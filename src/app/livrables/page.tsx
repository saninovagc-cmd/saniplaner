'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { DeliverableStatus } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

const WORKFLOW_STEPS: { key: DeliverableStatus; label: string; desc: string }[] = [
  { key: 'PREPARATION', label: '1. Préparation', desc: 'Rédaction par l’expert responsable' },
  { key: 'SOUMISSION_INTERNE', label: '2. Soumission', desc: 'Dépôt pour revue interne' },
  { key: 'VERIFICATION', label: '3. Vérification S&E', desc: 'Contrôle qualité des preuves' },
  { key: 'VALIDATION_DIRECTION', label: '4. Validation Direction', desc: 'Approbation finale' },
  { key: 'TRANSMISSION_PSI', label: '5. Transmis PSI', desc: 'Remis à PSI/ABMS' },
  { key: 'ARCHIVE', label: '6. Archivé', desc: 'Dossier clos et scellé' },
];

export default function DeliverablesPage() {
  const { deliverables, updateDeliverableStatus, users } = useApp();

  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredDeliverables = deliverables.filter(d => {
    const matchesMilestone = selectedMilestone === 'ALL' || d.milestone === selectedMilestone;
    const matchesStatus = selectedStatus === 'ALL' || d.validation_status === selectedStatus;
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.recipient.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMilestone && matchesStatus && matchesSearch;
  });

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = deliverables.map(d => ({
        Code: d.code,
        Titre: d.title,
        Milestone: d.milestone,
        Type: d.deliverable_type,
        Responsable: users.find(u => u.id === d.lead_expert_id)?.full_name || 'Non assigné',
        'Date Prévue': d.due_date,
        'Date Transmission': d.actual_submission_date || 'En attente',
        Destinataire: d.recipient,
        Version: d.version,
        Statut: d.validation_status,
        Commentaires: d.comments || '',
      }));
      exportToExcel(data, 'SANINOVA_Livrables_Contractuels');
    } else {
      const headers = ['Code', 'Titre du Livrable', 'Jalon', 'Responsable', 'Échéance', 'Destinataire', 'Statut'];
      const rows = deliverables.map(d => [
        d.code,
        d.title.substring(0, 40) + '...',
        d.milestone,
        users.find(u => u.id === d.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === d.lead_expert_id)?.full_name.split(' ')[1] || ''),
        d.due_date,
        d.recipient,
        d.validation_status,
      ]);
      exportTableToPdf(
        'Suivi des Livrables Contractuels et Opérationnels PSI/ABMS',
        headers,
        rows,
        'SANINOVA_Livrables_Contractuels',
        'Workflow d’approbation interne et traçabilité des transmissions officielles'
      );
    }
  };

  return (
    <ModuleGuard moduleId="livrables">
      <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 7 : Livrables
            </span>
            <span className="text-xs text-slate-500 font-medium">Engagements Contractuels PSI/ABMS</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Gestion & Circuit des Livrables</h1>
          <p className="text-xs text-slate-500">
            Workflow formel : Préparation &rarr; Soumission interne &rarr; Vérification &rarr; Validation Direction &rarr; Transmission PSI.
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
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold transition"
          >
            PDF
          </button>
        </div>
      </div>

      {/* Workflow Explanation Banner */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs">
        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-3">
          Circuit d’Approbation et de Transmission PSI/ABMS
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WORKFLOW_STEPS.map((st) => (
            <div key={st.key} className="p-2.5 rounded bg-slate-50 border border-slate-200 text-center">
              <span className="block text-xs font-bold text-slate-900">{st.label}</span>
              <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">{st.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher code, titre, destinataire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Jalon :</span>
          <select
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les jalons</option>
            <option value="B09">B09 - Promptitude eSIGL</option>
            <option value="B13">B13 - Quantification & Appro</option>
            <option value="TRANSVERSAL">Transversal</option>
          </select>

          <span className="text-xs text-slate-600 font-medium ml-2">Circuit :</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Toutes les étapes</option>
            <option value="PREPARATION">1. Préparation</option>
            <option value="SOUMISSION_INTERNE">2. Soumission</option>
            <option value="VERIFICATION">3. Vérification S&E</option>
            <option value="VALIDATION_DIRECTION">4. Validation Direction</option>
            <option value="TRANSMISSION_PSI">5. Transmis PSI</option>
            <option value="ARCHIVE">6. Archivé</option>
          </select>
        </div>
      </div>

      {/* Deliverables List */}
      <div className="space-y-4">
        {filteredDeliverables.length === 0 ? (
          <div className="bg-white rounded-lg p-8 border border-slate-200 text-center text-xs text-slate-400">
            Aucun livrable ne correspond à vos critères de recherche.
          </div>
        ) : (
          filteredDeliverables.map((deliv) => {
          const lead = users.find(u => u.id === deliv.lead_expert_id);
          const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.key === deliv.validation_status);

          return (
            <div key={deliv.id} className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-teal-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {deliv.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      deliv.milestone === 'B09' ? 'badge-b09' : deliv.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                    }`}>
                      {deliv.milestone}
                    </span>
                    <span className="text-xs text-slate-400">&bull; Version {deliv.version}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{deliv.title}</h3>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500">Destinataire :</span>
                  <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                    {deliv.recipient}
                  </span>
                </div>
              </div>

              {/* Step indicator visual */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {WORKFLOW_STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`p-2 rounded text-center text-xs font-medium border transition ${
                        isCurrent
                          ? 'bg-teal-800 text-white border-teal-900 shadow-xs font-bold'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] truncate">{step.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Details & Actions row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Responsable :</span> {lead?.full_name} ({lead?.title})
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Date limite prévue :</span> {deliv.due_date}
                    {deliv.actual_submission_date && (
                      <span className="ml-3 text-emerald-800 font-semibold font-mono">
                        Transmis le : {deliv.actual_submission_date}
                      </span>
                    )}
                  </div>
                  {deliv.final_file_name && (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-teal-800 font-medium">
                        Fichier : {deliv.final_file_name}
                      </span>
                      <Link 
                        href="/documentation" 
                        className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline"
                      >
                        Consulter dans la GED &rarr;
                      </Link>
                    </div>
                  )}
                  {deliv.comments && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5">
                      Note : {deliv.comments}
                    </p>
                  )}
                </div>

                {/* Status action buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {deliv.validation_status === 'PREPARATION' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'SOUMISSION_INTERNE')}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-xs"
                    >
                      Soumettre pour vérification
                    </button>
                  )}

                  {deliv.validation_status === 'SOUMISSION_INTERNE' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'VERIFICATION')}
                      className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold shadow-xs"
                    >
                      Vérifier (S&E)
                    </button>
                  )}

                  {deliv.validation_status === 'VERIFICATION' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'VALIDATION_DIRECTION')}
                      className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs"
                    >
                      Valider (Direction)
                    </button>
                  )}

                  {deliv.validation_status === 'VALIDATION_DIRECTION' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'TRANSMISSION_PSI')}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-xs"
                    >
                      Transmettre à PSI/ABMS
                    </button>
                  )}

                  {deliv.validation_status === 'TRANSMISSION_PSI' && (
                    <span className="text-emerald-800 font-bold px-2 py-1 bg-emerald-100 rounded border border-emerald-200">
                      Officiellement transmis à PSI/ABMS
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  </ModuleGuard>
  );
}
