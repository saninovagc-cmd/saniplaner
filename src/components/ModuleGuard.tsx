'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AppModuleId, ALL_MODULES } from '@/types';

interface ModuleGuardProps {
  moduleId: AppModuleId;
  children: React.ReactNode;
}

export default function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { currentUser } = useApp();

  // Direction always has full access to all modules
  if (currentUser.role === 'direction') {
    return <>{children}</>;
  }

  // Check customized allowed_modules
  const allowed = currentUser.allowed_modules && Array.isArray(currentUser.allowed_modules)
    ? currentUser.allowed_modules.includes(moduleId)
    : moduleId !== 'administration'; // default fallback

  if (!allowed) {
    const moduleInfo = ALL_MODULES.find(m => m.id === moduleId);

    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-4 font-sans">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xl font-bold mx-auto">
          !
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Habilitation Requise
          </span>
          <h2 className="text-base font-bold text-slate-900 mt-2 uppercase tracking-tight">
            Accès Non Autorisé : {moduleInfo?.label || moduleId}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Votre profil actuel (<strong>{currentUser.full_name}</strong> &bull; <span className="font-mono text-teal-800">@{currentUser.username}</span>) ne dispose pas des droits d’accès à ce module selon la politique de sécurité définie dans l’espace Administration.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition"
          >
            &larr; Revenir au Tableau de Bord
          </Link>
          <Link
            href="/planning-hebdo"
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition"
          >
            Planning Hebdomadaire
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
