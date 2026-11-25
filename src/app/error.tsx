'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to client console for diagnostic tracking
    console.error('[SaniNova Hub] Client-side exception caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center text-2xl font-bold mx-auto shadow-xs">
          <span>&loz;</span>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            SANINOVA HUB &bull; AFGHS-PSI BÉNIN
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-tight">
            Navigation Sécurisée Rétablie
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Une mise à jour ou transition d&apos;écran a nécessité une réinitialisation du contexte. Vos données saisies et synchronisations cloud sont préservées.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
          >
            Actualiser l&apos;écran
          </button>
          <a
            href="/work-plan"
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Aller au Work Plan &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
