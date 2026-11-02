'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { B09MonthlyMetric } from '@/types';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Send, 
  Download, 
  Search, 
  TrendingUp, 
  Clock, 
  ShieldCheck,
  Edit,
  X
} from 'lucide-react';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function B09Page() {
  const { b09Metrics, updateB09Metric, currentUser } = useApp();

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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Milestone B09
            </span>
            <span className="text-xs text-slate-500">LMIS On-time Reporting Rate</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Suivi Spécifique B09 — Promptitude eSIGL
          </h1>
          <p className="text-xs text-slate-500">
            Formule officielle : (Rapports soumis à temps / Rapports attendus) &times; 100. Date limite : le 20 du mois.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Relevé Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Rapport PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Taux National Consolidé</p>
              <h3 className={`text-3xl font-extrabold mt-1 ${targetMet ? 'text-emerald-600' : 'text-amber-600'}`}>
                {globalRate}%
              </h3>
            </div>
            <div className={`p-2.5 rounded-lg ${targetMet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Statut : <span className={`font-bold ${targetMet ? 'text-emerald-700' : 'text-amber-700'}`}>
              {targetMet ? 'EXCELLENT (>= 70%)' : 'SOUS LE SEUIL CONTRACTUEL'}
            </span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Rapports Attendus</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{totalExpected}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Dont <span className="font-semibold text-emerald-600">{totalOnTime} à temps</span> (avant le 20)
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Rapports en Retard / Manquants</p>
              <h3 className="text-3xl font-extrabold text-amber-600 mt-1">
                {totalLate + totalMissing}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {totalLate} soumis après le 20, {totalMissing} non soumis
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Relances & Notifications</p>
              <h3 className="text-3xl font-extrabold text-teal-700 mt-1">{totalReminders}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Relances effectuées par les Spécialistes SIS & RSCO
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par zone sanitaire..."
            value={searchZone}
            onChange={(e) => setSearchZone(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600 font-medium">Département :</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 font-medium outline-none focus:ring-1 focus:ring-teal-600"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Situation de la Promptitude par Zone Sanitaire (9 Zones Mesurées B09)
            </h3>
            <p className="text-[11px] text-slate-500">
              Période : Octobre 2026 — Date limite de transmission : 20 Novembre 2026
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700">
            {filteredMetrics.length} zones affichées
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Département</th>
                <th className="p-3.5">Zone Sanitaire</th>
                <th className="p-3.5 text-center">Attendus</th>
                <th className="p-3.5 text-center">À Temps (avant le 20)</th>
                <th className="p-3.5 text-center">En Retard</th>
                <th className="p-3.5 text-center">Manquants</th>
                <th className="p-3.5 text-center">Taux de Promptitude</th>
                <th className="p-3.5 text-center">Cible &ge; 70%</th>
                <th className="p-3.5 text-center">Relances</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMetrics.map((m) => {
                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-slate-800">{m.department}</td>
                    <td className="p-3.5 font-medium text-slate-900">{m.zone_name}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">{m.expected_reports}</td>
                    <td className="p-3.5 text-center font-bold text-emerald-600">{m.submitted_on_time}</td>
                    <td className="p-3.5 text-center text-amber-600 font-medium">{m.submitted_late}</td>
                    <td className="p-3.5 text-center text-red-600 font-medium">{m.missing_reports}</td>
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          m.target_met ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {m.promptitude_rate}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      {m.target_met ? (
                        <span className="inline-flex items-center text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conforme
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-bold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Sous seuil
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">
                      {m.reminders_sent}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setEditingMetric(m)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded transition"
                        title="Ajuster les rapports eSIGL"
                      >
                        <Edit className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Mise à jour des rapports A7 eSIGL
                </h3>
                <p className="text-[11px] text-slate-500">{editingMetric.zone_name}</p>
              </div>
              <button onClick={() => setEditingMetric(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
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
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rapports soumis à temps (avant le 20)</label>
                <input
                  type="number"
                  min="0"
                  value={editingMetric.submitted_on_time}
                  onChange={(e) => setEditingMetric({ ...editingMetric, submitted_on_time: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Non soumis / Manquants</label>
                  <input
                    type="number"
                    min="0"
                    value={editingMetric.missing_reports}
                    onChange={(e) => setEditingMetric({ ...editingMetric, missing_reports: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingMetric(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold"
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
