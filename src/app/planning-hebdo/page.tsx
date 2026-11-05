'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { WeeklyActivity, WeeklyActivityStatus, MilestoneType } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';
import {
  FISCAL_YEAR,
  FISCAL_WEEKS_LIST,
  FISCAL_QUARTERS,
  FISCAL_MONTHS,
  CURRENT_FISCAL_WEEK_NUM,
  getFiscalWeek,
  matchesFiscalWeek,
  weekMatchesMonth,
  getMonthLabel,
  FiscalWeek,
} from '@/lib/fiscal-weeks';

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
  days: ['Lundi'],
  milestone: 'B09',
  work_plan_code: '',
  location: 'Cotonou / Siège Projet AFGHS',
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

  const [selectedWeek, setSelectedWeek] = useState<number | 'ALL'>(CURRENT_FISCAL_WEEK_NUM);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('T1');
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

  // Batch entry modal state
  const [multiPlanModalOpen, setMultiPlanModalOpen] = useState(false);
  const [multiPlanStep, setMultiPlanStep] = useState<'entry' | 'preview'>('entry');
  const [multiPlanExpertId, setMultiPlanExpertId] = useState<string>(currentUser.id);
  const [multiPlanItems, setMultiPlanItems] = useState<MultiPlanItem[]>([]);
  const [formValidationMsg, setFormValidationMsg] = useState<string>('');

  const activeWeekNum = typeof selectedWeek === 'number' ? selectedWeek : CURRENT_FISCAL_WEEK_NUM;
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
    setSelectedWeek(CURRENT_FISCAL_WEEK_NUM);
    setSelectedQuarter('T1');
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
    setSelectedDays(['Lundi']);
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
      setSelectedDays(['Lundi']);
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

    newActs.forEach(act => addWeeklyActivity(act));
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
                Module 02 : Coordination Hebdomadaire
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
              Engagements hebdomadaires de l’équipe des 8 experts, suivi d’exécution et compte-rendu d’avancement sur les 53 semaines de l’année fiscale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              title="Exporter les activités filtrées en fichier Excel (.xlsx)"
            >
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              title="Exporter le planning en PDF officiel (format Paysage A4)"
            >
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleOpenCreateActivity}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition flex items-center space-x-1"
            >
              <span>+ Nouvelle Activité</span>
            </button>

            <button
              onClick={handleOpenCreateActivity}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs transition flex items-center space-x-1"
            >
              <span>+ Renseigner ma Semaine</span>
            </button>
          </div>
        </div>

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
                onClick={() => {
                  setSelectedWeek(CURRENT_FISCAL_WEEK_NUM);
                  setSelectedQuarter('T1');
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center space-x-1.5 border ${
                  selectedWeek === CURRENT_FISCAL_WEEK_NUM
                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Revenir à la semaine en cours au 5 Novembre 2026"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Semaine en cours (S06 : 02 - 08 Nov)</span>
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
                <option value="ALL">Toutes les semaines de l’Année Fiscale</option>
                {FISCAL_WEEKS_LIST.map((w) => (
                  <option key={w.num} value={w.num}>
                    {w.label} {w.isCurrent ? '★ EN COURS' : ''} ({w.quarter})
                  </option>
                ))}
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
              className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition border shrink-0 ${
                selectedWeek === 'ALL'
                  ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Toutes les semaines</span>
            </button>
            {displayedWeeks.map((w) => {
              const isSelected = selectedWeek === w.num;
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
                <option value="ALL">Tout le staff (8 experts)</option>
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
                    {w.label} {w.isCurrent ? '★ EN COURS' : ''}
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
            <div className="p-12 text-center text-xs text-slate-400 space-y-3">
              <p>Aucune activité enregistrée pour cette sélection.</p>
              <button
                onClick={handleOpenCreateActivity}
                className="px-4 py-2 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 transition"
              >
                + Renseigner mes activités pour la Semaine {activeWeekNum}
              </button>
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
                          <div className="font-bold text-slate-900 group-hover:text-teal-900 transition line-clamp-1">
                            {act.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1">
                            <span>Lieu :</span>
                            <span className="truncate font-medium text-slate-700">{act.location}</span>
                          </div>
                          {act.execution_notes && (
                            <div className="text-[10.5px] text-teal-800 bg-teal-50/70 border border-teal-200/60 rounded px-1.5 py-0.5 mt-1 line-clamp-1 italic" title={act.execution_notes}>
                              <span className="font-semibold not-italic">📝 Note :</span> {act.execution_notes}
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

                        {/* Les 3 boutons : Voir, Modifier, Supprimer */}
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

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                    Intitulé complet & Objectif de l’activité :
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
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
                    Notes d’exécution & Commentaires de terrain :
                  </span>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {viewingActivity.execution_notes || (
                      <span className="text-slate-400 italic">Aucune note d’exécution enregistrée pour le moment.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-slate-400">
                  Projet AFGHS &bull; Planning Hebdomadaire
                </span>

                <div className="flex items-center space-x-2">
                  {canEditActivity(viewingActivity) && (
                    <button
                      onClick={() => {
                        const act = viewingActivity;
                        setViewingActivityId(null);
                        handleOpenEditActivity(act);
                      }}
                      className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition"
                    >
                      Modifier l’Activité
                    </button>
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
                            Activité Liée du Work Plan ({activityForm.milestone || 'B09'})
                          </label>
                          <span className="text-[10px] bg-teal-200/80 text-teal-900 px-2 py-0.5 rounded-full font-semibold">
                            ⚡ Pré-remplissage en 1 clic
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
                                title: sel.title,
                                expected_output: sel.expected_result || prev.expected_output || '',
                                location: sel.geographic_zone || prev.location || 'Terrain / Siège',
                              }));
                            }
                          }}
                          className="w-full border border-teal-300 bg-white rounded p-2 outline-none focus:border-teal-700 text-xs font-medium text-slate-800 shadow-2xs"
                        >
                          <option value="">-- Choisir une activité officielle du Work Plan ({activityForm.milestone || 'B09'}) ou saisie libre --</option>
                          {activities
                            .filter(a => a.milestone === (activityForm.milestone || 'B09'))
                            .map(a => (
                              <option key={a.id} value={a.code}>
                                [{a.code}] {a.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Intitulé de l’activité *</label>
                      <input
                        type="text"
                        required
                        value={activityForm.title || ''}
                        onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                        placeholder="Ex: Analyse des prompts eSIGL pour la zone de Natitingou..."
                        className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                      />
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
                        placeholder="Ex: DDS Atacora, CS Natitingou, ou En ligne..."
                        className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Résultat attendu / Livrable</label>
                      <input
                        type="text"
                        value={activityForm.expected_output || ''}
                        onChange={(e) => setActivityForm({ ...activityForm, expected_output: e.target.value })}
                        placeholder="Ex: Fiche de supervision signée, rapport de promptitude actualisé..."
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
                          placeholder="Ex: Dr KASSA (MCZS Tanguiéta)..."
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
                        placeholder="Précisez les points saillants, contraintes ou justifications..."
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
                                      <span>{isChecked ? '✓' : ''}</span>
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
                                  ⚡ Sélection & Remplissage automatique
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
                                        title: sel.title,
                                        expected_output: sel.expected_result || updated[index].expected_output,
                                        location: sel.geographic_zone || updated[index].location,
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
                                  placeholder="Ex: DDS Atacora, CS Tanguiéta..."
                                  className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 bg-white"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Résultat attendu / Livrable</label>
                                <input
                                  type="text"
                                  value={item.expected_output}
                                  onChange={(e) => handleUpdateActivityCard(index, 'expected_output', e.target.value)}
                                  placeholder="Ex: Fiche de supervision signée..."
                                  className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 bg-white"
                                />
                              </div>
                            </div>

                            {/* Ligne Notes et Observations pour chaque activité prévue */}
                            <div className="text-xs">
                              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                                <span className="flex items-center space-x-1.5 text-xs text-slate-800">
                                  <span>📝</span>
                                  <span>Notes et Observations</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">Points d'attention, contraintes, précisions (Optionnel)</span>
                              </label>
                              <textarea
                                rows={2}
                                value={item.execution_notes || ''}
                                onChange={(e) => handleUpdateActivityCard(index, 'execution_notes', e.target.value)}
                                placeholder="Ajouter des notes, observations ou contraintes particulières pour cette activité prévue..."
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
                                  <span>👥 Collaborateurs internes & participants externes</span>
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
                                        placeholder="Ex: MCZS Natitingou..."
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
                                  ⚡ Sélection automatique
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
                                        title: sel.title,
                                        expected_output: sel.expected_result || copy[index].expected_output,
                                        location: sel.geographic_zone || copy[index].location,
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
                                placeholder="Ex: Séance de supervision formative sur le remplissage eSIGL..."
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
                                  placeholder="Ex: CS Tanguiéta, ou Bureau Cotonou..."
                                  value={item.location}
                                  onChange={(e) => handleUpdateActivityLine(index, 'location', e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Résultat attendu / Livrable</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Rapport de promptitude mensuel..."
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
                                  <span>📝</span>
                                  <span>Notes et Observations</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">Précisions, contraintes, points d'attention (Optionnel)</span>
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Ajouter des notes, observations ou contraintes particulières pour cette activité prévue..."
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
                                    <span className="font-semibold not-italic">📝 Note :</span> {item.execution_notes}
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