'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { WeeklyActivity, WeeklyActivityStatus, MilestoneType } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

const WEEKS_LIST = [
  { num: 44, label: 'Semaine 44 (26 Oct - 01 Nov 2026)', start: '2026-10-26', end: '2026-11-01', isCurrent: false },
  { num: 45, label: 'Semaine 45 (02 Nov - 08 Nov 2026)', start: '2026-11-02', end: '2026-11-08', isCurrent: true },
  { num: 46, label: 'Semaine 46 (09 Nov - 15 Nov 2026)', start: '2026-11-09', end: '2026-11-15', isCurrent: false },
  { num: 47, label: 'Semaine 47 (16 Nov - 22 Nov 2026)', start: '2026-11-16', end: '2026-11-22', isCurrent: false },
  { num: 48, label: 'Semaine 48 (23 Nov - 29 Nov 2026)', start: '2026-11-23', end: '2026-11-29', isCurrent: false },
  { num: 49, label: 'Semaine 49 (30 Nov - 06 Déc 2026)', start: '2026-11-30', end: '2026-12-06', isCurrent: false },
];

const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Toute la semaine'] as const;

const STATUS_CONFIG: Record<WeeklyActivityStatus, { label: string; badgeClass: string; textClass: string }> = {
  A_VENIR: { label: 'Planifié', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', textClass: 'text-slate-700' },
  EN_COURS: { label: 'En cours', badgeClass: 'bg-blue-50 text-blue-800 border-blue-200', textClass: 'text-blue-800' },
  REALISE: { label: 'Réalisé', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', textClass: 'text-emerald-800' },
  TERMINEE: { label: 'Réalisé', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', textClass: 'text-emerald-800' },
  NON_REALISE: { label: 'Non Réalisé', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200', textClass: 'text-rose-800' },
  REPORTE: { label: 'Reporté', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', textClass: 'text-amber-800' },
  REPORTEE: { label: 'Reporté', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', textClass: 'text-amber-800' },
  ANNULE: { label: 'Annulé', badgeClass: 'bg-slate-200 text-slate-800 border-slate-300', textClass: 'text-slate-800' },
  BLOQUEE: { label: 'Bloqué', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300', textClass: 'text-rose-900' },
};

interface MultiPlanItem {
  id: string;
  day_of_week: typeof DAYS_OF_WEEK[number];
  title: string;
  milestone: MilestoneType;
  location: string;
  expected_output: string;
  work_plan_code?: string;
  status: WeeklyActivityStatus;
  progress_pct: number;
  execution_notes?: string;
}

export default function PlanningHebdoPage() {
  const { 
    weeklyActivities, 
    weeklySubmissions,
    addWeeklyActivity, 
    updateWeeklyActivity, 
    deleteWeeklyActivity, 
    saveBatchWeeklyActivities,
    submitWeeklyPlanning,
    toggleWeeklySubmission,
    users, 
    currentUser,
    activities: workPlanActivities 
  } = useApp();

  const [selectedWeek, setSelectedWeek] = useState<number>(45);
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewFormat, setViewFormat] = useState<'team' | 'days' | 'table'>('team');

  // Modals state
  const [multiPlanModalOpen, setMultiPlanModalOpen] = useState(false);
  const [multiPlanStep, setMultiPlanStep] = useState<'entry' | 'preview'>('entry');
  const [multiPlanExpertId, setMultiPlanExpertId] = useState<string>(currentUser.id);
  const [multiPlanItems, setMultiPlanItems] = useState<MultiPlanItem[]>([]);
  const [formValidationMsg, setFormValidationMsg] = useState<string>('');

  // Single activity modals (for individual quick edit & progress rating)
  const [singleEditModalOpen, setSingleEditModalOpen] = useState(false);
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<WeeklyActivity | null>(null);
  const [singleForm, setSingleForm] = useState<Partial<WeeklyActivity>>({});

  const currentWeekInfo = WEEKS_LIST.find(w => w.num === selectedWeek) || WEEKS_LIST[1];

  // Activities for this week
  const weekActivities = useMemo(() => {
    return weeklyActivities.filter(a => a.week_number === selectedWeek);
  }, [weeklyActivities, selectedWeek]);

  // Submission statuses for this week
  const teamSubmissions = useMemo(() => {
    return users.map(user => {
      const sub = weeklySubmissions.find(s => s.expert_id === user.id && s.week_number === selectedWeek);
      const isSubmitted = sub ? sub.is_submitted : false;
      const submissionDate = sub?.submission_date;
      const userActsCount = weekActivities.filter(a => a.expert_id === user.id).length;
      return {
        user,
        isSubmitted,
        submissionDate,
        userActsCount,
      };
    });
  }, [users, weeklySubmissions, selectedWeek, weekActivities]);

  const submittedCount = teamSubmissions.filter(s => s.isSubmitted).length;
  const missingCount = teamSubmissions.length - submittedCount;
  const isCurrentUserSubmitted = teamSubmissions.find(s => s.user.id === currentUser.id)?.isSubmitted || false;

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return weekActivities.filter(act => {
      const matchExpert = selectedExpert === 'ALL' || act.expert_id === selectedExpert;
      const matchDay = selectedDay === 'ALL' || act.day_of_week === selectedDay;
      const matchMilestone = selectedMilestone === 'ALL' || act.milestone === selectedMilestone;
      
      let matchStatus = true;
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'REALISE') {
          matchStatus = act.status === 'REALISE' || act.status === 'TERMINEE';
        } else if (selectedStatus === 'REPORTE') {
          matchStatus = act.status === 'REPORTE' || act.status === 'REPORTEE';
        } else {
          matchStatus = act.status === selectedStatus;
        }
      }

      const matchSearch = 
        act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.expected_output.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (act.execution_notes && act.execution_notes.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchExpert && matchDay && matchMilestone && matchStatus && matchSearch;
    });
  }, [weekActivities, selectedExpert, selectedDay, selectedMilestone, selectedStatus, searchQuery]);

  // Activity stats
  const totalCount = weekActivities.length;
  const realisedCount = weekActivities.filter(a => a.status === 'REALISE' || a.status === 'TERMINEE').length;
  const inProgressCount = weekActivities.filter(a => a.status === 'EN_COURS').length;
  const delayedOrReportedCount = weekActivities.filter(a => a.status === 'REPORTE' || a.status === 'REPORTEE' || a.status === 'NON_REALISE').length;
  const avgExecution = totalCount > 0
    ? Math.round(weekActivities.reduce((s, a) => s + a.progress_pct, 0) / totalCount)
    : 0;

  // ----------------------------------------------------
  // MULTI-ACTIVITY WORKFLOW (AJOUT MULTIPLE + PREVISUALISATION)
  // ----------------------------------------------------
  const handleOpenMultiPlan = (expertId?: string) => {
    const targetExpert = expertId || (selectedExpert !== 'ALL' ? selectedExpert : currentUser.id);
    setMultiPlanExpertId(targetExpert);
    setFormValidationMsg('');

    // Pre-populate with existing activities of that expert for the week if any
    const existing = weekActivities.filter(a => a.expert_id === targetExpert);
    if (existing.length > 0) {
      setMultiPlanItems(existing.map(a => ({
        id: a.id,
        day_of_week: a.day_of_week as any,
        title: a.title,
        milestone: a.milestone,
        location: a.location,
        expected_output: a.expected_output,
        work_plan_code: a.work_plan_code,
        status: a.status,
        progress_pct: a.progress_pct,
        execution_notes: a.execution_notes,
      })));
    } else {
      // Start with 1 blank activity
      setMultiPlanItems([
        {
          id: `item-${Date.now()}-1`,
          day_of_week: 'Lundi',
          title: '',
          milestone: 'B09',
          location: 'Cotonou',
          expected_output: '',
          status: 'EN_COURS',
          progress_pct: 0,
        }
      ]);
    }

    setMultiPlanStep('entry');
    setMultiPlanModalOpen(true);
  };

  const handleAddActivityLine = () => {
    const daysCycle: typeof DAYS_OF_WEEK[number][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const nextDay = daysCycle[multiPlanItems.length % daysCycle.length] || 'Lundi';

    setMultiPlanItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        day_of_week: nextDay,
        title: '',
        milestone: 'B09',
        location: 'Cotonou',
        expected_output: '',
        status: 'EN_COURS',
        progress_pct: 0,
      }
    ]);
  };

  const handleRemoveActivityLine = (index: number) => {
    if (multiPlanItems.length <= 1) return;
    setMultiPlanItems(prev => prev.filter((_, i) => i !== index));
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
    setFormValidationMsg('');

    // Check if at least one activity has a title
    const validItems = multiPlanItems.filter(i => i.title.trim().length > 0);
    if (validItems.length === 0) {
      setFormValidationMsg('Veuillez renseigner au moins une activité avec un intitulé précis.');
      return;
    }

    // Check if any line is completely blank
    const incompleteIndex = multiPlanItems.findIndex(i => !i.title.trim());
    if (incompleteIndex >= 0) {
      setFormValidationMsg(`L’activité #${incompleteIndex + 1} n’a pas d’intitulé. Veuillez la compléter ou la retirer.`);
      return;
    }

    setMultiPlanStep('preview');
  };

  const handleConfirmAndSaveDraft = () => {
    const now = new Date().toISOString().substring(0, 10);
    const formatted: WeeklyActivity[] = multiPlanItems.map((item, idx) => ({
      id: item.id.startsWith('item-') ? `wact-${Date.now()}-${idx}` : item.id,
      expert_id: multiPlanExpertId,
      week_number: selectedWeek,
      week_label: currentWeekInfo.label,
      start_date: currentWeekInfo.start,
      end_date: currentWeekInfo.end,
      day_of_week: item.day_of_week,
      title: item.title,
      milestone: item.milestone,
      location: item.location || 'Terrain / Siège',
      expected_output: item.expected_output || '',
      status: item.status || 'EN_COURS',
      progress_pct: item.progress_pct || 0,
      execution_notes: item.execution_notes || '',
      work_plan_code: item.work_plan_code || '',
      created_at: now,
    }));

    saveBatchWeeklyActivities(formatted);
    setMultiPlanModalOpen(false);
  };

  const handleConfirmAndSubmitWeek = () => {
    const now = new Date().toISOString().substring(0, 10);
    const formatted: WeeklyActivity[] = multiPlanItems.map((item, idx) => ({
      id: item.id.startsWith('item-') ? `wact-${Date.now()}-${idx}` : item.id,
      expert_id: multiPlanExpertId,
      week_number: selectedWeek,
      week_label: currentWeekInfo.label,
      start_date: currentWeekInfo.start,
      end_date: currentWeekInfo.end,
      day_of_week: item.day_of_week,
      title: item.title,
      milestone: item.milestone,
      location: item.location || 'Terrain / Siège',
      expected_output: item.expected_output || '',
      status: item.status || 'EN_COURS',
      progress_pct: item.progress_pct || 0,
      execution_notes: item.execution_notes || '',
      work_plan_code: item.work_plan_code || '',
      created_at: now,
    }));

    // 1. Save all activities
    saveBatchWeeklyActivities(formatted);
    // 2. Submit planning for this week (turns to GREEN)
    submitWeeklyPlanning(multiPlanExpertId, selectedWeek);

    setMultiPlanModalOpen(false);
  };

  // Quick inline status change (au fur et a mesure dans la semaine)
  const handleQuickStatusChange = (act: WeeklyActivity, newStatus: WeeklyActivityStatus) => {
    let newProgress = act.progress_pct;
    if (newStatus === 'REALISE' || newStatus === 'TERMINEE') {
      newProgress = 100;
    } else if (newStatus === 'NON_REALISE' || newStatus === 'ANNULE') {
      newProgress = 0;
    } else if (newStatus === 'EN_COURS' && newProgress === 0) {
      newProgress = 25;
    }

    updateWeeklyActivity({
      ...act,
      status: newStatus,
      progress_pct: newProgress,
    });
  };

  // Single activity execution / progress modal
  const handleOpenExecution = (act: WeeklyActivity) => {
    setEditingActivity(act);
    setSingleForm(act);
    setExecModalOpen(true);
  };

  const handleSaveExecution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    const pct = Number(singleForm.progress_pct) || 0;
    let computedStatus = singleForm.status || editingActivity.status;
    if (pct === 100) {
      computedStatus = 'REALISE';
    } else if (pct > 0 && (computedStatus === 'A_VENIR' || computedStatus === 'NON_REALISE')) {
      computedStatus = 'EN_COURS';
    }

    updateWeeklyActivity({
      ...editingActivity,
      progress_pct: pct,
      status: computedStatus,
      execution_notes: singleForm.execution_notes || '',
    });
    setExecModalOpen(false);
  };

  // Single activity edit modal
  const handleOpenSingleEdit = (act: WeeklyActivity) => {
    setEditingActivity(act);
    setSingleForm(act);
    setSingleEditModalOpen(true);
  };

  const handleSaveSingleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !singleForm.title) return;

    updateWeeklyActivity({
      ...editingActivity,
      ...singleForm,
    } as WeeklyActivity);
    setSingleEditModalOpen(false);
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = filteredActivities.map(a => {
        const expert = users.find(u => u.id === a.expert_id);
        const sub = teamSubmissions.find(s => s.user.id === a.expert_id);
        return {
          Semaine: a.week_label,
          'Soumission Début Semaine': sub?.isSubmitted ? 'SOUMIS (VERT)' : 'NON SOUMIS (ROUGE)',
          Jour: a.day_of_week,
          Personnel: expert?.full_name || 'Non assigné',
          Rôle: expert?.title || '',
          Jalon: a.milestone,
          'Activité Planifiée': a.title,
          'Lieu / Zone': a.location,
          'Résultat Attendu': a.expected_output,
          'Statut d’Exécution': STATUS_CONFIG[a.status]?.label || a.status,
          'Avancement (%)': `${a.progress_pct}%`,
          'Observations / Difficultés': a.execution_notes || '',
        };
      });
      exportToExcel(data, `SANINOVA_Planning_Hebdo_S${selectedWeek}`);
    } else {
      const headers = ['Jour', 'Personnel', 'Jalon', 'Activité Planifiée', 'Lieu', 'Statut', 'Avance.', 'Observations'];
      const rows = filteredActivities.map(a => [
        a.day_of_week,
        users.find(u => u.id === a.expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === a.expert_id)?.full_name.split(' ')[1] || ''),
        a.milestone,
        a.title.substring(0, 36) + (a.title.length > 36 ? '...' : ''),
        a.location.substring(0, 20),
        STATUS_CONFIG[a.status]?.label || a.status,
        `${a.progress_pct}%`,
        (a.execution_notes || '-').substring(0, 26),
      ]);
      exportTableToPdf(
        `Planning Hebdomadaire des Activités — Semaine ${selectedWeek}`,
        headers,
        rows,
        `SANINOVA_Planning_Hebdo_S${selectedWeek}`,
        `${currentWeekInfo.label} | ${submittedCount}/${users.length} personnels ont soumis (Vert) | Avancement moyen : ${avgExecution}%`
      );
    }
  };

  const selectedExpertObj = users.find(u => u.id === multiPlanExpertId) || currentUser;

  return (
    <ModuleGuard moduleId="planning_hebdo">
      <div className="space-y-6 font-sans">
      {/* Top Header & Week Selector */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 03 : Opérationnel
            </span>
            <span className="text-xs text-slate-500 font-medium">Planning & Suivi d’Exécution Hebdomadaire</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            Planning Hebdomadaire des Activités
          </h1>
          <p className="text-xs text-slate-500">
            Chacun renseigne ses activités en début de semaine, soumet son planning, et actualise son statut au fur et à mesure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Week Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 px-1">Semaine :</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="text-xs border border-slate-300 font-bold rounded px-2.5 py-1 bg-white text-slate-900 outline-none focus:border-teal-700 cursor-pointer"
            >
              {WEEKS_LIST.map((w) => (
                <option key={w.num} value={w.num}>
                  {w.label} {w.isCurrent ? '• (En cours)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleExport('excel')}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold transition"
          >
            Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold transition"
          >
            PDF
          </button>

          {/* MAIN ACTION BUTTON : MULTI-ACTIVITY ENTRY */}
          <button
            onClick={() => handleOpenMultiPlan(currentUser.id)}
            className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1.5"
          >
            <span className="font-bold">+</span>
            <span>Planifier mes Activités de la Semaine</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: SUIVI DES SOUMISSIONS DE L'EQUIPE (VERT / ROUGE) */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Suivi des Soumissions de l’Équipe — {currentWeekInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Règle : Tout personnel ayant soumis son planning hebdomadaire apparaît au <strong>VERT</strong>. Ceux en retard apparaissent au <strong>ROUGE</strong>.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="inline-flex items-center px-2.5 py-1 rounded font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600 mr-1.5"></span>
              {submittedCount} Soumis (Vert)
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded font-bold bg-rose-50 text-rose-800 border border-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-600 mr-1.5"></span>
              {missingCount} En retard (Rouge)
            </span>
          </div>
        </div>

        {/* Current User Quick Banner */}
        <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isCurrentUserSubmitted 
            ? 'bg-emerald-50/70 border-emerald-300' 
            : 'bg-rose-50/80 border-rose-300'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 ${
              isCurrentUserSubmitted ? 'bg-emerald-600' : 'bg-rose-600'
            }`} />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-900">
                  Votre Statut Personnel ({currentUser.full_name}) :
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isCurrentUserSubmitted 
                    ? 'bg-emerald-700 text-white' 
                    : 'bg-rose-700 text-white animate-pulse'
                }`}>
                  {isCurrentUserSubmitted ? 'SOUMIS (VERT)' : 'NON SOUMIS (ROUGE)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isCurrentUserSubmitted 
                  ? 'Votre planning pour cette semaine est validé. Vous pouvez continuer à ajuster le statut de vos activités au fil des jours.'
                  : 'Vous n’avez pas encore soumis vos activités pour cette semaine. Cliquez sur le bouton ci-contre pour planifier et soumettre.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenMultiPlan(currentUser.id)}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shadow-xs"
            >
              + Renseigner / Modifier mes Activités
            </button>
            <button
              onClick={() => toggleWeeklySubmission(currentUser.id, selectedWeek)}
              className={`px-3.5 py-2 rounded text-xs font-bold transition border ${
                isCurrentUserSubmitted
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'
              }`}
            >
              {isCurrentUserSubmitted ? 'Annuler Soumission' : 'Valider & Passer au Vert'}
            </button>
          </div>
        </div>

        {/* Team Grid (All 8 Staff Members) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teamSubmissions.map(({ user, isSubmitted, submissionDate, userActsCount }) => {
            const isMe = user.id === currentUser.id;
            return (
              <div
                key={user.id}
                className={`p-3.5 rounded-lg border transition flex flex-col justify-between ${
                  isSubmitted 
                    ? 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-400' 
                    : 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {user.full_name} {isMe && <span className="text-teal-700 font-bold">(Moi)</span>}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                        {user.title}
                      </p>
                    </div>
                    <span className={`w-3 h-3 rounded-full shrink-0 ${
                      isSubmitted ? 'bg-emerald-600' : 'bg-rose-600'
                    }`} title={isSubmitted ? 'Planning Soumis (Vert)' : 'Non Soumis (Rouge)'} />
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Activités prévues :</span>
                    <span className="font-bold text-slate-800 font-mono">{userActsCount}</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Statut :</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      isSubmitted ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                    }`}>
                      {isSubmitted ? 'SOUMIS (VERT)' : 'EN RETARD (ROUGE)'}
                    </span>
                  </div>

                  {submissionDate && isSubmitted && (
                    <p className="text-[9px] text-slate-400 font-mono mt-1 text-right">
                      {submissionDate}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <button
                    onClick={() => handleOpenMultiPlan(user.id)}
                    className="text-teal-800 hover:underline font-semibold"
                  >
                    + Renseigner / Éditer &rarr;
                  </button>
                  <button
                    onClick={() => toggleWeeklySubmission(user.id, selectedWeek)}
                    className="text-slate-500 hover:text-slate-800 underline font-medium"
                    title="Basculer le statut"
                  >
                    {isSubmitted ? 'Annuler' : 'Passer Vert'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: SYNTHESE D'EXECUTION HEBDOMADAIRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activités Déclarées</p>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-bold text-slate-900">{totalCount}</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Semaine {selectedWeek}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Engagements de toute l’équipe
          </p>
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
          <p className="text-[11px] text-slate-500 mt-2">
            {inProgressCount} activité(s) actuellement en cours
          </p>
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
          <p className="text-[11px] text-slate-500 mt-2">
            Nécessitent un report ou réajustement
          </p>
        </div>
      </div>

      {/* SECTION 3: FILTRES ET VUE GLOBALE DE L'EQUIPE */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Rechercher activité, lieu, résultat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-600 font-medium">Personnel :</span>
          <select
            value={selectedExpert}
            onChange={(e) => setSelectedExpert(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none max-w-[170px]"
          >
            <option value="ALL">Toute l’équipe</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-600 font-medium ml-1">Jour :</span>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les jours</option>
            {DAYS_OF_WEEK.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <span className="text-xs text-slate-600 font-medium ml-1">Statut :</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="EN_COURS">En cours</option>
            <option value="REALISE">Réalisé</option>
            <option value="NON_REALISE">Non Réalisé</option>
            <option value="REPORTE">Reporté</option>
            <option value="ANNULE">Annulé</option>
            <option value="A_VENIR">Planifié</option>
          </select>

          {/* Format Switcher */}
          <div className="bg-slate-100 p-0.5 rounded flex items-center border border-slate-200 ml-2">
            <button
              onClick={() => setViewFormat('team')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                viewFormat === 'team' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vue Équipe
            </button>
            <button
              onClick={() => setViewFormat('days')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                viewFormat === 'days' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Par Jour
            </button>
            <button
              onClick={() => setViewFormat('table')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                viewFormat === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: VUE GLOBALE DE L'EQUIPE (GROUPED BY STAFF MEMBER) */}
      {viewFormat === 'team' && (
        <div className="space-y-5">
          {users
            .filter(u => selectedExpert === 'ALL' || u.id === selectedExpert)
            .map(user => {
              const userActs = filteredActivities.filter(a => a.expert_id === user.id);
              const sub = teamSubmissions.find(s => s.user.id === user.id);
              const isSub = sub?.isSubmitted;

              return (
                <div key={user.id} className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                  {/* Member Header */}
                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                        {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                            {user.full_name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isSub 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}>
                            {isSub ? 'SOUMIS (VERT)' : 'NON SOUMIS (ROUGE)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{user.title}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-slate-600 font-medium">
                        <strong>{userActs.length}</strong> activité{userActs.length > 1 ? 's' : ''} déclarée{userActs.length > 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => handleOpenMultiPlan(user.id)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-teal-800 border border-teal-300 rounded text-[11px] font-semibold transition"
                      >
                        + Gérer / Ajouter des activités
                      </button>
                    </div>
                  </div>

                  {/* Activities Grid for Member */}
                  <div className="p-4">
                    {userActs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200">
                        Aucune activité enregistrée pour {user.full_name} cette semaine.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {userActs.map((act) => {
                          const statusConf = STATUS_CONFIG[act.status] || STATUS_CONFIG.EN_COURS;
                          return (
                            <div 
                              key={act.id} 
                              className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-400 transition shadow-xs flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <span className="font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                    {act.day_of_week}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    act.milestone === 'B09' ? 'badge-b09' : act.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                                  }`}>
                                    {act.milestone}
                                  </span>
                                </div>

                                <h4 className="font-bold text-xs text-slate-900 leading-snug">
                                  {act.title}
                                </h4>

                                <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                                  <div>
                                    <span className="font-semibold text-slate-700">Lieu :</span> {act.location}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Livrable :</span> {act.expected_output}
                                  </div>
                                </div>

                                {act.execution_notes && (
                                  <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600">
                                    <span className="font-semibold text-slate-700 block text-[10px] uppercase">Notes :</span>
                                    {act.execution_notes}
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                                {/* Quick Status Changer (En cours, Réalisé, Non Réalisé, Reporté, Annulé) */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Statut (mise à jour directe) :
                                  </label>
                                  <select
                                    value={act.status}
                                    onChange={(e) => handleQuickStatusChange(act, e.target.value as WeeklyActivityStatus)}
                                    className={`w-full text-xs font-bold px-2 py-1.5 rounded border outline-none cursor-pointer ${statusConf.badgeClass}`}
                                  >
                                    <option value="EN_COURS">En cours</option>
                                    <option value="REALISE">Réalisé</option>
                                    <option value="NON_REALISE">Non Réalisé</option>
                                    <option value="REPORTE">Reporté</option>
                                    <option value="ANNULE">Annulé</option>
                                    <option value="A_VENIR">Planifié</option>
                                  </select>
                                </div>

                                {/* Progress bar */}
                                <div>
                                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                                    <span className="text-slate-500">Exécution :</span>
                                    <span className={act.progress_pct === 100 ? 'text-emerald-700' : 'text-teal-800'}>
                                      {act.progress_pct}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-1.5 rounded-full ${act.progress_pct === 100 ? 'bg-emerald-600' : 'bg-teal-700'}`} 
                                      style={{ width: `${act.progress_pct}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between text-xs pt-1">
                                  <button
                                    onClick={() => handleOpenExecution(act)}
                                    className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-semibold transition"
                                  >
                                    Notes & %
                                  </button>
                                  <div className="space-x-1">
                                    <button
                                      onClick={() => handleOpenSingleEdit(act)}
                                      className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-[11px] font-medium transition"
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      onClick={() => deleteWeeklyActivity(act.id)}
                                      className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-[11px] font-medium transition"
                                    >
                                      Retirer
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* VIEW 2: PAR JOUR DE LA SEMAINE */}
      {viewFormat === 'days' && (
        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayActs = filteredActivities.filter(a => a.day_of_week === day);
            if (selectedDay !== 'ALL' && selectedDay !== day) return null;
            if (dayActs.length === 0 && selectedDay === 'ALL') return null;

            return (
              <div key={day} className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-900">{day}</span>
                    <span className="text-[11px] text-slate-500 font-medium">({dayActs.length} activité{dayActs.length > 1 ? 's' : ''})</span>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayActs.map((act) => {
                    const expert = users.find(u => u.id === act.expert_id);
                    const statusConf = STATUS_CONFIG[act.status] || STATUS_CONFIG.EN_COURS;
                    return (
                      <div 
                        key={act.id} 
                        className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-400 transition shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              act.milestone === 'B09' ? 'badge-b09' : act.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                            }`}>
                              {act.milestone}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusConf.badgeClass}`}>
                              {statusConf.label}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-xs mt-2 leading-snug">
                            {act.title}
                          </h4>

                          <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                            <div>
                              <span className="font-semibold text-slate-700">Responsable :</span> {expert?.full_name}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">Lieu :</span> {act.location}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">Résultat :</span> {act.expected_output}
                            </div>
                          </div>

                          {act.execution_notes && (
                            <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700 block text-[10px] uppercase">Notes :</span>
                              {act.execution_notes}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                          <div>
                            <select
                              value={act.status}
                              onChange={(e) => handleQuickStatusChange(act, e.target.value as WeeklyActivityStatus)}
                              className={`w-full text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${statusConf.badgeClass}`}
                            >
                              <option value="EN_COURS">En cours</option>
                              <option value="REALISE">Réalisé</option>
                              <option value="NON_REALISE">Non Réalisé</option>
                              <option value="REPORTE">Reporté</option>
                              <option value="ANNULE">Annulé</option>
                              <option value="A_VENIR">Planifié</option>
                            </select>
                          </div>

                          <div className="flex justify-between text-xs mb-1 font-semibold">
                            <span className="text-slate-600">Avancement :</span>
                            <span className={act.progress_pct === 100 ? 'text-emerald-700' : 'text-teal-800'}>
                              {act.progress_pct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
                            <div 
                              className={`h-1.5 rounded-full ${act.progress_pct === 100 ? 'bg-emerald-600' : 'bg-teal-700'}`} 
                              style={{ width: `${act.progress_pct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <button
                              onClick={() => handleOpenExecution(act)}
                              className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-semibold transition"
                            >
                              Niveau d’exécution
                            </button>
                            <div className="space-x-1">
                              <button
                                onClick={() => handleOpenSingleEdit(act)}
                                className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-[11px] font-medium transition"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => deleteWeeklyActivity(act.id)}
                                className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-[11px] font-medium transition"
                              >
                                Retirer
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredActivities.length === 0 && (
            <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-xs text-slate-400">
              Aucune activité planifiée ne correspond aux critères pour cette semaine.
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: TABLE CONSOLIDEE */}
      {viewFormat === 'table' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Jour</th>
                  <th className="p-3.5">Personnel Responsable</th>
                  <th className="p-3.5">Jalon</th>
                  <th className="p-3.5">Intitulé & Lieu</th>
                  <th className="p-3.5">Résultat Attendu</th>
                  <th className="p-3.5">Statut de la Semaine</th>
                  <th className="p-3.5">Avancement</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Aucune activité enregistrée pour cette semaine.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => {
                    const expert = users.find(u => u.id === act.expert_id);
                    const statusConf = STATUS_CONFIG[act.status] || STATUS_CONFIG.EN_COURS;
                    return (
                      <tr key={act.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {act.day_of_week}
                        </td>
                        <td className="p-3.5 font-medium text-slate-800">
                          {expert?.full_name}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.milestone === 'B09' ? 'badge-b09' : act.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                          }`}>
                            {act.milestone}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-xs">
                          <div className="font-semibold text-slate-900">{act.title}</div>
                          <div className="text-[11px] text-slate-500">{act.location}</div>
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-xs truncate">
                          {act.expected_output}
                        </td>
                        <td className="p-3.5">
                          <select
                            value={act.status}
                            onChange={(e) => handleQuickStatusChange(act, e.target.value as WeeklyActivityStatus)}
                            className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${statusConf.badgeClass}`}
                          >
                            <option value="EN_COURS">En cours</option>
                            <option value="REALISE">Réalisé</option>
                            <option value="NON_REALISE">Non Réalisé</option>
                            <option value="REPORTE">Reporté</option>
                            <option value="ANNULE">Annulé</option>
                            <option value="A_VENIR">Planifié</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${act.progress_pct === 100 ? 'bg-emerald-600' : 'bg-teal-700'}`}
                                style={{ width: `${act.progress_pct}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-700 text-[11px]">{act.progress_pct}%</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenExecution(act)}
                            className="px-2 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-semibold transition"
                          >
                            Exécution
                          </button>
                          <button
                            onClick={() => handleOpenSingleEdit(act)}
                            className="px-2 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded text-[11px] transition"
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL MULTI-ACTIVITES : SAISIE DYNAMIQUE + PREVISUALISATION */}
      {/* ==================================================== */}
      {multiPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200 uppercase">
                    Planification Hebdomadaire
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">{currentWeekInfo.label}</span>
                </div>
                <h3 className="font-bold text-sm uppercase tracking-tight text-slate-900 mt-1">
                  {multiPlanStep === 'entry' 
                    ? `Saisie des Activités Hebdomadaires — ${selectedExpertObj.full_name}`
                    : `Prévisualisation & Validation du Planning — ${selectedExpertObj.full_name}`}
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                {/* Step indicator */}
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  multiPlanStep === 'entry' ? 'bg-teal-800 text-white border-teal-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  1. Saisie ({multiPlanItems.length} act.)
                </span>
                <span className="text-slate-400">&rarr;</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  multiPlanStep === 'preview' ? 'bg-teal-800 text-white border-teal-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  2. Visualiser & Soumettre
                </span>

                <button 
                  onClick={() => setMultiPlanModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-800 text-xs font-bold px-2 py-1 rounded ml-2"
                >
                  Fermer &times;
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

              {/* STEP 1: SAISIE DES ACTIVITES AVEC LE BOUTON + */}
              {multiPlanStep === 'entry' && (
                <form onSubmit={handleProceedToPreview} className="space-y-4">
                  {/* Personnel selector */}
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
                      Renseignez chaque activité prévue puis cliquez sur <strong>+ Ajouter une autre activité</strong> pour en insérer d’autres.
                    </div>
                  </div>

                  {/* List of Activities to Plan */}
                  <div className="space-y-3.5">
                    {multiPlanItems.map((item, index) => (
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Jour d’exécution *</label>
                            <select
                              value={item.day_of_week}
                              onChange={(e) => handleUpdateActivityLine(index, 'day_of_week', e.target.value)}
                              className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700 font-medium"
                            >
                              {DAYS_OF_WEEK.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Jalon du projet *</label>
                            <select
                              value={item.milestone}
                              onChange={(e) => handleUpdateActivityLine(index, 'milestone', e.target.value)}
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
                              <option value="REALISE">Réalisé</option>
                              <option value="NON_REALISE">Non Réalisé</option>
                              <option value="REPORTE">Reporté</option>
                              <option value="ANNULE">Annulé</option>
                              <option value="A_VENIR">Planifié</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Intitulé précis de l’activité *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Supervision formative de la saisie eSIGL et suivi des stocks..."
                              value={item.title}
                              onChange={(e) => handleUpdateActivityLine(index, 'title', e.target.value)}
                              className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Lieu / Structure sanitaire ciblée</label>
                            <input
                              type="text"
                              placeholder="Ex: Natitingou / Hôpital de zone, CS Boukoumbé"
                              value={item.location}
                              onChange={(e) => handleUpdateActivityLine(index, 'location', e.target.value)}
                              className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Résultat ou livrable attendu</label>
                            <input
                              type="text"
                              placeholder="Ex: Rapport A7 validé et fiche de supervision signée"
                              value={item.expected_output}
                              onChange={(e) => handleUpdateActivityLine(index, 'expected_output', e.target.value)}
                              className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Liaison Work Plan officiel (Optionnel)</label>
                            <select
                              value={item.work_plan_code || ''}
                              onChange={(e) => handleUpdateActivityLine(index, 'work_plan_code', e.target.value)}
                              className="w-full border border-slate-200 rounded p-1.5 outline-none focus:border-teal-700"
                            >
                              <option value="">Aucune liaison spécifique</option>
                              {workPlanActivities.map(a => (
                                <option key={a.id} value={a.code}>
                                  {a.code} - {a.title.substring(0, 48)}...
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* LE BOUTON + POUR AJOUTER UNE AUTRE ACTIVITE */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAddActivityLine}
                      className="w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-teal-600 bg-teal-50/50 hover:bg-teal-50 text-teal-900 font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                    >
                      <span className="text-base font-bold">+</span>
                      <span>Ajouter une autre activité pour cette semaine ({multiPlanItems.length} déjà saisie{multiPlanItems.length > 1 ? 's' : ''})</span>
                    </button>
                  </div>

                  {/* Submit to preview */}
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setMultiPlanModalOpen(false)}
                      className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                    >
                      Annuler
                    </button>

                    <button
                      type="submit"
                      className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs flex items-center space-x-2 transition"
                    >
                      <span>Enregistrer & Prévisualiser le Planning ({multiPlanItems.length} activité{multiPlanItems.length > 1 ? 's' : ''})</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: PREVISUALISATION ET VALIDATION AVANT SOUMISSION */}
              {multiPlanStep === 'preview' && (
                <div className="space-y-4">
                  {/* Summary Callout */}
                  <div className="bg-slate-900 text-white p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                        Vérification Préalable à la Soumission
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        Planning de {selectedExpertObj.full_name} — {currentWeekInfo.label}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        Total : <strong>{multiPlanItems.length} activité{multiPlanItems.length > 1 ? 's' : ''}</strong> déclarée{multiPlanItems.length > 1 ? 's' : ''} pour la semaine.
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono px-3 py-1 bg-emerald-950 text-emerald-300 font-bold rounded border border-emerald-800">
                        Prêt pour Soumission
                      </span>
                    </div>
                  </div>

                  {/* Previsualization Table */}
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-3 w-28">Jour</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Activité Prévue</th>
                          <th className="py-2.5 px-3 w-24">Jalon</th>
                          <th className="py-2.5 px-3">Lieu / Structure</th>
                          <th className="py-2.5 px-3">Résultat Attendu</th>
                          <th className="py-2.5 px-3 w-28 text-center">Statut Initial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {multiPlanItems.map((item, index) => {
                          const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.EN_COURS;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50/50">
                                {item.day_of_week}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-900 block leading-snug">{item.title}</span>
                                {item.work_plan_code && (
                                  <span className="text-[10px] text-teal-800 font-medium">Liaison : {item.work_plan_code}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.milestone === 'B09' ? 'badge-b09' : item.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                                }`}>
                                  {item.milestone}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {item.location || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {item.expected_output || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusConf.badgeClass}`}>
                                  {statusConf.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                    <span>
                      En cliquant sur <strong>« Valider & Soumettre le Planning »</strong>, vos activités seront enregistrées et votre indicateur de début de semaine passera immédiatement au <strong>VERT</strong>.
                    </span>
                  </div>

                  {/* Preview Footer Actions */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMultiPlanStep('entry')}
                      className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center space-x-1"
                    >
                      <span>&larr;</span>
                      <span>Modifier / Ajouter d’autres activités</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleConfirmAndSaveDraft}
                        className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition"
                      >
                        Enregistrer en Brouillon
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmAndSubmitWeek}
                        className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                      >
                        <span>Valider & Soumettre le Planning (Passer au Vert)</span>
                        <span className="font-bold">&check;</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXECUTION : NIVEAU D'EXÉCUTION & OBSERVATIONS */}
      {execModalOpen && editingActivity && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  Renseigner le niveau d’exécution & Statut
                </h3>
                <p className="text-[11px] text-slate-500 truncate max-w-xs">{editingActivity.title}</p>
              </div>
              <button 
                onClick={() => setExecModalOpen(false)} 
                className="text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                Fermer &times;
              </button>
            </div>

            <form onSubmit={handleSaveExecution} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="flex justify-between items-start text-[11px]">
                  <span className="font-bold text-slate-900">{editingActivity.day_of_week}</span>
                  <span className="text-slate-500">{editingActivity.location}</span>
                </div>
                <p className="text-xs text-slate-700 font-semibold mt-1">{editingActivity.title}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-800">Taux d’avancement :</label>
                  <span className="font-bold text-base text-teal-800">{singleForm.progress_pct || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={singleForm.progress_pct || 0}
                  onChange={(e) => setSingleForm({ ...singleForm, progress_pct: Number(e.target.value) })}
                  className="w-full accent-teal-800 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>0% (Non entamé)</span>
                  <span>50% (À mi-parcours)</span>
                  <span>100% (Réalisé)</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Statut d’exécution de l’activité *</label>
                <select
                  value={singleForm.status}
                  onChange={(e) => {
                    const newSt = e.target.value as WeeklyActivityStatus;
                    setSingleForm({ 
                      ...singleForm, 
                      status: newSt,
                      progress_pct: newSt === 'REALISE' ? 100 : (newSt === 'NON_REALISE' || newSt === 'ANNULE' ? 0 : singleForm.progress_pct)
                    });
                  }}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700 font-medium"
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
                <label className="block font-semibold text-slate-800 mb-1">
                  Observations, résultats atteints ou motifs de report / blocage :
                </label>
                <textarea
                  rows={3}
                  placeholder="Préciser les résultats obtenus, les contraintes rencontrées ou le motif de report..."
                  value={singleForm.execution_notes || ''}
                  onChange={(e) => setSingleForm({ ...singleForm, execution_notes: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setExecModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded font-semibold"
                >
                  Valider l’Exécution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIFICATION INDIVIDUELLE RAPIDE */}
      {singleEditModalOpen && editingActivity && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-lg">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                Modifier l’activité individuelle
              </h3>
              <button 
                onClick={() => setSingleEditModalOpen(false)} 
                className="text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                Fermer &times;
              </button>
            </div>

            <form onSubmit={handleSaveSingleEdit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Intitulé de l’activité *</label>
                <input
                  type="text"
                  required
                  value={singleForm.title || ''}
                  onChange={(e) => setSingleForm({ ...singleForm, title: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jour d’exécution</label>
                  <select
                    value={singleForm.day_of_week}
                    onChange={(e) => setSingleForm({ ...singleForm, day_of_week: e.target.value as any })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jalon</label>
                  <select
                    value={singleForm.milestone}
                    onChange={(e) => setSingleForm({ ...singleForm, milestone: e.target.value as any })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="B09">B09 - Promptitude eSIGL</option>
                    <option value="B13">B13 - Quantification & Appro</option>
                    <option value="TRANSVERSAL">Transversal / Coordination</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lieu</label>
                  <input
                    type="text"
                    value={singleForm.location || ''}
                    onChange={(e) => setSingleForm({ ...singleForm, location: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Statut</label>
                  <select
                    value={singleForm.status}
                    onChange={(e) => setSingleForm({ ...singleForm, status: e.target.value as any })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="EN_COURS">En cours</option>
                    <option value="REALISE">Réalisé</option>
                    <option value="NON_REALISE">Non Réalisé</option>
                    <option value="REPORTE">Reporté</option>
                    <option value="ANNULE">Annulé</option>
                    <option value="A_VENIR">Planifié</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Résultat attendu</label>
                <input
                  type="text"
                  value={singleForm.expected_output || ''}
                  onChange={(e) => setSingleForm({ ...singleForm, expected_output: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSingleEditModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </ModuleGuard>
  );
}
