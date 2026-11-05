'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

export default function B13Page() {
  const { b13Items, users } = useApp();

  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
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
    <ModuleGuard moduleId="b13">
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

      {/* Institutional Thresholds and Official Rules Banner */}
      <div className="bg-slate-900 rounded-lg p-5 text-white border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Règles Contractuelles et Déclencheurs de Paiement du Milestone B13
            </h2>
            <p className="text-xs text-slate-400">
              Fixed Amount Award SAQMMA26CA0351 — Objectif 2 DOS : Renforcement de la chaîne d’approvisionnement
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded text-teal-300 font-bold border border-slate-700">
            2 Unités Contractuelles par Semestre
          </span>
        </div>

        {/* Tiers of Achievement */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-emerald-400">Excellent</span>
              <span className="font-mono font-bold text-emerald-300">2 Unités / semestre</span>
            </div>
            <p className="text-[11px] text-slate-300">100% de déclenchement du paiement prévu pour le semestre.</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-amber-400">Minimum</span>
              <span className="font-mono font-bold text-amber-300">1 Unité / semestre</span>
            </div>
            <p className="text-[11px] text-slate-300">Paiement partiel et obligation de régularisation sous 30 jours.</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-rose-400">Insuffisant</span>
              <span className="font-mono font-bold text-rose-300">0 Unité / semestre</span>
            </div>
            <p className="text-[11px] text-slate-300">Aucun paiement déclenché pour le milestone B13.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] text-slate-300 border-t border-slate-800">
          <div>
            <strong className="text-white block mb-0.5">Date qui fait foi juridique :</strong>
            Un livrable est considéré transmis à temps lorsque SaniNova le dépose formellement auprès de PSI par courriel ou courrier avec accusé de réception avant la date limite, même si la validation formelle conjointe intervient ultérieurement.
          </div>
          <div>
            <strong className="text-white block mb-0.5">Activités suivies hors milestone (indicateurs opérationnels) :</strong>
            Les drafts QAT (12/an), réunions GTT (4/an), rapports de validation données ILP (2/semestre) et le plan CPS sont suivis pour le pilotage technique mais ne sont pas des unités de paiement B13.
          </div>
        </div>
      </div>

      {/* SECTION 1: LES 4 LIVRABLES PREDEFINIS CONTRACTUELS (2 PAR SEMESTRE) */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Les Livrables Prédéfinis Contractuels B13 (Unités Officielles de Paiement)
            </h2>
            <p className="text-xs text-slate-500">
              Deux unités par semestre : Unité 1 (POA 9 ZS) + Unité 2 (Rapport de quantification & plan révisé).
            </p>
          </div>
          <span className="text-xs font-mono bg-teal-50 text-teal-800 px-3 py-1 rounded font-bold border border-teal-200">
            4 Unités Annuelles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {predefinedDeliverables.map((deliv, index) => {
            const lead = users.find(u => u.id === deliv.lead_expert_id);
            const isS1 = deliv.semester === 'S1_2026_2027';
            return (
              <div key={deliv.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      isS1 ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-purple-50 text-purple-800 border-purple-200'
                    }`}>
                      {isS1 ? 'Semestre 1 (Oct 26 - Mar 27)' : 'Semestre 2 (Avr 27 - Sep 27)'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      deliv.status === 'VALIDE' || deliv.status === 'TRANSMIS'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      deliv.status === 'EN_COURS'
                        ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {deliv.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-slate-900 mt-2 leading-snug">{deliv.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">{deliv.notes}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Lead Expert :</span>
                      <span className="font-semibold text-slate-800">{lead?.full_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Échéance Contractuelle :</span>
                      <span className="font-mono font-bold text-slate-900">{deliv.execution_date}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Niveau d’avancement</span>
                      <span className="font-bold text-teal-800">{deliv.progress_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-teal-700 h-1.5 rounded-full" 
                        style={{ width: `${deliv.progress_pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1 text-right">
                    <Link 
                      href="/livrables" 
                      className="text-[11px] text-teal-800 hover:text-teal-900 font-semibold inline-flex items-center space-x-1"
                    >
                      <span>Consulter dans le Circuit des Livrables</span>
                      <span>&rarr;</span>
                    </Link>
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Semestre :</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
            >
              <option value="ALL">Tous les semestres</option>
              <option value="S1_2026_2027">Semestre 1 (S1)</option>
              <option value="S2_2026_2027">Semestre 2 (S2)</option>
            </select>

            <span className="text-xs text-slate-600 font-medium ml-2">Catégorie :</span>
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
  </ModuleGuard>
  );
}
