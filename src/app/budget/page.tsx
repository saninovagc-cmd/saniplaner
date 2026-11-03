'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  MOCK_BUDGET_METRICS, 
  MOCK_BUDGET_SUMMARY, 
  MOCK_QUARTERLY_BUDGETS, 
  MOCK_PAYMENT_SCHEDULE, 
  MOCK_GHSD_TIERS 
} from '@/lib/mock-data';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function BudgetPage() {
  const { users, activities, timesheets } = useApp();
  const [activeTab, setActiveTab] = useState<'synthese' | 'echeancier' | 'performance' | 'equipe' | 'activites'>('synthese');
  const [filterMilestone, setFilterMilestone] = useState<'TOUS' | 'B09' | 'B13' | 'TRANSVERSAL'>('TOUS');

  // Format currency FCFA
  const fmt = (num?: number) => {
    if (num === undefined || num === null) return '0 FCFA';
    return `${num.toLocaleString('fr-FR')} FCFA`;
  };

  // Filter activities
  const filteredActivities = activities.filter(a => {
    if (filterMilestone === 'TOUS') return true;
    if (filterMilestone === 'TRANSVERSAL') return a.milestone === 'TRANSVERSAL';
    return a.milestone === filterMilestone;
  });

  // Calculate timesheet LOE consumed
  const getConsumedDays = (expertId: string) => {
    return timesheets
      .filter(t => t.expert_id === expertId)
      .reduce((sum, t) => sum + (t.total_days_worked || 0), 0);
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      if (activeTab === 'synthese') {
        const rows = MOCK_BUDGET_SUMMARY.map(s => ({
          'Rubrique Budgétaire': s.rubrique,
          'Part (%)': `${s.pct_total}%`,
          'B09 (FCFA)': s.b09_fcfa,
          'B13 (FCFA)': s.b13_fcfa,
          'Total (FCFA)': s.total_fcfa
        }));
        exportToExcel(rows, 'Budget_Saninova_PSI_Recapitulatif');
      } else if (activeTab === 'echeancier') {
        const rows = MOCK_PAYMENT_SCHEDULE.map(p => ({
          'Milestone': p.milestone,
          'Intitulé': p.milestone_title,
          'Trimestre': p.quarter,
          'Date Limite': p.submission_deadline,
          'Montant Max (FCFA)': p.max_payment_fcfa,
          'Montant USD': p.max_payment_usd,
          'Statut': p.status,
          'Preuve Requise': p.evidence_required
        }));
        exportToExcel(rows, 'Echeancier_Paiements_PSI');
      } else if (activeTab === 'equipe') {
        const rows = users.map(u => ({
          'Expert': u.full_name,
          'Fonction': u.title,
          'Taux Journalier (FCFA)': u.daily_rate,
          'LOE Planifié (Jours)': u.loe_total,
          'LOE B09 (Jours)': u.loe_b09,
          'LOE B13 (Jours)': u.loe_b13,
          'Total Honoraires (FCFA)': u.total_fees_fcfa
        }));
        exportToExcel(rows, 'Saninova_Equipe_Honoraires_LOE');
      } else {
        const rows = filteredActivities.map(a => ({
          'Code': a.code,
          'Milestone': a.milestone,
          'Activité': a.title,
          'LOE (Jours)': a.loe_days || 0,
          'Honoraires A (FCFA)': a.budget_a_fcfa || 0,
          'Coûts Directs B (FCFA)': a.budget_b_fcfa || 0,
          'Budget Total (FCFA)': a.budget_total_fcfa || 0,
          'Statut': a.status
        }));
        exportToExcel(rows, 'Saninova_Budget_Activites');
      }
    } else {
      if (activeTab === 'synthese') {
        const headers = ['Rubrique Budgétaire', 'Part (%)', 'Milestone B09 (FCFA)', 'Milestone B13 (FCFA)', 'Total (FCFA)'];
        const rows = MOCK_BUDGET_SUMMARY.map(s => [
          s.rubrique,
          `${s.pct_total}%`,
          fmt(s.b09_fcfa),
          fmt(s.b13_fcfa),
          fmt(s.total_fcfa)
        ]);
        rows.push([
          'TOTAL GÉNÉRAL',
          '100.0%',
          fmt(MOCK_BUDGET_METRICS.b09_total_fcfa),
          fmt(MOCK_BUDGET_METRICS.b13_total_fcfa),
          fmt(MOCK_BUDGET_METRICS.total_award_fcfa)
        ]);
        exportTableToPdf(
          'Budget Contractuel Saninova - Récapitulatif par Rubrique',
          headers,
          rows,
          'Saninova_Budget_Synthese',
          'Fixed Amount Award SAQMMA26CA0351 | Période : 01/10/2026 - 30/09/2027'
        );
      } else if (activeTab === 'echeancier') {
        const headers = ['Milestone', 'Période / Trimestre', 'Date Limite', 'Plafond Max (FCFA)', 'Plafond USD', 'Conditions de déclenchement'];
        const rows = MOCK_PAYMENT_SCHEDULE.map(p => [
          `${p.milestone} - ${p.milestone_title}`,
          p.quarter,
          p.submission_deadline,
          fmt(p.max_payment_fcfa),
          `$${p.max_payment_usd?.toLocaleString('en-US')}`,
          p.evidence_required
        ]);
        exportTableToPdf(
          'Échéancier des Paiements par Milestone (PSI / GHSD)',
          headers,
          rows,
          'Saninova_Echeancier_Paiements_PSI',
          'Plafonds contractuels en FCFA | Paiement conditionné à la validation des preuves'
        );
      } else {
        const headers = ['Code', 'Milestone', 'Intitulé Activité', 'LOE (Jours)', 'Honoraires A', 'Coûts Directs B', 'Total Direct A+B'];
        const rows = filteredActivities.map(a => [
          a.code,
          a.milestone,
          a.title,
          `${a.loe_days || 0} j`,
          fmt(a.budget_a_fcfa || 0),
          fmt(a.budget_b_fcfa || 0),
          fmt(a.budget_total_fcfa || 0)
        ]);
        exportTableToPdf(
          'Plan et Budget par Activité (Chemonics Gantt)',
          headers,
          rows,
          'Saninova_Budget_Activites',
          'Ventilation des 19 activités budgétées sur B09 et B13'
        );
      }
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Contrat Fixed Amount Award
            </span>
            <span className="text-xs text-slate-500 font-medium">Réf. SAQMMA26CA0351 · PSI / AFGHS Bénin</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            Budget Contractuel & Échéancier PSI
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Cadre budgétaire certifié pour les Milestones B09 (Promptitude eSIGL) et B13 (Quantification ILP) pour la période du 1er octobre 2026 au 30 septembre 2027.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => handleExport('excel')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition flex items-center space-x-1.5"
          >
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded shadow-xs transition flex items-center space-x-1.5"
          >
            <span>Export Synthèse PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Budget Total Alloué</div>
          <div className="text-xl font-bold text-slate-900 mt-1.5">{fmt(MOCK_BUDGET_METRICS.total_award_fcfa)}</div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>B09: 42,9%</span>
            <span>B13: 57,1%</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Milestone B09 (eSIGL)</div>
          <div className="text-xl font-bold text-teal-700 mt-1.5">{fmt(MOCK_BUDGET_METRICS.b09_total_fcfa)}</div>
          <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            Plafond annuel · 4 tranches trimestrielles
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Milestone B13 (Quantif)</div>
          <div className="text-xl font-bold text-indigo-700 mt-1.5">{fmt(MOCK_BUDGET_METRICS.b13_total_fcfa)}</div>
          <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            Plafond annuel · 2 tranches semestrielles (T2/T4)
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Honoraires Équipe (A)</div>
          <div className="text-xl font-bold text-slate-900 mt-1.5">{fmt(MOCK_BUDGET_METRICS.team_fees_total_fcfa)}</div>
          <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            37,9% du total · 8 experts (2 112 jours)
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Coûts d'Activités (B)</div>
          <div className="text-xl font-bold text-slate-900 mt-1.5">{fmt(MOCK_BUDGET_METRICS.activities_total_fcfa)}</div>
          <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            62,1% du total · Ateliers & logistique terrain
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex space-x-6">
        <button
          onClick={() => setActiveTab('synthese')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'synthese'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          1. Récapitulatif par Rubrique
        </button>
        <button
          onClick={() => setActiveTab('echeancier')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'echeancier'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          2. Échéancier Paiements PSI (T1–T4)
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'performance'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          3. Barèmes GHSD & Risques
        </button>
        <button
          onClick={() => setActiveTab('equipe')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'equipe'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          4. Équipe & Effort LOE (264j)
        </button>
        <button
          onClick={() => setActiveTab('activites')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'activites'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          5. Budget des 19 Activités
        </button>
      </div>

      {/* TAB 1: SYNTHÈSE BUDGÉTAIRE */}
      {activeTab === 'synthese' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Main Summary Budget (Format Chemonics / PSI)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Répartition des charges directes entre les Milestones B09 et B13. Les frais de gestion de 10% ont été convertis en coûts directs vérifiables (réf. PM).
                </p>
              </div>
              <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-600">
                Total : 406 958 726 FCFA
              </span>
            </div>

            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Rubrique Budgétaire</th>
                  <th className="py-3 px-4 text-center">Part (%)</th>
                  <th className="py-3 px-4 text-right">Milestone B09 (FCFA)</th>
                  <th className="py-3 px-4 text-right">Milestone B13 (FCFA)</th>
                  <th className="py-3 px-4 text-right">Total Général (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_BUDGET_SUMMARY.map((row) => (
                  <tr key={row.code} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-medium text-slate-900">{row.rubrique}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold">
                        {row.pct_total}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{fmt(row.b09_fcfa)}</td>
                    <td className="py-3 px-4 text-right font-mono">{fmt(row.b13_fcfa)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(row.total_fcfa)}</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td className="py-3.5 px-4 uppercase tracking-wide">TOTAL GÉNÉRAL CONTRACTUEL</td>
                  <td className="py-3.5 px-4 text-center font-mono">100.0%</td>
                  <td className="py-3.5 px-4 text-right font-mono text-teal-800">{fmt(MOCK_BUDGET_METRICS.b09_total_fcfa)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-indigo-800">{fmt(MOCK_BUDGET_METRICS.b13_total_fcfa)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-900 text-sm">{fmt(MOCK_BUDGET_METRICS.total_award_fcfa)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quarterly Summary breakdown */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Ventilation des Dépenses par Trimestre (A + B)
              </h2>
            </div>
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Trimestre</th>
                  <th className="py-3 px-4">Période</th>
                  <th className="py-3 px-4 text-right">B09 Honoraires (A)</th>
                  <th className="py-3 px-4 text-right">B09 Coûts (B)</th>
                  <th className="py-3 px-4 text-right">B13 Honoraires (A)</th>
                  <th className="py-3 px-4 text-right">B13 Coûts (B)</th>
                  <th className="py-3 px-4 text-right">Total Dépenses Trimestre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_QUARTERLY_BUDGETS.map((q) => (
                  <tr key={q.quarter} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">{q.quarter}</td>
                    <td className="py-3 px-4 text-slate-600">{q.period_label}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b09_fees)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b09_activities)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b13_fees)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b13_activities)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(q.total_quarter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ÉCHÉANCIER PAIEMENTS PSI */}
      {activeTab === 'echeancier' && (
        <div className="space-y-6">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-900 flex items-start space-x-3">
            <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              i
            </div>
            <div>
              <div className="font-bold">Modalité Fixed Amount Award (Paiement au résultat)</div>
              <p className="mt-0.5 text-teal-800 leading-relaxed">
                Les fonds sont décaissés par PSI uniquement après réception et vérification probante des livrables de chaque milestone. 
                Le milestone B09 est réclamé chaque trimestre (T1, T2, T3, T4). Le milestone B13 est réclamé semestriellement en fin de T2 (semestre 1) et fin de T4 (semestre 2).
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Calendrier Officiel des 6 Tranches de Paiement
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Plafonds contractuels en FCFA (Taux Softworks USD : 565 FCFA)
              </span>
            </div>

            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">Période</th>
                  <th className="py-3 px-4">Date Limite Soumission</th>
                  <th className="py-3 px-4 text-right">Paiement Max (FCFA)</th>
                  <th className="py-3 px-4 text-right">Équivalent USD</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Preuves Exigées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_PAYMENT_SCHEDULE.map((p) => {
                  const isCurrent = p.status === 'EN_COURS';
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition ${isCurrent ? 'bg-amber-50/40' : ''}`}>
                      <td className="py-3 px-4 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          p.milestone === 'B09' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {p.milestone}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.quarter}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{p.submission_deadline}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(p.max_payment_fcfa)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">${p.max_payment_usd?.toLocaleString('en-US')}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          p.status === 'EN_COURS'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : p.status === 'VALIDE_PAYE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.status === 'EN_COURS' ? 'Tranche en cours' : p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs">{p.evidence_required}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BARÈMES GHSD & ANALYSE DE RISQUE */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Barèmes de Rémunération GHSD / PSI selon la Performance
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Simulation de l'impact financier en cas de sous-performance sur les seuils contractuels.
              </p>
            </div>

            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">Niveau</th>
                  <th className="py-3 px-4">Condition de Seuil</th>
                  <th className="py-3 px-4 text-center">% Rémunération</th>
                  <th className="py-3 px-4 text-right">Paiement Annuel Saninova</th>
                  <th className="py-3 px-4 text-right">Coûts Engagés (A+B)</th>
                  <th className="py-3 px-4 text-right">Impact Financier (Écart)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_GHSD_TIERS.map((tier, idx) => {
                  const isNegative = tier.variance_fcfa < 0;
                  const isExcellent = tier.level === 'Excellent';
                  return (
                    <tr key={idx} className={`hover:bg-slate-50 transition ${isExcellent ? 'bg-emerald-50/30' : ''}`}>
                      <td className="py-3 px-4 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          tier.milestone === 'B09' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {tier.milestone}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{tier.level}</td>
                      <td className="py-3 px-4 text-slate-600">{tier.threshold_condition}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          tier.payment_pct === 100 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : tier.payment_pct >= 60 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {tier.payment_pct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(tier.annual_payout_fcfa)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{fmt(tier.direct_costs_fcfa)}</td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {tier.variance_fcfa === 0 ? 'Équilibre (0 FCFA)' : fmt(tier.variance_fcfa)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900">
            <div className="font-bold">Mécanisme de Rattrapage au Trimestre 4 :</div>
            <p className="mt-1 leading-relaxed text-amber-800">
              Selon le modèle GHSD de PSI, si un trimestre B09 n'atteint pas le seuil Excellent (70%), la retenue temporaire peut être intégralement rattrapée au paiement final du 4ème trimestre si la moyenne annuelle consolidée atteint ou dépasse 70%.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: ÉQUIPE TECHNIQUE & LOE */}
      {activeTab === 'equipe' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Équipe Technique & Niveau d'Effort (264 Jours / Expert = 100%)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Taux journaliers validés basés sur les salaires bruts de septembre 2026 (+5%) acceptés par PSI le 31/10/2026.
                </p>
              </div>
              <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-600">
                Total LOE : 2 112 jours · 154 287 936 FCFA
              </span>
            </div>

            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Expert</th>
                  <th className="py-3 px-4">Fonction Proposée</th>
                  <th className="py-3 px-4 text-right">Taux Journalier</th>
                  <th className="py-3 px-4 text-center">LOE B09 (j)</th>
                  <th className="py-3 px-4 text-center">LOE B13 (j)</th>
                  <th className="py-3 px-4 text-center">LOE Total (j)</th>
                  <th className="py-3 px-4 text-center">Jours Saisis (Timesheet)</th>
                  <th className="py-3 px-4 text-right">Honoraires Annuels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((expert) => {
                  const consumed = getConsumedDays(expert.id);
                  return (
                    <tr key={expert.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{expert.full_name}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">{expert.title}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">{fmt(expert.daily_rate)}</td>
                      <td className="py-3 px-4 text-center font-mono text-teal-800 font-medium">{expert.loe_b09} j</td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-800 font-medium">{expert.loe_b13} j</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{expert.loe_total} j</td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                          {consumed} j
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(expert.total_fees_fcfa)}</td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td className="py-3.5 px-4 uppercase">TOTAL ÉQUIPE (8 EXPERTS)</td>
                  <td className="py-3.5 px-4 text-slate-500 font-normal">100% plein temps</td>
                  <td className="py-3.5 px-4 text-right font-mono">—</td>
                  <td className="py-3.5 px-4 text-center font-mono text-teal-900">711,4 j</td>
                  <td className="py-3.5 px-4 text-center font-mono text-indigo-900">1 400,6 j</td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-900">2 112 j</td>
                  <td className="py-3.5 px-4 text-center font-mono">—</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-900 text-sm">
                    {fmt(MOCK_BUDGET_METRICS.team_fees_total_fcfa)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: BUDGET DÉTAILLÉ PAR ACTIVITÉ */}
      {activeTab === 'activites' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">Filtrer par Milestone :</span>
              {(['TOUS', 'B09', 'B13', 'TRANSVERSAL'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMilestone(m)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                    filterMilestone === m
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {m === 'TRANSVERSAL' ? 'Transversal (eSIGL)' : m}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500">
              {filteredActivities.length} activité(s) affichée(s)
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">Intitulé de l'Activité</th>
                  <th className="py-3 px-4 text-center">LOE (Jours)</th>
                  <th className="py-3 px-4 text-right">Honoraires (A)</th>
                  <th className="py-3 px-4 text-right">Coûts Directs (B)</th>
                  <th className="py-3 px-4 text-right">Budget Total (A+B)</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{act.code}</td>
                    <td className="py-3 px-4 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        act.milestone === 'B09' 
                          ? 'bg-teal-100 text-teal-800' 
                          : act.milestone === 'B13' 
                          ? 'bg-indigo-100 text-indigo-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {act.milestone}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{act.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{act.expected_result}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                      {act.loe_days ? `${act.loe_days} j` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {fmt(act.budget_a_fcfa || 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {fmt(act.budget_b_fcfa || 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {fmt(act.budget_total_fcfa || 0)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        act.status === 'TERMINEE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : act.status === 'EN_COURS'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
