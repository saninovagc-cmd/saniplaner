'use client';

import React, { useState, useMemo } from 'react';
import { WorkPlanActivity, WorkPlanSubActivity, UserProfile } from '@/types';

export const FISCAL_MONTHS = [
  { key: 'Oct-26', label: 'Octobre 2026', short: 'Oct 26', quarter: 'T1', isPast: true, isCurrent: false },
  { key: 'Nov-26', label: 'Novembre 2026', short: 'Nov 26', quarter: 'T1', isPast: false, isCurrent: true },
  { key: 'Dec-26', label: 'Décembre 2026', short: 'Déc 26', quarter: 'T1', isPast: false, isCurrent: false },
  { key: 'Jan-27', label: 'Janvier 2027', short: 'Jan 27', quarter: 'T2', isPast: false, isCurrent: false },
  { key: 'Fev-27', label: 'Février 2027', short: 'Fév 27', quarter: 'T2', isPast: false, isCurrent: false },
  { key: 'Mar-27', label: 'Mars 2027', short: 'Mar 27', quarter: 'T2', isPast: false, isCurrent: false },
  { key: 'Avr-27', label: 'Avril 2027', short: 'Avr 27', quarter: 'T3', isPast: false, isCurrent: false },
  { key: 'Mai-27', label: 'Mai 2027', short: 'Mai 27', quarter: 'T3', isPast: false, isCurrent: false },
  { key: 'Juin-27', label: 'Juin 2027', short: 'Juin 27', quarter: 'T3', isPast: false, isCurrent: false },
  { key: 'Juil-27', label: 'Juillet 2027', short: 'Juil 27', quarter: 'T4', isPast: false, isCurrent: false },
  { key: 'Aout-27', label: 'Août 2027', short: 'Août 27', quarter: 'T4', isPast: false, isCurrent: false },
  { key: 'Sept-27', label: 'Septembre 2027', short: 'Sept 27', quarter: 'T4', isPast: false, isCurrent: false },
];

interface WorkPlanSubActivitiesViewProps {
  activities: WorkPlanActivity[];
  users: UserProfile[];
  selectedMilestone: string;
  selectedExpert: string;
  searchQuery: string;
  onUpdateSubActivity: (activityId: string, sub: WorkPlanSubActivity) => void;
  onAddSubActivity?: (activityId: string, sub: WorkPlanSubActivity) => void;
  onDeleteSubActivity?: (activityId: string, subId: string) => void;
  onOpenEditActivityModal: (act: WorkPlanActivity) => void;
}

export default function WorkPlanSubActivitiesView({
  activities,
  users,
  selectedMilestone,
  selectedExpert,
  searchQuery,
  onUpdateSubActivity,
  onAddSubActivity,
  onDeleteSubActivity,
  onOpenEditActivityModal,
}: WorkPlanSubActivitiesViewProps) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set(activities.map(a => a.id)));
  const [editingSub, setEditingSub] = useState<{ activityId: string; sub: WorkPlanSubActivity } | null>(null);
  const [addingToAct, setAddingToAct] = useState<WorkPlanActivity | null>(null);
  const [newSubForm, setNewSubForm] = useState<Partial<WorkPlanSubActivity>>({
    code: '',
    title: '',
    description: '',
    deliverable_or_output: '',
    weight_pct: 25,
    calendar_months: ['Nov-26'],
    frequency: 'CONTINU',
    total_occurrences: 1,
    completed_occurrences: 0,
    progress_pct: 0,
    status: 'EN_COURS',
  });

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedCards(new Set(activities.map(a => a.id)));
  const collapseAll = () => setExpandedCards(new Set());

  // Filtrage des activités et des sous-activités
  const filteredActivitiesWithSubs = useMemo(() => {
    return activities.filter((act) => {
      // Filtre Jalon
      const matchesMilestone = selectedMilestone === 'ALL' || act.milestone === selectedMilestone;

      // Filtre Expert
      const matchesExpert = selectedExpert === 'ALL' ||
        act.lead_expert_id === selectedExpert ||
        (act.collaborators_ids && act.collaborators_ids.includes(selectedExpert)) ||
        (act.sub_activities && act.sub_activities.some(s => s.lead_expert_id === selectedExpert));

      // Filtre Recherche textuelle
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        act.title.toLowerCase().includes(q) ||
        act.code.toLowerCase().includes(q) ||
        act.domain.toLowerCase().includes(q) ||
        (act.sub_activities && act.sub_activities.some(s => 
          s.title.toLowerCase().includes(q) || 
          s.code.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.deliverable_or_output && s.deliverable_or_output.toLowerCase().includes(q))
        ));

      // Filtre Mois Calendrier d'Exécution
      let matchesMonth = true;
      if (selectedMonthFilter === 'CURRENT') {
        matchesMonth = Boolean(act.sub_activities && act.sub_activities.some(s => s.calendar_months.includes('Nov-26')));
      } else if (selectedMonthFilter !== 'ALL') {
        matchesMonth = Boolean(act.sub_activities && act.sub_activities.some(s => s.calendar_months.includes(selectedMonthFilter)));
      }

      return matchesMilestone && matchesExpert && matchesSearch && matchesMonth;
    });
  }, [activities, selectedMilestone, selectedExpert, searchQuery, selectedMonthFilter]);

  // Statistiques globales du sous-module
  const totalSubCount = useMemo(() => {
    return activities.reduce((sum, a) => sum + (a.sub_activities?.length || 0), 0);
  }, [activities]);

  const activeCurrentMonthSubCount = useMemo(() => {
    return activities.reduce((sum, a) => {
      const subsInNov = (a.sub_activities || []).filter(s => s.calendar_months.includes('Nov-26'));
      return sum + subsInNov.length;
    }, 0);
  }, [activities]);

  const completedSubCount = useMemo(() => {
    return activities.reduce((sum, a) => {
      const completed = (a.sub_activities || []).filter(s => s.status === 'TERMINEE' || s.progress_pct >= 100);
      return sum + completed.length;
    }, 0);
  }, [activities]);

  const inProgressSubCount = useMemo(() => {
    return activities.reduce((sum, a) => {
      const inProg = (a.sub_activities || []).filter(s => s.status === 'EN_COURS' || (s.progress_pct > 0 && s.progress_pct < 100));
      return sum + inProg.length;
    }, 0);
  }, [activities]);

  const avgWeightedProgress = useMemo(() => {
    if (activities.length === 0) return 0;
    const totalProg = activities.reduce((sum, a) => sum + (a.progress_pct || 0), 0);
    return Math.round(totalProg / activities.length);
  }, [activities]);

  // Gestion des occurrences rapides
  const handleQuickOccurrence = (actId: string, sub: WorkPlanSubActivity, delta: number) => {
    const total = sub.total_occurrences || 1;
    const current = sub.completed_occurrences || 0;
    const nextVal = Math.max(0, Math.min(total, current + delta));
    const nextPct = Math.min(100, Math.round((nextVal / total) * 100));
    const nextStatus = nextPct >= 100 ? 'TERMINEE' : (nextPct > 0 ? 'EN_COURS' : 'A_VENIR');

    onUpdateSubActivity(actId, {
      ...sub,
      completed_occurrences: nextVal,
      progress_pct: nextPct,
      status: nextStatus,
    });
  };

  const handleQuickPctChange = (actId: string, sub: WorkPlanSubActivity, newPct: number) => {
    const pct = Math.max(0, Math.min(100, newPct));
    const total = sub.total_occurrences || 1;
    const computedOcc = Math.round((pct / 100) * total);
    const nextStatus = pct >= 100 ? 'TERMINEE' : (pct > 0 ? 'EN_COURS' : 'A_VENIR');

    onUpdateSubActivity(actId, {
      ...sub,
      progress_pct: pct,
      completed_occurrences: computedOcc,
      status: nextStatus,
    });
  };

  const handleStartAddSub = (act: WorkPlanActivity) => {
    const currentSubs = act.sub_activities || [];
    const nextNum = currentSubs.length + 1;
    setNewSubForm({
      code: `${act.code}.${nextNum}`,
      title: '',
      description: '',
      deliverable_or_output: '',
      weight_pct: 25,
      calendar_months: ['Nov-26'],
      frequency: 'CONTINU',
      total_occurrences: 1,
      completed_occurrences: 0,
      progress_pct: 0,
      status: 'EN_COURS',
      lead_expert_id: act.lead_expert_id,
    });
    setAddingToAct(act);
  };

  const handleSaveNewSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingToAct || !newSubForm.title || !newSubForm.code) return;

    const newSub: WorkPlanSubActivity = {
      id: `sub-${Date.now()}`,
      activity_id: addingToAct.id,
      code: newSubForm.code || `${addingToAct.code}.${(addingToAct.sub_activities || []).length + 1}`,
      title: newSubForm.title,
      description: newSubForm.description || '',
      deliverable_or_output: newSubForm.deliverable_or_output || '',
      weight_pct: Number(newSubForm.weight_pct) || 20,
      calendar_months: (newSubForm.calendar_months && newSubForm.calendar_months.length > 0) ? newSubForm.calendar_months : ['Nov-26'],
      frequency: newSubForm.frequency || 'CONTINU',
      total_occurrences: Number(newSubForm.total_occurrences) || 1,
      completed_occurrences: Number(newSubForm.completed_occurrences) || 0,
      progress_pct: Number(newSubForm.progress_pct) || 0,
      status: newSubForm.status || 'EN_COURS',
      lead_expert_id: newSubForm.lead_expert_id || addingToAct.lead_expert_id,
      execution_notes: newSubForm.execution_notes || '',
    };

    if (onAddSubActivity) {
      onAddSubActivity(addingToAct.id, newSub);
    }
    setAddingToAct(null);
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. BANNIÈRE RÉCAPITULATIVE & SÉLECTEUR DE MOIS DU CALENDRIER          */}
      {/* ==================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-lg p-5 text-white border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                Sous-Module Opérationnel
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Pondération 100% & Calendrier d’Exécution
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Mois Actif : Novembre 2026 (M2)
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1.5 uppercase tracking-tight">
              Décomposition des Activités & Évolution selon le Calendrier d’Exécution
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-0.5">
              Chaque activité du Work Plan est décomposée en sous-activités opérationnelles dont la somme des poids équivaut exactement à 100%. L’avancement en pourcentage évolue selon le calendrier d’exécution mensuel et les réalisations probantes.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-white/10 px-4 py-2.5 rounded-lg border border-white/15 backdrop-blur-xs shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Exécution Globale Pondérée
              </p>
              <p className="text-2xl font-bold font-mono text-teal-300">
                {avgWeightedProgress}%
              </p>
              <p className="text-[10px] text-slate-300">
                sur les 19 activités contractuelles
              </p>
            </div>
            <div className="h-10 w-px bg-white/20"></div>
            <div className="text-left">
              <p className="text-xs font-bold text-white">{totalSubCount} Sous-activités</p>
              <p className="text-[10px] text-emerald-300 font-medium">{activeCurrentMonthSubCount} actives en Nov 2026</p>
              <p className="text-[10px] text-slate-300">{completedSubCount} achevées • {inProgressSubCount} en cours</p>
            </div>
          </div>
        </div>

        {/* Barre de navigation temporelle par mois de l'année fiscale */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <span>📅 Filtrer par mois du calendrier d’exécution :</span>
            </span>
            <div className="flex items-center space-x-2 text-[11px]">
              <button 
                onClick={expandAll}
                className="text-teal-300 hover:text-white underline text-xs transition"
              >
                Tout déplier
              </button>
              <span className="text-white/30">•</span>
              <button 
                onClick={collapseAll}
                className="text-slate-400 hover:text-white underline text-xs transition"
              >
                Tout replier
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedMonthFilter('ALL')}
              className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition ${
                selectedMonthFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              Toute l’année (12 mois)
            </button>

            <button
              onClick={() => setSelectedMonthFilter('CURRENT')}
              className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
                selectedMonthFilter === 'CURRENT'
                  ? 'bg-teal-400 text-teal-950 shadow-xs'
                  : 'bg-teal-500/20 text-teal-200 border border-teal-500/40 hover:bg-teal-500/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              <span>Ce mois-ci : Novembre 2026</span>
            </button>

            {FISCAL_MONTHS.map(m => {
              const isSelected = selectedMonthFilter === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setSelectedMonthFilter(m.key)}
                  className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition flex items-center space-x-1 ${
                    isSelected
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : m.isCurrent
                      ? 'bg-blue-600/30 text-blue-200 border border-blue-400/50 hover:bg-blue-600/40'
                      : m.isPast
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/40'
                      : 'bg-white/5 text-slate-300 hover:bg-white/15'
                  }`}
                >
                  {m.isPast && <span className="text-[10px]">✓</span>}
                  <span>{m.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. LISTE DES ACTIVITÉS ET DE LEURS SOUS-ACTIVITÉS                     */}
      {/* ==================================================================== */}
      {filteredActivitiesWithSubs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400 font-sans shadow-xs">
          <p className="text-sm font-semibold">Aucune sous-activité ne correspond aux critères sélectionnés.</p>
          <p className="text-xs text-slate-400 mt-1">Modifiez vos filtres de jalon, de responsable ou de mois d’exécution.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivitiesWithSubs.map((act) => {
            const isExpanded = expandedCards.has(act.id);
            const subs = act.sub_activities || [];
            const lead = users.find(u => u.id === act.lead_expert_id);
            const isTransversal = act.milestone === 'TRANSVERSAL';
            const isB09 = act.milestone === 'B09';

            return (
              <div 
                key={act.id} 
                className={`bg-white rounded-lg border transition shadow-xs overflow-hidden ${
                  isExpanded ? 'border-slate-300 ring-1 ring-slate-200/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* En-tête de l'activité parente */}
                <div className="p-4 sm:p-5 bg-slate-50/60 border-b border-slate-200/80">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Ligne 1 : Badges & Méta */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-900 text-white">
                          {act.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isTransversal ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                          isB09 ? 'bg-teal-100 text-teal-900 border border-teal-200' :
                          'bg-indigo-100 text-indigo-900 border border-indigo-200'
                        }`}>
                          {act.milestone}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium truncate max-w-sm">
                          {act.domain}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                          <span>👤 {lead?.full_name || 'Équipe SaniNova'}</span>
                        </span>
                      </div>

                      {/* Ligne 2 : Titre de l'activité */}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                        {act.title}
                      </h3>

                      {/* Ligne 3 : Calendrier contractuel & mois */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                        <span>Période : <strong className="text-slate-700">{act.start_date}</strong> au <strong className="text-slate-700">{act.end_date}</strong></span>
                        <span>Zone : <strong className="text-slate-700">{act.geographic_zone}</strong></span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-slate-400">Mois actifs :</span>
                          <div className="flex gap-1 flex-wrap">
                            {(act.active_months || []).map(m => (
                              <span 
                                key={m} 
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                                  m === 'Nov-26' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                                  ['Oct-26'].includes(m) ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bloc d'avancement 100% pondéré */}
                    <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Avancement :</span>
                          <span className="text-xl sm:text-2xl font-bold font-mono text-teal-800">
                            {act.progress_pct}%
                          </span>
                          <span className="text-xs font-semibold text-slate-400">/ 100%</span>
                        </div>
                        <div className="w-36 sm:w-44 bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              act.progress_pct >= 100 ? 'bg-emerald-600' :
                              act.progress_pct > 0 ? 'bg-teal-600' : 'bg-slate-300'
                            }`}
                            style={{ width: `${act.progress_pct}%` }}
                          />
                        </div>
                        <p className="text-[9.5px] text-slate-400 mt-1 italic">
                          Calculé sur 100% ({subs.length} sous-activité{subs.length > 1 ? 's' : ''})
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => onOpenEditActivityModal(act)}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-100 rounded text-xs font-semibold transition"
                          title="Modifier l’activité générale"
                        >
                          Éditer
                        </button>
                        <button
                          onClick={() => toggleExpand(act.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition"
                          title={isExpanded ? 'Replier les sous-activités' : 'Déplier les sous-activités'}
                        >
                          <span className="text-xs font-bold font-mono">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Corps : Liste des Sous-Activités détaillées */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          Sous-activités & Découpage Calendaire ({subs.length})
                        </span>
                        <span className="text-[11px] text-teal-800 font-semibold">
                          • Somme des pondérations : {subs.reduce((s, x) => s + x.weight_pct, 0)}%
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartAddSub(act)}
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-[11px] font-bold transition flex items-center space-x-1 shadow-2xs"
                        title="Ajouter une action ou diligence imprévue à loger sous cette activité"
                      >
                        <span>+ Ajouter une sous-activité</span>
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      {subs.map((sub) => {
                        const subLead = users.find(u => u.id === sub.lead_expert_id);
                        const weightedContribution = ((sub.progress_pct * sub.weight_pct) / 100).toFixed(1);
                        const isCurrentMonthActive = sub.calendar_months.includes('Nov-26');

                        return (
                          <div 
                            key={sub.id} 
                            className={`p-4 rounded-lg border transition ${
                              isCurrentMonthActive 
                                ? 'border-teal-300 bg-teal-50/20 shadow-2xs' 
                                : 'border-slate-200 bg-slate-50/40 hover:bg-white'
                            }`}
                          >
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              {/* Colonne gauche : Description & Ce qui se fait */}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="font-mono text-xs font-bold text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-200">
                                    {sub.code}
                                  </span>
                                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                    {sub.title}
                                  </span>
                                  {isCurrentMonthActive && (
                                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-teal-600 text-white animate-pulse">
                                      En cours ce mois-ci
                                    </span>
                                  )}
                                </div>

                                {/* Ce qui se fait concrètement */}
                                <div className="text-xs text-slate-600 mt-2 bg-white p-2.5 rounded border border-slate-200/80">
                                  <p className="font-semibold text-slate-800 text-[11px] mb-0.5">
                                    📋 Ce qui se fait concrètement :
                                  </p>
                                  <p className="leading-relaxed">{sub.description}</p>

                                  {sub.deliverable_or_output && (
                                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-baseline gap-1.5 text-[11px] text-teal-950">
                                      <span className="font-bold shrink-0">📑 Livrable / Justificatif :</span>
                                      <span className="italic">{sub.deliverable_or_output}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Calendrier d'exécution mensuel */}
                                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">
                                    Calendrier d’exécution :
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {FISCAL_MONTHS.map(fm => {
                                      const isIncluded = sub.calendar_months.includes(fm.key);
                                      if (!isIncluded) return null;
                                      const isPassed = fm.isPast;
                                      const isNow = fm.isCurrent;

                                      return (
                                        <span 
                                          key={fm.key} 
                                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1 ${
                                            isNow
                                              ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                                              : isPassed
                                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                                          }`}
                                          title={`${fm.label} (${isNow ? 'Mois en cours' : isPassed ? 'Échu' : 'À venir'})`}
                                        >
                                          {isPassed && <span>✓</span>}
                                          <span>{fm.short}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    ({sub.frequency ? sub.frequency.toLowerCase() : 'périodique'})
                                  </span>
                                </div>
                              </div>

                              {/* Colonne droite : Poids 100%, Occurrences & Progression */}
                              <div className="w-full md:w-64 shrink-0 bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2.5">
                                {/* Poids contractuel sur 100% */}
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                    Poids dans l’activité :
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                    {sub.weight_pct}%
                                  </span>
                                </div>

                                {/* Compteur d'occurrences et boutons rapides */}
                                {sub.total_occurrences && (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                                        Occurrences :
                                      </span>
                                      <span className="font-bold text-slate-800 font-mono text-xs">
                                        {sub.completed_occurrences || 0} / {sub.total_occurrences} réalisé{sub.total_occurrences > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <button
                                        type="button"
                                        onClick={() => handleQuickOccurrence(act.id, sub, -1)}
                                        disabled={(sub.completed_occurrences || 0) <= 0}
                                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 font-bold text-xs flex items-center justify-center transition"
                                        title="Décrémenter d'une occurrence"
                                      >
                                        -
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickOccurrence(act.id, sub, 1)}
                                        disabled={(sub.completed_occurrences || 0) >= (sub.total_occurrences || 1)}
                                        className="w-6 h-6 rounded bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-30 font-bold text-xs flex items-center justify-center transition"
                                        title="Incrémenter d'une occurrence réalisée"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Taux d'avancement de la sous-activité */}
                                <div>
                                  <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      Progression :
                                    </span>
                                    <span className="font-mono font-bold text-sm text-slate-900">
                                      {sub.progress_pct}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        sub.progress_pct >= 100 ? 'bg-emerald-600' :
                                        sub.progress_pct > 0 ? 'bg-teal-600' : 'bg-slate-300'
                                      }`}
                                      style={{ width: `${sub.progress_pct}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                                    <span>Impact sur les 100% :</span>
                                    <span className="font-bold text-teal-800 font-mono">
                                      +{weightedContribution}%
                                    </span>
                                  </div>
                                </div>

                                {/* Statut & Édition rapide */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <select
                                    value={sub.status}
                                    onChange={(e) => {
                                      const newStatus = e.target.value as any;
                                      const newProg = newStatus === 'TERMINEE' ? 100 : (newStatus === 'A_VENIR' ? 0 : (sub.progress_pct === 0 ? 25 : sub.progress_pct));
                                      onUpdateSubActivity(act.id, {
                                        ...sub,
                                        status: newStatus,
                                        progress_pct: newProg,
                                        completed_occurrences: Math.round((newProg / 100) * (sub.total_occurrences || 1))
                                      });
                                    }}
                                    className="text-[10px] font-bold rounded px-2 py-1 bg-slate-100 border border-slate-200 text-slate-800 cursor-pointer"
                                  >
                                    <option value="A_VENIR">À venir</option>
                                    <option value="EN_COURS">En cours</option>
                                    <option value="TERMINEE">Terminée</option>
                                    <option value="EN_RETARD">En retard</option>
                                  </select>

                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingSub({ activityId: act.id, sub })}
                                      className="text-teal-800 hover:text-teal-900 font-bold text-[11px] underline"
                                    >
                                      Ajuster
                                    </button>
                                    {onDeleteSubActivity && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Confirmer la suppression de la sous-activité ${sub.code} ?`)) {
                                            onDeleteSubActivity(act.id, sub.id);
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-700 text-xs px-1 font-bold"
                                        title="Supprimer cette sous-activité"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MODAL DE MODIFICATION RAPIDE D'UNE SOUS-ACTIVITÉ                  */}
      {/* ==================================================================== */}
      {editingSub && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-teal-800">{editingSub.sub.code}</span>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 mt-0.5">
                  Ajuster l’état d’avancement de la sous-activité
                </h3>
              </div>
              <button
                onClick={() => setEditingSub(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateSubActivity(editingSub.activityId, editingSub.sub);
                setEditingSub(null);
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Intitulé de la sous-activité
                </label>
                <input
                  type="text"
                  value={editingSub.sub.title}
                  onChange={(e) => setEditingSub({ ...editingSub, sub: { ...editingSub.sub, title: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Ce qui se fait (Description opérationnelle)
                </label>
                <textarea
                  rows={3}
                  value={editingSub.sub.description}
                  onChange={(e) => setEditingSub({ ...editingSub, sub: { ...editingSub.sub, description: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Livrable / Justificatif attendu
                </label>
                <input
                  type="text"
                  value={editingSub.sub.deliverable_or_output || ''}
                  onChange={(e) => setEditingSub({ ...editingSub, sub: { ...editingSub.sub, deliverable_or_output: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Poids sur l’activité (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingSub.sub.weight_pct}
                    onChange={(e) => setEditingSub({ ...editingSub, sub: { ...editingSub.sub, weight_pct: Number(e.target.value) || 0 } })}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Taux d’avancement ({editingSub.sub.progress_pct}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={editingSub.sub.progress_pct}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      const total = editingSub.sub.total_occurrences || 1;
                      setEditingSub({
                        ...editingSub,
                        sub: {
                          ...editingSub.sub,
                          progress_pct: pct,
                          completed_occurrences: Math.round((pct / 100) * total),
                          status: pct >= 100 ? 'TERMINEE' : (pct > 0 ? 'EN_COURS' : 'A_VENIR')
                        }
                      });
                    }}
                    className="w-full mt-2 accent-teal-800"
                  />
                </div>
              </div>

              {editingSub.sub.total_occurrences && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Occurrences réalisées
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={editingSub.sub.total_occurrences}
                      value={editingSub.sub.completed_occurrences || 0}
                      onChange={(e) => {
                        const completed = Number(e.target.value) || 0;
                        const total = editingSub.sub.total_occurrences || 1;
                        const pct = Math.min(100, Math.round((completed / total) * 100));
                        setEditingSub({
                          ...editingSub,
                          sub: {
                            ...editingSub.sub,
                            completed_occurrences: completed,
                            progress_pct: pct,
                            status: pct >= 100 ? 'TERMINEE' : (pct > 0 ? 'EN_COURS' : 'A_VENIR')
                          }
                        });
                      }}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Total occurrences prévues
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingSub.sub.total_occurrences}
                      onChange={(e) => setEditingSub({ ...editingSub, sub: { ...editingSub.sub, total_occurrences: Number(e.target.value) || 1 } })}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Notes et observations d’exécution
                </label>
                <input
                  type="text"
                  placeholder="Ex : Réunion tenue le 04 nov, PV signé avec DTDI..."
                  value={editingSub.sub.execution_notes || ''}
                  onChange={(e) => setEditingSub({ ...editingSub, sub: { ...editingSub.sub, execution_notes: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingSub(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 shadow-xs"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 4. MODAL D'AJOUT D'UNE NOUVELLE SOUS-ACTIVITÉ (ACTION IMPRÉVUE DU WORK PLAN) */}
      {addingToAct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-teal-800">{addingToAct.code}</span>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 mt-0.5">
                  Ajouter une sous-activité / action non prévue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddingToAct(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSaveNewSub} className="p-5 space-y-4 text-xs">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px] leading-relaxed">
                Vous enregistrez une sous-activité sous <strong>[{addingToAct.code}] {addingToAct.title}</strong>.
                Elle s’intégrera automatiquement au calendrier d’exécution et au calcul de la pondération.
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubForm.code}
                    onChange={(e) => setNewSubForm({ ...newSubForm, code: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Intitulé de la sous-activité
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : Réunion d’urgence DPAS sur la régulation..."
                    value={newSubForm.title}
                    onChange={(e) => setNewSubForm({ ...newSubForm, title: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Ce qui se fait concrètement (Description opérationnelle)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Décrivez précisément les actions concrètes menées ou à mener..."
                  value={newSubForm.description}
                  onChange={(e) => setNewSubForm({ ...newSubForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Livrable / Justificatif attendu
                </label>
                <input
                  type="text"
                  placeholder="Ex : Procès-verbal de concertation signé, note technique..."
                  value={newSubForm.deliverable_or_output || ''}
                  onChange={(e) => setNewSubForm({ ...newSubForm, deliverable_or_output: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              {/* Sélection des mois d'exécution */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Mois d’exécution dans le calendrier :
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-1">
                  {FISCAL_MONTHS.map(fm => {
                    const isChecked = (newSubForm.calendar_months || []).includes(fm.key);
                    return (
                      <button
                        type="button"
                        key={fm.key}
                        onClick={() => {
                          const cur = newSubForm.calendar_months || [];
                          const next = cur.includes(fm.key) ? cur.filter(x => x !== fm.key) : [...cur, fm.key];
                          setNewSubForm({ ...newSubForm, calendar_months: next });
                        }}
                        className={`p-1.5 rounded text-[10px] font-mono font-bold border transition text-center ${
                          isChecked 
                            ? 'bg-teal-800 text-white border-teal-900 shadow-2xs' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {fm.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Poids (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={newSubForm.weight_pct}
                    onChange={(e) => setNewSubForm({ ...newSubForm, weight_pct: Number(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Avancement (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newSubForm.progress_pct || 0}
                    onChange={(e) => {
                      const p = Number(e.target.value) || 0;
                      setNewSubForm({ 
                        ...newSubForm, 
                        progress_pct: p,
                        status: p >= 100 ? 'TERMINEE' : (p > 0 ? 'EN_COURS' : 'A_VENIR')
                      });
                    }}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Statut
                  </label>
                  <select
                    value={newSubForm.status}
                    onChange={(e) => setNewSubForm({ ...newSubForm, status: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-bold"
                  >
                    <option value="EN_COURS">En cours</option>
                    <option value="TERMINEE">Terminée</option>
                    <option value="A_VENIR">À venir</option>
                    <option value="EN_RETARD">En retard</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAddingToAct(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 shadow-xs"
                >
                  Ajouter la sous-activité
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
