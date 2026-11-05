'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

export default function FormationsPage() {
  const { trainings, users } = useApp();

  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTrainings = trainings.filter(t => {
    const matchesMilestone = selectedMilestone === 'ALL' || t.milestone === selectedMilestone;
    const matchesDept = selectedDept === 'ALL' || t.department === selectedDept;
    const matchesSearch = t.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.zone_sanitaire.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMilestone && matchesDept && matchesSearch;
  });

  const totalParticipants = trainings.reduce((s, t) => s + t.participants_count, 0);
  const evaluatedTrainings = trainings.filter(t => t.status === 'EVALUEE');
  
  const avgPreTest = evaluatedTrainings.length > 0
    ? (evaluatedTrainings.reduce((s, t) => s + t.pre_test_avg, 0) / evaluatedTrainings.length).toFixed(1)
    : 0;
  
  const avgPostTest = evaluatedTrainings.length > 0
    ? (evaluatedTrainings.reduce((s, t) => s + t.post_test_avg, 0) / evaluatedTrainings.length).toFixed(1)
    : 0;

  const avgGain = Number(avgPostTest) - Number(avgPreTest);

  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = trainings.map(t => ({
        Thème: t.topic,
        Milestone: t.milestone,
        Département: t.department,
        'Zone Sanitaire': t.zone_sanitaire,
        Date: t.training_date,
        'Nombre Participants': t.participants_count,
        'Moyenne Pré-test (%)': `${t.pre_test_avg}%`,
        'Moyenne Post-test (%)': `${t.post_test_avg}%`,
        'Gain (%)': `+${(t.post_test_avg - t.pre_test_avg).toFixed(1)}%`,
        Statut: t.status,
      }));
      exportToExcel(data, 'SANINOVA_Formations_Renforcement');
    } else {
      const headers = ['Thème de la formation', 'Jalon', 'Département', 'Date', 'Participants', 'Pré-test', 'Post-test', 'Statut'];
      const rows = trainings.map(t => [
        t.topic.substring(0, 40) + '...',
        t.milestone,
        `${t.department} - ${t.zone_sanitaire}`,
        t.training_date,
        t.participants_count,
        `${t.pre_test_avg}%`,
        `${t.post_test_avg}%`,
        t.status,
      ]);
      exportTableToPdf(
        'Bilan des Formations et Renforcement des Capacités',
        headers,
        rows,
        'SANINOVA_Formations_Renforcement',
        `Progression moyenne constatée : +${avgGain.toFixed(1)} points après formation`
      );
    }
  };

  return (
    <ModuleGuard moduleId="formations">
      <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 6 : Capacités
            </span>
            <span className="text-xs text-slate-500 font-medium">Ateliers & Coaching des Acteurs</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Formations & Renforcement des Capacités</h1>
          <p className="text-xs text-slate-500">
            Suivi des ateliers eSIGL, sessions QAT, listes d’émargement et évaluation de l’impact (Pré-test vs Post-test).
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acteurs Formés</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalParticipants}</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200">
              Effectif
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Gestionnaires dépôts, pharmaciens, cadres DDS</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sessions de formation</p>
              <h3 className="text-2xl font-bold text-indigo-900 mt-1">{trainings.length}</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
              Ateliers
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{evaluatedTrainings.length} sessions déjà évaluées</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moyenne Pré-test</p>
              <h3 className="text-2xl font-bold text-slate-700 mt-1">{avgPreTest}%</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
              Initial
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Niveau initial des connaissances</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moyenne Post-test</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">{avgPostTest}%</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Final
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-2">Gain moyen : +{avgGain.toFixed(1)} points</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher un thème, zone sanitaire..."
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
          </select>

          <span className="text-xs text-slate-600 font-medium ml-2">Département :</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les départements</option>
            <option value="Atacora">Atacora</option>
            <option value="Donga">Donga</option>
            <option value="Mono">Mono</option>
            <option value="Plateau">Plateau</option>
            <option value="Alibori">Alibori</option>
          </select>
        </div>
      </div>

      {/* Trainings List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredTrainings.length === 0 ? (
          <div className="md:col-span-3 bg-white rounded-lg p-8 border border-slate-200 text-center text-xs text-slate-400">
            Aucune session de formation ne correspond à vos critères de recherche.
          </div>
        ) : (
          filteredTrainings.map((t) => {
          const trainersList = t.trainer_ids.map(id => users.find(u => u.id === id)?.full_name).filter(Boolean).join(', ');
          const hasEvaluation = t.status === 'EVALUEE';

          return (
            <div key={t.id} className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.milestone === 'B09' ? 'badge-b09' : 'badge-b13'
                  }`}>
                    {t.milestone}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.status === 'EVALUEE' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {t.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-xs leading-snug">{t.topic}</h3>
                <p className="text-xs text-slate-500 mt-1">{t.department} &bull; {t.zone_sanitaire}</p>
                <p className="text-xs text-slate-600 mt-2">
                  <span className="font-semibold text-slate-700">Formateurs :</span> {trainersList}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs text-slate-500 mb-3 font-mono">
                  <span>{t.training_date}</span>
                  <span className="font-semibold text-slate-800 font-sans">{t.participants_count} participants</span>
                </div>

                {hasEvaluation ? (
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Score Pré-test :</span>
                      <span className="text-slate-800">{t.pre_test_avg}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-slate-500 h-1.5 rounded-full" style={{ width: `${t.pre_test_avg}%` }} />
                    </div>

                    <div className="flex justify-between text-xs font-semibold pt-1">
                      <span className="text-emerald-800">Score Post-test :</span>
                      <span className="text-emerald-800 font-bold">{t.post_test_avg}% (+{(t.post_test_avg - t.pre_test_avg).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${t.post_test_avg}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 bg-slate-50 rounded text-slate-400 text-xs italic">
                    Session planifiée — Évaluation pré/post-test à venir.
                  </div>
                )}
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  </ModuleGuard>
  );
}
