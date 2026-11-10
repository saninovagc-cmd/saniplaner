'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { WeeklyActivity, WeeklyActivityStatus, MilestoneType, WeeklyActivityPhoto } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';
import {
  FISCAL_YEAR,
  FISCAL_WEEKS_LIST,
  FISCAL_QUARTERS,
  FISCAL_MONTHS,
  CURRENT_FISCAL_WEEK_NUM,
  getCurrentFiscalWeekNum,
  getFiscalWeek,
  formatFiscalWeekShort,
  matchesFiscalWeek,
  weekMatchesMonth,
  getMonthLabel,
  FiscalWeek,
} from '@/lib/fiscal-weeks';

// Helper pour compresser les photos sur canvas avant conversion en Base64
const compressImageFile = (file: File, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

// Helper pour lire un document (PDF, Word, Excel) en DataURL avec nom et taille
const readFileAsDataUrl = (file: File): Promise<{ dataUrl: string; sizeKb: number; name: string }> => {
  return new Promise((resolve, reject) => {
    const sizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUrl: reader.result as string,
        sizeKb,
        name: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const WORK_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'] as const;

const STATUS_CONFIG: Record<WeeklyActivityStatus, { label: string; badgeClass: string; textClass: string }> = {
  A_VENIR: { label: 'Planifié', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', textClass: 'text-slate-700' },
  EN_COURS: { label: 'En cours', badgeClass: 'bg-blue-50 text-blue-800 border-blue-200', textClass: 'text-blue-800' },
  REALISE: { label: 'Réalisé', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300', textClass: 'text-emerald-800' },
  TERMINEE: { label: 'Réalisé', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300', textClass: 'text-emerald-800' },
  NON_REALISE: { label: 'Non Réalisé', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200', textClass: 'text-rose-800' },
  REPORTE: { label: 'Reporté', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', textClass: 'text-amber-800' },
  REPORTEE: { label: 'Reporté', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', textClass: 'text-amber-800' },
  ANNULE: { label: 'Annulé', badgeClass: 'bg-slate-200 text-slate-800 border-slate-300', textClass: 'text-slate-800' },
  BLOQUEE: { label: 'Bloqué', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300', textClass: 'text-rose-900' },
};

interface MultiPlanItem {
  id: string;
  days: string[];
  day_of_week: string;
  title: string;
  milestone: MilestoneType;
  location: string;
  expected_output: string;
  work_plan_code?: string;
  status: WeeklyActivityStatus;
  progress_pct: number;
  execution_notes?: string;
}

interface ActivityFormItem {
  id: string;
  title: string;
  days: string[];
  milestone: MilestoneType;
  work_plan_code?: string;
  location: string;
  expected_output: string;
  collaborators_ids: string[];
  external_participants: string[];
  externalInput?: string;
  status: WeeklyActivityStatus;
  progress_pct: number;
  execution_notes: string;
  showDetails?: boolean;
}

const createDefaultActivityItem = (index: number = 1): ActivityFormItem => ({
  id: `item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
  title: '',
  days: [],
  milestone: 'B09',
  work_plan_code: '',
  location: '',
  expected_output: '',
  collaborators_ids: [],
  external_participants: [],
  externalInput: '',
  status: 'EN_COURS',
  progress_pct: 0,
  execution_notes: '',
  showDetails: false,
});

// Helper to format days label
function formatDaysLabel(days: string[]): string {
  if (!days || days.length === 0) return 'Lundi';
  if (days.length === WORK_DAYS.length && WORK_DAYS.every(d => days.includes(d))) {
    return 'Toute la semaine';
  }
  return WORK_DAYS.filter(d => days.includes(d)).join(', ');
}

export default function PlanningHebdoPage() {
  const { 
    weeklyActivities, 
    weeklySubmissions,
    activities,
    addWeeklyActivity, 
    updateWeeklyActivity, 
    deleteWeeklyActivity, 
    saveBatchWeeklyActivities,
    submitWeeklyPlanning,
    toggleWeeklySubmission,
    users, 
    currentUser,
  } = useApp();

  const [selectedWeek, setSelectedWeek] = useState<number | 'ALL'>('ALL');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View Modal state (C'EST QUAND ON FAIT VOIR QU'ON PEUT VOIR LE CONTENU)
  const [viewingActivityId, setViewingActivityId] = useState<string | null>(null);

  // Edit / Form Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<WeeklyActivity | null>(null);
  const [activityForm, setActivityForm] = useState<Partial<WeeklyActivity>>({});
  const [selectedDays, setSelectedDays] = useState<string[]>(['Lundi']);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [externalParticipants, setExternalParticipants] = useState<string[]>([]);
  const [externalInput, setExternalInput] = useState<string>('');
  const [newActivitiesList, setNewActivitiesList] = useState<ActivityFormItem[]>([
    createDefaultActivityItem(1),
  ]);
  const [formBatchError, setFormBatchError] = useState<string>('');

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    activity: WeeklyActivity | null;
  }>({
    open: false,
    activity: null,
  });

  // Modal Actualiser l'état de l'activité (En cours, Réalisé, Planifié + Livrables: Notes, Rapport, Photos)
  const [actualiserModalOpen, setActualiserModalOpen] = useState(false);
  const [actualiserActivity, setActualiserActivity] = useState<WeeklyActivity | null>(null);
  const [actualiserStatus, setActualiserStatus] = useState<WeeklyActivityStatus>('EN_COURS');
  const [actualiserProgress, setActualiserProgress] = useState<number>(50);
  const [actualiserNotes, setActualiserNotes] = useState<string>('');
  const [actualiserReportName, setActualiserReportName] = useState<string>('');
  const [actualiserReportFile, setActualiserReportFile] = useState<string>('');
  const [actualiserReportSizeKb, setActualiserReportSizeKb] = useState<number>(0);
  const [actualiserPhotos, setActualiserPhotos] = useState<WeeklyActivityPhoto[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [actualiserSuccessMsg, setActualiserSuccessMsg] = useState<string>('');
  const [photoPreviewModal, setPhotoPreviewModal] = useState<string | null>(null);

  // Batch entry modal state
  const [multiPlanModalOpen, setMultiPlanModalOpen] = useState(false);
  const [multiPlanStep, setMultiPlanStep] = useState<'entry' | 'preview'>('entry');
  const [multiPlanExpertId, setMultiPlanExpertId] = useState<string>(currentUser.id);
  const [multiPlanItems, setMultiPlanItems] = useState<MultiPlanItem[]>([]);
  const [formValidationMsg, setFormValidationMsg] = useState<string>('');

  // ====================================================
  // SOUS-MENU PRINCIPAL & RAPPORT DE SUIVI DES SOUS-ACTIVITES DU WORK PLAN
  // ====================================================
  const [activeMainTab, setActiveMainTab] = useState<'planning' | 'suivi_workplan'>('planning');

  // Filtres multidimensionnels du Rapport de Suivi Work Plan
  const [reportMilestone, setReportMilestone] = useState<string>('ALL');
  const [reportWorkPlanCode, setReportWorkPlanCode] = useState<string>('ALL');
  const [reportExpertId, setReportExpertId] = useState<string>('ALL');
  const [reportStatus, setReportStatus] = useState<string>('ALL');
  const [reportDateMode, setReportDateMode] = useState<'ALL' | 'WEEK' | 'MONTH' | 'DAY'>('ALL');
  const [reportSelectedWeek, setReportSelectedWeek] = useState<number | 'ALL'>('ALL');
  const [reportSelectedMonth, setReportSelectedMonth] = useState<string>('ALL');
  const [reportSelectedDay, setReportSelectedDay] = useState<string>('ALL');
  const [reportExactDate, setReportExactDate] = useState<string>('');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Synchronisation avec l'URL (?tab=suivi ou ?tab=rapport)
  useEffect(() => {
    const syncTabFromUrl = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'suivi' || tabParam === 'rapport' || tabParam === 'workplan') {
          setActiveMainTab('suivi_workplan');
        } else if (tabParam === 'planning') {
          setActiveMainTab('planning');
        }
      }
    };

    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  const handleSwitchMainTab = (tab: 'planning' | 'suivi_workplan') => {
    setActiveMainTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'suivi_workplan') {
        url.searchParams.set('tab', 'suivi');
      } else {
        url.searchParams.delete('tab');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Sous-activités filtrées pour le Rapport de Suivi Work Plan
  const filteredReportSubActivities = useMemo(() => {
    return weeklyActivities.filter(act => {
      // 1. Filtrer par Date / Échelle temporelle
      if (reportDateMode === 'WEEK' && reportSelectedWeek !== 'ALL') {
        if (!matchesFiscalWeek(act.week_number, reportSelectedWeek)) return false;
      } else if (reportDateMode === 'MONTH' && reportSelectedMonth !== 'ALL') {
        const actWeek = getFiscalWeek(act.week_number);
        if (!weekMatchesMonth(actWeek, reportSelectedMonth)) return false;
      } else if (reportDateMode === 'DAY') {
        if (reportSelectedDay !== 'ALL') {
          const actDays = act.days || (act.day_of_week === 'Toute la semaine' ? [...WORK_DAYS] : act.day_of_week.split(',').map(s => s.trim()));
          const matchDay = actDays.includes(reportSelectedDay) || act.day_of_week === 'Toute la semaine' || act.day_of_week.includes(reportSelectedDay);
          if (!matchDay) return false;
        }
        if (reportExactDate) {
          if (act.start_date && act.end_date) {
            if (reportExactDate < act.start_date || reportExactDate > act.end_date) return false;
          }
        }
      }

      // 2. Filtrer par Personnel (Responsable ou Collaborateur)
      if (reportExpertId !== 'ALL') {
        const isLead = act.expert_id === reportExpertId;
        const isCollab = act.collaborators_ids && act.collaborators_ids.includes(reportExpertId);
        if (!isLead && !isCollab) return false;
      }

      // 3. Filtrer par Jalon du Work Plan
      if (reportMilestone !== 'ALL') {
        if (act.milestone !== reportMilestone) return false;
      }

      // 4. Filtrer par Grande Activité du Work Plan
      if (reportWorkPlanCode !== 'ALL') {
        if (reportWorkPlanCode === 'UNLINKED') {
          if (act.work_plan_code && act.work_plan_code.trim()) return false;
        } else {
          if (act.work_plan_code !== reportWorkPlanCode) return false;
        }
      }

      // 5. Filtrer par Statut
      if (reportStatus !== 'ALL') {
        if (reportStatus === 'REALISE') {
          if (act.status !== 'REALISE' && act.status !== 'TERMINEE') return false;
        } else if (reportStatus === 'REPORTE') {
          if (act.status !== 'REPORTE' && act.status !== 'REPORTEE') return false;
        } else {
          if (act.status !== reportStatus) return false;
        }
      }

      // 6. Recherche textuelle libre
      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.toLowerCase();
        const parentAct = activities.find(a => a.code === act.work_plan_code);
        const matchTitle = act.title.toLowerCase().includes(q);
        const matchCode = (act.work_plan_code || '').toLowerCase().includes(q);
        const matchParentTitle = (parentAct?.title || '').toLowerCase().includes(q);
        const matchLoc = (act.location || '').toLowerCase().includes(q);
        const matchNotes = (act.execution_notes || '').toLowerCase().includes(q);
        const expert = users.find(u => u.id === act.expert_id);
        const matchExpert = (expert?.full_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchParentTitle && !matchLoc && !matchNotes && !matchExpert) return false;
      }

      return true;
    });
  }, [
    weeklyActivities,
    reportDateMode,
    reportSelectedWeek,
    reportSelectedMonth,
    reportSelectedDay,
    reportExactDate,
    reportExpertId,
    reportMilestone,
    reportWorkPlanCode,
    reportStatus,
    reportSearchQuery,
    activities,
    users,
  ]);

  // Groupement des sous-activités par Grande Activité du Work Plan
  const reportGroupedByWorkPlan = useMemo(() => {
    const groups: Record<string, WeeklyActivity[]> = {};

    filteredReportSubActivities.forEach(act => {
      const code = act.work_plan_code && act.work_plan_code.trim() ? act.work_plan_code : 'NON_RATTACHE';
      if (!groups[code]) groups[code] = [];
      groups[code].push(act);
    });

    const result = Object.entries(groups).map(([code, subActs]) => {
      const parent = activities.find(a => a.code === code);
      const completedCount = subActs.filter(a => a.status === 'REALISE' || a.status === 'TERMINEE').length;
      const inProgressCount = subActs.filter(a => a.status === 'EN_COURS').length;
      const plannedCount = subActs.filter(a => a.status === 'A_VENIR').length;
      const avgProgress = subActs.length > 0
        ? Math.round(subActs.reduce((acc, a) => acc + (a.progress_pct || 0), 0) / subActs.length)
        : 0;

      return {
        code,
        parent,
        title: parent ? parent.title : 'Sous-activités ponctuelles ou transversales (hors code officiel)',
        milestone: parent ? parent.milestone : (subActs[0]?.milestone || 'TRANSVERSAL'),
        lead_domain: parent?.domain,
        subActivities: subActs,
        totalCount: subActs.length,
        completedCount,
        inProgressCount,
        plannedCount,
        avgProgress,
      };
    });

    result.sort((a, b) => {
      if (a.code === 'NON_RATTACHE') return 1;
      if (b.code === 'NON_RATTACHE') return -1;
      return a.code.localeCompare(b.code);
    });

    return result;
  }, [filteredReportSubActivities, activities]);

  // Métriques KPI du Rapport de Suivi
  const reportMetrics = useMemo(() => {
    const total = filteredReportSubActivities.length;
    const completed = filteredReportSubActivities.filter(a => a.status === 'REALISE' || a.status === 'TERMINEE').length;
    const inProgress = filteredReportSubActivities.filter(a => a.status === 'EN_COURS').length;
    const planned = filteredReportSubActivities.filter(a => a.status === 'A_VENIR').length;
    const withReport = filteredReportSubActivities.filter(a => Boolean(a.report_file)).length;
    const withPhotos = filteredReportSubActivities.filter(a => a.photos && a.photos.length > 0).length;
    const workPlanCodesCovered = new Set(filteredReportSubActivities.map(a => a.work_plan_code).filter(Boolean)).size;
    const avgProgress = total > 0 ? Math.round(filteredReportSubActivities.reduce((acc, a) => acc + (a.progress_pct || 0), 0) / total) : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      planned,
      withReport,
      withPhotos,
      workPlanCodesCovered,
      avgProgress,
      completionRate,
    };
  }, [filteredReportSubActivities]);

  const handleResetReportFilters = () => {
    setReportMilestone('ALL');
    setReportWorkPlanCode('ALL');
    setReportExpertId('ALL');
    setReportStatus('ALL');
    setReportDateMode('ALL');
    setReportSelectedWeek('ALL');
    setReportSelectedMonth('ALL');
    setReportSelectedDay('ALL');
    setReportExactDate('');
    setReportSearchQuery('');
  };

  const handleExportWorkPlanReportExcel = () => {
    if (filteredReportSubActivities.length === 0) {
      alert("Aucune sous-activité à exporter avec les critères actuels.");
      return;
    }

    const data = filteredReportSubActivities.map(act => {
      const parent = activities.find(a => a.code === act.work_plan_code);
      const expert = users.find(u => u.id === act.expert_id);
      const week = getFiscalWeek(act.week_number);
      const collabs = (act.collaborators_ids || [])
        .map(id => users.find(u => u.id === id)?.full_name)
        .filter(Boolean)
        .join(', ');

      return {
        'Code Work Plan': act.work_plan_code || 'Non rattaché',
        'Grande Activité Work Plan': parent ? parent.title : 'Sous-activité hors Work Plan',
        'Jalon Work Plan': act.milestone,
        'Intitulé de la sous-activité menée': act.title,
        'Semaine Fiscale': `Semaine ${String(act.week_number).padStart(2, '0')}`,
        'Dates Période': `${week.start} au ${week.end}`,
        'Jours d’exécution': act.day_of_week,
        'Responsable': expert ? expert.full_name : act.expert_id,
        'Collaborateurs': collabs || 'Aucun',
        'Lieu d’exécution': act.location,
        'Résultat attendu / Objectif': act.expected_output || '',
        'Statut': STATUS_CONFIG[act.status]?.label || act.status,
        'Avancement (%)': `${act.progress_pct}%`,
        'Rapport joint': act.report_name ? `Oui (${act.report_name})` : 'Non',
        'Photos jointes': act.photos && act.photos.length > 0 ? `${act.photos.length} photo(s)` : '0',
        'Notes et Observations': act.execution_notes || '',
      };
    });

    exportToExcel(data, `SANINOVA_Suivi_SousActivites_WorkPlan_${Date.now()}`);
  };

  const handleExportWorkPlanReportPdf = () => {
    if (filteredReportSubActivities.length === 0) {
      alert("Aucune sous-activité à exporter avec les critères actuels.");
      return;
    }

    const headers = [
      'Code & Jalon',
      'Grande Activité Work Plan',
      'Sous-activité menée',
      'Sem.',
      'Responsable',
      'Statut',
      'Avanc.',
      'Livrables',
    ];

    const rows = filteredReportSubActivities.map(act => {
      const parent = activities.find(a => a.code === act.work_plan_code);
      const expert = users.find(u => u.id === act.expert_id);
      const hasDoc = act.report_file ? 'Doc' : '';
      const photosCount = act.photos && act.photos.length > 0 ? `${act.photos.length} Ph.` : '';
      const livrables = [hasDoc, photosCount].filter(Boolean).join(' + ') || '-';

      return [
        `${act.work_plan_code || 'HORS WP'}\n[${act.milestone}]`,
        parent ? (parent.title.length > 32 ? parent.title.substring(0, 32) + '...' : parent.title) : 'Hors Work Plan',
        act.title.length > 35 ? act.title.substring(0, 35) + '...' : act.title,
        `S${String(act.week_number).padStart(2, '0')}`,
        expert ? expert.full_name.split(' ')[0] + ' ' + (expert.full_name.split(' ')[1] || '') : act.expert_id,
        STATUS_CONFIG[act.status]?.label || act.status,
        `${act.progress_pct}%`,
        livrables,
      ];
    });

    const subtitle = `Rapport Analytique de Suivi des Sous-Activités par Activité du Work Plan • ${filteredReportSubActivities.length} sous-activité(s) répertoriée(s)`;

    exportTableToPdf(
      'Suivi des Sous-Activités par Activité du Work Plan',
      headers,
      rows,
      `SANINOVA_Suivi_SousActivites_WorkPlan`,
      subtitle
    );
  };

  const activeWeekNum = typeof selectedWeek === 'number' ? selectedWeek : getCurrentFiscalWeekNum();
  const currentWeekInfo = getFiscalWeek(activeWeekNum);

  // Semaines affichées selon le trimestre et le mois sélectionnés
  const displayedWeeks = useMemo(() => {
    return FISCAL_WEEKS_LIST.filter(w => {
      const matchQ = selectedQuarter === 'ALL' || w.quarter === selectedQuarter;
      const matchM = selectedMonth === 'ALL' || weekMatchesMonth(w, selectedMonth);
      return matchQ && matchM;
    });
  }, [selectedQuarter, selectedMonth]);

  // Derived viewing activity for the modal
  const viewingActivity = useMemo(() => {
    if (!viewingActivityId) return null;
    return weeklyActivities.find(a => a.id === viewingActivityId) || null;
  }, [weeklyActivities, viewingActivityId]);

  // Check if current user can edit/delete activity
  const canEditActivity = (act: WeeklyActivity | null) => {
    if (!act) return false;
    if (currentUser.role === 'direction') return true;
    return act.expert_id === currentUser.id;
  };

  // Filtered activities across all dimensions: personnel, all staff, week, month, day, milestone, status, search
  const filteredActivities = useMemo(() => {
    return weeklyActivities.filter(act => {
      // 1. Filtrer par Semaine
      if (selectedWeek !== 'ALL') {
        if (!matchesFiscalWeek(act.week_number, selectedWeek)) return false;
      }

      const actWeek = getFiscalWeek(act.week_number);

      // 2. Filtrer par Trimestre (si semaine sur ALL)
      if (selectedWeek === 'ALL' && selectedQuarter !== 'ALL') {
        if (actWeek.quarter !== selectedQuarter) return false;
      }

      // 3. Filtrer par Mois
      if (selectedMonth !== 'ALL') {
        if (!weekMatchesMonth(actWeek, selectedMonth)) return false;
      }

      // 4. Filtrer par Personnel (Tout le staff ou un membre précis ou collaborateur)
      if (selectedExpert !== 'ALL') {
        const isLead = act.expert_id === selectedExpert;
        const isCollab = act.collaborators_ids && act.collaborators_ids.includes(selectedExpert);
        if (!isLead && !isCollab) return false;
      }

      // 5. Filtrer par Jour d'exécution
      if (selectedDay !== 'ALL') {
        const actDays = act.days || (act.day_of_week === 'Toute la semaine' ? [...WORK_DAYS] : act.day_of_week.split(',').map(s => s.trim()));
        const matchDay = actDays.includes(selectedDay) || act.day_of_week === 'Toute la semaine' || act.day_of_week.includes(selectedDay);
        if (!matchDay) return false;
      }

      // 6. Filtrer par Jalon
      if (selectedMilestone !== 'ALL') {
        if (act.milestone !== selectedMilestone) return false;
      }

      // 7. Filtrer par Statut
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'REALISE') {
          if (act.status !== 'REALISE' && act.status !== 'TERMINEE') return false;
        } else if (selectedStatus === 'REPORTE') {
          if (act.status !== 'REPORTE' && act.status !== 'REPORTEE') return false;
        } else {
          if (act.status !== selectedStatus) return false;
        }
      }

      // 8. Recherche textuelle globale
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const expert = users.find(u => u.id === act.expert_id);
        const matchTitle = act.title.toLowerCase().includes(q);
        const matchLoc = act.location.toLowerCase().includes(q);
        const matchOutput = act.expected_output.toLowerCase().includes(q);
        const matchNotes = (act.execution_notes || '').toLowerCase().includes(q);
        const matchExpert = expert ? expert.full_name.toLowerCase().includes(q) : false;
        const matchExternal = (act.external_participants || []).some(ext => ext.toLowerCase().includes(q));

        if (!matchTitle && !matchLoc && !matchOutput && !matchNotes && !matchExpert && !matchExternal) {
          return false;
        }
      }

      return true;
    });
  }, [weeklyActivities, selectedWeek, selectedQuarter, selectedMonth, selectedExpert, selectedDay, selectedMilestone, selectedStatus, searchQuery, users]);

  // Submission statuses for the active week
  const teamSubmissions = useMemo(() => {
    return users.map(user => {
      const sub = weeklySubmissions.find(s => s.expert_id === user.id && matchesFiscalWeek(s.week_number, activeWeekNum));
      const isSubmitted = sub ? sub.is_submitted : false;
      const submissionDate = sub?.submission_date;
      const userActsCount = weeklyActivities.filter(a => a.expert_id === user.id && matchesFiscalWeek(a.week_number, activeWeekNum)).length;
      return {
        user,
        isSubmitted,
        submissionDate,
        userActsCount,
      };
    });
  }, [users, weeklySubmissions, activeWeekNum, weeklyActivities]);

  const submittedCount = teamSubmissions.filter(s => s.isSubmitted).length;
  const isCurrentUserSubmitted = teamSubmissions.find(s => s.user.id === currentUser.id)?.isSubmitted || false;

  // Activity stats dynamiques basées sur la sélection active
  const totalCount = filteredActivities.length;
  const realisedCount = filteredActivities.filter(a => a.status === 'REALISE' || a.status === 'TERMINEE').length;
  const inProgressCount = filteredActivities.filter(a => a.status === 'EN_COURS').length;
  const delayedOrReportedCount = filteredActivities.filter(a => a.status === 'REPORTE' || a.status === 'REPORTEE' || a.status === 'NON_REALISE').length;
  const avgExecution = totalCount > 0
    ? Math.round(filteredActivities.reduce((s, a) => s + a.progress_pct, 0) / totalCount)
    : 0;

  // ----------------------------------------------------
  // EXPORT HANDLERS (EXCEL & PDF AVEC TOUS LES CHAMPS DÉTAILLÉS)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    if (filteredActivities.length === 0) {
      alert("Aucune activité à exporter pour les critères sélectionnés.");
      return;
    }

    const data = filteredActivities.map(a => {
      const expert = users.find(u => u.id === a.expert_id);
      const weekInfo = getFiscalWeek(a.week_number);
      const internalCollabs = a.collaborators_ids && a.collaborators_ids.length > 0
        ? a.collaborators_ids.map(id => users.find(u => u.id === id)?.full_name).filter(Boolean).join(', ')
        : 'Aucun';
      const externalCollabs = a.external_participants && a.external_participants.length > 0
        ? a.external_participants.join(', ')
        : 'Aucun';

      return {
        'Période': `Semaine ${String(weekInfo.num).padStart(2, '0')} (${weekInfo.start} au ${weekInfo.end})`,
        'Mois': getMonthLabel(weekInfo.start.substring(0, 7)),
        'Trimestre': weekInfo.quarter,
        'Responsable': expert ? `${expert.full_name} (${expert.title})` : 'Non assigné',
        'Intitulé de l’activité': a.title,
        'Jours d’exécution': a.day_of_week,
        'Jalon': a.milestone,
        'Lieu d’exécution': a.location,
        'Résultat Attendu / Livrable': a.expected_output || 'Non renseigné',
        'Personnes internes à impliquer': internalCollabs,
        'Personnes externes à impliquer': externalCollabs,
        'Avancement (%)': `${a.progress_pct}%`,
        'Statut d’exécution': STATUS_CONFIG[a.status]?.label || a.status,
        'Notes & Observations': a.execution_notes || '',
      };
    });

    const fileSuffix = selectedWeek !== 'ALL'
      ? `Semaine_${selectedWeek}`
      : selectedMonth !== 'ALL'
        ? `Mois_${selectedMonth}`
        : 'FY27_Global';
    exportToExcel(data, `SANINOVA_Planning_Hebdo_${fileSuffix}`);
  };

  const handleExportPdf = () => {
    if (filteredActivities.length === 0) {
      alert("Aucune activité à exporter pour les critères sélectionnés.");
      return;
    }

    const headers = [
      'Période',
      'Responsable',
      'Intitulé de l’activité',
      'Jours',
      'Jalon',
      'Lieu d’exécution',
      'Résultat Attendu',
      'Avance.',
      'Statut',
    ];

    const rows = filteredActivities.map(a => {
      const expert = users.find(u => u.id === a.expert_id);
      const weekInfo = getFiscalWeek(a.week_number);
      return [
        `S${String(weekInfo.num).padStart(2, '0')}\n(${weekInfo.start.substring(5)})`,
        expert ? expert.full_name.split(' ')[0] + ' ' + (expert.full_name.split(' ')[1] || '') : 'Non assigné',
        a.title.length > 40 ? a.title.substring(0, 40) + '...' : a.title,
        a.day_of_week === 'Toute la semaine' ? 'Toute la sem. (5j)' : a.day_of_week.substring(0, 16),
        a.milestone,
        a.location.length > 18 ? a.location.substring(0, 18) + '...' : a.location,
        a.expected_output ? (a.expected_output.length > 25 ? a.expected_output.substring(0, 25) + '...' : a.expected_output) : '-',
        `${a.progress_pct}%`,
        STATUS_CONFIG[a.status]?.label || a.status,
      ];
    });

    const staffLabel = selectedExpert === 'ALL' ? 'Tout le staff' : (users.find(u => u.id === selectedExpert)?.full_name || 'Staff');
    const periodLabel = selectedWeek !== 'ALL' ? `Semaine ${selectedWeek}` : 'Toutes les semaines';
    const monthLabel = getMonthLabel(selectedMonth);

    const subtitle = `Filtres : Staff : ${staffLabel} • Période : ${periodLabel} • Mois : ${monthLabel} • ${filteredActivities.length} activité(s) exportée(s)`;

    exportTableToPdf(
      'Planning Hebdomadaire des Activités (FY2026-2027)',
      headers,
      rows,
      `SANINOVA_Planning_Hebdo_${selectedWeek !== 'ALL' ? `S${selectedWeek}` : 'Export'}`,
      subtitle
    );
  };

  const handleResetFilters = () => {
    setSelectedWeek('ALL');
    setSelectedQuarter('ALL');
    setSelectedMonth('ALL');
    setSelectedExpert('ALL');
    setSelectedDay('ALL');
    setSelectedMilestone('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  // ----------------------------------------------------
  // SINGLE / MULTI ACTIVITY (CREATE / EDIT)
  // ----------------------------------------------------
  const handleOpenCreateActivity = () => {
    setEditingActivity(null);
    setSelectedDays([]);
    setSelectedCollaboratorIds([]);
    setExternalParticipants([]);
    setExternalInput('');
    setNewActivitiesList([createDefaultActivityItem(1)]);
    setFormBatchError('');
    setEditModalOpen(true);
  };

  const handleAddAnotherActivity = () => {
    setNewActivitiesList(prev => [
      ...prev,
      createDefaultActivityItem(prev.length + 1),
    ]);
    setFormBatchError('');
  };

  const handleRemoveActivityCard = (index: number) => {
    setNewActivitiesList(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpdateActivityCard = <K extends keyof ActivityFormItem>(
    index: number,
    field: K,
    value: ActivityFormItem[K]
  ) => {
    setNewActivitiesList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleToggleCardDay = (index: number, day: string) => {
    setNewActivitiesList(prev => {
      const updated = [...prev];
      const curDays = updated[index].days || ['Lundi'];
      let newDays: string[];
      if (curDays.includes(day)) {
        if (curDays.length === 1) return prev;
        newDays = curDays.filter(d => d !== day);
      } else {
        newDays = [...curDays, day];
      }
      updated[index] = { ...updated[index], days: newDays };
      return updated;
    });
  };

  const handleSelectAllCardDays = (index: number) => {
    setNewActivitiesList(prev => {
      const updated = [...prev];
      const curDays = updated[index].days || [];
      const newDays = curDays.length === WORK_DAYS.length ? ['Lundi'] : [...WORK_DAYS];
      updated[index] = { ...updated[index], days: newDays };
      return updated;
    });
  };

  const handleToggleCardCollaborator = (index: number, userId: string) => {
    setNewActivitiesList(prev => {
      const updated = [...prev];
      const curCollabs = updated[index].collaborators_ids || [];
      const newCollabs = curCollabs.includes(userId)
        ? curCollabs.filter(id => id !== userId)
        : [...curCollabs, userId];
      updated[index] = { ...updated[index], collaborators_ids: newCollabs };
      return updated;
    });
  };

  const handleAddCardExternal = (index: number) => {
    const card = newActivitiesList[index];
    const input = (card.externalInput || '').trim();
    if (!input) return;
    setNewActivitiesList(prev => {
      const updated = [...prev];
      const currentExt = updated[index].external_participants || [];
      if (!currentExt.includes(input)) {
        updated[index] = {
          ...updated[index],
          external_participants: [...currentExt, input],
          externalInput: '',
        };
      } else {
        updated[index] = { ...updated[index], externalInput: '' };
      }
      return updated;
    });
  };

  const handleRemoveCardExternal = (cardIndex: number, extIndex: number) => {
    setNewActivitiesList(prev => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        external_participants: (updated[cardIndex].external_participants || []).filter((_, i) => i !== extIndex),
      };
      return updated;
    });
  };

  // --- ACTUALISER L'ETAT ET RENSEIGNER LES LIVRABLES DE L'ACTIVITE ---
  const handleOpenActualiserModal = (act: WeeklyActivity) => {
    setActualiserActivity(act);
    const initialStatus = act.status === 'REALISE' || act.status === 'TERMINEE'
      ? 'REALISE'
      : act.status === 'A_VENIR'
        ? 'A_VENIR'
        : 'EN_COURS';
    setActualiserStatus(initialStatus);
    setActualiserProgress(
      act.progress_pct !== undefined
        ? act.progress_pct
        : initialStatus === 'REALISE' ? 100 : initialStatus === 'A_VENIR' ? 0 : 50
    );
    setActualiserNotes(act.execution_notes || '');
    setActualiserReportName(act.report_name || '');
    setActualiserReportFile(act.report_file || '');
    setActualiserReportSizeKb(act.report_size_kb || 0);
    setActualiserPhotos(act.photos ? [...act.photos] : []);
    setActualiserSuccessMsg('');
    setActualiserModalOpen(true);
  };

  const handleReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    try {
      const res = await readFileAsDataUrl(file);
      setActualiserReportFile(res.dataUrl);
      setActualiserReportName(res.name);
      setActualiserReportSizeKb(res.sizeKb);
    } catch (err) {
      console.error('Erreur lecture rapport:', err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveReport = () => {
    setActualiserReportFile('');
    setActualiserReportName('');
    setActualiserReportSizeKb(0);
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingPhoto(true);
    try {
      const newPhotos: WeeklyActivityPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImageFile(file, 1024, 0.7);
        newPhotos.push({
          id: `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          url: compressedBase64,
          filename: file.name,
          captured_at: new Date().toISOString().substring(0, 10),
          caption: '',
        });
      }
      setActualiserPhotos(prev => [...prev, ...newPhotos]);
    } catch (err) {
      console.error('Erreur chargement photos:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setActualiserPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleUpdatePhotoCaption = (photoId: string, caption: string) => {
    setActualiserPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p));
  };

  const handleSaveActualisation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualiserActivity) return;

    const finalProgress = actualiserStatus === 'REALISE'
      ? 100
      : actualiserStatus === 'A_VENIR'
        ? 0
        : actualiserProgress;

    const updated: WeeklyActivity = {
      ...actualiserActivity,
      status: actualiserStatus,
      progress_pct: finalProgress,
      execution_notes: actualiserNotes.trim(),
      report_name: actualiserStatus === 'REALISE' ? actualiserReportName : (actualiserReportName || actualiserActivity.report_name),
      report_file: actualiserStatus === 'REALISE' ? actualiserReportFile : (actualiserReportFile || actualiserActivity.report_file),
      report_size_kb: actualiserStatus === 'REALISE' ? actualiserReportSizeKb : (actualiserReportSizeKb || actualiserActivity.report_size_kb),
      photos: actualiserStatus === 'REALISE' ? actualiserPhotos : (actualiserPhotos.length > 0 ? actualiserPhotos : actualiserActivity.photos),
    };

    updateWeeklyActivity(updated);
    setActualiserSuccessMsg('État et livrables de l’activité enregistrés avec succès !');
    setTimeout(() => {
      setActualiserModalOpen(false);
      setActualiserSuccessMsg('');
    }, 700);
  };

  const handleOpenEditActivity = (act: WeeklyActivity) => {
    setEditingActivity(act);
    const initialDays = act.days && act.days.length > 0
      ? act.days
      : act.day_of_week === 'Toute la semaine'
        ? [...WORK_DAYS]
        : act.day_of_week.split(',').map(s => s.trim()).filter(Boolean);
    setSelectedDays(initialDays.length > 0 ? initialDays : ['Lundi']);
    setSelectedCollaboratorIds(act.collaborators_ids || []);
    setExternalParticipants(act.external_participants || []);
    setExternalInput('');

    setActivityForm({
      expert_id: act.expert_id,
      week_number: act.week_number,
      week_label: act.week_label,
      start_date: act.start_date,
      end_date: act.end_date,
      day_of_week: act.day_of_week,
      days: initialDays,
      milestone: act.milestone,
      work_plan_code: act.work_plan_code || '',
      title: act.title,
      location: act.location,
      expected_output: act.expected_output,
      status: act.status,
      progress_pct: act.progress_pct,
      execution_notes: act.execution_notes || '',
    });
    setEditModalOpen(true);
  };

  const handleToggleCollaborator = (userId: string) => {
    setSelectedCollaboratorIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddExternalParticipant = () => {
    if (!externalInput.trim()) return;
    if (!externalParticipants.includes(externalInput.trim())) {
      setExternalParticipants(prev => [...prev, externalInput.trim()]);
    }
    setExternalInput('');
  };

  const handleRemoveExternalParticipant = (index: number) => {
    setExternalParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleDay = (day: string) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Do not allow 0 days
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const handleSelectAllDays = () => {
    if (selectedDays.length === WORK_DAYS.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...WORK_DAYS]);
    }
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingActivity) {
      if (!activityForm.title) return;
      const orderedDays = WORK_DAYS.filter(d => selectedDays.includes(d));
      const dayLabel = formatDaysLabel(orderedDays);
      const updated: WeeklyActivity = {
        ...editingActivity,
        expert_id: editingActivity.expert_id || currentUser.id,
        day_of_week: dayLabel,
        days: orderedDays,
        milestone: activityForm.milestone || editingActivity.milestone,
        work_plan_code: activityForm.work_plan_code !== undefined ? activityForm.work_plan_code : editingActivity.work_plan_code,
        title: activityForm.title,
        location: activityForm.location || editingActivity.location,
        expected_output: activityForm.expected_output || editingActivity.expected_output,
        status: (activityForm.status as WeeklyActivityStatus) || editingActivity.status,
        progress_pct: activityForm.progress_pct !== undefined ? activityForm.progress_pct : editingActivity.progress_pct,
        execution_notes: activityForm.execution_notes || '',
        collaborators_ids: selectedCollaboratorIds,
        external_participants: externalParticipants,
      };
      updateWeeklyActivity(updated);
      setEditModalOpen(false);
      return;
    }

    // Validation multi-activités
    const emptyIndex = newActivitiesList.findIndex(a => !a.title || !a.title.trim());
    if (emptyIndex !== -1) {
      setFormBatchError(`Veuillez saisir l'intitulé pour l'Activité #${emptyIndex + 1} ou la retirer.`);
      return;
    }
    setFormBatchError('');

    const newActs: WeeklyActivity[] = newActivitiesList.map((item, idx) => {
      const orderedDays = WORK_DAYS.filter(d => (item.days && item.days.length > 0 ? item.days : ['Lundi']).includes(d));
      const dayLabel = formatDaysLabel(orderedDays);
      return {
        id: `act-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        expert_id: currentUser.id,
        week_number: activeWeekNum,
        week_label: currentWeekInfo.label,
        start_date: currentWeekInfo.start,
        end_date: currentWeekInfo.end,
        day_of_week: dayLabel,
        days: orderedDays,
        title: item.title.trim(),
        milestone: item.milestone || 'B09',
        work_plan_code: item.work_plan_code || '',
        location: item.location.trim() || 'Cotonou / Siège Projet AFGHS',
        expected_output: item.expected_output.trim() || '',
        progress_pct: item.progress_pct || 0,
        status: (item.status as WeeklyActivityStatus) || 'EN_COURS',
        execution_notes: item.execution_notes.trim() || '',
        collaborators_ids: item.collaborators_ids || [],
        external_participants: item.external_participants || [],
        created_at: new Date().toISOString(),
      };
    });

    saveBatchWeeklyActivities(newActs);
    setEditModalOpen(false);
  };

  // ----------------------------------------------------
  // DELETE ACTIVITY
  // ----------------------------------------------------
  const handleOpenDeleteModal = (act: WeeklyActivity) => {
    setDeleteModal({
      open: true,
      activity: act,
    });
  };

  const handleConfirmDeleteActivity = () => {
    if (!deleteModal.activity) return;
    deleteWeeklyActivity(deleteModal.activity.id);
    if (viewingActivityId === deleteModal.activity.id) setViewingActivityId(null);
    setDeleteModal({ open: false, activity: null });
  };

  // ----------------------------------------------------
  // BATCH MULTI-PLAN MODAL (AJOUT PAR LOT)
  // ----------------------------------------------------
  const handleOpenMultiPlan = (expertId?: string) => {
    const targetExpert = expertId || (selectedExpert !== 'ALL' ? selectedExpert : currentUser.id);
    setMultiPlanExpertId(targetExpert);

    const existingActs = weeklyActivities.filter(
      a => a.expert_id === targetExpert && matchesFiscalWeek(a.week_number, activeWeekNum)
    );
    if (existingActs.length > 0) {
      setMultiPlanItems(existingActs.map(a => {
        const itemDays = a.days && a.days.length > 0
          ? a.days
          : a.day_of_week === 'Toute la semaine'
            ? [...WORK_DAYS]
            : a.day_of_week.split(',').map(s => s.trim()).filter(Boolean);
        return {
          id: a.id,
          days: itemDays.length > 0 ? itemDays : ['Lundi'],
          day_of_week: a.day_of_week,
          title: a.title,
          milestone: a.milestone,
          location: a.location,
          expected_output: a.expected_output,
          work_plan_code: a.work_plan_code,
          status: a.status,
          progress_pct: a.progress_pct,
          execution_notes: a.execution_notes,
        };
      }));
    } else {
      setMultiPlanItems([
        {
          id: `item-${Date.now()}-1`,
          days: ['Lundi'],
          day_of_week: 'Lundi',
          title: '',
          milestone: 'B09',
          location: 'Cotonou / Siège Projet AFGHS',
          expected_output: '',
          status: 'EN_COURS',
          progress_pct: 0,
          execution_notes: '',
        },
        {
          id: `item-${Date.now()}-2`,
          days: ['Mardi'],
          day_of_week: 'Mardi',
          title: '',
          milestone: 'B09',
          location: 'Cotonou / Siège Projet AFGHS',
          expected_output: '',
          status: 'EN_COURS',
          progress_pct: 0,
          execution_notes: '',
        },
      ]);
    }

    setMultiPlanStep('entry');
    setFormValidationMsg('');
    setMultiPlanModalOpen(true);
  };

  const handleAddActivityLine = () => {
    const nextDayIndex = Math.min(multiPlanItems.length, WORK_DAYS.length - 1);
    const dayName = WORK_DAYS[nextDayIndex] || 'Lundi';
    setMultiPlanItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        days: [dayName],
        day_of_week: dayName,
        title: '',
        milestone: 'B09',
        location: 'Cotonou / Siège Projet AFGHS',
        expected_output: '',
        status: 'EN_COURS',
        progress_pct: 0,
        execution_notes: '',
      }
    ]);
  };

  const handleRemoveActivityLine = (index: number) => {
    setMultiPlanItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleMultiItemDay = (index: number, day: string) => {
    setMultiPlanItems(prev => {
      const copy = [...prev];
      const currentDays = copy[index].days || ['Lundi'];
      let newDays: string[];
      if (currentDays.includes(day)) {
        if (currentDays.length === 1) return prev; // keep at least 1
        newDays = currentDays.filter(d => d !== day);
      } else {
        newDays = [...currentDays, day];
      }
      const ordered = WORK_DAYS.filter(d => newDays.includes(d));
      copy[index] = {
        ...copy[index],
        days: ordered,
        day_of_week: formatDaysLabel(ordered),
      };
      return copy;
    });
  };

  const handleSelectAllDaysForMultiItem = (index: number) => {
    setMultiPlanItems(prev => {
      const copy = [...prev];
      const currentDays = copy[index].days || [];
      const newDays = currentDays.length === WORK_DAYS.length ? ['Lundi'] : [...WORK_DAYS];
      copy[index] = {
        ...copy[index],
        days: newDays,
        day_of_week: formatDaysLabel(newDays),
      };
      return copy;
    });
  };

  const handleUpdateActivityLine = (index: number, field: keyof MultiPlanItem, value: any) => {
    setMultiPlanItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const emptyItem = multiPlanItems.find(i => !i.title.trim());
    if (emptyItem) {
      setFormValidationMsg('Veuillez renseigner un intitulé pour chacune des activités prévues.');
      return;
    }
    setFormValidationMsg('');
    setMultiPlanStep('preview');
  };

  const handleFinalSaveAndSubmit = () => {
    const expert = users.find(u => u.id === multiPlanExpertId);
    if (!expert) return;

    const formattedActivities: WeeklyActivity[] = multiPlanItems.map((item, idx) => {
      const orderedDays = WORK_DAYS.filter(d => (item.days || ['Lundi']).includes(d));
      const dayLabel = formatDaysLabel(orderedDays);
      return {
        id: item.id.startsWith('item-') ? `act-${Date.now()}-${idx}` : item.id,
        expert_id: expert.id,
        week_number: activeWeekNum,
        week_label: currentWeekInfo.label,
        start_date: currentWeekInfo.start,
        end_date: currentWeekInfo.end,
        day_of_week: dayLabel,
        days: orderedDays,
        title: item.title,
        milestone: item.milestone,
        location: item.location || 'Cotonou / Siège Projet AFGHS',
        expected_output: item.expected_output || '',
        progress_pct: item.progress_pct || 0,
        status: item.status,
        execution_notes: item.execution_notes || '',
        work_plan_code: item.work_plan_code,
        created_at: new Date().toISOString(),
      };
    });

    saveBatchWeeklyActivities(formattedActivities);
    submitWeeklyPlanning(expert.id, activeWeekNum);
    setMultiPlanModalOpen(false);
  };

  const selectedExpertObj = users.find(u => u.id === multiPlanExpertId) || currentUser;

  return (
    <ModuleGuard moduleId="planning_hebdo">
      <div className="space-y-6 font-sans">
        
        {/* BANNER HEADER */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wide">
                Coordination Hebdomadaire
              </span>
              <span className="text-xs text-slate-500 font-medium">AFGHS-PSI Bénin</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Année Fiscale : 01 Oct 2026 – 30 Sept 2027
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
              Planning Hebdomadaire des Activités
            </h1>
            <p className="text-xs text-slate-500">
              Engagements hebdomadaires de l’équipe SaniNova, suivi d’exécution et compte-rendu d’avancement sur les 53 semaines de l’année fiscale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={activeMainTab === 'planning' ? handleExportExcel : handleExportWorkPlanReportExcel}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              title="Exporter en fichier Excel (.xlsx)"
            >
              <span>Export Excel</span>
            </button>

            <button
              onClick={activeMainTab === 'planning' ? handleExportPdf : handleExportWorkPlanReportPdf}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              title="Exporter en PDF officiel (format Paysage A4)"
            >
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleOpenCreateActivity}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs transition flex items-center space-x-1"
            >
              <span>+ Renseigner ma Semaine</span>
            </button>
          </div>
        </div>

        {/* SOUS-MENU DE NAVIGATION INTERNE */}
        <div className="bg-white rounded-lg p-2 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchMainTab('planning')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition flex items-center space-x-2 border ${
                activeMainTab === 'planning'
                  ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Planning & Engagements Hebdomadaires</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeMainTab === 'planning' ? 'bg-teal-900 text-teal-100 font-bold' : 'bg-slate-200 text-slate-700'
              }`}>
                {weeklyActivities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMainTab('suivi_workplan')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition flex items-center space-x-2 border ${
                activeMainTab === 'suivi_workplan'
                  ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Rapport de Suivi des Sous-Activités / Work Plan</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeMainTab === 'suivi_workplan' ? 'bg-teal-900 text-teal-100' : 'bg-teal-100 text-teal-900 border border-teal-300'
              }`}>
                {reportMetrics.total} sous-activités
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2 px-2 text-[11px] text-slate-500 font-medium">
            <span className="hidden sm:inline">Traçabilité Opérationnelle Work Plan</span>
          </div>
        </div>

        {activeMainTab === 'planning' ? (
          <>
            {/* SELECTEUR DE SEMAINE & NAVIGATION ANNÉE FISCALE FY27 */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
          {/* Ligne Supérieure : Contexte Fiscal & Accès Rapide */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 uppercase tracking-wide">
                  Année Fiscale FY2026-2027
                </span>
                <span className="text-xs text-slate-500 font-medium">01 Octobre 2026 au 30 Septembre 2027</span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-1">
                {currentWeekInfo.label} &bull; <span className="text-teal-800 font-semibold">{FISCAL_QUARTERS.find(q => q.id === currentWeekInfo.quarter)?.label}</span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedWeek('ALL')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center space-x-1.5 border ${
                  selectedWeek === 'ALL'
                    ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Afficher toutes les activités planifiées"
              >
                <span>Toutes les semaines ({weeklyActivities.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const curWeekNum = getCurrentFiscalWeekNum();
                  const curInfo = getFiscalWeek(curWeekNum);
                  setSelectedWeek(curWeekNum);
                  setSelectedQuarter(curInfo?.quarter || 'T1');
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center space-x-1.5 border ${
                  selectedWeek === getCurrentFiscalWeekNum()
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title={`Revenir à la semaine en cours (${getFiscalWeek(getCurrentFiscalWeekNum()).label})`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Semaine en cours ({formatFiscalWeekShort(getFiscalWeek(getCurrentFiscalWeekNum()))})</span>
              </button>

              <select
                value={selectedWeek}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    setSelectedWeek('ALL');
                  } else {
                    const num = Number(val);
                    setSelectedWeek(num);
                    const info = getFiscalWeek(num);
                    if (info) setSelectedQuarter(info.quarter);
                  }
                }}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-teal-700 bg-white"
              >
                <option value="ALL">Toutes les semaines de l’Année Fiscale ({weeklyActivities.length} activités)</option>
                {FISCAL_WEEKS_LIST.map((w) => {
                  const countInWeek = weeklyActivities.filter(a => matchesFiscalWeek(a.week_number, w.num)).length;
                  return (
                    <option key={w.num} value={w.num}>
                      {w.label} {w.isCurrent ? ' • EN COURS' : ''} {countInWeek > 0 ? ` [${countInWeek} activité${countInWeek > 1 ? 's' : ''}]` : ''} ({w.quarter})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Onglets des Trimestres (T1, T2, T3, T4, Tous) */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Filtrer par Trimestre :
            </span>
            {FISCAL_QUARTERS.map(q => {
              const isSelected = selectedQuarter === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuarter(q.id)}
                  className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition border ${
                    isSelected
                      ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {q.id === 'ALL' ? 'Toutes les semaines (53)' : q.id}
                </button>
              );
            })}
          </div>

          {/* Carrousel horizontal de pastilles de semaines */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-1 pb-1">
            <button
              onClick={() => setSelectedWeek('ALL')}
              className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition border shrink-0 flex items-center space-x-1.5 ${
                selectedWeek === 'ALL'
                  ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Toutes les semaines</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                selectedWeek === 'ALL' ? 'bg-teal-900 text-teal-200' : 'bg-slate-200 text-slate-700'
              }`}>
                {weeklyActivities.length}
              </span>
            </button>
            {displayedWeeks.map((w) => {
              const isSelected = selectedWeek === w.num;
              const countInWeek = weeklyActivities.filter(a => matchesFiscalWeek(a.week_number, w.num)).length;
              return (
                <button
                  key={w.num}
                  onClick={() => setSelectedWeek(w.num)}
                  className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition border shrink-0 flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>Semaine {String(w.num).padStart(2, '0')}</span>
                  {countInWeek > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected ? 'bg-white text-teal-900' : 'bg-teal-100 text-teal-800 border border-teal-200'
                    }`} title={`${countInWeek} activité(s) enregistrée(s)`}>
                      {countInWeek}
                    </span>
                  )}
                  {w.isCurrent && (
                    <span className="text-[9px] bg-amber-400 text-slate-900 px-1 py-0.2 rounded font-mono font-bold">
                      En cours
                    </span>
                  )}
                  <span className={`text-[10px] ${isSelected ? 'text-teal-200' : 'text-slate-400'}`}>
                    ({w.quarter})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 1: STATUT PERSONNEL & APERÇU EQUIPE (VERT / ROUGE) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                isCurrentUserSubmitted ? 'bg-emerald-600' : 'bg-rose-600 animate-pulse'
              }`} />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-slate-900">
                    Statut de Soumission ({currentUser.full_name}) :
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isCurrentUserSubmitted 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {isCurrentUserSubmitted ? 'Soumis & Conforme (Vert)' : 'Non Soumis (Rouge)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {submittedCount} sur {teamSubmissions.length} experts ont validé leur planning pour la Semaine {activeWeekNum}.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => toggleWeeklySubmission(currentUser.id, activeWeekNum)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition border ${
                  isCurrentUserSubmitted
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'
                }`}
              >
                {isCurrentUserSubmitted ? 'Annuler Soumission' : 'Valider & Passer au Vert'}
              </button>
            </div>
          </div>

          {/* Quick Team Light Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
            {teamSubmissions.map(({ user, isSubmitted, userActsCount }) => {
              const isSelected = selectedExpert === user.id;
              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedExpert(isSelected ? 'ALL' : user.id)}
                  className={`p-2 rounded border cursor-pointer transition text-center ${
                    isSelected
                      ? 'ring-2 ring-teal-700 bg-teal-50/50'
                      : isSubmitted
                        ? 'bg-emerald-50/50 border-emerald-300 hover:bg-emerald-50'
                        : 'bg-rose-50/50 border-rose-300 hover:bg-rose-50'
                  }`}
                  title={`${user.full_name} : ${isSubmitted ? 'Planning soumis' : 'En retard'}`}
                >
                  <div className="flex items-center justify-center space-x-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${isSubmitted ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                    <span className="font-bold text-[11px] text-slate-800 truncate">
                      {user.full_name.split(' ')[0]}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {userActsCount} act.
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: SYNTHÈSE STATISTIQUE HEBDOMADAIRE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activités Déclarées</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-slate-900">{totalCount}</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {selectedWeek !== 'ALL' ? `Semaine ${String(selectedWeek).padStart(2, '0')}` : 'Toutes les semaines'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Engagements de toute l’équipe</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taux d’Exécution Moyen</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className={`text-2xl font-bold ${avgExecution >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {avgExecution}%
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                avgExecution >= 70 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {avgExecution >= 70 ? 'Satisfaisant' : 'En cours'}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full ${avgExecution >= 70 ? 'bg-emerald-600' : 'bg-amber-600'}`} 
                style={{ width: `${avgExecution}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activités Réalisées</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-emerald-700">{realisedCount}</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Réalisé
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">{inProgressCount} activité(s) en cours</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reportées / Non Réalisées</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className={`text-2xl font-bold ${delayedOrReportedCount > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                {delayedOrReportedCount}
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                delayedOrReportedCount > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {delayedOrReportedCount > 0 ? 'À suivre' : 'Zéro'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Nécessitent un report ou réajustement</p>
          </div>
        </div>

        {/* SECTION 3: FILTRES DU TABLEAU MULTI-CRITÈRES */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3 text-xs">
          {/* Ligne 1 : Barre de recherche, Quick-toggles Staff et Boutons Export */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher activité, lieu, résultat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none focus:border-teal-700 w-64 text-xs pr-6"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 font-bold"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Quick toggle Staff */}
              <div className="inline-flex rounded-md shadow-2xs border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectedExpert('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold transition ${
                    selectedExpert === 'ALL'
                      ? 'bg-teal-800 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tout le staff (8)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedExpert(currentUser.id)}
                  className={`px-3 py-1.5 text-xs font-bold transition border-l border-slate-200 ${
                    selectedExpert === currentUser.id
                      ? 'bg-teal-800 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Mes activités
                </button>
              </div>
            </div>

            {/* Actions rapides d'export */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
                title="Exporter les activités filtrées en fichier Excel (.xlsx) avec tous les détails"
              >
                <span>Export Excel ({filteredActivities.length})</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
                title="Exporter le planning filtré en document PDF"
              >
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Ligne 2 : Sélecteurs de filtres (Personnel, Mois, Semaine, Jour, Jalon, Statut) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtre Personnel / Staff */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Personnel :</span>
              <select
                value={selectedExpert}
                onChange={(e) => setSelectedExpert(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 outline-none font-medium text-slate-800 focus:border-teal-700 bg-white"
              >
                <option value="ALL">Tout le staff ({users.length} membres)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.id === currentUser.id ? '(Moi)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre Mois */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Mois (FY27) :</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 outline-none font-medium text-slate-800 focus:border-teal-700 bg-white"
              >
                <option value="ALL">Tous les mois</option>
                {FISCAL_MONTHS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.quarter})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre Semaine */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Semaine :</span>
              <select
                value={selectedWeek}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    setSelectedWeek('ALL');
                  } else {
                    const num = Number(val);
                    setSelectedWeek(num);
                    const info = getFiscalWeek(num);
                    if (info) setSelectedQuarter(info.quarter);
                  }
                }}
                className="border border-slate-300 rounded px-2.5 py-1.5 outline-none font-medium text-slate-800 focus:border-teal-700 bg-white"
              >
                <option value="ALL">Toutes les semaines ({FISCAL_WEEKS_LIST.length})</option>
                {FISCAL_WEEKS_LIST.map(w => (
                  <option key={w.num} value={w.num}>
                    {w.label} {w.isCurrent ? ' EN COURS' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre Jour */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Jour :</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 outline-none font-medium text-slate-800 focus:border-teal-700 bg-white"
              >
                <option value="ALL">Tous les jours (Lun-Ven)</option>
                {WORK_DAYS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Filtre Jalon */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Jalon :</span>
              <select
                value={selectedMilestone}
                onChange={(e) => setSelectedMilestone(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 outline-none font-medium text-slate-800 focus:border-teal-700 bg-white"
              >
                <option value="ALL">Tous les jalons</option>
                <option value="B09">B09 - Promptitude eSIGL</option>
                <option value="B13">B13 - Quantification & Appro</option>
                <option value="TRANSVERSAL">Transversal / Coordination</option>
              </select>
            </div>

            {/* Filtre Statut */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Statut :</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 outline-none font-medium text-slate-800 focus:border-teal-700 bg-white"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="A_VENIR">Planifié</option>
                <option value="EN_COURS">En cours</option>
                <option value="REALISE">Réalisé</option>
                <option value="NON_REALISE">Non Réalisé</option>
                <option value="REPORTE">Reporté</option>
                <option value="ANNULE">Annulé</option>
              </select>
            </div>

            {/* Bouton Réinitialiser */}
            <div className="flex flex-col justify-end">
              <span className="text-[10px] font-bold text-transparent mb-0.5">.</span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold border border-slate-200 transition"
                title="Réinitialiser tous les filtres à la semaine en cours"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: TABLEAU SYNTHÉTIQUE AVEC LES BOUTONS VOIR, MODIFIER, SUPPRIMER */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-xs uppercase tracking-wide text-slate-800">
                Planning des Activités &bull;{' '}
                {selectedWeek !== 'ALL'
                  ? `Semaine ${String(selectedWeek).padStart(2, '0')}`
                  : 'Toutes les semaines'}
                {selectedMonth !== 'ALL' ? ` • ${getMonthLabel(selectedMonth)}` : ''}
                {selectedExpert !== 'ALL' ? ` • ${users.find(u => u.id === selectedExpert)?.full_name || ''}` : ' • Tout le staff'}
                {selectedDay !== 'ALL' ? ` • Jour : ${selectedDay}` : ''}
              </span>
              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                {filteredActivities.length} activité{filteredActivities.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Cliquez sur &laquo; Voir &raquo; pour consulter le détail d’une activité
            </span>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-xs text-slate-500 space-y-3.5 bg-slate-50/50 rounded-lg m-4 border border-dashed border-slate-200">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-base">
                📋
              </div>
              <div>
                <p className="font-bold text-slate-700 text-sm">
                  Aucune activité enregistrée pour la Semaine {selectedWeek !== 'ALL' ? String(selectedWeek).padStart(2, '0') : ''}.
                </p>
                {selectedWeek === getCurrentFiscalWeekNum() && (
                  <p className="text-[11px] text-teal-700 font-medium mt-1">
                    C’est la semaine en cours : vous pouvez renseigner votre planning ci-dessous.
                  </p>
                )}
              </div>

              {weeklyActivities.length > 0 && selectedWeek !== 'ALL' && (
                <div className="text-[11px] text-slate-500 space-y-2 pt-1 border-t border-slate-200/60 max-w-md mx-auto">
                  <p>
                    <strong className="text-slate-700">{weeklyActivities.length} activité{weeklyActivities.length > 1 ? 's sont' : ' est'} déjà enregistrée{weeklyActivities.length > 1 ? 's' : ''}</strong> sur d’autres semaines de la plateforme.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedWeek('ALL')}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded font-bold transition border border-slate-300 shadow-2xs"
                    >
                      Afficher Toutes les Semaines ({weeklyActivities.length})
                    </button>
                    {weeklyActivities.some(a => matchesFiscalWeek(a.week_number, 6)) && (
                      <button
                        type="button"
                        onClick={() => setSelectedWeek(6)}
                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-bold transition border border-teal-300 shadow-2xs"
                      >
                        Consulter la Semaine 06
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleOpenCreateActivity}
                  className="px-4 py-2 bg-teal-800 text-white rounded text-xs font-bold hover:bg-teal-900 transition shadow-xs"
                >
                  + Renseigner ma Semaine {activeWeekNum}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Période & Jour(s)</th>
                    <th className="py-3 px-4">Personnel Responsable</th>
                    <th className="py-3 px-4">Jalon</th>
                    <th className="py-3 px-4">Activité & Lieu</th>
                    <th className="py-3 px-4">Résultat Attendu</th>
                    <th className="py-3 px-4">Statut & Avancement</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.map((act) => {
                    const expert = users.find(u => u.id === act.expert_id);
                    const isMine = act.expert_id === currentUser.id;
                    const statusConf = STATUS_CONFIG[act.status] || STATUS_CONFIG.EN_COURS;
                    const canEdit = canEditActivity(act);
                    const actDays = act.days || (act.day_of_week === 'Toute la semaine' ? [...WORK_DAYS] : act.day_of_week.split(',').map(s => s.trim()));
                    const isFullWeek = act.day_of_week === 'Toute la semaine' || actDays.length === WORK_DAYS.length;

                    return (
                      <tr key={act.id} className="hover:bg-slate-50/80 transition group">
                        {/* Période & Jour(s) d'exécution avec pills */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <span className="font-mono font-bold text-[10px] bg-slate-900 text-teal-300 px-1.5 py-0.5 rounded shadow-2xs">
                              S{String(act.week_number).padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {act.start_date ? act.start_date.substring(5) : ''}
                            </span>
                          </div>
                          {isFullWeek ? (
                            <span className="font-bold text-[11px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200 whitespace-nowrap inline-block">
                              Toute la semaine (5j)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {actDays.map((d, i) => (
                                <span key={i} className="font-bold text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-200 whitespace-nowrap">
                                  {d.substring(0, 3)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Personnel */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{expert?.full_name || 'Non assigné'}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {isMine && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Moi
                              </span>
                            )}
                            {act.collaborators_ids && act.collaborators_ids.length > 0 && (
                              <span
                                className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-teal-50 text-teal-800 border border-teal-200"
                                title={users.filter(u => act.collaborators_ids?.includes(u.id)).map(u => u.full_name).join(', ')}
                              >
                                +{act.collaborators_ids.length} interne{act.collaborators_ids.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {act.external_participants && act.external_participants.length > 0 && (
                              <span
                                className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                title={act.external_participants.join(', ')}
                              >
                                +{act.external_participants.length} ext.
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Jalon */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.milestone === 'B09' ? 'badge-b09' : act.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                          }`}>
                            {act.milestone}
                          </span>
                        </td>

                        {/* Activité & Lieu */}
                        <td className="py-3 px-4 max-w-xs">
                          {act.work_plan_code && (
                            <div className="mb-1 flex items-center space-x-1.5" title={`Grande Activité Work Plan : ${activities.find(a => a.code === act.work_plan_code)?.title || act.work_plan_code}`}>
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-teal-100 text-teal-900 border border-teal-200 shrink-0">
                                Work Plan [{act.work_plan_code}]
                              </span>
                              <span className="text-[10px] text-slate-500 truncate">
                                {activities.find(a => a.code === act.work_plan_code)?.title}
                              </span>
                            </div>
                          )}
                          <div className="font-bold text-slate-900 group-hover:text-teal-900 transition line-clamp-2" title={act.title}>
                            {act.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1">
                            <span>Lieu :</span>
                            <span className="truncate font-medium text-slate-700">{act.location}</span>
                          </div>
                          {act.execution_notes && (
                            <div className="text-[10.5px] text-teal-800 bg-teal-50/70 border border-teal-200/60 rounded px-1.5 py-0.5 mt-1 line-clamp-1 italic" title={act.execution_notes}>
                              <span className="font-semibold not-italic">Note :</span> {act.execution_notes}
                            </div>
                          )}
                        </td>

                        {/* Résultat Attendu */}
                        <td className="py-3 px-4 max-w-[200px]">
                          <div className="text-[11px] text-slate-600 line-clamp-1" title={act.expected_output}>
                            {act.expected_output || '-'}
                          </div>
                        </td>

                        {/* Statut & Avancement */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusConf.badgeClass}`}>
                              {statusConf.label}
                            </span>
                            <span className={`font-mono font-bold text-[11px] ${
                              act.progress_pct === 100 ? 'text-emerald-700' : 'text-slate-700'
                            }`}>
                              {act.progress_pct}%
                            </span>
                          </div>
                          <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                            <div 
                              className={`h-1.5 rounded-full ${act.progress_pct === 100 ? 'bg-emerald-600' : 'bg-teal-700'}`} 
                              style={{ width: `${act.progress_pct}%` }}
                            />
                          </div>
                        </td>

                        {/* Les 4 boutons : Voir, Actualiser, Modifier, Supprimer */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center space-x-1.5">
                            {/* Bouton VOIR */}
                            <button
                              onClick={() => setViewingActivityId(act.id)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                              title="Consulter le contenu complet de l'activité"
                            >
                              <span>Voir</span>
                            </button>

                            {/* Bouton ACTUALISER */}
                            <button
                              onClick={() => handleOpenActualiserModal(act)}
                              disabled={!canEdit}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 border ${
                                canEdit
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                              }`}
                              title={canEdit ? 'Actualiser l’état et renseigner les livrables de l’activité' : 'Actualisation réservée à l’auteur ou à la direction'}
                            >
                              <span>Actualiser</span>
                            </button>

                            {/* Bouton MODIFIER */}
                            <button
                              onClick={() => handleOpenEditActivity(act)}
                              disabled={!canEdit}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 border ${
                                canEdit
                                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                              }`}
                              title={canEdit ? 'Modifier cette activité' : 'Modification réservée à l’auteur ou à la direction'}
                            >
                              <span>Modifier</span>
                            </button>

                            {/* Bouton SUPPRIMER */}
                            <button
                              onClick={() => handleOpenDeleteModal(act)}
                              disabled={!canEdit}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 border ${
                                canEdit
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                              }`}
                              title={canEdit ? 'Supprimer cette activité' : 'Suppression réservée à l’auteur ou à la direction'}
                            >
                              <span>Supprimer</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    ) : (
      /* ==================================================== */
      /* RAPPORT DE SUIVI DES SOUS-ACTIVITES PAR ACTIVITE DU WORK PLAN */
      /* ==================================================== */
      <div className="space-y-5 animate-in fade-in duration-150">
        {/* HEADER SYNTHESE DU RAPPORT AVEC EXPORTS ET KPIS */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 text-white rounded-xl p-5 border border-teal-900/50 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-400 text-slate-950 uppercase tracking-wide">
                  Rapport Analytique Opérationnel
                </span>
                <span className="text-xs text-teal-200 font-mono">
                  Suivi par Activité du Work Plan
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Cartographie des Sous-Activités de Terrain
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                Visualisez, filtrez et analysez toutes les sous-activités exécutées ou planifiées par les experts en regard de chaque grande activité officielle du Work Plan.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleExportWorkPlanReportExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                title="Exporter le rapport complet sous Excel avec détail des sous-activités"
              >
                <span>Export Excel (.xlsx)</span>
              </button>

              <button
                onClick={handleExportWorkPlanReportPdf}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                title="Générer le PDF officiel format paysage A4"
              >
                <span>Export PDF Officiel</span>
              </button>
            </div>
          </div>

          {/* KPI STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <div className="bg-white/10 rounded-lg p-3 border border-white/10">
              <span className="text-[10px] text-teal-200 uppercase font-bold tracking-wider block">Total Sous-Activités</span>
              <p className="text-2xl font-black text-white mt-0.5">{reportMetrics.total}</p>
              <span className="text-[10px] text-slate-300">Actions enregistrées</span>
            </div>

            <div className="bg-emerald-950/60 rounded-lg p-3 border border-emerald-500/30">
              <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider block">Réalisées (100%)</span>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{reportMetrics.completed}</p>
              <span className="text-[10px] text-emerald-200 font-semibold">{reportMetrics.completionRate}% du volume</span>
            </div>

            <div className="bg-blue-950/60 rounded-lg p-3 border border-blue-500/30">
              <span className="text-[10px] text-blue-300 uppercase font-bold tracking-wider block">En Cours</span>
              <p className="text-2xl font-black text-blue-400 mt-0.5">{reportMetrics.inProgress}</p>
              <span className="text-[10px] text-slate-300">En cours d’exécution</span>
            </div>

            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Planifiées</span>
              <p className="text-2xl font-black text-slate-200 mt-0.5">{reportMetrics.planned}</p>
              <span className="text-[10px] text-slate-400">À venir</span>
            </div>

            <div className="bg-white/10 rounded-lg p-3 border border-white/10">
              <span className="text-[10px] text-teal-200 uppercase font-bold tracking-wider block">Grandes Activités WP</span>
              <p className="text-2xl font-black text-teal-300 mt-0.5">{reportMetrics.workPlanCodesCovered}</p>
              <span className="text-[10px] text-slate-300">Couvertes sur le terrain</span>
            </div>

            <div className="bg-white/10 rounded-lg p-3 border border-white/10">
              <span className="text-[10px] text-teal-200 uppercase font-bold tracking-wider block">Avancement Moyen</span>
              <p className="text-2xl font-black text-white mt-0.5">{reportMetrics.avgProgress}%</p>
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-teal-400 h-full rounded-full" style={{ width: `${reportMetrics.avgProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* BARRE DE FILTRES MULTIDIMENSIONNELS */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs uppercase text-slate-800 tracking-wider">
                Filtres Multidimensionnels
              </span>
              <span className="text-[11px] text-slate-500">
                ({filteredReportSubActivities.length} sous-activité(s) correspondante(s))
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetReportFilters}
              className="text-xs text-teal-800 hover:text-teal-900 font-semibold underline self-start sm:self-auto"
            >
              Réinitialiser tous les filtres
            </button>
          </div>

          {/* FILTRE TEMPOREL / DATE */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase">
                1. Échelle Temporelle & Date :
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setReportDateMode('ALL')}
                  className={`px-3 py-1 rounded text-xs font-bold transition border ${
                    reportDateMode === 'ALL'
                      ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Toutes dates
                </button>
                <button
                  type="button"
                  onClick={() => setReportDateMode('WEEK')}
                  className={`px-3 py-1 rounded text-xs font-bold transition border ${
                    reportDateMode === 'WEEK'
                      ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Semaine par semaine
                </button>
                <button
                  type="button"
                  onClick={() => setReportDateMode('MONTH')}
                  className={`px-3 py-1 rounded text-xs font-bold transition border ${
                    reportDateMode === 'MONTH'
                      ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Par Mois
                </button>
                <button
                  type="button"
                  onClick={() => setReportDateMode('DAY')}
                  className={`px-3 py-1 rounded text-xs font-bold transition border ${
                    reportDateMode === 'DAY'
                      ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Par Jour
                </button>
              </div>
            </div>

            {/* SÉLECTEUR DYNAMIQUE SELON LE MODE DE DATE */}
            {reportDateMode === 'WEEK' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-medium text-slate-700">Choisir la Semaine :</label>
                <select
                  value={reportSelectedWeek}
                  onChange={(e) => setReportSelectedWeek(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700 font-semibold"
                >
                  <option value="ALL">Toutes les 53 semaines (FY2026-2027)</option>
                  {FISCAL_WEEKS_LIST.map(w => (
                    <option key={w.num} value={w.num}>
                      Semaine {String(w.num).padStart(2, '0')} : {w.start} au {w.end} {w.num === getCurrentFiscalWeekNum() ? '• (Semaine en cours)' : ''}
                    </option>
                  ))}
                </select>
                {reportSelectedWeek !== 'ALL' && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold border border-teal-200">
                    {getFiscalWeek(Number(reportSelectedWeek)).label}
                  </span>
                )}
              </div>
            )}

            {reportDateMode === 'MONTH' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-medium text-slate-700">Choisir le Mois Fiscal :</label>
                <select
                  value={reportSelectedMonth}
                  onChange={(e) => setReportSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700 font-semibold"
                >
                  <option value="ALL">Tous les mois (12 mois de l'année fiscale)</option>
                  {FISCAL_MONTHS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.quarter})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reportDateMode === 'DAY' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-medium text-slate-700">Jour de la semaine :</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setReportSelectedDay('ALL')}
                      className={`px-2 py-1 rounded text-xs font-bold transition border ${
                        reportSelectedDay === 'ALL'
                          ? 'bg-teal-800 text-white border-teal-800'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Tous
                    </button>
                    {WORK_DAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setReportSelectedDay(day)}
                        className={`px-2 py-1 rounded text-xs font-bold transition border ${
                          reportSelectedDay === day
                            ? 'bg-teal-800 text-white border-teal-800'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:border-l sm:border-slate-300 sm:pl-3">
                  <label className="text-xs font-medium text-slate-700">Date exacte (calendrier) :</label>
                  <input
                    type="date"
                    min="2026-10-01"
                    max="2027-09-30"
                    value={reportExactDate}
                    onChange={(e) => setReportExactDate(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700"
                  />
                  {reportExactDate && (
                    <button
                      type="button"
                      onClick={() => setReportExactDate('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-bold"
                      title="Effacer la date exacte"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* FILTRES METIER : PERSONNEL, JALON, WORK PLAN, STATUT & RECHERCHE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 2. Filtre Personnel */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                2. Personnel (Expert) :
              </label>
              <select
                value={reportExpertId}
                onChange={(e) => setReportExpertId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700"
              >
                <option value="ALL">Tous les collaborateurs</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.title.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Filtre Jalon du Work Plan */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                3. Jalon du Work Plan :
              </label>
              <select
                value={reportMilestone}
                onChange={(e) => {
                  setReportMilestone(e.target.value);
                  setReportWorkPlanCode('ALL');
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700"
              >
                <option value="ALL">Tous les Jalons (B09, B13, TRANSVERSAL)</option>
                <option value="B09">Jalon B09 (eSIGL / Logistique)</option>
                <option value="B13">Jalon B13 (Approvisionnement & Quantif)</option>
                <option value="TRANSVERSAL">Transversal (Coordination & S&E)</option>
              </select>
            </div>

            {/* 4. Filtre Grande Activité Work Plan */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                4. Activité du Work Plan :
              </label>
              <select
                value={reportWorkPlanCode}
                onChange={(e) => setReportWorkPlanCode(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700"
              >
                <option value="ALL">Toutes les grandes activités</option>
                <option value="UNLINKED">Sous-activités ponctuelles / Hors Work Plan</option>
                {activities
                  .filter(a => reportMilestone === 'ALL' || a.milestone === reportMilestone)
                  .map(a => (
                    <option key={a.code} value={a.code}>
                      [{a.code}] {a.title.length > 40 ? a.title.substring(0, 40) + '...' : a.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* 5. Filtre Statut */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                5. Statut d’exécution :
              </label>
              <select
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-teal-700"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="REALISE">Réalisé (100%)</option>
                <option value="EN_COURS">En cours d'exécution</option>
                <option value="A_VENIR">Planifié / À venir</option>
                <option value="REPORTE">Reporté</option>
              </select>
            </div>
          </div>

          {/* RECHERCHE LIBRE */}
          <div className="relative pt-1">
            <input
              type="text"
              value={reportSearchQuery}
              onChange={(e) => setReportSearchQuery(e.target.value)}
              placeholder="Recherche libre : intitulé d'action, mot-clé, code d'activité, lieu, notes..."
              className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:ring-2 focus:ring-teal-700 shadow-2xs"
            />
            <span className="absolute left-3 top-3 text-slate-400 text-xs">
              🔍
            </span>
            {reportSearchQuery && (
              <button
                type="button"
                onClick={() => setReportSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* LISTE GROUPÉE DES ACTIVITÉS DU WORK PLAN ET DE LEURS SOUS-ACTIVITÉS */}
        {reportGroupedByWorkPlan.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-3">
            <p className="text-sm font-bold text-slate-700">
              Aucune sous-activité ne correspond aux critères de filtre sélectionnés.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Modifiez l'échelle temporelle, le personnel sélectionné ou le jalon pour afficher les actions correspondantes.
            </p>
            <button
              type="button"
              onClick={handleResetReportFilters}
              className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {reportGroupedByWorkPlan.map((group) => {
              const parentMilestone = group.milestone;

              return (
                <div
                  key={group.code}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
                >
                  {/* EN-TÊTE DE LA GRANDE ACTIVITÉ DU WORK PLAN */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-400 text-slate-950">
                          {group.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          parentMilestone === 'B09' ? 'badge-b09' : parentMilestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                        }`}>
                          {parentMilestone}
                        </span>
                        {group.lead_domain && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            {group.lead_domain}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {group.title}
                      </h3>
                      {group.parent && (
                        <p className="text-xs text-slate-300">
                          {group.parent.lead_expert_id && (
                            <>Lead Work Plan : <span className="font-semibold text-teal-300">{users.find(u => u.id === group.parent?.lead_expert_id)?.full_name || group.parent.lead_expert_id}</span> &bull; </>
                          )}
                          <span>Zone : {group.parent.geographic_zone || 'National / Bénin'}</span>
                        </p>
                      )}
                    </div>

                    {/* STATS DE LA GRANDE ACTIVITÉ */}
                    <div className="flex items-center gap-4 shrink-0 bg-slate-950/40 p-3 rounded-lg border border-slate-700/50">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Sous-activités</span>
                        <span className="text-base font-black text-white">
                          {group.completedCount} / {group.totalCount} <span className="text-xs font-normal text-emerald-400">réalisée(s)</span>
                        </span>
                      </div>
                      <div className="w-24">
                        <div className="flex justify-between text-[10px] font-bold text-slate-300 mb-1">
                          <span>Avancement</span>
                          <span className="text-teal-300">{group.avgProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              group.avgProgress >= 100 ? 'bg-emerald-500' : group.avgProgress >= 50 ? 'bg-teal-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${group.avgProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TABLEAU DES SOUS-ACTIVITÉS RATTACHÉES */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3">Période / Date</th>
                          <th className="py-2.5 px-3">Sous-activité spécifique menée</th>
                          <th className="py-2.5 px-3">Responsable & Équipe</th>
                          <th className="py-2.5 px-3">Lieu & Résultat</th>
                          <th className="py-2.5 px-3 text-center">Statut & Avanc.</th>
                          <th className="py-2.5 px-3 text-center">Livrables</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.subActivities.map((act) => {
                          const expert = users.find(u => u.id === act.expert_id);
                          const weekInfo = getFiscalWeek(act.week_number);

                          return (
                            <tr key={act.id} className="hover:bg-slate-50/80 transition">
                              {/* PÉRIODE / DATE */}
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <div className="flex items-center space-x-1.5 mb-1">
                                  <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-900 text-teal-300">
                                    S{String(act.week_number).padStart(2, '0')}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {weekInfo.start.substring(5)} au {weekInfo.end.substring(5)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-[130px]">
                                  {(act.days || (act.day_of_week === 'Toute la semaine' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'] : act.day_of_week.split(',').map(s => s.trim()))).map((d, i) => (
                                    <span key={i} className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                      {d.length > 3 ? d.substring(0, 3) : d}
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* SOUS-ACTIVITÉ SPÉCIFIQUE MENÉE */}
                              <td className="py-3 px-3 align-top max-w-sm">
                                <div className="flex items-start space-x-2">
                                  <div className="flex-1">
                                    <p className="font-bold text-slate-900 text-xs leading-snug">
                                      {act.title}
                                    </p>
                                    {act.execution_notes && (
                                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                                        "{act.execution_notes}"
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* RESPONSABLE & ÉQUIPE */}
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <div className="font-semibold text-slate-900">
                                  {expert ? expert.full_name : act.expert_id}
                                </div>
                                <span className="text-[10px] text-slate-500 block">
                                  {expert?.title.split(' ')[0]}
                                </span>
                                {act.collaborators_ids && act.collaborators_ids.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-0.5">
                                    {act.collaborators_ids.map(cid => (
                                      <span key={cid} className="text-[9px] px-1 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                        {users.find(u => u.id === cid)?.full_name.split(' ')[0] || cid}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* LIEU & RÉSULTAT */}
                              <td className="py-3 px-3 align-top max-w-xs">
                                <p className="text-slate-800 font-medium truncate">
                                  {act.location}
                                </p>
                                {act.expected_output && (
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5" title={act.expected_output}>
                                    Cible : {act.expected_output}
                                  </p>
                                )}
                              </td>

                              {/* STATUT & AVANCEMENT */}
                              <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  (STATUS_CONFIG[act.status] || STATUS_CONFIG.EN_COURS).badgeClass
                                }`}>
                                  {(STATUS_CONFIG[act.status] || STATUS_CONFIG.EN_COURS).label}
                                </span>
                                <div className="mt-1.5 flex items-center justify-center space-x-1.5">
                                  <div className="w-14 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        act.progress_pct >= 100 ? 'bg-emerald-600' : act.progress_pct >= 50 ? 'bg-teal-600' : 'bg-amber-500'
                                      }`}
                                      style={{ width: `${act.progress_pct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[10px] font-bold text-slate-700">
                                    {act.progress_pct}%
                                  </span>
                                </div>
                              </td>

                              {/* LIVRABLES */}
                              <td className="py-3 px-3 align-top text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {act.report_file ? (
                                    <a
                                      href={act.report_file}
                                      download={act.report_name || `Rapport_${act.id}.pdf`}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[10px] font-bold transition"
                                      title={`Télécharger : ${act.report_name || 'Rapport'}`}
                                    >
                                      <span>Doc</span>
                                      <span className="text-[9px]">({act.report_size_kb || 0}Ko)</span>
                                    </a>
                                  ) : null}

                                  {act.photos && act.photos.length > 0 ? (
                                    <div className="flex items-center -space-x-1">
                                      {act.photos.slice(0, 3).map((ph, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => setPhotoPreviewModal(ph.url)}
                                          className="w-5 h-5 rounded-full border border-white overflow-hidden shadow-2xs hover:scale-110 transition cursor-pointer"
                                          title="Cliquer pour voir la photo"
                                        >
                                          <img src={ph.url} alt="Preuve" className="w-full h-full object-cover" />
                                        </button>
                                      ))}
                                      {act.photos.length > 3 && (
                                        <span className="text-[9px] font-bold text-slate-500 ml-1">
                                          +{act.photos.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}

                                  {!act.report_file && (!act.photos || act.photos.length === 0) && (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  )}
                                </div>
                              </td>

                              {/* ACTIONS */}
                              <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => setViewingActivityId(act.id)}
                                    className="px-2 py-1 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                    title="Voir tous les détails de l'activité"
                                  >
                                    Voir
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenActualiserModal(act)}
                                    className="px-2 py-1 rounded text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition"
                                    title="Actualiser l'état et renseigner les livrables"
                                  >
                                    Actualiser
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

        {/* ==================================================== */}
        {/* MODAL : VOIR LE CONTENU COMPLET D'UNE ACTIVITE */}
        {/* (C'EST QUAND ON FAIT VOIR QU'ON VOIT LE CONTENU) */}
        {/* ==================================================== */}
        {viewingActivity && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded">
                      Semaine {viewingActivity.week_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      viewingActivity.milestone === 'B09' ? 'badge-b09' : viewingActivity.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                    }`}>
                      {viewingActivity.milestone}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      (STATUS_CONFIG[viewingActivity.status] || STATUS_CONFIG.EN_COURS).badgeClass
                    }`}>
                      {(STATUS_CONFIG[viewingActivity.status] || STATUS_CONFIG.EN_COURS).label}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1.5">
                    {viewingActivity.title}
                  </h3>
                </div>

                <button
                  onClick={() => setViewingActivityId(null)}
                  className="text-slate-400 hover:text-white p-1 text-base font-bold rounded"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto">
                {/* Jours d'exécution */}
                <div className="p-3 bg-teal-50/60 rounded border border-teal-200">
                  <span className="font-bold text-teal-900 uppercase text-[10px] block mb-1.5">
                    Jours d’exécution programmés :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(viewingActivity.days || viewingActivity.day_of_week.split(',').map(s => s.trim())).map((d, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-white text-teal-900 rounded font-bold text-xs border border-teal-300 shadow-2xs">
                        {d}
                      </span>
                    ))}
                    {viewingActivity.day_of_week === 'Toute la semaine' && (
                      <span className="px-2.5 py-1 bg-teal-800 text-white rounded font-bold text-xs shadow-2xs">
                        Toute la semaine (Lundi au Vendredi)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                      Personnel Responsable :
                    </span>
                    <p className="text-slate-900 font-semibold">
                      {users.find(u => u.id === viewingActivity.expert_id)?.full_name || 'Non assigné'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {users.find(u => u.id === viewingActivity.expert_id)?.title}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                      Lieu d’intervention :
                    </span>
                    <p className="text-slate-900 font-medium">
                      {viewingActivity.location}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      Période : {viewingActivity.start_date} au {viewingActivity.end_date}
                    </p>
                  </div>
                </div>

                {/* Personnes internes et externes impliquées */}
                {((viewingActivity.collaborators_ids && viewingActivity.collaborators_ids.length > 0) ||
                  (viewingActivity.external_participants && viewingActivity.external_participants.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewingActivity.collaborators_ids && viewingActivity.collaborators_ids.length > 0 && (
                      <div className="p-3 bg-teal-50/60 rounded border border-teal-200">
                        <span className="font-bold text-teal-900 uppercase text-[10px] block mb-1.5">
                          Personnel interne impliqué ({viewingActivity.collaborators_ids.length}) :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {viewingActivity.collaborators_ids.map(collabId => {
                            const u = users.find(x => x.id === collabId);
                            return (
                              <span
                                key={collabId}
                                className="inline-flex items-center px-2 py-0.5 rounded bg-white text-teal-900 border border-teal-300 text-xs font-medium shadow-2xs"
                              >
                                {u ? u.full_name : collabId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {viewingActivity.external_participants && viewingActivity.external_participants.length > 0 && (
                      <div className="p-3 bg-slate-100/80 rounded border border-slate-300">
                        <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1.5">
                          Personnes externes impliquées ({viewingActivity.external_participants.length}) :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {viewingActivity.external_participants.map((ext, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-300 text-xs font-medium shadow-2xs"
                            >
                              {ext}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grande Activité parente du Work Plan */}
                {viewingActivity.work_plan_code && (
                  <div className="p-3 bg-teal-50/70 rounded-lg border border-teal-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-800 text-white">
                        Work Plan [{viewingActivity.work_plan_code}]
                      </span>
                      <span className="text-[10px] text-teal-900 font-bold uppercase">
                        Grande Activité de rattachement
                      </span>
                    </div>
                    <p className="text-teal-950 font-bold text-xs leading-relaxed">
                      {activities.find(a => a.code === viewingActivity.work_plan_code)?.title || viewingActivity.work_plan_code}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                    Intitulé de l’activité spécifique (Sous-activité planifiée) :
                  </span>
                  <p className="text-slate-900 leading-relaxed font-bold text-sm">
                    {viewingActivity.title}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                    Résultat Attendu & Livrable Clé :
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {viewingActivity.expected_output || 'Aucun résultat spécifique précisé.'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 uppercase text-[10px] block">
                      Taux d’avancement & Progression :
                    </span>
                    <span className="font-mono font-bold text-sm text-teal-800">
                      {viewingActivity.progress_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-2 rounded-full ${viewingActivity.progress_pct === 100 ? 'bg-emerald-600' : 'bg-teal-700'}`} 
                      style={{ width: `${viewingActivity.progress_pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                    Notes d’exécution & Observations de réalisation :
                  </span>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {viewingActivity.execution_notes || (
                      <span className="text-slate-400 italic">Aucune note ou observation enregistrée pour le moment.</span>
                    )}
                  </div>
                </div>

                {/* Livrables de réalisation (Rapport & Photos) si disponibles */}
                {(viewingActivity.report_file || (viewingActivity.photos && viewingActivity.photos.length > 0)) && (
                  <div className="p-3 bg-emerald-50/70 rounded border border-emerald-200 space-y-3">
                    <span className="font-bold text-emerald-950 uppercase text-[10px] block">
                      Livrables & Justificatifs de Réalisation :
                    </span>

                    {/* Rapport attaché */}
                    {viewingActivity.report_file && (
                      <div className="p-2.5 bg-white rounded border border-emerald-300 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center space-x-2 truncate">
                          <svg className="w-5 h-5 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 truncate text-xs">
                              {viewingActivity.report_name || 'Rapport_Activite.pdf'}
                            </div>
                            {viewingActivity.report_size_kb ? (
                              <div className="text-[10px] text-slate-500 font-mono">
                                {viewingActivity.report_size_kb} Ko &bull; Document justificatif
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <a
                          href={viewingActivity.report_file}
                          download={viewingActivity.report_name || 'Rapport_Activite'}
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition shrink-0 ml-2 shadow-2xs inline-flex items-center space-x-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Télécharger</span>
                        </a>
                      </div>
                    )}

                    {/* Galerie photos */}
                    {viewingActivity.photos && viewingActivity.photos.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-emerald-900 block mb-1.5">
                          Galerie Photos de Terrain ({viewingActivity.photos.length}) :
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {viewingActivity.photos.map((p, idx) => (
                            <div
                              key={p.id || idx}
                              onClick={() => setPhotoPreviewModal(p.url)}
                              className="group relative rounded border border-emerald-200 overflow-hidden bg-slate-900 aspect-video cursor-pointer hover:border-emerald-500 transition shadow-2xs"
                            >
                              <img
                                src={p.url}
                                alt={p.caption || `Photo ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                              {p.caption && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-[10px] text-white truncate">
                                  {p.caption}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-slate-400">
                  Projet AFGHS &bull; Planning Hebdomadaire
                </span>

                <div className="flex items-center space-x-2">
                  {canEditActivity(viewingActivity) && (
                    <>
                      <button
                        onClick={() => {
                          const act = viewingActivity;
                          setViewingActivityId(null);
                          handleOpenActualiserModal(act);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                      >
                        <span>Actualiser l’État</span>
                      </button>

                      <button
                        onClick={() => {
                          const act = viewingActivity;
                          setViewingActivityId(null);
                          handleOpenEditActivity(act);
                        }}
                        className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition"
                      >
                        Modifier
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setViewingActivityId(null)}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : CRÉER (MULTI-ACTIVITÉS) / MODIFIER UNE ACTIVITÉ */}
        {/* ==================================================== */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className={`bg-white rounded-xl shadow-2xl border border-slate-300 w-full ${editingActivity ? 'max-w-lg' : 'max-w-3xl'} max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150`}>
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    {editingActivity ? 'Modifier l’activité hebdomadaire' : 'Planification Hebdomadaire — Saisie des Activités'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Semaine {selectedWeek} &bull; {currentWeekInfo.label} &bull; Projet AFGHS
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {!editingActivity && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase">
                      {newActivitiesList.length} activité{newActivitiesList.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    onClick={() => setEditModalOpen(false)}
                    className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveActivity} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
                {/* SI MODIFICATION D'UNE ACTIVITÉ EXISTANTE */}
                {editingActivity ? (
                  <>
                    {/* Responsable de l'activité (Verrouillé et grisé sur l'utilisateur connecté) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-semibold text-slate-700">Responsable de l’activité *</label>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                          Verrouillé
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={`${(users.find(u => u.id === (editingActivity?.expert_id || currentUser.id)) || currentUser).full_name} (${(users.find(u => u.id === (editingActivity?.expert_id || currentUser.id)) || currentUser).title})`}
                        className="w-full border border-slate-300 rounded p-2 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed select-none shadow-xs"
                      />
                    </div>

                    {/* JALON DU PROJET & ACTIVITÉ WORK PLAN */}
                    <div className="p-3 bg-teal-50/60 rounded-lg border border-teal-200 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-800 text-xs uppercase mb-1">
                            Jalon du projet *
                          </label>
                          <select
                            value={activityForm.milestone || 'B09'}
                            onChange={(e) => {
                              const newM = e.target.value as MilestoneType;
                              setActivityForm(prev => ({ ...prev, milestone: newM, work_plan_code: '' }));
                            }}
                            className="w-full border border-teal-300 rounded p-2 outline-none focus:border-teal-700 font-bold bg-white text-teal-950 text-sm"
                          >
                            <option value="B09">B09 - Promptitude eSIGL</option>
                            <option value="B13">B13 - Quantification & Appro</option>
                            <option value="TRANSVERSAL">Transversal / Coordination</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-800 text-xs uppercase mb-1">
                            Statut de réalisation
                          </label>
                          <select
                            value={activityForm.status || 'EN_COURS'}
                            onChange={(e) => setActivityForm(prev => ({ ...prev, status: e.target.value as WeeklyActivityStatus }))}
                            className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold bg-white text-sm"
                          >
                            <option value="EN_COURS">En cours</option>
                            <option value="REALISE">Réalisé (100%)</option>
                            <option value="A_VENIR">Planifié</option>
                            <option value="REPORTEE">Reporté</option>
                            <option value="ANNULE">Annulé</option>
                            <option value="BLOQUEE">Bloqué</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-teal-900 text-xs uppercase">
                            Grande Activité du Work Plan de rattachement ({activityForm.milestone || 'B09'}) *
                          </label>
                          <span className="text-[10px] bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full font-semibold border border-teal-200">
                            Classement Work Plan
                          </span>
                        </div>
                        <select
                          value={activityForm.work_plan_code || ''}
                          onChange={(e) => {
                            const code = e.target.value;
                            if (!code) {
                              setActivityForm(prev => ({ ...prev, work_plan_code: '' }));
                              return;
                            }
                            const sel = activities.find(a => a.code === code);
                            if (sel) {
                              setActivityForm(prev => ({
                                ...prev,
                                work_plan_code: sel.code,
                                // Conserver l'intitulé spécifique s'il a déjà été saisi par l'utilisateur
                                title: prev.title?.trim() ? prev.title : sel.title,
                                expected_output: prev.expected_output?.trim() ? prev.expected_output : (sel.expected_result || ''),
                                location: prev.location?.trim() ? prev.location : (sel.geographic_zone || 'Terrain / Siège'),
                              }));
                            }
                          }}
                          className="w-full border border-teal-300 bg-white rounded p-2 outline-none focus:border-teal-700 text-xs font-medium text-slate-800 shadow-2xs"
                        >
                          <option value="">-- Sélectionner la grande activité officielle du Work Plan ({activityForm.milestone || 'B09'}) --</option>
                          {activities
                            .filter(a => a.milestone === (activityForm.milestone || 'B09'))
                            .map(a => (
                              <option key={a.id} value={a.code}>
                                [{a.code}] {a.title}
                              </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Sélectionnez la grande activité du Work Plan dans laquelle s’inscrit cette sous-activité pour le suivi et les rapports consolidés.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-800 mb-1">
                        Intitulé de l’activité spécifique (Sous-activité planifiée) *
                      </label>
                      <input
                        type="text"
                        required
                        value={activityForm.title || ''}
                        onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                        placeholder="Ex: Séance de briefing avec les MCZS, Collecte des données de promptitude, Atelier de validation..."
                        className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium text-xs text-slate-900 bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Précisez l’action concrète à réaliser sur le terrain ou au siège cette semaine.
                      </p>
                    </div>

                    {/* SÉLECTION MULTI-JOURS AVEC CHECKBOXES */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block font-bold text-slate-800 text-xs">
                          Jour(s) d’exécution de l’activité *
                        </label>
                        <button
                          type="button"
                          onClick={handleSelectAllDays}
                          className="text-[11px] text-teal-800 hover:underline font-bold"
                        >
                          {selectedDays.length === WORK_DAYS.length ? 'Désélectionner tout' : 'Toute la semaine (5j)'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        {WORK_DAYS.map((day) => {
                          const isChecked = selectedDays.includes(day);
                          return (
                            <label
                              key={day}
                              className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition select-none ${
                                isChecked
                                  ? 'bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDay(day)}
                                className="rounded text-teal-800 focus:ring-teal-700 h-3.5 w-3.5"
                              />
                              <span className="text-xs">{day}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="text-[11px] text-teal-900 font-medium pt-1">
                        Sélection actuelle : <strong>{formatDaysLabel(selectedDays)}</strong>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lieu d’exécution</label>
                      <input
                        type="text"
                        value={activityForm.location || ''}
                        onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                        placeholder=""
                        className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Résultat attendu / Livrable</label>
                      <input
                        type="text"
                        value={activityForm.expected_output || ''}
                        onChange={(e) => setActivityForm({ ...activityForm, expected_output: e.target.value })}
                        placeholder=""
                        className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      />
                    </div>

                    {/* Personnes internes à impliquer */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block font-bold text-slate-800 text-xs">
                          Personnes internes à impliquer (Équipe SaniNova)
                        </label>
                        <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {selectedCollaboratorIds.length} sélectionné(e){selectedCollaboratorIds.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 bg-white rounded p-2">
                        {users
                          .filter(u => u.id !== currentUser.id)
                          .map(user => {
                            const isChecked = selectedCollaboratorIds.includes(user.id);
                            return (
                              <label
                                key={user.id}
                                className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition select-none ${
                                  isChecked
                                    ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleCollaborator(user.id)}
                                    className="rounded text-teal-800 focus:ring-teal-700 h-3.5 w-3.5"
                                  />
                                  <span className="text-xs">{user.full_name}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 truncate max-w-[170px] text-right">
                                  {user.title}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    {/* Personnes externes à impliquer */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block font-bold text-slate-800 text-xs">
                          Personnes externes à impliquer (DDS, MCZS, FOSA, Partenaires...)
                        </label>
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                          {externalParticipants.length} externe{externalParticipants.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={externalInput}
                          onChange={(e) => setExternalInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExternalParticipant();
                            }
                          }}
                          placeholder=""
                          className="flex-1 border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-teal-700 bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddExternalParticipant}
                          className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shrink-0"
                        >
                          + Ajouter
                        </button>
                      </div>

                      {externalParticipants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {externalParticipants.map((ext, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-200/90 text-slate-800 text-xs font-medium border border-slate-300"
                            >
                              <span>{ext}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExternalParticipant(idx)}
                                className="text-slate-500 hover:text-rose-700 ml-1 font-bold text-xs"
                                title="Retirer"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Statut d’exécution</label>
                        <select
                          value={activityForm.status}
                          onChange={(e) => {
                            const newSt = e.target.value as WeeklyActivityStatus;
                            setActivityForm({
                              ...activityForm,
                              status: newSt,
                              progress_pct: newSt === 'REALISE' ? 100 : (newSt === 'NON_REALISE' || newSt === 'ANNULE' ? 0 : activityForm.progress_pct)
                            });
                          }}
                          className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                        >
                          <option value="EN_COURS">En cours</option>
                          <option value="REALISE">Réalisé</option>
                          <option value="NON_REALISE">Non Réalisé</option>
                          <option value="REPORTE">Reporté</option>
                          <option value="ANNULE">Annulé</option>
                          <option value="A_VENIR">Planifié</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Avancement (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={activityForm.progress_pct || 0}
                          onChange={(e) => setActivityForm({ ...activityForm, progress_pct: Number(e.target.value) })}
                          className="w-full border border-slate-300 rounded p-2 outline-none font-mono focus:border-teal-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Notes d’exécution / Commentaires de terrain
                      </label>
                      <textarea
                        rows={2}
                        value={activityForm.execution_notes || ''}
                        onChange={(e) => setActivityForm({ ...activityForm, execution_notes: e.target.value })}
                        placeholder=""
                        className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(false)}
                        className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                      >
                        Enregistrer Modifications
                      </button>
                    </div>
                  </>
                ) : (
                  /* ==================================================== */
                  /* CAS CRÉATION : FORMULAIRE AVEC AJOUT MULTI-ACTIVITÉS */
                  /* ==================================================== */
                  <>
                    {/* Bannière Contexte & Responsable */}
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800">Responsable :</span>
                          <span className="font-semibold text-teal-900">{currentUser.full_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({currentUser.title})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Semaine {selectedWeek} &bull; {currentWeekInfo.start} au {currentWeekInfo.end}
                        </p>
                      </div>
                      <div className="text-[11px] font-semibold text-teal-800 bg-teal-100/70 border border-teal-300 px-2.5 py-1 rounded self-start sm:self-auto">
                        {newActivitiesList.length} activité{newActivitiesList.length > 1 ? 's' : ''} au planning
                      </div>
                    </div>

                    {formBatchError && (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded text-xs font-semibold text-rose-800">
                        {formBatchError}
                      </div>
                    )}

                    {/* LISTE DYNAMIQUE DES ACTIVITÉS */}
                    <div className="space-y-4">
                      {newActivitiesList.map((item, index) => {
                        const itemDays = item.days || ['Lundi'];
                        return (
                          <div
                            key={item.id}
                            className="p-4 rounded-xl border-2 border-slate-200 bg-white shadow-2xs space-y-3.5 hover:border-slate-300 transition"
                          >
                            {/* En-tête de la carte */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                              <div className="flex items-center space-x-2.5">
                                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                  {index + 1}
                                </span>
                                <div>
                                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                    Activité #{index + 1}
                                  </span>
                                  {item.title && (
                                    <span className="text-[11px] text-slate-500 ml-2 italic max-w-xs truncate inline-block align-bottom">
                                      &bull; {item.title}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.milestone === 'B09' ? 'badge-b09' : item.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                                }`}>
                                  {item.milestone}
                                </span>

                                {newActivitiesList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveActivityCard(index)}
                                    className="text-rose-600 hover:text-rose-800 text-[11px] font-bold px-2 py-1 rounded hover:bg-rose-50 transition flex items-center space-x-1"
                                    title="Supprimer cette activité du formulaire"
                                  >
                                    <span>Retirer &times;</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Intitulé */}
                            <div>
                              <label className="block font-semibold text-slate-800 mb-1">
                                Intitulé de l’activité *
                              </label>
                              <input
                                type="text"
                                required
                                value={item.title}
                                onChange={(e) => handleUpdateActivityCard(index, 'title', e.target.value)}
                                placeholder={`Ex: ${index === 0 ? 'Supervision formative des agents de santé sur eSIGL...' : 'Réunion de coordination des approvisionnements...'}`}
                                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 bg-white font-medium"
                              />
                            </div>

                            {/* Jours d'exécution pour cette activité */}
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="block font-bold text-slate-700 text-xs">
                                  Jours d’exécution pour l’Activité #{index + 1} *
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllCardDays(index)}
                                  className="text-[11px] text-teal-800 hover:underline font-bold"
                                >
                                  {itemDays.length === WORK_DAYS.length ? 'Désélectionner tout' : 'Toute la semaine (5j)'}
                                </button>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                                {WORK_DAYS.map((day) => {
                                  const isChecked = itemDays.includes(day);
                                  return (
                                    <button
                                      type="button"
                                      key={day}
                                      onClick={() => handleToggleCardDay(index, day)}
                                      className={`py-1.5 px-2 rounded-md border text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                                        isChecked
                                          ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span>{isChecked ? '' : ''}</span>
                                      <span>{day}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="text-[11px] text-teal-900 font-medium pt-0.5">
                                Planifié sur : <strong>{formatDaysLabel(itemDays)}</strong>
                              </div>
                            </div>

                            {/* Jalon & Statut */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Jalon du projet *</label>
                                <select
                                  value={item.milestone}
                                  onChange={(e) => {
                                    const newMilestone = e.target.value as MilestoneType;
                                    setNewActivitiesList(prev => {
                                      const updated = [...prev];
                                      updated[index] = { ...updated[index], milestone: newMilestone, work_plan_code: '' };
                                      return updated;
                                    });
                                  }}
                                  className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                                >
                                  <option value="B09">B09 - Promptitude eSIGL</option>
                                  <option value="B13">B13 - Quantification & Appro</option>
                                  <option value="TRANSVERSAL">Transversal / Coordination</option>
                                </select>
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Statut initial</label>
                                <select
                                  value={item.status}
                                  onChange={(e) => handleUpdateActivityCard(index, 'status', e.target.value as any)}
                                  className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                                >
                                  <option value="EN_COURS">En cours</option>
                                  <option value="REALISE">Réalisé (100%)</option>
                                  <option value="A_VENIR">Planifié</option>
                                </select>
                              </div>
                            </div>

                            {/* Activité liée du Work Plan pour ce Jalon */}
                            <div className="bg-teal-50/70 p-3 rounded-lg border border-teal-200">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold text-teal-900 uppercase">
                                  Activité Liée du Work Plan ({item.milestone})
                                </label>
                                <span className="text-[10px] bg-teal-200/80 text-teal-900 px-2 py-0.5 rounded-full font-semibold">
                                   Sélection & Remplissage automatique
                                </span>
                              </div>
                              <select
                                value={item.work_plan_code || ''}
                                onChange={(e) => {
                                  const code = e.target.value;
                                  if (!code) {
                                    handleUpdateActivityCard(index, 'work_plan_code', '');
                                    return;
                                  }
                                  const sel = activities.find(a => a.code === code);
                                  if (sel) {
                                    setNewActivitiesList(prev => {
                                      const updated = [...prev];
                                      updated[index] = {
                                        ...updated[index],
                                        work_plan_code: sel.code,
                                        title: updated[index].title?.trim() ? updated[index].title : sel.title,
                                        expected_output: updated[index].expected_output?.trim() ? updated[index].expected_output : (sel.expected_result || ''),
                                        location: updated[index].location?.trim() ? updated[index].location : (sel.geographic_zone || 'Terrain / Siège'),
                                      };
                                      return updated;
                                    });
                                  }
                                }}
                                className="w-full border border-teal-300 rounded p-2 outline-none focus:border-teal-700 text-xs font-medium bg-white text-slate-800 shadow-2xs"
                              >
                                <option value="">-- Choisir une activité du Work Plan ({item.milestone}) ou saisie libre ci-dessous --</option>
                                {activities
                                  .filter(a => a.milestone === item.milestone)
                                  .map(a => (
                                    <option key={a.id} value={a.code}>
                                      [{a.code}] {a.title}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Lieu & Résultat attendu */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Lieu d’exécution</label>
                                <input
                                  type="text"
                                  value={item.location}
                                  onChange={(e) => handleUpdateActivityCard(index, 'location', e.target.value)}
                                  placeholder=""
                                  className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 bg-white"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Résultat attendu / Livrable</label>
                                <input
                                  type="text"
                                  value={item.expected_output}
                                  onChange={(e) => handleUpdateActivityCard(index, 'expected_output', e.target.value)}
                                  placeholder=""
                                  className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 bg-white"
                                />
                              </div>
                            </div>

                            {/* Ligne Notes et Observations pour chaque activité prévue */}
                            <div className="text-xs">
                              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                                <span className="flex items-center space-x-1.5 text-xs text-slate-800">
                                  <span></span>
                                  <span>Notes et Observations</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">Points d'attention, contraintes, précisions (Optionnel)</span>
                              </label>
                              <textarea
                                rows={2}
                                value={item.execution_notes || ''}
                                onChange={(e) => handleUpdateActivityCard(index, 'execution_notes', e.target.value)}
                                placeholder=""
                                className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 bg-white text-xs text-slate-800 placeholder:text-slate-400"
                              />
                            </div>

                            {/* Section Déroulante : Collaborateurs & Participants */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/60">
                              <button
                                type="button"
                                onClick={() => handleUpdateActivityCard(index, 'showDetails', !item.showDetails)}
                                className="w-full px-3 py-2 text-left font-semibold text-xs text-slate-700 flex justify-between items-center hover:bg-slate-100/80 transition"
                              >
                                <div className="flex items-center space-x-2">
                                  <span> Collaborateurs internes & participants externes</span>
                                  {((item.collaborators_ids?.length || 0) + (item.external_participants?.length || 0) > 0) && (
                                    <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 rounded-full font-bold text-[10px]">
                                      {(item.collaborators_ids?.length || 0) + (item.external_participants?.length || 0)}
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 font-bold">{item.showDetails ? '▲ Masquer' : '▼ Renseigner'}</span>
                              </button>

                              {item.showDetails && (
                                <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                                  {/* Collaborateurs internes */}
                                  <div>
                                    <label className="block font-semibold text-slate-700 text-xs mb-1">
                                      Collaborateurs internes SaniNova
                                    </label>
                                    <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-200 rounded p-2 bg-slate-50">
                                      {users
                                        .filter(u => u.id !== currentUser.id)
                                        .map(user => {
                                          const isChecked = (item.collaborators_ids || []).includes(user.id);
                                          return (
                                            <label
                                              key={user.id}
                                              className={`flex items-center justify-between p-1 rounded cursor-pointer transition select-none ${
                                                isChecked
                                                  ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold'
                                                  : 'hover:bg-slate-100 text-slate-700'
                                              }`}
                                            >
                                              <div className="flex items-center space-x-2">
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => handleToggleCardCollaborator(index, user.id)}
                                                  className="rounded text-teal-800 focus:ring-teal-700 h-3.5 w-3.5"
                                                />
                                                <span className="text-xs">{user.full_name}</span>
                                              </div>
                                              <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                {user.title}
                                              </span>
                                            </label>
                                          );
                                        })}
                                    </div>
                                  </div>

                                  {/* Participants externes */}
                                  <div>
                                    <label className="block font-semibold text-slate-700 text-xs mb-1">
                                      Participants externes (DDS, MCZS, Partenaires...)
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={item.externalInput || ''}
                                        onChange={(e) => handleUpdateActivityCard(index, 'externalInput', e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCardExternal(index);
                                          }
                                        }}
                                        placeholder=""
                                        className="flex-1 border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-teal-700 bg-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddCardExternal(index)}
                                        className="px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shrink-0"
                                      >
                                        + Ajouter
                                      </button>
                                    </div>

                                    {(item.external_participants || []).length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                                        {(item.external_participants || []).map((ext, eIdx) => (
                                          <span
                                            key={eIdx}
                                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs border border-slate-300"
                                          >
                                            <span>{ext}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveCardExternal(index, eIdx)}
                                              className="text-slate-500 hover:text-rose-700 ml-1 font-bold text-xs"
                                            >
                                              &times;
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* BOUTON PROÉMINENT AU NIVEAU DU FORMULAIRE : AJOUTER UNE AUTRE ACTIVITÉ */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleAddAnotherActivity}
                        className="w-full py-3 px-4 bg-teal-50 hover:bg-teal-100 text-teal-900 border-2 border-dashed border-teal-400/80 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-2xs cursor-pointer group"
                      >
                        <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold group-hover:scale-110 transition-transform">
                          +
                        </span>
                        <span>+ Ajouter une autre activité au formulaire (Activité #{newActivitiesList.length + 1})</span>
                      </button>
                    </div>

                    {/* Footer du formulaire */}
                    <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                      <div className="text-xs text-slate-600 font-medium">
                        Total : <strong className="text-slate-900">{newActivitiesList.length} activité{newActivitiesList.length > 1 ? 's' : ''}</strong> pour la Semaine {selectedWeek}
                      </div>

                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setEditModalOpen(false)}
                          className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleAddAnotherActivity}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-xs border border-slate-300 transition flex items-center space-x-1"
                        >
                          <span>+ Ajouter une autre activité</span>
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                        >
                          {newActivitiesList.length > 1 ? `Enregistrer les ${newActivitiesList.length} activités` : 'Ajouter l’activité'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : CONFIRMATION DE SUPPRESSION D'ACTIVITÉ */}
        {/* ==================================================== */}
        {deleteModal.open && deleteModal.activity && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 text-rose-700">
                <span className="font-bold text-sm uppercase tracking-wide">Confirmation de suppression</span>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  Êtes-vous sûr de vouloir retirer cette activité du planning de la Semaine {selectedWeek} ?
                </p>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="font-bold text-slate-900">{deleteModal.activity.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-2">
                    <span className="font-semibold text-slate-700">{deleteModal.activity.day_of_week}</span>
                    <span>&bull;</span>
                    <span>{users.find(u => u.id === deleteModal.activity?.expert_id)?.full_name}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ open: false, activity: null })}
                  className="px-3.5 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteActivity}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold shadow-xs transition"
                >
                  Supprimer Définitivement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : ACTUALISER L'ETAT ET RENSEIGNER LES LIVRABLES */}
        {/* ==================================================== */}
        {actualiserModalOpen && actualiserActivity && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150 font-sans">
              
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
                      Semaine {actualiserActivity.week_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      {actualiserActivity.milestone}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Suivi d’exécution</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1.5">
                    Actualiser l’État & les Livrables de l’Activité
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setActualiserModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 text-base font-bold rounded"
                >
                  &times;
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveActualisation} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
                {actualiserSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs font-bold text-emerald-800 animate-in fade-in">
                    {actualiserSuccessMsg}
                  </div>
                )}

                {/* Recap de l'activité */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                    Activité sélectionnée :
                  </span>
                  <div className="text-slate-900 font-bold text-sm">
                    {actualiserActivity.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1.5 font-medium">
                    <span>
                      Responsable : <strong className="text-slate-800">{users.find(u => u.id === actualiserActivity.expert_id)?.full_name || 'Non assigné'}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Jours : <strong className="text-slate-800">{actualiserActivity.day_of_week}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Lieu : <strong className="text-slate-800">{actualiserActivity.location}</strong>
                    </span>
                  </div>
                </div>

                {/* SECTION 1 : CHOIX DE L'ETAT */}
                <div>
                  <label className="block font-bold text-slate-900 text-xs uppercase tracking-wide mb-2">
                    1. État d’avancement de l’activité :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Planifié */}
                    <button
                      type="button"
                      onClick={() => {
                        setActualiserStatus('A_VENIR');
                        setActualiserProgress(0);
                      }}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                        actualiserStatus === 'A_VENIR'
                          ? 'bg-slate-100 border-slate-600 ring-2 ring-slate-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-slate-800 text-xs">Planifié</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          actualiserStatus === 'A_VENIR' ? 'border-slate-800 bg-slate-800' : 'border-slate-300'
                        }`}>
                          {actualiserStatus === 'A_VENIR' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Activité programmée, non encore démarrée (0%).
                      </p>
                    </button>

                    {/* En cours */}
                    <button
                      type="button"
                      onClick={() => {
                        setActualiserStatus('EN_COURS');
                        if (actualiserProgress === 100 || actualiserProgress === 0) {
                          setActualiserProgress(50);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                        actualiserStatus === 'EN_COURS'
                          ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-blue-900 text-xs">En cours</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          actualiserStatus === 'EN_COURS' ? 'border-blue-700 bg-blue-700' : 'border-slate-300'
                        }`}>
                          {actualiserStatus === 'EN_COURS' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-600 mt-2">
                        Exécution en cours sur le terrain ou au bureau.
                      </p>
                    </button>

                    {/* Réalisé */}
                    <button
                      type="button"
                      onClick={() => {
                        setActualiserStatus('REALISE');
                        setActualiserProgress(100);
                      }}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                        actualiserStatus === 'REALISE'
                          ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-emerald-900 text-xs">Réalisé</span>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          actualiserStatus === 'REALISE' ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300'
                        }`}>
                          {actualiserStatus === 'REALISE' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700 mt-2 font-medium">
                        Activité terminée (100%) avec livrables joints.
                      </p>
                    </button>
                  </div>
                </div>

                {/* SECTION 2 : POURCENTAGE D'AVANCEMENT */}
                {actualiserStatus === 'EN_COURS' && (
                  <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-blue-950 text-xs">
                        Taux d’avancement réel :
                      </label>
                      <span className="font-mono font-bold text-sm text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-300">
                        {actualiserProgress}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={5}
                      value={actualiserProgress}
                      onChange={(e) => setActualiserProgress(Number(e.target.value))}
                      className="w-full accent-blue-700 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-blue-600 font-mono">
                      <span>Démarrage (10%)</span>
                      <span>Mi-parcours (50%)</span>
                      <span>Presque terminé (90%)</span>
                    </div>
                  </div>
                )}

                {/* SECTION 3 : LIVRABLES ET OBSERVATIONS (OBLIGATOIRE OU RECOMMANDE SI REALISE) */}
                <div className={`p-4 rounded-lg border space-y-4 ${
                  actualiserStatus === 'REALISE'
                    ? 'bg-emerald-50/40 border-emerald-300'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide block">
                        2. Livrables & Observations de Réalisation
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {actualiserStatus === 'REALISE'
                          ? 'Veuillez joindre les éléments attestant de la réalisation effective de l’activité.'
                          : 'Notes d’exécution, points d’attention ou documents intermédiaires.'}
                      </p>
                    </div>
                    {actualiserStatus === 'REALISE' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Livrables de clôture
                      </span>
                    )}
                  </div>

                  {/* A. Note et Observations */}
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Note & Observations de Réalisation :
                    </label>
                    <textarea
                      rows={3}
                      value={actualiserNotes}
                      onChange={(e) => setActualiserNotes(e.target.value)}
                      placeholder="Détaillez le déroulement, les constats sur le terrain, les résultats obtenus, les obstacles rencontrés..."
                      className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-teal-700 bg-white placeholder:text-slate-400"
                    />
                  </div>

                  {/* B. Rapport d'activité / Document justificatif */}
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Rapport d’activité / Compte-rendu (PDF, Word, Excel) :
                    </label>

                    {actualiserReportFile ? (
                      <div className="p-3 bg-white rounded border border-emerald-300 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center space-x-2 truncate">
                          <svg className="w-5 h-5 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 truncate text-xs">
                              {actualiserReportName || 'Document_Rapport.pdf'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {actualiserReportSizeKb} Ko &bull; Livrable attaché
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          <a
                            href={actualiserReportFile}
                            download={actualiserReportName || 'Rapport_Activite'}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                          >
                            Télécharger
                          </a>
                          <button
                            type="button"
                            onClick={handleRemoveReport}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition"
                            title="Supprimer ce document"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-lg p-3 text-center bg-white transition cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          onChange={handleReportUpload}
                          disabled={isUploadingFile}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="font-bold text-slate-700 text-xs">
                            {isUploadingFile ? 'Chargement du document...' : 'Cliquez pour sélectionner le rapport (PDF, DOCX, XLSX)'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Fichier joint directement mémorisé avec l’activité
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* C. Photos de terrain */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-semibold text-slate-800">
                        Photos de terrain & Justificatifs visuels ({actualiserPhotos.length}) :
                      </label>
                      <label className="px-2.5 py-1 bg-white hover:bg-slate-50 text-teal-800 border border-teal-300 rounded text-[11px] font-bold cursor-pointer transition shadow-2xs inline-flex items-center space-x-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{isUploadingPhoto ? 'Compression...' : '+ Ajouter des photos'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotosUpload}
                          disabled={isUploadingPhoto}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {actualiserPhotos.length === 0 ? (
                      <div className="p-3 bg-white rounded border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                        Aucune photo attachée pour le moment.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                        {actualiserPhotos.map((photo) => (
                          <div key={photo.id} className="relative rounded border border-slate-200 overflow-hidden bg-white shadow-2xs flex flex-col">
                            <div
                              onClick={() => setPhotoPreviewModal(photo.url)}
                              className="aspect-video bg-slate-900 cursor-pointer overflow-hidden relative group"
                            >
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Photo terrain'}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                                Agrandir
                              </div>
                            </div>

                            <div className="p-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                              <input
                                type="text"
                                value={photo.caption || ''}
                                onChange={(e) => handleUpdatePhotoCaption(photo.id, e.target.value)}
                                placeholder="Légende..."
                                className="flex-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] outline-none focus:border-teal-600"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(photo.id)}
                                className="text-slate-400 hover:text-rose-700 p-1 text-xs font-bold shrink-0"
                                title="Supprimer la photo"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-200 flex justify-between items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setActualiserModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold text-xs"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs shadow-xs transition flex items-center space-x-1.5"
                  >
                    <span>Enregistrer l’Actualisation</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LIGHTBOX PREVIEW PHOTO */}
        {photoPreviewModal && (
          <div
            onClick={() => setPhotoPreviewModal(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-lg shadow-2xl">
              <img
                src={photoPreviewModal}
                alt="Aperçu photo"
                className="max-w-full max-h-[85vh] object-contain rounded"
              />
              <button
                onClick={() => setPhotoPreviewModal(null)}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white px-3 py-1 rounded-full text-sm font-bold"
              >
                &times; Fermer
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL MULTI-ACTIVITES : SAISIE PAR LOT DYNAMIQUE */}
        {/* ==================================================== */}
        {multiPlanModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase">
                      Planification Hebdomadaire
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">{currentWeekInfo.label}</span>
                  </div>
                  <h3 className="font-bold text-sm uppercase tracking-tight text-white mt-1">
                    {multiPlanStep === 'entry' 
                      ? `Saisie des Activités Hebdomadaires — ${selectedExpertObj.full_name}`
                      : `Prévisualisation & Validation du Planning — ${selectedExpertObj.full_name}`}
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                    multiPlanStep === 'entry' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    1. Saisie ({multiPlanItems.length})
                  </span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                    multiPlanStep === 'preview' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    2. Valider
                  </span>

                  <button 
                    onClick={() => setMultiPlanModalOpen(false)} 
                    className="text-slate-400 hover:text-white p-1 text-base font-bold rounded ml-2"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 flex-1 overflow-y-auto">
                {formValidationMsg && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded text-xs font-semibold text-rose-800">
                    {formValidationMsg}
                  </div>
                )}

                {/* STEP 1: SAISIE DES ACTIVITES */}
                {multiPlanStep === 'entry' && (
                  <form onSubmit={handleProceedToPreview} className="space-y-4">
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Personnel concerné :</label>
                        <select
                          value={multiPlanExpertId}
                          onChange={(e) => setMultiPlanExpertId(e.target.value)}
                          className="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white font-semibold outline-none focus:border-teal-700"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({u.title})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Cochez un ou plusieurs jours pour chaque activité selon sa durée.
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {multiPlanItems.map((item, index) => {
                        const itemDays = item.days || ['Lundi'];
                        return (
                          <div 
                            key={item.id} 
                            className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs relative space-y-3 hover:border-slate-300 transition"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
                                  {index + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                  Activité #{index + 1}
                                </span>
                              </div>

                              {multiPlanItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveActivityLine(index)}
                                  className="text-red-600 hover:text-red-800 text-[11px] font-semibold flex items-center space-x-1"
                                >
                                  <span>Retirer cette activité &times;</span>
                                </button>
                              )}
                            </div>

                            {/* Checkbox jours pour cette ligne d'activité */}
                            <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-bold text-[11px] text-slate-700 uppercase">
                                  Jours d’exécution :
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllDaysForMultiItem(index)}
                                  className="text-[10px] font-bold text-teal-800 hover:underline"
                                >
                                  {itemDays.length === WORK_DAYS.length ? 'Désélectionner tout' : 'Toute la semaine'}
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {WORK_DAYS.map(day => {
                                  const isChecked = itemDays.includes(day);
                                  return (
                                    <button
                                      type="button"
                                      key={day}
                                      onClick={() => handleToggleMultiItemDay(index, day)}
                                      className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                                        isChecked
                                          ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Jalon du projet *</label>
                                <select
                                  value={item.milestone}
                                  onChange={(e) => {
                                    const newMilestone = e.target.value as MilestoneType;
                                    setMultiPlanItems(prev => {
                                      const copy = [...prev];
                                      copy[index] = { ...copy[index], milestone: newMilestone, work_plan_code: '' };
                                      return copy;
                                    });
                                  }}
                                  className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700 font-medium"
                                >
                                  <option value="B09">B09 - Promptitude eSIGL</option>
                                  <option value="B13">B13 - Quantification & Appro</option>
                                  <option value="TRANSVERSAL">Transversal / Coordination</option>
                                </select>
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Statut initial *</label>
                                <select
                                  value={item.status}
                                  onChange={(e) => handleUpdateActivityLine(index, 'status', e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700 font-medium"
                                >
                                  <option value="EN_COURS">En cours</option>
                                  <option value="REALISE">Réalisé (100%)</option>
                                  <option value="A_VENIR">Planifié</option>
                                </select>
                              </div>
                            </div>

                            {/* Activité liée du Work Plan pour ce Jalon */}
                            <div className="bg-teal-50/70 p-2.5 rounded-lg border border-teal-200 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <label className="block font-bold text-teal-900 uppercase text-[11px]">
                                  Activité Liée du Work Plan ({item.milestone})
                                </label>
                                <span className="text-[10px] text-teal-800 font-semibold bg-teal-100 px-1.5 py-0.5 rounded">
                                   Sélection automatique
                                </span>
                              </div>
                              <select
                                value={item.work_plan_code || ''}
                                onChange={(e) => {
                                  const code = e.target.value;
                                  if (!code) {
                                    handleUpdateActivityLine(index, 'work_plan_code', '');
                                    return;
                                  }
                                  const sel = activities.find(a => a.code === code);
                                  if (sel) {
                                    setMultiPlanItems(prev => {
                                      const copy = [...prev];
                                      copy[index] = {
                                        ...copy[index],
                                        work_plan_code: sel.code,
                                        title: copy[index].title?.trim() ? copy[index].title : sel.title,
                                        expected_output: copy[index].expected_output?.trim() ? copy[index].expected_output : (sel.expected_result || ''),
                                        location: copy[index].location?.trim() ? copy[index].location : (sel.geographic_zone || 'Terrain / Siège'),
                                      };
                                      return copy;
                                    });
                                  }
                                }}
                                className="w-full border border-teal-300 rounded p-1.5 outline-none focus:border-teal-700 font-medium bg-white text-slate-800 shadow-2xs"
                              >
                                <option value="">-- Choisir une activité {item.milestone} ou saisie libre ci-dessous --</option>
                                {activities
                                  .filter(a => a.milestone === item.milestone)
                                  .map(a => (
                                    <option key={a.id} value={a.code}>
                                      [{a.code}] {a.title}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="text-xs">
                              <label className="block font-semibold text-slate-700 mb-1">Intitulé précis de l’activité *</label>
                              <input
                                type="text"
                                required
                                placeholder=""
                                value={item.title}
                                onChange={(e) => handleUpdateActivityLine(index, 'title', e.target.value)}
                                className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Lieu d’exécution</label>
                                <input
                                  type="text"
                                  placeholder=""
                                  value={item.location}
                                  onChange={(e) => handleUpdateActivityLine(index, 'location', e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Résultat attendu / Livrable</label>
                                <input
                                  type="text"
                                  placeholder=""
                                  value={item.expected_output}
                                  onChange={(e) => handleUpdateActivityLine(index, 'expected_output', e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                                />
                              </div>
                            </div>

                            {/* Ligne Notes et Observations pour chaque activité prévue */}
                            <div className="text-xs">
                              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                                <span className="flex items-center space-x-1.5 text-xs text-slate-800">
                                  <span></span>
                                  <span>Notes et Observations</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">Précisions, contraintes, points d'attention (Optionnel)</span>
                              </label>
                              <textarea
                                rows={2}
                                placeholder=""
                                value={item.execution_notes || ''}
                                onChange={(e) => handleUpdateActivityLine(index, 'execution_notes', e.target.value)}
                                className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700 text-xs bg-white text-slate-800 placeholder:text-slate-400"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleAddActivityLine}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-xs border border-slate-300 transition flex items-center space-x-1"
                      >
                        <span>+ Ajouter une autre activité</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setMultiPlanModalOpen(false)}
                          className="px-3.5 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold text-xs shadow-xs transition"
                        >
                          Étape suivante : Prévisualiser &rarr;
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* STEP 2: PREVIEW & FINAL SUBMIT */}
                {multiPlanStep === 'preview' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900">
                      <div className="font-bold">Vérification de vos engagements pour {currentWeekInfo.label}</div>
                      <p className="mt-1">
                        Vous vous apprêtez à enregistrer <strong>{multiPlanItems.length} activité(s)</strong> pour <strong>{selectedExpertObj.full_name}</strong>. Cliquez sur &laquo; Valider & Soumettre le Planning &raquo; pour valider et passer au statut <strong>SOUMIS (VERT)</strong>.
                      </p>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-2.5">Jour(s)</th>
                            <th className="p-2.5">Jalon</th>
                            <th className="p-2.5">Activité</th>
                            <th className="p-2.5">Lieu</th>
                            <th className="p-2.5">Résultat</th>
                            <th className="p-2.5">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {multiPlanItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                                {formatDaysLabel(item.days || ['Lundi'])}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.milestone === 'B09' ? 'badge-b09' : item.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                                }`}>
                                  {item.milestone}
                                </span>
                              </td>
                              <td className="p-2.5 font-medium text-slate-900">
                                <div>{item.title}</div>
                                {item.execution_notes && (
                                  <div className="text-[10px] text-teal-800 font-normal italic mt-0.5">
                                    <span className="font-semibold not-italic"> Note :</span> {item.execution_notes}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600">{item.location}</td>
                              <td className="p-2.5 text-slate-600">{item.expected_output || '-'}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  (STATUS_CONFIG[item.status] || STATUS_CONFIG.EN_COURS).badgeClass
                                }`}>
                                  {(STATUS_CONFIG[item.status] || STATUS_CONFIG.EN_COURS).label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setMultiPlanStep('entry')}
                        className="px-3.5 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                      >
                        &larr; Revenir à la saisie
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setMultiPlanModalOpen(false)}
                          className="px-3.5 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleFinalSaveAndSubmit}
                          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs shadow-xs transition"
                        >
                          Valider & Soumettre le Planning (Passer au Vert)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </ModuleGuard>
  );
}