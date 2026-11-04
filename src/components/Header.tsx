'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function Header() {
  const { currentUser, setCurrentUser, users, b09Metrics, login } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Calculate overall B09 promptitude
  const totalExpected = b09Metrics.reduce((acc, m) => acc + m.expected_reports, 0);
  const totalOnTime = b09Metrics.reduce((acc, m) => acc + m.submitted_on_time, 0);
  const globalPromptitude = totalExpected > 0 ? Number(((totalOnTime / totalExpected) * 100).toFixed(1)) : 0;
  const isPromptitudeTargetMet = globalPromptitude >= 70;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!usernameInput) {
      setErrorMessage('Veuillez saisir votre identifiant (ex : aimorou).');
      return;
    }

    const res = login(usernameInput, passwordInput || 'sani2026');
    if (res.success) {
      setSuccessMessage('Connexion réussie !');
      setTimeout(() => {
        setModalOpen(false);
        setUsernameInput('');
        setPasswordInput('');
        setSuccessMessage('');
      }, 700);
    } else {
      setErrorMessage(res.message || 'Identifiant ou mot de passe incorrect.');
    }
  };

  const handleQuickSelect = (u: typeof users[0]) => {
    setCurrentUser(u);
    setSuccessMessage(`Connecté en tant que ${u.full_name}`);
    setTimeout(() => {
      setModalOpen(false);
      setSuccessMessage('');
    }, 500);
  };

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
        <button
          onClick={() => {
            setErrorMessage('');
            setSuccessMessage('');
            setModalOpen(true);
          }}
          className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition text-left group"
        >
          <div className="w-8 h-8 rounded bg-teal-800 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
            {currentUser.full_name.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <span>{currentUser.full_name}</span>
              <span className="font-mono text-[10px] font-semibold text-teal-800 bg-teal-50 px-1 rounded border border-teal-200">
                @{currentUser.username || 'user'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>{currentUser.title.split('—')[0].trim()}</span>
              <span className="text-slate-400">&bull; Changer</span>
            </div>
          </div>
        </button>
      </div>

      {/* LOGIN & USER SWITCH MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">Connexion Utilisateur</h3>
                <p className="text-[11px] text-slate-400">Accès sécurisé à votre espace de travail SaniPlaner</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                  {successMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Identifiant (Initiale prénom + Nom) :
                </label>
                <input
                  type="text"
                  placeholder="Ex : aimorou, hakohouvi, edanhin..."
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono outline-none focus:border-teal-700"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Exemple : <span className="font-mono text-teal-800 font-bold">aimorou</span> pour Arafath IMOROU
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mot de passe :
                </label>
                <input
                  type="password"
                  placeholder="sani2026"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono outline-none focus:border-teal-700"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Mot de passe standard : <span className="font-mono text-slate-700 font-semibold">sani2026</span>
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-xs shadow-xs transition"
              >
                Se Connecter
              </button>
            </form>

            {/* Quick Switch Helper */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                Ou basculer rapidement sur un profil :
              </div>
              <div className="grid grid-cols-2 gap-2">
                {users.map((u) => {
                  const isSelected = u.id === currentUser.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickSelect(u)}
                      className={`text-left p-2 rounded border text-[11px] transition flex items-center space-x-2 ${
                        isSelected 
                          ? 'bg-teal-50 border-teal-300 text-teal-900 font-bold'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {u.full_name.charAt(0)}
                      </span>
                      <div className="truncate">
                        <div className="truncate font-medium">{u.full_name.split(' ').slice(-1)[0]}</div>
                        <div className="font-mono text-[9px] text-teal-700">@{u.username}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
