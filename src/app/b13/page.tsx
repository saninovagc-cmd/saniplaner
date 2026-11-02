'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { B13Item } from '@/types';
import { 
  PackageCheck, 
  FileText, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Users, 
  Download, 
  Layers,
  ChevronRight,
  Filter,
  Sparkles
} from 'lucide-react';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function B13Page() {
  const { b13Items, updateB13Item, users } = useApp();

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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Milestone B13
            </span>
            <span className="text-xs text-slate-500">Quantification Reports and Distribution Plans</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Suivi Spécifique B13 — Quantification & Plans d’Approvisionnement
          </h1>
          <p className="text-xs text-slate-500">
            Pilotage QAT, GTT, validation ILP, POA départementaux et conformité des 2 livrables semestriels PSI.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Synthèse PDF</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: LES 2 LIVRABLES SEMESTRIELS OFFICIELS */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-6 text-white shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h2 className="text-base font-bold tracking-wide">
              Les Deux Livrables Prédéfinis Contractuels B13 (Comptabilisés par Semestre)
            </h2>
          </div>
          <span className="text-xs font-mono bg-white/20 px-3 py-1 rounded-full text-blue-100">
            Jalonnement Contractuel PSI/ABMS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {predefinedDeliverables.map((deliv, index) => {
            const lead = users.find(u => u.id === deliv.lead_expert_id);
            return (
              <div key={deliv.id} className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Livrable Semestriel Officiel #{index + 1} ({deliv.semester.replace('_', ' ')})
                    </span>
                    <h3 className="font-bold text-sm text-white mt-1">{deliv.title}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    deliv.status === 'VALIDE' || deliv.status === 'TRANSMIS'
                      ? 'bg-emerald-400 text-emerald-950'
                      : 'bg-amber-300 text-amber-950'
                  }`}>
                    {deliv.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                  <div className="text-blue-100">
                    <span className="text-[11px] block text-blue-200">Expert Responsable :</span>
                    <span className="font-semibold text-white">{lead?.full_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] block text-blue-200">Échéance prévue :</span>
                    <span className="font-mono font-semibold text-amber-200">{deliv.execution_date}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1 text-blue-200">
                    <span>Avancement de la production</span>
                    <span className="font-bold text-white">{deliv.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-400 h-2 rounded-full" 
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Composantes Opérationnelles B13 (Validation ILP, QAT, GTT, POA, CPS)
            </h3>
            <p className="text-xs text-slate-500">
              Suivi technique continu par le Spécialiste FASP et les Conseillers Régionaux
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium outline-none"
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
              <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
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
                    <span className="font-bold text-teal-700">{item.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-teal-600 h-1.5 rounded-full" 
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
