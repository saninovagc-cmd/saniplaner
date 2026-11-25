'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SaniNova Hub] Global root error caught:', error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-teal-900/50 border border-teal-500/40 text-teal-400 flex items-center justify-center text-2xl font-bold mx-auto">
            <span>&loz;</span>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-950 px-2.5 py-1 rounded-full border border-teal-800">
              SANINOVA HUB &bull; AFGHS-PSI BÉNIN
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight">
              Réinitialisation Sécurisée
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Une exception d&apos;affichage est survenue. Vos données saisies et synchronisations cloud sont préservées en toute sécurité.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
            >
              Actualiser l&apos;écran
            </button>
            <a
              href="/login"
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Page de Connexion &rarr;
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
