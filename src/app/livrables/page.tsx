'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Deliverable, DeliverableStatus } from '@/types';
import { 
  FileCheck2, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  ArrowRight,
  ShieldCheck,
  FileText,
  UserCheck
} from 'lucide-react';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

const WORKFLOW_STEPS: { key: DeliverableStatus; label: string; desc: string }[] = [
  { key: 'PREPARATION', label: '1. Préparation', desc: 'Rdaction par l’expert responsable' },
  { key: 'SOUMISSION_INTERNE', label: '2. Soumission', desc: 'Dépôt pour revue interne' },
  { key: 'VERIFICATION', label: '3. Vérification S&E', desc: 'Contrôle qualité des preuves' },
  { key: 'VALIDATION_DIRECTION', label: '4. Validation Direction', desc: 'Approbation finale' },
  { key: 'TRANSMISSION_PSI', label: '5. Transmis PSI', desc: 'Remis à PSI/ABMS' },
  { key: 'ARCHIVE', label: '6. Archivé', desc: 'Dossier clos et scellé' },
];

export default function DeliverablesPage() {
  const { deliverables, updateDeliverableStatus, users, currentUser } = useApp();

  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');

  const filteredDeliverables = deliverables.filter(d => {
    return selectedMilestone === 'ALL' || d.milestone === selectedMilestone;
  });

  const isDirectionOrSenior = currentUser.role === 'direction' || currentUser.role === 'senior_advisor';

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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Module 7 : Livrables
            </span>
            <span className="text-xs text-slate-500">Engagements Contractuels PSI/ABMS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Gestion & Circuit des Livrables</h1>
          <p className="text-xs text-slate-500">
            Workflow formel : Préparation &rarr; Soumission interne &rarr; Vérification &rarr; Validation Direction &rarr; Transmission PSI.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Workflow Explanation Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Circuit d’Approbation et de Transmission PSI/ABMS
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WORKFLOW_STEPS.map((st, i) => (
            <div key={st.key} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
              <span className="block text-xs font-bold text-slate-800">{st.label}</span>
              <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">{st.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deliverables List */}
      <div className="space-y-4">
        {filteredDeliverables.map((deliv) => {
          const lead = users.find(u => u.id === deliv.lead_expert_id);
          const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.key === deliv.validation_status);

          return (
            <div key={deliv.id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {deliv.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      deliv.milestone === 'B09' ? 'badge-b09' : deliv.milestone === 'B13' ? 'badge-b13' : 'badge-transversal'
                    }`}>
                      {deliv.milestone}
                    </span>
                    <span className="text-xs text-slate-400">&bull; Version {deliv.version}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{deliv.title}</h3>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500">Destinataire :</span>
                  <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded">
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
                      className={`p-2 rounded-lg text-center text-xs font-medium border transition ${
                        isCurrent
                          ? 'bg-teal-700 text-white border-teal-800 shadow-sm font-bold'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className="text-[10px] truncate">{step.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Details & Actions row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Responsable :</span> {lead?.full_name} ({lead?.title})
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Date limite prévue :</span> {deliv.due_date}
                    {deliv.actual_submission_date && (
                      <span className="ml-3 text-emerald-700 font-semibold">
                        Transmis le : {deliv.actual_submission_date}
                      </span>
                    )}
                  </div>
                  {deliv.final_file_name && (
                    <div className="flex items-center space-x-1 text-teal-800 font-medium">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{deliv.final_file_name}</span>
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
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Soumettre pour vérification
                    </button>
                  )}

                  {deliv.validation_status === 'SOUMISSION_INTERNE' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'VERIFICATION')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Vérifier (S&E)
                    </button>
                  )}

                  {deliv.validation_status === 'VERIFICATION' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'VALIDATION_DIRECTION')}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Valider (Direction)
                    </button>
                  )}

                  {deliv.validation_status === 'VALIDATION_DIRECTION' && (
                    <button
                      onClick={() => updateDeliverableStatus(deliv.id, 'TRANSMISSION_PSI')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      <span>Transmettre à PSI/ABMS</span>
                    </button>
                  )}

                  {deliv.validation_status === 'TRANSMISSION_PSI' && (
                    <span className="flex items-center space-x-1 text-emerald-700 font-bold px-2 py-1 bg-emerald-100 rounded">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Officiellement transmis à PSI/ABMS</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
