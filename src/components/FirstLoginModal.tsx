'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function FirstLoginModal() {
  const { currentUser, isPasswordChangeRequired, changePassword } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isPasswordChangeRequired) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword || newPassword.trim().length < 4) {
      setErrorMessage('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }

    if (newPassword.trim() === 'sani2026') {
      setErrorMessage('Veuillez choisir un nouveau mot de passe différent du mot de passe initial (sani2026).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    const res = await changePassword(currentUser.id, newPassword);
    if (res.success) {
      setSuccessMessage('Mot de passe enregistré avec succès ! Bienvenue sur SaniPlaner.');
      setTimeout(() => {
        setIsSubmitting(false);
      }, 900);
    } else {
      setErrorMessage(res.message || 'Une erreur est survenue lors de l’enregistrement.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans">
        {/* Institutional Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
              Première Connexion Requise
            </span>
            <span className="text-xs text-slate-400 font-mono">Sécurité du Compte</span>
          </div>
          <h2 className="text-base font-bold text-white mt-1.5 uppercase tracking-tight">
            Personnalisation du Mot de Passe
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Projet AFGHS-PSI Bénin · SaniNova Global Consulting
          </p>
        </div>

        {/* User Card */}
        <div className="p-4 bg-teal-50/50 border-b border-teal-100 flex items-center space-x-3 text-xs">
          <div className="w-10 h-10 rounded-lg bg-teal-800 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
            {currentUser.full_name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-slate-900 truncate">{currentUser.full_name}</div>
            <div className="text-[11px] text-teal-800 font-mono">
              Identifiant : <span className="font-bold">@{currentUser.username || 'user'}</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">{currentUser.title}</div>
          </div>
        </div>

        {/* Instructions & Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Bienvenue sur votre espace de travail. Pour des raisons de confidentialité, vous devez <strong>remplacer votre mot de passe temporaire initial</strong> par votre propre mot de passe personnel, qui sera mémorisé pour toutes vos prochaines connexions.
          </p>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium text-xs">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-xs">
              {successMessage}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nouveau Mot de Passe :
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Votre nouveau mot de passe personnel..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 pr-16"
                autoFocus
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-800 font-semibold px-1 py-0.5 rounded bg-slate-100"
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Minimum 4 caractères. Choisissez un mot de passe facile à retenir pour vous.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Confirmer le Nouveau Mot de Passe :
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Répétez votre mot de passe..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded font-mono outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer mon Mot de Passe & Accéder'}
          </button>
        </form>

        {/* Footer Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          Ce mot de passe restera strictement personnel et confidentiel.
        </div>
      </div>
    </div>
  );
}
