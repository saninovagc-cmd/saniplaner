'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function B13Page() {
  const { b13Items, users } = useApp();

  const [selectedSemester] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const predefinedDeliverables = b13Items.filter(i => i.is_predefined_deliverable);
  const operationalItems = b13Items.filter(i => !i.is_predefined_deliverable);

  const filteredOperational = operationalItems.filter(item => {
    const matchesSemester = selectedSemester === 'ALL' || item.semester === selectedSemester;
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSemester && matchesCat;
  });

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = b13Items.map(item => ({
        Type: item.is_predefined_deliverable ? 'LIVRABLE OFFICIEL SEMESTRIEL' : 'SUIVI OPERATIONNEL',
        Catégorie: item.category,
        Titre: item.title,
        Semestre: item.semester,
        Responsable: users.find(u => u.id === item.lead_expert_id)?.full_name || 'Non assigné',
        Échéance: item.execution_date,
        Avancement: `${item.progress_pct}%`,
        Statut: item.status,
        Remarques: item.notes || '',
      }));
      exportToExcel(data, 'SANINOVA_B13_Quantification_Appro');
    } else {
      const headers = ['Type', 'Catégorie', 'Intitulé / Composante', 'Semestre', 'Responsable', 'Avance.', 'Statut'];
      const rows = b13Items.map(item => [
        item.is_predefined_deliverable ? 'LIVRABLE OFFICIEL' : 'OPÉRATIONNEL',
        item.category,
        item.title.substring(0, 45) + (item.title.length > 45 ? '...' : ''),
        item.semester === 'S1_2026_2027' ? 'Semestre 1' : 'Semestre 2',
        users.find(u => u.id === item.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === item.lead_expert_id)?.full_name.split(' ')[1] || ''),
        `${item.progress_pct}%`,
        item.status,
      ]);
      exportTableToPdf(
        'Suivi du Milestone B13 : Quantification et Approvisionnements',
        headers,
        rows,
        'SANINOVA_B13_Quantification_Appro',
        'Distinction entre les 2 Livrables Semestriels officiels et le suivi opérationnel'
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
              Milestone B13
            </span>
            <span className="text-xs text-slate-500 font-medium">Quantification Reports and Distribution Plans</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            Suivi Spécifique B13 — Quantification & Plans d’Approvisionnement
          </h1>
          <p className="text-xs text-slate-500">
            Pilotage QAT, GTT, validation ILP, POA départementaux et conformité des 2 livrables semestriels PSI.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('excel')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition"
          >
            Export Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold transition"
          >
            Synthèse PDF
          </button>
        </div>
      </div>

      {/* SECTION 1: LES 2 LIVRABLES SEMESTRIELS OFFICIELS */}
      <div className="bg-slate-900 rounded-lg p-6 text-white border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Les Deux Livrables Prédéfinis Contractuels B13 (Comptabilisés par Semestre)
          </h2>
          <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded text-teal-300 font-bold border border-slate-700">
            Jalonnement PSI/ABMS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {predefinedDeliverables.map((deliv, index) => {
            const lead = users.find(u => u.id === deliv.lead_expert_id);
            return (
              <div key={deliv.id} className="bg-slate-800/80 rounded p-4 border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                      Livrable Semestriel #{index + 1} ({deliv.semester.replace('_', ' ')})
                    </span>
                    <h3 className="font-bold text-sm text-white mt-1">{deliv.title}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    deliv.status === 'VALIDE' || deliv.status === 'TRANSMIS'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {deliv.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[11px] block text-slate-400">Responsable :</span>
                    <span className="font-semibold text-white">{lead?.full_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] block text-slate-400">Échéance prévue :</span>
                    <span className="font-mono font-semibold text-amber-300">{deliv.execution_date}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1 text-slate-400">
                    <span>Avancement de la production</span>
                    <span className="font-bold text-white">{deliv.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-teal-500 h-1.5 rounded-full" 
                      style={{ width: `${deliv.progress_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: SUIVI OPERATIONNEL */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Composantes Opérationnelles B13 (Validation ILP, QAT, GTT, POA, CPS)
            </h3>
            <p className="text-xs text-slate-500">
              Suivi technique continu par le Conseiller Senior et les Conseillers Régionaux
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 font-medium">Catégorie :</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
            >
              <option value="ALL">Toutes les sous-activités</option>
              <option value="ILP_VALIDATION">Validation des données ILP</option>
              <option value="QUANTIFICATION">Quantification</option>
              <option value="GTT_MEETING">Réunions GTT</option>
              <option value="POA_MANAGEMENT">Gestion des 9 POA</option>
              <option value="CPS_CAMPAIGN">Campagne CPS Alibori</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOperational.map((item) => {
            const lead = users.find(u => u.id === item.lead_expert_id);
            return (
              <div key={item.id} className="p-4 rounded border border-slate-200 bg-white hover:border-slate-400 transition shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {item.category.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.status === 'VALIDE' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'EN_COURS' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-xs mt-1 leading-snug">
                    {item.title}
                  </h4>
                  {item.notes && (
                    <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600 text-[11px] mb-1.5">
                    <span>{lead?.full_name}</span>
                    <span className="font-bold text-teal-800">{item.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-teal-700 h-1.5 rounded-full" 
                      style={{ width: `${item.progress_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
