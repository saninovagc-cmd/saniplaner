'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { WorkPlanActivity, MilestoneType, ActivityStatus } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

function WorkPlanInner() {
  const { activities, updateActivity, addActivity, users, projectRisks, updateProjectRisk, currentUser } = useApp();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'gantt' | 'risks'>('table');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<WorkPlanActivity | null>(null);

  useEffect(() => {
    const expertParam = searchParams.get('expert');
    if (expertParam) {
      setSelectedExpert(expertParam);
    }
    const milestoneParam = searchParams.get('milestone');
    if (milestoneParam) {
      setSelectedMilestone(milestoneParam);
    }
  }, [searchParams]);

  // Form state
  const [formData, setFormData] = useState<Partial<WorkPlanActivity>>({
    code: '',
    milestone: 'B09',
    domain: '',
    title: '',
    description: '',
    methodology: '',
    lead_expert_id: currentUser?.id || users[0]?.id || '',
    geographic_zone: 'Atacora, Donga, Mono, Plateau',
    start_date: '2026-11-01',
    end_date: '2026-12-31',
    deadline: '2026-12-20',
    expected_result: '',
    status: 'EN_COURS',
    progress_pct: 0,
    priority: 'MOYENNE',
    observations: '',
  });

  // Gestion des personnes internes et externes impliquées
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [externalParticipants, setExternalParticipants] = useState<string[]>([]);
  const [externalInput, setExternalInput] = useState('');

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

  // Détection des activités sous la responsabilité des 3 RSCO
  const isRscoActivity = (act: WorkPlanActivity | Partial<WorkPlanActivity>) => {
    const domainLower = (act.domain || '').toLowerCase();
    const titleLower = (act.title || '').toLowerCase();
    return (
      domainLower.includes('rsco') ||
      titleLower.includes('rsco') ||
      ['B09.3', 'B09.4', 'B09.5', 'B09.6', 'B13.7', 'B13.8', 'B13.9'].includes(act.code || '') ||
      ['usr-rsco-1', 'usr-rsco-2', 'usr-rsco-3'].includes(act.lead_expert_id || '')
    );
  };

  const filteredActivities = activities.filter((act) => {
    const matchesMilestone = selectedMilestone === 'ALL' || act.milestone === selectedMilestone;
    const isRsco = isRscoActivity(act);
    const matchesExpert = selectedExpert === 'ALL' || 
      act.lead_expert_id === selectedExpert ||
      (isRsco && ['usr-rsco-1', 'usr-rsco-2', 'usr-rsco-3'].includes(selectedExpert)) ||
      (act.collaborators_ids && act.collaborators_ids.includes(selectedExpert));

    const matchesSearch = 
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (isRsco && 'rsco djeriho kouagou imorou atacora mono plateau donga alibori sakif pak'.includes(searchQuery.toLowerCase()));

    return matchesMilestone && matchesExpert && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setEditingActivity(null);
    setSelectedCollaboratorIds([]);
    setExternalParticipants([]);
    setExternalInput('');
    setFormData({
      code: `ACT-${activities.length + 1}`,
      milestone: 'B09',
      domain: '',
      title: '',
      description: '',
      methodology: '',
      lead_expert_id: currentUser.id,
      geographic_zone: '',
      start_date: '',
      end_date: '',
      deadline: '',
      expected_result: '',
      status: 'A_VENIR',
      progress_pct: 0,
      priority: 'MOYENNE',
      observations: '',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (act: WorkPlanActivity) => {
    setEditingActivity(act);
    setSelectedCollaboratorIds(act.collaborators_ids || []);
    setExternalParticipants(act.external_participants || []);
    setExternalInput('');
    setFormData(act);
    setModalOpen(true);
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.code) return;

    if (editingActivity) {
      updateActivity({
        ...editingActivity,
        ...formData,
        lead_expert_id: editingActivity.lead_expert_id || currentUser.id,
        collaborators_ids: selectedCollaboratorIds,
        external_participants: externalParticipants,
      } as WorkPlanActivity);
    } else {
      const newAct: WorkPlanActivity = {
        id: `act-${Date.now()}`,
        code: formData.code || `ACT-${activities.length + 1}`,
        milestone: formData.milestone || 'B09',
        domain: formData.domain || 'Gestion Logistique',
        title: formData.title || '',
        description: formData.description || '',
        methodology: formData.methodology || '',
        lead_expert_id: currentUser.id,
        collaborators_ids: selectedCollaboratorIds,
        external_participants: externalParticipants,
        associated_partners: ['PSI/ABMS'],
        geographic_zone: formData.geographic_zone || 'Atacora, Donga, Mono, Plateau',
        start_date: formData.start_date || '2026-11-01',
        end_date: formData.end_date || '2026-12-31',
        deadline: formData.deadline || '2026-12-20',
        expected_result: formData.expected_result || '',
        status: formData.status || 'A_VENIR',
        progress_pct: formData.progress_pct || 0,
        priority: formData.priority || 'MOYENNE',
        observations: formData.observations || '',
      };
      addActivity(newAct);
    }
    setModalOpen(false);
  };

  const handleSaveAndAddAnother = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.code) return;

    const newAct: WorkPlanActivity = {
      id: `act-${Date.now()}`,
      code: formData.code || `ACT-${activities.length + 1}`,
      milestone: formData.milestone || 'B09',
      domain: formData.domain || 'Gestion Logistique',
      title: formData.title || '',
      description: formData.description || '',
      methodology: formData.methodology || '',
      lead_expert_id: currentUser.id,
      collaborators_ids: selectedCollaboratorIds,
      external_participants: externalParticipants,
      associated_partners: ['PSI/ABMS'],
      geographic_zone: formData.geographic_zone || 'Atacora, Donga, Mono, Plateau',
      start_date: formData.start_date || '2026-11-01',
      end_date: formData.end_date || '2026-12-31',
      deadline: formData.deadline || '2026-12-20',
      expected_result: formData.expected_result || '',
      status: formData.status || 'A_VENIR',
      progress_pct: formData.progress_pct || 0,
      priority: formData.priority || 'MOYENNE',
      observations: formData.observations || '',
    };
    addActivity(newAct);

    // Réinitialiser pour l'activité suivante
    setFormData({
      code: '',
      milestone: formData.milestone || 'B09',
      domain: formData.domain || '',
      title: '',
      description: '',
      methodology: '',
      geographic_zone: formData.geographic_zone || '',
      start_date: formData.start_date || '',
      end_date: formData.end_date || '',
      deadline: formData.deadline || '',
      expected_result: '',
      status: 'A_VENIR',
      progress_pct: 0,
      priority: 'MOYENNE',
      observations: '',
    });
    setSelectedCollaboratorIds([]);
    setExternalParticipants([]);
    setExternalInput('');
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = filteredActivities.map(a => ({
        Code: a.code,
        Milestone: a.milestone,
        Domaine: a.domain,
        Intitulé: a.title,
        Responsable: isRscoActivity(a) 
          ? 'Les 3 RSCO (Mohamed DJERIWO, KOUAGOU Soumari, IMOROU T. Arafath)' 
          : (users.find(u => u.id === a.lead_expert_id)?.full_name || 'Non assigné'),
        Zone: a.geographic_zone,
        Début: a.start_date,
        Fin: a.end_date,
        Échéance: a.deadline,
        Avancement: `${a.progress_pct}%`,
        Statut: a.status,
        Priorité: a.priority,
      }));
      exportToExcel(data, 'SANINOVA_WorkPlan_Export');
    } else {
      const headers = ['Code', 'Milestone', 'Intitulé de l’activité', 'Responsable', 'Zone', 'Échéance', 'Avance.', 'Statut'];
      const rows = filteredActivities.map(a => [
        a.code,
        a.milestone,
        a.title.substring(0, 45) + (a.title.length > 45 ? '...' : ''),
        isRscoActivity(a)
          ? 'Les 3 RSCO (DJERIWO, KOUAGOU, IMOROU)'
          : (users.find(u => u.id === a.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === a.lead_expert_id)?.full_name.split(' ')[1] || '')),
        a.geographic_zone.substring(0, 20),
        a.deadline,
        `${a.progress_pct}%`,
        a.status,
      ]);
      exportTableToPdf(
        'Plan de Travail Opérationnel (Work Plan)',
        headers,
        rows,
        'SANINOVA_WorkPlan_Export',
        `Activités filtrées (${filteredActivities.length}) - Projet AFGHS-PSI Bénin`
      );
    }
  };

  return (
    <ModuleGuard moduleId="work_plan">
      <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 2 : Work Plan
            </span>
            <span className="text-xs text-slate-500 font-medium">Planification intégrée du projet</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Gestion du Plan de Travail</h1>
          <p className="text-xs text-slate-500">
            Suivi des engagements, responsabilités des 8 membres de l’équipe, chronogrammes et livrables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="bg-slate-100 p-1 rounded flex items-center space-x-1 border border-slate-200 overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${
                viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${
                viewMode === 'kanban' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${
                viewMode === 'gantt' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chronogramme Gantt
            </button>
            <button
              onClick={() => setViewMode('risks')}
              className={`px-3 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${
                viewMode === 'risks' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matrice des Risques
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => handleExport('excel')}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-medium transition"
          >
            Export Excel
          </button>

          <button
            onClick={() => handleExport('pdf')}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-medium transition"
          >
            Export PDF
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition"
          >
            + Nouvelle Activité
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher code, mot-clé, titre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-600 font-medium">Jalon :</span>
          <select
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les jalons (B09, B13, Tr.)</option>
            <option value="B09">B09 - Promptitude eSIGL</option>
            <option value="B13">B13 - Quantification & Appro</option>
            <option value="TRANSVERSAL">Transversal</option>
          </select>

          <span className="text-xs text-slate-600 font-medium ml-2">Responsable :</span>
          <select
            value={selectedExpert}
            onChange={(e) => setSelectedExpert(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none max-w-[200px]"
          >
            <option value="ALL">Tous les responsables</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW 1: TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Jalon</th>
                  <th className="p-3.5">Intitulé & Domaine</th>
                  <th className="p-3.5">Responsable</th>
                  <th className="p-3.5">Zone</th>
                  <th className="p-3.5">Échéance</th>
                  <th className="p-3.5">Avancement</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Aucune activité ne correspond à vos critères de recherche.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => {
                    const lead = users.find(u => u.id === act.lead_expert_id);
                    const isRsco = isRscoActivity(act);
                    return (
                      <tr key={act.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-mono font-bold text-slate-800">
                          {act.code}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.milestone === 'B09' ? 'badge-b09' : act.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                          }`}>
                            {act.milestone}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-sm">
                          <div className="font-semibold text-slate-900">{act.title}</div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>{act.domain}</span>
                            {act.budget_total_fcfa ? (
                              <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                {act.budget_total_fcfa.toLocaleString('fr-FR')} FCFA ({act.loe_days} j)
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3.5 min-w-[220px]">
                          {isRsco ? (
                            <div className="space-y-1">
                              <span className="font-bold text-[10px] uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                                Les 3 RSCO
                              </span>
                              <div className="text-[11px] text-slate-700 space-y-0.5 font-medium leading-tight">
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0"></span>
                                  <span>Mohamed DJERIWO <span className="text-[10px] text-slate-500 font-mono">(Atacora)</span></span>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0"></span>
                                  <span>KOUAGOU Soumari <span className="text-[10px] text-slate-500 font-mono">(Mono, Plateau)</span></span>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0"></span>
                                  <span>IMOROU T. Arafath <span className="text-[10px] text-slate-500 font-mono">(Donga, Alibori)</span></span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-slate-800">{lead ? lead.full_name : 'Non assigné'}</span>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {lead?.id === currentUser.id && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Moi
                                  </span>
                                )}
                                {act.collaborators_ids && act.collaborators_ids.length > 0 && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-teal-50 text-teal-800 border border-teal-200"
                                    title={users.filter(u => act.collaborators_ids?.includes(u.id)).map(u => u.full_name).join(', ')}
                                  >
                                    +{act.collaborators_ids.length} interne{act.collaborators_ids.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                {act.external_participants && act.external_participants.length > 0 && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                    title={act.external_participants.join(', ')}
                                  >
                                    +{act.external_participants.length} ext.
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {act.geographic_zone}
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                          {act.deadline}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-teal-700 h-1.5 rounded-full"
                                style={{ width: `${act.progress_pct}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-700 text-[11px]">{act.progress_pct}%</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.status === 'TERMINEE' ? 'bg-emerald-100 text-emerald-800' :
                            act.status === 'EN_COURS' ? 'bg-blue-100 text-blue-800' :
                            act.status === 'EN_RETARD' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {act.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleOpenEditModal(act)}
                            className="px-2 py-1 text-slate-700 hover:text-teal-800 hover:bg-slate-100 rounded text-[11px] font-semibold border border-slate-200 transition"
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

      {/* VIEW 2: KANBAN */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['A_VENIR', 'EN_COURS', 'TERMINEE', 'EN_RETARD'] as ActivityStatus[]).map((status) => {
            const list = filteredActivities.filter(a => a.status === status);
            return (
              <div key={status} className="bg-slate-100 rounded-lg p-3 border border-slate-200">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {status.replace('_', ' ')}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-white text-slate-700 text-[11px] font-bold border border-slate-200">
                    {list.length}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[600px] pr-1">
                  {list.map((act) => {
                    const lead = users.find(u => u.id === act.lead_expert_id);
                    const isRsco = isRscoActivity(act);
                    return (
                      <div
                        key={act.id}
                        onClick={() => handleOpenEditModal(act)}
                        className="bg-white p-3.5 rounded border border-slate-200 shadow-xs hover:border-teal-700 cursor-pointer transition"
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            act.milestone === 'B09' ? 'badge-b09' : act.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                          }`}>
                            {act.milestone}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">{act.code}</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 text-xs line-clamp-2">{act.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1">{act.geographic_zone}</p>

                        <div className="mt-3 pt-2 border-t border-slate-100">
                          {isRsco ? (
                            <div className="text-[10px]">
                              <span className="font-bold text-teal-800 uppercase block mb-0.5">Responsables (Les 3 RSCO) :</span>
                              <span className="text-slate-700 font-medium leading-tight block">
                                M. DJERIWO, S. KOUAGOU, A. IMOROU
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-600 font-medium truncate max-w-[120px]">
                                {lead?.full_name.split(' ')[0]}
                              </span>
                              <span className="font-bold text-teal-800">{act.progress_pct}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: GANTT CHRONOGRAMME OFFICIEL (OCT 2026 - SEPT 2027) */}
      {viewMode === 'gantt' && (
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Chronogramme Officiel d’Exécution (Section 4 du Plan de Travail)
              </h3>
              <p className="text-xs text-slate-500">
                Octobre 2026 – Septembre 2027 (12 mois) + Période de vérification fermée à la programmation (Octobre/Novembre 2027).
              </p>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 bg-teal-800 text-white font-bold flex items-center justify-center rounded-xs text-[9px]">X</span>
                <span className="text-slate-600 font-medium">Mois de mise en œuvre</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 bg-amber-600 text-white font-bold flex items-center justify-center rounded-xs text-[9px]">V</span>
                <span className="text-slate-600 font-medium">Soumission des preuves</span>
              </span>
            </div>
          </div>

          {/* Detailed Monthly Schedule Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3 border-r border-slate-200 w-24">Code</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[280px]">Activité & Responsable</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10">Oct</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10">Nov</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10">Déc</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10 bg-slate-50">Jan</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10 bg-slate-50">Fév</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10 bg-slate-50">Mar</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10">Avr</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10">Mai</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10">Juin</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10 bg-slate-50">Juil</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10 bg-slate-50">Août</th>
                  <th className="py-2 px-1 text-center border-r border-slate-200 w-10 bg-slate-50">Sep</th>
                  <th className="py-2 px-1 text-center w-16 bg-amber-50/50 text-amber-900 font-bold">Oct/Nov</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredActivities.map((act) => {
                  const lead = users.find(u => u.id === act.lead_expert_id);
                  const isTransversal = act.milestone === 'TRANSVERSAL';
                  const isB09 = act.milestone === 'B09';

                  // Official schedule months mapping from Section 4
                  const activeMonthsMap: Record<string, string[]> = {
                    'B09/B13.1': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar'],
                    'B09.1': ['dec', 'jun'],
                    'B09.2': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'],
                    'B09.3': ['oct', 'nov'],
                    'B09.4': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'],
                    'B09.5': ['jan', 'jul'],
                    'B09.6': ['nov', 'feb', 'may', 'aug'],
                    'B09.7': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'],
                    'B13.1': ['nov', 'dec', 'may', 'jun'],
                    'B13.2': ['feb', 'aug'],
                    'B13.3': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'],
                    'B13.4': ['dec', 'mar', 'jun', 'sep'],
                    'B13.5': ['jan'],
                    'B13.6': ['may', 'aug'],
                    'B13.7': ['nov', 'may'],
                    'B13.8': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'],
                    'B13.9': ['jun', 'jul', 'aug', 'sep'],
                    'B13.10': ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'],
                    'B13.11': ['jan', 'feb', 'mar'],
                  };

                  const activeMonths = activeMonthsMap[act.code] || [];
                  const hasVerif = act.code === 'B09.7' || act.code === 'B13.10';

                  const monthKeys = ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'];

                  return (
                    <tr key={act.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800 border-r border-slate-200">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                          isTransversal ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                          isB09 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {act.code}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-900 leading-tight">{act.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-teal-800">
                            {isRscoActivity(act) ? 'Les 3 RSCO (DJERIWO, KOUAGOU, IMOROU)' : lead?.full_name}
                          </span>
                          <span>&bull;</span>
                          <span>{act.geographic_zone}</span>
                          <span>&bull;</span>
                          <span className="font-bold">{act.progress_pct}%</span>
                        </div>
                      </td>
                      {monthKeys.map((m) => {
                        const isActive = activeMonths.includes(m);
                        return (
                          <td key={m} className="py-1 px-1 text-center border-r border-slate-200">
                            {isActive ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-teal-800 text-white font-bold text-[10px]">
                                X
                              </span>
                            ) : (
                              <span className="text-slate-300">&middot;</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1 px-1 text-center bg-amber-50/50">
                        {hasVerif ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-600 text-white font-bold text-[10px]">
                            V
                          </span>
                        ) : (
                          <span className="text-slate-300">&middot;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: MATRICE DES RISQUES ET DEPENDANCES (SECTION 6 DU PLAN) */}
      {viewMode === 'risks' && (
        <div className="space-y-6">
          {/* Risk Overview Header */}
          <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 uppercase">
                  Section 6 du Plan de Travail
                </span>
                <span className="text-xs text-slate-500 font-medium">Gouvernance des Risques</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1 uppercase tracking-tight">
                Matrice des Risques et Dépendances Affectant la Réalisation des Milestones
              </h2>
              <p className="text-xs text-slate-500">
                Dispositif d’atténuation proactive, suivi opérationnel et propriétaires désignés (Conseiller Sénior, SIS, S&E, RSCO).
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                1 Sous Contrôle
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">
                2 Sous Vigilance
              </span>
              <span className="px-3 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded font-bold">
                1 Action Requise
              </span>
            </div>
          </div>

          {/* Risk Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectRisks.map((risk) => {
              const isAction = risk.status === 'ACTION_REQUISE';
              const isVigilance = risk.status === 'VIGILANCE';

              return (
                <div
                  key={risk.id}
                  className={`bg-white rounded-lg p-5 border shadow-xs flex flex-col justify-between transition ${
                    isAction ? 'border-rose-300 ring-1 ring-rose-200' :
                    isVigilance ? 'border-amber-300' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {risk.code}
                        </span>
                        <span className="text-[11px] font-bold text-teal-800">
                          {risk.milestones_affected}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200" title="Probabilité / Impact">
                          P/I : {risk.likelihood_impact}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {risk.description}
                    </h3>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Stratégie & Plan d’Atténuation SaniNova :
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {risk.mitigation}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Propriétaire(s) du Risque</p>
                      <p className="font-semibold text-slate-800 text-[11px]">{risk.owner_name}</p>
                      <p className="text-[10px] text-slate-500">{risk.owner_role}</p>
                    </div>

                    <div className="text-right">
                      <label className="block text-[10px] text-slate-400 font-semibold uppercase mb-1">Niveau d’Alerte</label>
                      <select
                        value={risk.status}
                        onChange={(e) => updateProjectRisk({ ...risk, status: e.target.value as any })}
                        className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${
                          risk.status === 'ACTION_REQUISE' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                          risk.status === 'VIGILANCE' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                          'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <option value="SOUS_CONTROLE">Sous Contrôle</option>
                        <option value="VIGILANCE">Vigilance</option>
                        <option value="ACTION_REQUISE">Action Requise</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EDIT / ADD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                {editingActivity ? `Modifier l’activité ${editingActivity.code}` : 'Créer une nouvelle activité'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code de l’activité *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Milestone *</label>
                  <select
                    value={formData.milestone || 'B09'}
                    onChange={(e) => setFormData({ ...formData, milestone: e.target.value as MilestoneType })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="B09">B09 - Promptitude eSIGL</option>
                    <option value="B13">B13 - Quantification & Appro</option>
                    <option value="TRANSVERSAL">Transversal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Intitulé de l’activité *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Domaine d’intervention</label>
                <input
                  type="text"
                  value={formData.domain || ''}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              {isRscoActivity(formData) && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-900">
                  <span className="font-bold block uppercase text-[10px]">Activité sous la responsabilité des 3 RSCO :</span>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-medium">
                    <span className="bg-white px-2 py-0.5 rounded border border-teal-300">Mohamed DJERIWO (Atacora)</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-teal-300">KOUAGOU Soumari (Mono, Plateau)</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-teal-300">IMOROU T. Arafath (Donga, Alibori)</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Responsable verrouillé et grisé */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block font-semibold text-slate-700">Responsable Principal *</label>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                      Verrouillé (Votre compte)
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={`${(users.find(u => u.id === (editingActivity?.lead_expert_id || currentUser.id)) || currentUser).full_name} (${(users.find(u => u.id === (editingActivity?.lead_expert_id || currentUser.id)) || currentUser).title})`}
                    className="w-full border border-slate-300 rounded p-2 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed select-none shadow-xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Votre compte est automatiquement désigné responsable principal.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Zone Géographique</label>
                  <input
                    type="text"
                    value={formData.geographic_zone || ''}
                    onChange={(e) => setFormData({ ...formData, geographic_zone: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date début</label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Échéance finale</label>
                  <input
                    type="date"
                    value={formData.deadline || ''}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Statut</label>
                  <select
                    value={formData.status || 'A_VENIR'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ActivityStatus })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="A_VENIR">À venir</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="TERMINEE">Terminée</option>
                    <option value="EN_RETARD">En retard</option>
                    <option value="SUSPENDUE">Suspendue</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Avancement (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress_pct || 0}
                    onChange={(e) => setFormData({ ...formData, progress_pct: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priorité</label>
                  <select
                    value={formData.priority || 'MOYENNE'}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="BASSE">Basse</option>
                    <option value="MOYENNE">Moyenne</option>
                    <option value="HAUTE">Haute</option>
                    <option value="CRITIQUE">Critique</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Résultat Attendu & Observations</label>
                <textarea
                  rows={2}
                  value={formData.expected_result || ''}
                  onChange={(e) => setFormData({ ...formData, expected_result: e.target.value })}
                  placeholder=""
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              {/* Personnes internes à impliquer (Membres de l'équipe SaniNova) - Après Résultat attendu */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block font-bold text-slate-800 text-xs">
                    Personnes internes à impliquer (Équipe SaniNova)
                  </label>
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {selectedCollaboratorIds.length} sélectionné(e){selectedCollaboratorIds.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cochez les autres membres de l’équipe qui participent à la mise en œuvre de cette activité :
                </p>
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

              {/* Personnes externes à impliquer (Partenaires, DDS, MCZS, FOSA...) - Après Résultat attendu */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block font-bold text-slate-800 text-xs">
                    Personnes externes à impliquer (DDS, Zone Sanitaire, MCZS, FOSA, Partenaires...)
                  </label>
                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    {externalParticipants.length} externe{externalParticipants.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Saisissez le nom ou l’organisme des intervenants externes et validez :
                </p>
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

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                {!editingActivity && (
                  <button
                    type="button"
                    onClick={handleSaveAndAddAnother}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded font-bold text-xs transition"
                  >
                    + Enregistrer & Ajouter une autre
                  </button>
                )}
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

export default function WorkPlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-sans">Chargement du Plan de Travail...</div>}>
      <WorkPlanInner />
    </Suspense>
  );
}
