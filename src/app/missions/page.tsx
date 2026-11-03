'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { FieldMission, MissionStatus } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function MissionsPage() {
  const { missions, addMission, updateMissionStatus, users } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(missions[0]?.id || null);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeMission = missions.find(m => m.id === selectedMissionId) || missions[0] || null;

  const filteredMissions = missions.filter(m => {
    const matchesDept = selectedDept === 'ALL' || m.department === selectedDept;
    const matchesSearch = 
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.zone_sanitaire.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const [formData, setFormData] = useState<Partial<FieldMission>>({
    title: '',
    lead_expert_id: users[5]?.id || '', // Mohamed DJERIHO
    department: 'Atacora',
    zone_sanitaire: 'Natitingou-Boukoumbé-Toucountouna (NBT)',
    departure_date: '2026-11-15',
    return_date: '2026-11-20',
    objectives: '',
    visited_facilities: ['Hôpital de Zone Natitingou', 'CS Boukoumbé'],
    expected_results: '',
    status: 'BROUILLON',
    photos_count: 0,
    recommendations: [],
  });

  const handleCreateMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.objectives) return;

    const newMis: FieldMission = {
      id: `mis-${Date.now()}`,
      title: formData.title || '',
      lead_expert_id: formData.lead_expert_id || users[0].id,
      companion_expert_ids: [],
      department: formData.department || 'Atacora',
      zone_sanitaire: formData.zone_sanitaire || '',
      departure_date: formData.departure_date || '2026-11-15',
      return_date: formData.return_date || '2026-11-20',
      objectives: formData.objectives || '',
      visited_facilities: formData.visited_facilities || [],
      expected_results: formData.expected_results || '',
      status: formData.status || 'BROUILLON',
      photos_count: 0,
      recommendations: [],
    };
    addMission(newMis);
    setModalOpen(false);
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = missions.map(m => ({
        Titre: m.title,
        Responsable: users.find(u => u.id === m.lead_expert_id)?.full_name || 'Non assigné',
        Département: m.department,
        'Zone Sanitaire': m.zone_sanitaire,
        Départ: m.departure_date,
        Retour: m.return_date,
        Statut: m.status,
        'Nombre Recommandations': m.recommendations.length,
        'Photos Justificatives': m.photos_count,
      }));
      exportToExcel(data, 'SANINOVA_Missions_Terrain');
    } else {
      const headers = ['Titre de la mission', 'Expert', 'Département & Zone', 'Dates', 'Statut', 'Recommandations'];
      const rows = missions.map(m => [
        m.title.substring(0, 40) + (m.title.length > 40 ? '...' : ''),
        users.find(u => u.id === m.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === m.lead_expert_id)?.full_name.split(' ')[1] || ''),
        `${m.department} - ${m.zone_sanitaire.substring(0, 20)}`,
        `${m.departure_date} au ${m.return_date}`,
        m.status,
        `${m.recommendations.length} recommandation(s)`,
      ]);
      exportTableToPdf(
        'Registre des Missions de Terrain et Coaching',
        headers,
        rows,
        'SANINOVA_Missions_Terrain',
        'Suivi des supervisions, appui coaching eSIGL et approvisionnements'
      );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 5 : Terrain
            </span>
            <span className="text-xs text-slate-500 font-medium">Supervisions, Coaching & Recommandations</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Gestion des Missions de Terrain</h1>
          <p className="text-xs text-slate-500">
            Planification, suivi sur site, pièces justificatives et plan de suivi des recommandations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('excel')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition"
          >
            Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition"
          >
            PDF
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition"
          >
            + Planifier une Mission
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher une mission, zone, objectif..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600 font-medium">Département :</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les départements</option>
            <option value="Atacora">Atacora</option>
            <option value="Donga">Donga</option>
            <option value="Mono">Mono</option>
            <option value="Plateau">Plateau</option>
            <option value="Alibori">Alibori</option>
            <option value="National">National</option>
          </select>
        </div>
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredMissions.length === 0 ? (
            <div className="bg-white rounded-lg p-8 border border-slate-200 text-center text-xs text-slate-400">
              Aucune mission ne correspond à vos filtres.
            </div>
          ) : (
            filteredMissions.map((m) => {
              const lead = users.find(u => u.id === m.lead_expert_id);
              const isSelected = activeMission?.id === m.id;

              return (
                <div 
                  key={m.id}
                  onClick={() => setSelectedMissionId(m.id)}
                  className={`bg-white rounded-lg p-5 border transition cursor-pointer shadow-xs ${
                    isSelected ? 'border-teal-700 ring-1 ring-teal-700' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {m.department}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">{m.zone_sanitaire}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">{m.title}</h3>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                      m.status === 'CLOTUREE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      m.status === 'EN_COURS' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                      m.status === 'VALIDEE' ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    <span className="font-semibold text-slate-700">Objectifs :</span> {m.objectives}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <div>
                      <span>Dates : </span>
                      <span className="font-mono font-medium text-slate-700">{m.departure_date} au {m.return_date}</span>
                      <span className="ml-3 font-mono">Photos : {m.photos_count}</span>
                    </div>

                    <div className="font-semibold text-slate-800">
                      Lead : {lead?.full_name}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Mission Details & Recommendations Panel */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs h-fit">
          {activeMission ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Détail de la Mission
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{activeMission.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeMission.department} &bull; {activeMission.zone_sanitaire}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1">Structures sanitaires visitées :</h4>
                <div className="flex flex-wrap gap-1.5">
                  {activeMission.visited_facilities.map((fac, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700 font-medium">
                      {fac}
                    </span>
                  ))}
                </div>
              </div>

              {activeMission.mission_report_summary && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Synthèse du Rapport :</h4>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {activeMission.mission_report_summary}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-slate-800">
                    Plan de suivi des recommandations ({activeMission.recommendations.length})
                  </h4>
                </div>

                {activeMission.recommendations.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Aucune recommandation enregistrée.</p>
                ) : (
                  <div className="space-y-2">
                    {activeMission.recommendations.map((rec) => (
                      <div key={rec.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs">
                        <div className="flex justify-between font-semibold text-slate-800">
                          <span>{rec.target_entity}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            rec.status === 'CLOTUREE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1">{rec.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status workflow */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Changer le statut de la mission :
                </label>
                <div className="flex flex-wrap gap-1">
                  {(['VALIDEE', 'EN_COURS', 'REALISEE', 'CLOTUREE'] as MissionStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => updateMissionStatus(activeMission.id, st)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition border ${
                        activeMission.status === st
                          ? 'bg-teal-800 text-white border-teal-900'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Sélectionnez une mission à gauche pour consulter ses structures visitées, photos et recommandations.
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-lg">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">Planifier une Mission de Terrain</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-800 text-xs font-bold">
                Fermer
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Titre de la mission *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Supervision formative eSIGL et audit physique..."
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Département *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="Atacora">Atacora</option>
                    <option value="Donga">Donga</option>
                    <option value="Mono">Mono</option>
                    <option value="Plateau">Plateau</option>
                    <option value="Alibori">Alibori</option>
                    <option value="National">National</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsable</label>
                  <select
                    value={formData.lead_expert_id}
                    onChange={(e) => setFormData({ ...formData, lead_expert_id: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date départ</label>
                  <input
                    type="date"
                    value={formData.departure_date}
                    onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date retour</label>
                  <input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Objectifs de la mission *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.objectives}
                  onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
  );
}
