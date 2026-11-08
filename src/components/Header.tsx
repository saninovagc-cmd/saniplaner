'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Header() {
  const router = useRouter();
  const { currentUser, b09Metrics, logout, toggleMobileSidebar } = useApp();

  const handleLogout = () => {
    if (window.confirm(`Confirmez-vous la déconnexion de ${currentUser.full_name} ?`)) {
      logout();
      router.replace('/login');
    }
  };

  // Calculate overall B09 promptitude
  const totalExpected = b09Metrics.reduce((acc, m) => acc + m.expected_reports, 0);
  const totalOnTime = b09Metrics.reduce((acc, m) => acc + m.submitted_on_time, 0);
  const globalPromptitude = totalExpected > 0 ? Number(((totalOnTime / totalExpected) * 100).toFixed(1)) : 0;
  const isPromptitudeTargetMet = globalPromptitude >= 70;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-5 md:px-6 flex items-center justify-between shrink-0 shadow-xs font-sans z-30">
      {/* Title, Mobile Hamburger & Milestones status */}
      <div className="flex items-center space-x-2.5 sm:space-x-4 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition focus:outline-none focus:ring-2 focus:ring-teal-700 shrink-0"
          aria-label="Ouvrir le menu de navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand logo on tablet / desktop */}
        <div className="hidden sm:flex items-center shrink-0 pr-3 border-r border-slate-200">
          <Image
            src="/images/logo-saninova.png"
            alt="SaniNova"
            width={110}
            height={32}
            className="h-7 w-auto object-contain"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide truncate">
              PROJET AFGHS-PSI BÉNIN
            </h2>
            <span className="hidden xl:inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase">
              Hub Opérationnel
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 truncate hidden xs:block">
            Plateforme intégrée de gestion et de pilotage technique & opérationnel
          </p>
        </div>

        {/* Milestone Badges on Tablet & Desktop */}
        <div className="hidden lg:flex items-center space-x-2 pl-3 border-l border-slate-200 shrink-0">
          <div className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
            isPromptitudeTargetMet ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            <span>B09 eSIGL : {globalPromptitude}% (Cible &ge; 70%)</span>
          </div>

          <div className="px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <span>B13 : S1 en cours</span>
          </div>
        </div>
      </div>

      {/* User Connected Card (Read-only, strictly locked to current user) & Déconnexion */}
      <div className="flex items-center space-x-2 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-2.5 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-teal-800 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
            {currentUser.full_name.charAt(0)}
          </div>
          <div className="hidden sm:block max-w-[150px] md:max-w-[190px]">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5 truncate">
              <span className="truncate">{currentUser.full_name}</span>
              <span className="font-mono text-[9px] font-semibold text-teal-800 bg-teal-50 px-1 rounded border border-teal-200 shrink-0">
                @{currentUser.username || 'user'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center space-x-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
              <span className="truncate">{currentUser.title.split('—')[0].trim()}</span>
            </div>
          </div>
        </div>

        {/* Bouton Déconnexion */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold transition shadow-2xs group cursor-pointer"
          title="Se déconnecter de la plateforme"
        >
          <svg className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden md:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
