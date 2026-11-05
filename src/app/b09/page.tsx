'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { B09MonthlyMetric } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

export default function B09Page() {
  const { b09Metrics, updateB09Metric } = useApp();

  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchZone, setSearchZone] = useState<string>('');
  const [editingMetric, setEditingMetric] = useState<B09MonthlyMetric | null>(null);

  // Overall calculations
  const totalExpected = b09Metrics.reduce((s, m) => s + m.expected_reports, 0);
  const totalOnTime = b09Metrics.reduce((s, m) => s + m.submitted_on_time, 0);
  const totalLate = b09Metrics.reduce((s, m) => s + m.submitted_late, 0);
  const totalMissing = b09Metrics.reduce((s, m) => s + m.missing_reports, 0);
  const totalReminders = b09Metrics.reduce((s, m) => s + m.reminders_sent, 0);

  const globalRate = totalExpected > 0 ? Number(((totalOnTime / totalExpected) * 100).toFixed(1)) : 0;
  const targetMet = globalRate >= 70;

  const filteredMetrics = b09Metrics.filter((m) => {
    const matchesDept = selectedDept === 'ALL' || m.department === selectedDept;
    const matchesSearch = m.zone_name.toLowerCase().includes(searchZone.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = filteredMetrics.map(m => ({
        Période: `${m.period_month}/${m.period_year}`,
        Département: m.department,
        'Zone Sanitaire': m.zone_name,
        'Rapports Attendus': m.expected_reports,
        'Soumis à Temps': m.submitted_on_time,
        'Soumis en Retard': m.submitted_late,
        'Rapports Manquants': m.missing_reports,
        'Taux de Promptitude': `${m.promptitude_rate}%`,
        'Conformité Cible (>=70%)': m.target_met ? 'OUI' : 'NON',
        'Date Butoir eSIGL': m.deadline_date,
        'Relances Effectuées': m.reminders_sent,
      }));
      exportToExcel(data, 'SANINOVA_B09_Promptitude_eSIGL');
    } else {
      const headers = ['Département', 'Zone Sanitaire', 'Attendus', 'À Temps', 'En Retard', 'Manquants', 'Taux %', 'Seuil >=70%'];
      const rows = filteredMetrics.map(m => [
        m.department,
        m.zone_name,
        m.expected_reports,
        m.submitted_on_time,
        m.submitted_late,
        m.missing_reports,
        `${m.promptitude_rate}%`,
        m.target_met ? 'CONFORME' : 'SOUS SEUIL',
      ]);
      exportTableToPdf(
        'Suivi du Milestone B09 : Promptitude du Rapportage eSIGL',
        headers,
        rows,
        'SANINOVA_B09_Promptitude_eSIGL',
        `Date butoir nationale : 20 du mois | Taux national global : ${globalRate}%`
      );
    }
  };

  const handleSaveMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMetric) {
      const expected = Number(editingMetric.expected_reports) || 0;
      const onTime = Number(editingMetric.submitted_on_time) || 0;
      const rate = expected > 0 ? Number(((onTime / expected) * 100).toFixed(1)) : 0;
      const isTargetMet = rate >= 70;
      updateB09Metric({
        ...editingMetric,
        expected_reports: expected,
        submitted_on_time: onTime,
        submitted_late: Number(editingMetric.submitted_late) || 0,
        missing_reports: Number(editingMetric.missing_reports) || 0,
        reminders_sent: Number(editingMetric.reminders_sent) || 0,
        promptitude_rate: rate,
        target_met: isTargetMet,
      });
      setEditingMetric(null);
    }
  };

  return (
    <ModuleGuard moduleId="b09">
      <div className="space-y-6 font-sans">
      {/* Institutional Rules & Framework Banner (Work Plan Official Guidelines) */}
      <div className="bg-slate-900 rounded-lg p-5 text-white border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Règles Officielles de Mesure et Paliers d’Atteinte du Milestone B09
            </h2>
            <p className="text-xs text-slate-400">
              Source : Plan de Travail AFGHS-PSI Bénin — Fixed Amount Award SAQMMA26CA0351
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded text-slate-300 border border-slate-700">
            Jalonnement Trimestriel (T1 – T4)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-emerald-400">Excellent</span>
              <span className="font-mono font-bold text-emerald-300">&ge; 70 %</span>
            </div>
            <p className="text-[11px] text-slate-300">100% de déclenchement du paiement prévu pour le jalon B09.</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-blue-400">Satisfaisant</span>
              <span className="font-mono font-bold text-blue-300">60 – 69 %</span>
            </div>
            <p className="text-[11px] text-slate-300">Niveau d’effort substantiel avec plan d’actions correctives immédiat.</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-amber-400">Minimal</span>
              <span className="font-mono font-bold text-amber-300">50 – 59 %</span>
            </div>
            <p className="text-[11px] text-slate-300">Seuil de basculement avec alerte formelle au GOR via PSI.</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-rose-400">Insuffisant</span>
              <span className="font-mono font-bold text-rose-300">&lt; 50 %</span>
            </div>
            <p className="text-[11px] text-slate-300">Paiement non déclenché. Revue conjointe obligatoire.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-300 border-t border-slate-800">
          <div>
            <span className="font-bold text-white block mb-0.5">Périmètre Territorial Strict :</span>
            Strictement les 4 départements cibles (Atacora, Donga, Mono, Plateau) soit 9 zones sanitaires. <strong className="text-amber-300">L’Alibori est formellement exclu du dénominateur et numérateur B09</strong>.
          </div>
          <div>
            <span className="font-bold text-white block mb-0.5">Niveau de Référence (Baseline) :</span>
            Taux moyen de promptitude sur juillet-septembre 2026, calculé lors de l’état des lieux initial (B09.3) et communiqué à PSI en novembre 2026 pour apprécier l’effort d’atteinte du seuil.
          </div>
          <div>
            <span className="font-bold text-white block mb-0.5">Dissociation Qualité des Données :</span>
            B09 mesure strictement la promptitude au 20 du mois. La concordance registres/eSIGL (B09.5) est suivie comme indicateur opérationnel distinct, sans incidence sur le paiement B09.
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taux National Consolidé</p>
              <h3 className={`text-2xl font-bold mt-1 ${targetMet ? 'text-emerald-700' : 'text-amber-700'}`}>
                {globalRate}%
              </h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              targetMet ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {targetMet ? 'Conforme' : 'Sous Seuil'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Seuil cible : &ge; 70%
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rapports Attendus</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalExpected}</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
              Total
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Dont <span className="font-semibold text-emerald-700">{totalOnTime} à temps</span> (avant le 20)
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retard / Manquants</p>
              <h3 className="text-2xl font-bold text-amber-800 mt-1">
                {totalLate + totalMissing}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
              Alertes
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {totalLate} après le 20, {totalMissing} non soumis
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Relances Envoyées</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalReminders}</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
              RSCO / SIS
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Relances effectuées auprès des gestionnaires
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Filtrer par zone sanitaire..."
            value={searchZone}
            onChange={(e) => setSearchZone(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600 font-medium">Département :</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs border border-slate-200 rounded px-3 py-1.5 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les 4 départements B09</option>
            <option value="Atacora">Atacora (3 zones)</option>
            <option value="Donga">Donga (2 zones)</option>
            <option value="Mono">Mono (2 zones)</option>
            <option value="Plateau">Plateau (2 zones)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Promptitude par Zone Sanitaire (9 Zones Mesurées B09)
            </h3>
            <p className="text-[11px] text-slate-500">
              Période : Octobre 2026 — Date limite de transmission : 20 Novembre 2026
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-mono">
            {filteredMetrics.length} zones
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Département</th>
                <th className="p-3.5">Zone Sanitaire</th>
                <th className="p-3.5 text-center">Attendus</th>
                <th className="p-3.5 text-center">À Temps (avant le 20)</th>
                <th className="p-3.5 text-center">En Retard</th>
                <th className="p-3.5 text-center">Manquants</th>
                <th className="p-3.5 text-center">Taux</th>
                <th className="p-3.5 text-center">Seuil &ge; 70%</th>
                <th className="p-3.5 text-center">Relances</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMetrics.map((m) => {
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{m.department}</td>
                    <td className="p-3.5 font-medium text-slate-800">{m.zone_name}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">{m.expected_reports}</td>
                    <td className="p-3.5 text-center font-bold text-emerald-700">{m.submitted_on_time}</td>
                    <td className="p-3.5 text-center text-amber-700 font-medium">{m.submitted_late}</td>
                    <td className="p-3.5 text-center text-red-700 font-medium">{m.missing_reports}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        m.target_met ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {m.promptitude_rate}%
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {m.target_met ? (
                        <span className="text-emerald-800 font-bold text-[11px]">Conforme</span>
                      ) : (
                        <span className="text-red-700 font-bold text-[11px]">Sous seuil</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">
                      {m.reminders_sent}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setEditingMetric(m)}
                        className="px-2 py-1 text-slate-700 hover:text-teal-800 hover:bg-slate-100 rounded text-[11px] font-semibold border border-slate-200 transition"
                      >
                        Ajuster
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingMetric && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg shrink-0">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  Mise à jour des rapports A7 eSIGL
                </h3>
                <p className="text-[11px] text-slate-500">{editingMetric.zone_name}</p>
              </div>
              <button onClick={() => setEditingMetric(null)} className="text-slate-500 hover:text-slate-800 text-xs font-bold">
                Fermer
              </button>
            </div>

            <form onSubmit={handleSaveMetric} className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rapports attendus (Total structures)</label>
                <input
                  type="number"
                  min="1"
                  value={editingMetric.expected_reports}
                  onChange={(e) => setEditingMetric({ ...editingMetric, expected_reports: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rapports soumis à temps (avant le 20)</label>
                <input
                  type="number"
                  min="0"
                  value={editingMetric.submitted_on_time}
                  onChange={(e) => setEditingMetric({ ...editingMetric, submitted_on_time: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Soumis en retard</label>
                  <input
                    type="number"
                    min="0"
                    value={editingMetric.submitted_late}
                    onChange={(e) => setEditingMetric({ ...editingMetric, submitted_late: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Non soumis / Manquants</label>
                  <input
                    type="number"
                    min="0"
                    value={editingMetric.missing_reports}
                    onChange={(e) => setEditingMetric({ ...editingMetric, missing_reports: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre de relances envoyées</label>
                <input
                  type="number"
                  min="0"
                  value={editingMetric.reminders_sent}
                  onChange={(e) => setEditingMetric({ ...editingMetric, reminders_sent: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingMetric(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded font-semibold"
                >
                  Calculer & Enregistrer
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
