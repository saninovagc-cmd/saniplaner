'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

export default function DashboardPage() {
  const { activities, b09Metrics, b13Items, missions, deliverables, users } = useApp();

  // Activity stats
  const totalActivities = activities.length;
  const completedActivities = activities.filter(a => a.status === 'TERMINEE').length;
  const inProgressActivities = activities.filter(a => a.status === 'EN_COURS').length;
  const upcomingActivities = activities.filter(a => a.status === 'A_VENIR').length;
  const delayedActivities = activities.filter(a => a.status === 'EN_RETARD').length;

  const avgProgress = totalActivities > 0 
    ? Math.round(activities.reduce((sum, a) => sum + a.progress_pct, 0) / totalActivities)
    : 0;

  // B09 stats
  const totalB09Expected = b09Metrics.reduce((s, m) => s + m.expected_reports, 0);
  const totalB09OnTime = b09Metrics.reduce((s, m) => s + m.submitted_on_time, 0);
  const b09GlobalRate = totalB09Expected > 0 ? Number(((totalB09OnTime / totalB09Expected) * 100).toFixed(1)) : 0;
  const b09TargetMet = b09GlobalRate >= 70;

  // B13 stats
  const b13Predefined = b13Items.filter(i => i.is_predefined_deliverable);
  const b13CompletedPredefined = b13Predefined.filter(i => i.status === 'VALIDE' || i.status === 'TRANSMIS').length;

  // Deliverables stats
  const totalDeliverables = deliverables.length;
  const transmittedDeliverables = deliverables.filter(d => d.validation_status === 'TRANSMISSION_PSI').length;

  // Missions stats
  const totalMissions = missions.length;
  const completedMissions = missions.filter(m => m.status === 'CLOTUREE' || m.status === 'REALISEE').length;

  // Urgent alerts
  const zonesUnderTarget = b09Metrics.filter(m => !m.target_met);
  const pendingDeliverables = deliverables.filter(d => d.validation_status === 'SOUMISSION_INTERNE' || d.validation_status === 'VERIFICATION');

  const handleExportSummary = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = [
        { Indicateur: 'Taux Global d’Exécution', Valeur: `${avgProgress}%` },
        { Indicateur: 'Total Activités Work Plan', Valeur: totalActivities },
        { Indicateur: 'Activités Terminées', Valeur: completedActivities },
        { Indicateur: 'Activités En Cours', Valeur: inProgressActivities },
        { Indicateur: 'Taux de Promptitude B09 eSIGL', Valeur: `${b09GlobalRate}%` },
        { Indicateur: 'Seuil B09 Exigé', Valeur: '>= 70%' },
        { Indicateur: 'Livrables PSI Transmis', Valeur: `${transmittedDeliverables}/${totalDeliverables}` },
        { Indicateur: 'Missions Terrain Réalisées', Valeur: `${completedMissions}/${totalMissions}` },
      ];
      exportToExcel(data, 'SANINOVA_Synthese_Projet_AFGHS');
    } else {
      const headers = ['Indicateur Clé', 'Valeur Actuelle', 'Cible / Seuil Contractuel', 'Statut'];
      const rows = [
        ['Taux Global d’Exécution', `${avgProgress}%`, '100% à échéance', avgProgress >= 50 ? 'Conforme' : 'Vigilance'],
        ['Promptitude Rapportage eSIGL (B09)', `${b09GlobalRate}%`, '>= 70.0% (Date butoir 20 du mois)', b09TargetMet ? 'EXCELLENT' : 'ATTENTION'],
        ['Livrables Semestriels B13', `${b13CompletedPredefined}/2 Livrables`, '2 Livrables Semestriels officiels', 'En cours S1'],
        ['Livrables Contractuels Transmis', `${transmittedDeliverables}/${totalDeliverables}`, `${totalDeliverables} attendus`, `${transmittedDeliverables} transmis`],
        ['Missions de Terrain Réalisées', `${completedMissions}/${totalMissions}`, '100% exécutées', `${completedMissions} effectuées`],
      ];
      exportTableToPdf(
        'Tableau de Bord Général - Synthèse Exécutive',
        headers,
        rows,
        'SANINOVA_Synthese_Executive_AFGHS',
        `Période : 1er Octobre 2026 - 30 Septembre 2027 | Situation consolidée au ${new Date().toLocaleDateString('fr-FR')}`
      );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Export Actions */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Projet AFGHS-PSI Bénin
            </span>
            <span className="text-xs text-slate-500 font-medium">Milestones B09 & B13</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            Tableau de Bord Exécutif & de Pilotage
          </h1>
          <p className="text-xs text-slate-600">
            Coordination technique et opérationnelle — SaniNova Global Consulting
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExportSummary('excel')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition"
          >
            Export Excel
          </button>
          <button
            onClick={() => handleExportSummary('pdf')}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold transition"
          >
            Synthèse PDF
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taux Global */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taux d’Exécution Global</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{avgProgress}%</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200">
              Work Plan
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-blue-700 h-1.5 rounded-full" 
              style={{ width: `${avgProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {completedActivities} terminées / {totalActivities} activités au total
          </p>
        </div>

        {/* Milestone B09 */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Promptitude eSIGL (B09)</p>
              <h3 className={`text-2xl font-bold mt-1 ${b09TargetMet ? 'text-emerald-700' : 'text-amber-700'}`}>
                {b09GlobalRate}%
              </h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              b09TargetMet ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {b09TargetMet ? 'Atteint' : 'Vigilance'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${b09TargetMet ? 'bg-emerald-600' : 'bg-amber-600'}`} 
              style={{ width: `${Math.min(b09GlobalRate, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Seuil cible : &ge; 70% (Date butoir : 20 du mois)
          </p>
        </div>

        {/* Milestone B13 */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantification B13</p>
              <h3 className="text-2xl font-bold text-indigo-900 mt-1">
                {b13CompletedPredefined} / 2
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
              Semestriel
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-indigo-700 h-1.5 rounded-full" 
              style={{ width: `${(b13CompletedPredefined / 2) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            2 Livrables semestriels officiels contractuels
          </p>
        </div>

        {/* Livrables & Missions */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missions de Terrain</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {completedMissions} / {totalMissions}
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
              Terrain
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-teal-700 h-1.5 rounded-full" 
              style={{ width: `${(completedMissions / totalMissions) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {transmittedDeliverables} livrable(s) transmis à PSI/ABMS
          </p>
        </div>
      </div>

      {/* Middle Row: Alerts & Geographical Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Alerts Card */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Alertes & Risques Prioritaires</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
              {zonesUnderTarget.length + delayedActivities} alerte(s)
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {zonesUnderTarget.map((z) => (
              <div key={z.id} className="p-3 rounded bg-amber-50/70 border border-amber-200 text-xs">
                <div className="flex justify-between font-semibold text-amber-900">
                  <span>Zone sous seuil B09 ({z.promptitude_rate}%)</span>
                  <span>{z.department}</span>
                </div>
                <p className="text-amber-800 mt-1">
                  {z.zone_name} : {z.missing_reports} rapports manquants. Date limite nationale : {z.deadline_date}.
                </p>
                <div className="mt-2 flex justify-between items-center text-[11px]">
                  <span className="text-amber-700 font-medium">{z.reminders_sent} relances effectuées</span>
                  <Link href="/b09" className="text-teal-800 font-bold hover:underline">
                    Gérer &rarr;
                  </Link>
                </div>
              </div>
            ))}

            {delayedActivities === 0 && (
              <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                Aucune activité en retard critique dans le Work Plan.
              </div>
            )}

            {pendingDeliverables.length > 0 && (
              <div className="p-3 rounded bg-blue-50/70 border border-blue-200 text-xs">
                <div className="font-semibold text-blue-900">
                  Livrables en attente de validation ({pendingDeliverables.length})
                </div>
                <p className="text-blue-800 mt-0.5">
                  Revue technique S&E ou approbation Direction requise avant transmission PSI.
                </p>
                <Link href="/livrables" className="mt-2 text-blue-800 font-bold hover:underline inline-block">
                  Consulter les livrables &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Progress by Department */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Promptitude eSIGL par Zone Sanitaire (Octobre 2026)
            </h3>
            <span className="text-xs text-slate-500 font-medium">9 Zones Mesurées B09</span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {b09Metrics.map((m) => {
              const isAbove = m.promptitude_rate >= 70;
              return (
                <div key={m.id} className="p-3 rounded border border-slate-200 bg-slate-50/70">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{m.zone_name}</span>
                      <p className="text-[11px] text-slate-500">{m.department}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      isAbove ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {m.promptitude_rate}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${isAbove ? 'bg-emerald-600' : 'bg-red-600'}`}
                      style={{ width: `${Math.min(m.promptitude_rate, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                    <span>{m.submitted_on_time}/{m.expected_reports} à temps</span>
                    <span>{m.submitted_late} en retard</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Experts Workload & Status */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Répartition des Responsabilités et Avancement par Membre de l’Équipe
          </h3>
          <Link href="/work-plan" className="text-xs text-teal-800 font-semibold hover:underline">
            Voir le Work Plan complet &rarr;
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {users.map((u) => {
            const userActivities = activities.filter(a => a.lead_expert_id === u.id);
            const userMissions = missions.filter(m => m.lead_expert_id === u.id);
            const userDeliverables = deliverables.filter(d => d.lead_expert_id === u.id);

            return (
              <div key={u.id} className="p-3.5 rounded border border-slate-200 bg-white shadow-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs border border-slate-200">
                    {u.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{u.full_name}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{u.title}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 p-1.5 rounded">
                    <span className="block text-xs font-bold text-slate-800">{userActivities.length}</span>
                    <span className="text-[9px] text-slate-400 uppercase">Act.</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded">
                    <span className="block text-xs font-bold text-slate-800">{userMissions.length}</span>
                    <span className="text-[9px] text-slate-400 uppercase">Miss.</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded">
                    <span className="block text-xs font-bold text-slate-800">{userDeliverables.length}</span>
                    <span className="text-[9px] text-slate-400 uppercase">Livr.</span>
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
