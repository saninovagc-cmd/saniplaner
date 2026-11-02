'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';

export default function Header() {
  const { currentUser, setCurrentUser, users, b09Metrics } = useApp();

  // Calculate overall B09 promptitude
  const totalExpected = b09Metrics.reduce((acc, m) => acc + m.expected_reports, 0);
  const totalOnTime = b09Metrics.reduce((acc, m) => acc + m.submitted_on_time, 0);
  const globalPromptitude = totalExpected > 0 ? Number(((totalOnTime / totalExpected) * 100).toFixed(1)) : 0;
  const isPromptitudeTargetMet = globalPromptitude >= 70;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-xs font-sans">
      {/* Title & Milestones status */}
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            PROJET AFGHS-PSI BÉNIN
          </h2>
          <p className="text-[11px] text-slate-500">
            Plateforme intégrée de gestion et de pilotage technique & opérationnel
          </p>
        </div>

        <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-slate-200">
          <div className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
            isPromptitudeTargetMet ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            <span>B09 eSIGL : {globalPromptitude}% (Cible &ge; 70%)</span>
          </div>

          <div className="px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <span>B13 : Semestre 1 en cours</span>
          </div>
        </div>
      </div>

      {/* User Switcher & Info */}
      <div className="flex items-center space-x-3">
        <div className="flex flex-col text-right">
          <label className="text-[10px] uppercase font-bold text-slate-400">
            Profil actif :
          </label>
          <select 
            value={currentUser.id}
            onChange={(e) => {
              const selected = users.find(u => u.id === e.target.value);
              if (selected) setCurrentUser(selected);
            }}
            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 outline-none focus:border-teal-600"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="w-8 h-8 rounded bg-teal-800 text-white font-bold flex items-center justify-center text-xs">
          {currentUser.full_name.charAt(0)}
        </div>
      </div>
    </header>
  );
}
