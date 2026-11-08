'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim()) {
      setErrorMessage('Veuillez saisir votre identifiant ou votre adresse e-mail.');
      return;
    }

    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = login(username, password);
      if (res.success) {
        router.replace('/');
      } else {
        setErrorMessage(res.message || 'Identifiant ou mot de passe incorrect.');
        setIsSubmitting(false);
      }
    }, 350);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Header / Branding */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center space-x-3.5">
          <div className="relative h-11 w-auto max-w-[150px] flex items-center shrink-0">
            <Image
              src="/images/logo-saninova-white.png"
              alt="SaniNova"
              width={140}
              height={44}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <div className="border-l border-slate-700/80 pl-3.5">
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight uppercase">
                SANINOVA HUB
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                AFGHS-PSI Bénin
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Plateforme Intégrée de Gestion & Pilotage Opérationnel
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-3">
          <div className="px-3 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-slate-300">
            FY2026-2027 &bull; Softworks / SaniNova
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Platform Presentation */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-900/40 border border-teal-700/50 text-teal-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Espace Sécurisé &bull; Équipe Projet</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Portail de Gestion & Pilotage des Opérations
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connectez-vous avec vos identifiants institutionnels pour accéder à la planification d&apos;activités, à l&apos;imputation des feuilles de temps mensuelles, au suivi contractuel et à la coordination des missions de terrain.
            </p>
          </div>

          <div className="pt-2 flex items-center space-x-4 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Accès réservé & confidentiel</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Contrôle de sécurité RLS actif</span>
            </div>
          </div>
        </div>

        {/* Right Column: Clean Login Card */}
        <div className="lg:col-span-6">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-700"></div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Connexion Utilisateur</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Renseignez vos identifiants pour ouvrir votre session de travail
                </p>
              </div>
              <div className="relative h-8 w-auto max-w-[95px] flex items-center shrink-0">
                <Image
                  src="/images/logo-saninova-white.png"
                  alt="SaniNova"
                  width={95}
                  height={28}
                  className="h-6 w-auto object-contain opacity-85"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs font-medium flex items-start space-x-2.5 animate-in fade-in duration-200">
                <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
                  Identifiant ou E-mail Professionnel :
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex : aimorou ou aimorou@saninovagc.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Format : identifiant (ex : <span className="text-teal-400 font-mono font-semibold">aimorou</span>) ou email (<span className="text-teal-400 font-mono font-semibold">aimorou@saninovagc.com</span>)
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Mot de Passe :
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Initial : <code className="text-teal-400 font-semibold">sani2026</code>
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-lg shadow-teal-900/40 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Authentification...</span>
                  </>
                ) : (
                  <>
                    <span>Se Connecter à la Plateforme</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
        <p>
          &copy; 2026-2027 SaniNova ONG &bull; Projet AFGHS-PSI Bénin &bull; Tous droits réservés.
        </p>
        <p className="font-mono">
          Accès restreint &bull; Confidentialité & Conformité RLS Supabase
        </p>
      </footer>
    </div>
  );
}
