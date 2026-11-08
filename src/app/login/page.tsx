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
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#091124] text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 font-sans selection:bg-emerald-500 selection:text-white">
      <div className="w-full flex-1 flex flex-col justify-center items-center my-auto py-6">
        {/* Main Card Container */}
        <div className="w-full max-w-[440px] rounded-2xl overflow-hidden shadow-2xl shadow-black/70 border border-slate-800/80 bg-white">
          {/* Top Dark Header */}
          <div className="bg-[#0b1426] px-6 pt-7 pb-6 text-center border-b border-slate-800 flex flex-col items-center">
            {/* White pill badge with Logo */}
            <div className="inline-flex items-center justify-center bg-white px-5 py-2.5 rounded-2xl shadow-md mb-4 border border-slate-100">
              <Image
                src="/images/logo-saninova.png"
                alt="SaniNova"
                width={150}
                height={46}
                className="h-9 w-auto object-contain"
                priority
              />
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
              SANINOVA HUB
            </h1>

            {/* Green Subtitle */}
            <div className="text-[11px] sm:text-xs font-bold text-emerald-400 tracking-wide uppercase mt-1">
              PROJET AFGHS-PSI BÉNIN
            </div>

            {/* Government / Institutional reference */}
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ministère de la Santé &bull; République du Bénin
            </p>
          </div>

          {/* White Card Body */}
          <div className="p-6 sm:p-8 bg-white text-slate-800">
            <div className="mb-6">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Espace d&apos;Authentification Agent
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Connectez-vous avec vos identifiants institutionnels nominatifs
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start space-x-2 animate-in fade-in duration-150">
                <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Identifiant ou Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Identifiant ou Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder=""
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                    autoFocus
                  />
                </div>
              </div>

              {/* Field 2: Mot de passe */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#047857] hover:bg-[#065f46] active:bg-[#047857] text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Connexion en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Se connecter à mon espace</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Développé par <span className="font-bold text-emerald-400">SANINOVA GLOBAL CONSULTING</span>
        </div>
      </div>
    </div>
  );
}
