'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { UserCheck, Shield, MapPin, Phone, Bell } from 'lucide-react';

export default function Header() {
  const { currentUser, setCurrentUser, users, b09Metrics } = useApp();

  // Calculate overall B09 promptitude
  const totalExpected = b09Metrics.reduce((acc, m) => acc + m.expected_reports, 0);
  const totalOnTime = b09Metrics.reduce((acc, m) => acc + m.submitted_on_time, 0);
  const globalPromptitude = totalExpected > 0 ? Number(((totalOnTime / totalExpected) * 100).toFixed(1)) : 0;
  const isPromptitudeTargetMet = globalPromptitude >= 70;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
      {/* Title & Milestones status */}
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            PROJET AFGHS-PSI BÉNIN
          </h2>
          <p className="text-xs text-slate-500">
            Plateforme intégrée de gestion et de pilotage technique & opérationnel
          </p>
        </div>

        <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-slate-200">
          <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center space-x-1.5 ${
            isPromptitudeTargetMet ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>B09 eSIGL : {globalPromptitude}% (Cible &ge; 70%)</span>
          </div>

          <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span>B13 : S1 en cours (2 livrables semestriels)</span>
          </div>
        </div>
      </div>

      {/* User Switcher & Info */}
      <div className="flex items-center space-x-3">
        <div className="flex flex-col text-right">
          <label className="text-[10px] uppercase font-semibold text-slate-400">
            Connecté en tant que :
          </label>
          <select 
            value={currentUser.id}
            onChange={(e) => {
              const selected = users.find(u => u.id === e.target.value);
              if (selected) setCurrentUser(selected);
            }}
            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-500"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="w-9 h-9 rounded-full bg-teal-100 border border-teal-300 text-teal-800 font-bold flex items-center justify-center text-xs shadow-inner">
          {currentUser.full_name.charAt(0)}
        </div>
      </div>
    </header>
  );
}
