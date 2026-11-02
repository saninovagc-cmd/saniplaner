'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { WorkPlanActivity, MilestoneType, ActivityStatus } from '@/types';
import { 
  Plus, 
  Search, 
  Filter, 
  Table as TableIcon, 
  Kanban, 
  BarChart3, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Edit,
  X
} from 'lucide-react';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function WorkPlanPage() {
  const { activities, updateActivity, addActivity, users, currentUser } = useApp();

  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'gantt'>('table');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<WorkPlanActivity | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<WorkPlanActivity>>({
    code: '',
    milestone: 'B09',
    domain: '',
    title: '',
    description: '',
    methodology: '',
    lead_expert_id: users[1]?.id || '',
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

  const filteredActivities = activities.filter((act) => {
    const matchesMilestone = selectedMilestone === 'ALL' || act.milestone === selectedMilestone;
    const matchesExpert = selectedExpert === 'ALL' || act.lead_expert_id === selectedExpert;
    const matchesSearch = 
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.domain.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMilestone && matchesExpert && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setEditingActivity(null);
    setFormData({
      code: `ACT-${activities.length + 1}`,
      milestone: 'B09',
      domain: 'Gestion Logistique',
      title: '',
      description: '',
      methodology: '',
      lead_expert_id: users[1]?.id || '',
      geographic_zone: 'Atacora, Donga, Mono, Plateau',
      start_date: '2026-11-01',
      end_date: '2026-12-31',
      deadline: '2026-12-20',
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
        lead_expert_id: formData.lead_expert_id || users[0].id,
        collaborators_ids: [],
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

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = filteredActivities.map(a => ({
        Code: a.code,
        Milestone: a.milestone,
        Domaine: a.domain,
        Intitulé: a.title,
        Responsable: users.find(u => u.id === a.lead_expert_id)?.full_name || 'Non assigné',
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
        users.find(u => u.id === a.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === a.lead_expert_id)?.full_name.split(' ')[1] || ''),
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Module 2 : Work Plan
            </span>
            <span className="text-xs text-slate-500">Planification intégrée du projet</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Gestion du Plan de Travail</h1>
          <p className="text-xs text-slate-500">
            Suivi des engagements, responsabilités des 8 experts, chronogrammes et livrables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center space-x-1 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'table' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tableau</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'kanban' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition ${
                viewMode === 'gantt' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Gantt</span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => handleExport('excel')}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 text-xs font-medium transition"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleExport('pdf')}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 text-xs font-medium transition"
            title="Export PDF"
          >
            <Download className="w-4 h-4 text-teal-700" />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Activité</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher code, mot-clé, titre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Milestone :</span>
          </div>
          <select
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium outline-none focus:ring-1 focus:ring-teal-600"
          >
            <option value="ALL">Tous les jalons (B09, B13, Tr.)</option>
            <option value="B09">B09 - Promptitude eSIGL</option>
            <option value="B13">B13 - Quantification & Appro</option>
            <option value="TRANSVERSAL">Transversal / Gouvernance</option>
          </select>

          <div className="flex items-center space-x-1.5 text-xs text-slate-600 ml-2">
            <span>Expert Responsable :</span>
          </div>
          <select
            value={selectedExpert}
            onChange={(e) => setSelectedExpert(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium outline-none focus:ring-1 focus:ring-teal-600 max-w-[200px]"
          >
            <option value="ALL">Tous les experts</option>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Jalon</th>
                  <th className="p-3.5">Intitulé & Domaine</th>
                  <th className="p-3.5">Responsable</th>
                  <th className="p-3.5">Zone</th>
                  <th className="p-3.5">Échéance</th>
                  <th className="p-3.5">Avancement</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right">Actions</th>
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
                    return (
                      <tr key={act.id} className="hover:bg-slate-50/70 transition">
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
                        <td className="p-3.5 max-w-xs">
                          <div className="font-semibold text-slate-900">{act.title}</div>
                          <div className="text-[11px] text-slate-500">{act.domain}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-slate-700">{lead ? lead.full_name : 'Non assigné'}</span>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {act.geographic_zone}
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                          {act.deadline}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-teal-600 h-2 rounded-full"
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
                            className="p-1 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded transition"
                            title="Modifier l’activité"
                          >
                            <Edit className="w-4 h-4" />
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
              <div key={status} className="bg-slate-100/70 rounded-xl p-3 border border-slate-200">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {status.replace('_', ' ')}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 text-[11px] font-bold shadow-xs">
                    {list.length}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[600px] pr-1">
                  {list.map((act) => {
                    const lead = users.find(u => u.id === act.lead_expert_id);
                    return (
                      <div
                        key={act.id}
                        onClick={() => handleOpenEditModal(act)}
                        className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs hover:border-teal-500 cursor-pointer transition"
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

                        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium truncate max-w-[120px]">
                            {lead?.full_name.split(' ')[0]}
                          </span>
                          <span className="font-bold text-teal-700">{act.progress_pct}%</span>
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

      {/* VIEW 3: GANTT / CHRONOGRAMME */}
      {viewMode === 'gantt' && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Chronogramme d’Exécution (Octobre 2026 - Septembre 2027)</h3>
            <span className="text-xs text-slate-500 font-medium">Projection temporelle</span>
          </div>

          <div className="space-y-3">
            {filteredActivities.map((act) => {
              const lead = users.find(u => u.id === act.lead_expert_id);
              return (
                <div key={act.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{act.code} - {act.title}</span>
                      <p className="text-[11px] text-slate-500">
                        Responsable : <span className="font-semibold text-slate-700">{lead?.full_name}</span> | Zone : {act.geographic_zone}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-700">
                      Du {act.start_date} au {act.end_date} (Échéance : {act.deadline})
                    </span>
                  </div>

                  <div className="mt-3 relative w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${
                        act.status === 'TERMINEE' ? 'bg-emerald-500' :
                        act.status === 'EN_COURS' ? 'bg-teal-600' :
                        act.status === 'EN_RETARD' ? 'bg-red-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${act.progress_pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Statut : {act.status}</span>
                    <span className="font-bold text-teal-800">{act.progress_pct}% achevé</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EDIT / ADD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-sm text-slate-800">
                {editingActivity ? `Modifier l’activité ${editingActivity.code}` : 'Créer une nouvelle activité'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
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
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Milestone *</label>
                  <select
                    value={formData.milestone || 'B09'}
                    onChange={(e) => setFormData({ ...formData, milestone: e.target.value as MilestoneType })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Domaine d’intervention</label>
                <input
                  type="text"
                  value={formData.domain || ''}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expert Responsable</label>
                  <select
                    value={formData.lead_expert_id || ''}
                    onChange={(e) => setFormData({ ...formData, lead_expert_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.title})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Zone Géographique</label>
                  <input
                    type="text"
                    value={formData.geographic_zone || ''}
                    onChange={(e) => setFormData({ ...formData, geographic_zone: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Échéance finale</label>
                  <input
                    type="date"
                    value={formData.deadline || ''}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Statut</label>
                  <select
                    value={formData.status || 'A_VENIR'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ActivityStatus })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priorité</label>
                  <select
                    value={formData.priority || 'MOYENNE'}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                  placeholder="Livrable ou résultat attendu..."
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
