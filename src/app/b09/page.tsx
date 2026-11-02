'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { B09MonthlyMetric } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

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
      updateB09Metric(editingMetric);
      setEditingMetric(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Milestone B09
            </span>
            <span className="text-xs text-slate-500 font-medium">LMIS On-time Reporting Rate</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            Suivi Spécifique B09 — Promptitude eSIGL
          </h1>
          <p className="text-xs text-slate-500">
            Formule officielle : (Rapports soumis à temps / Rapports attendus) &times; 100. Date butoir : 20 du mois.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('excel')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition"
          >
            Relevé Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold transition"
          >
            Rapport PDF
          </button>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
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

            <form onSubmit={handleSaveMetric} className="p-5 space-y-3 text-xs">
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
  );
}
