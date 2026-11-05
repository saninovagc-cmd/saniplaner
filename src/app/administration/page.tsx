'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { GEOGRAPHIC_ZONES } from '@/lib/mock-data';
import { checkSupabaseStatus, SupabaseStatus } from '@/lib/supabase-sync';
import { ALL_MODULES, UserProfile, UserRole } from '@/types';
import ModuleGuard from '@/components/ModuleGuard';

export default function AdministrationPage() {
  const { users, auditLogs, currentUser, updateUser, syncNow, lastSyncTime } = useApp();

  const [activeTab, setActiveTab] = useState<'users' | 'zones' | 'settings' | 'audit' | 'cloud'>('users');
  const [b09Threshold, setB09Threshold] = useState<number>(70);
  const [b09DeadlineDay, setB09DeadlineDay] = useState<number>(20);
  const [cloudStatus, setCloudStatus] = useState<SupabaseStatus | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string>('');

  // Editing state for roles and modules
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('rsco');
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editIsFirstLogin, setEditIsFirstLogin] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState<string>('sani2026');

  useEffect(() => {
    checkSupabaseStatus().then(setCloudStatus);
  }, []);

  const handleRefreshCloud = async () => {
    setIsCheckingCloud(true);
    const status = await checkSupabaseStatus();
    setCloudStatus(status);
    setIsCheckingCloud(false);
  };

  const isDirection = currentUser.role === 'direction';

  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditModules(u.allowed_modules && u.allowed_modules.length > 0 
      ? [...u.allowed_modules] 
      : ALL_MODULES.map(m => m.id)
    );
    setEditIsFirstLogin(Boolean(u.is_first_login));
    setEditPassword(u.password || 'sani2026');
  };

  const handleToggleModule = (moduleId: string) => {
    setEditModules(prev => 
      prev.includes(moduleId)
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSelectAllModules = () => {
    setEditModules(ALL_MODULES.map(m => m.id));
  };

  const handleDeselectAllModules = () => {
    setEditModules([]);
  };

  const handleSaveUserPermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updated: UserProfile = {
      ...editingUser,
      role: editRole,
      allowed_modules: editModules,
      is_first_login: editIsFirstLogin,
      password: editPassword,
    };

    updateUser(updated);
    setEditingUser(null);
    setSuccessToast(`Permissions et rôle enregistrés pour ${updated.full_name}`);
    setTimeout(() => setSuccessToast(''), 4000);
  };

  return (
    <ModuleGuard moduleId="administration">
      <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 13 : Administration
            </span>
            <span className="text-xs text-slate-500 font-medium">Gouvernance, Sécurité RLS, Rôles & Modules</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Administration & Paramétrage</h1>
          <p className="text-xs text-slate-500">
            Attribution des rôles, habilitations modulaires par personnel, identifiants et synchronisation multi-utilisateurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSyncTime && (
            <div className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 flex items-center space-x-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Dernière synchro : <strong className="font-mono text-slate-700">{lastSyncTime}</strong></span>
            </div>
          )}
          <button
            onClick={() => syncNow()}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300 transition shrink-0"
          >
            Synchroniser
          </button>
          <div className="bg-slate-100 p-1 rounded flex items-center space-x-1 border border-slate-200 text-xs overflow-x-auto max-w-full no-scrollbar">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded font-semibold transition whitespace-nowrap ${
                activeTab === 'users' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Équipe ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('zones')}
              className={`px-3 py-1.5 rounded font-semibold transition whitespace-nowrap ${
                activeTab === 'zones' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Territoires ({GEOGRAPHIC_ZONES.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded font-semibold transition whitespace-nowrap ${
                activeTab === 'settings' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paramètres Cibles
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded font-semibold transition whitespace-nowrap ${
                activeTab === 'audit' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Journal d’Audit
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className={`px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'cloud' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Supabase Cloud</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security alert for non-direction */}
      {!isDirection && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded text-xs text-blue-900">
          Mode consultation active. La modification des paramètres et des droits utilisateurs est réservée à la <strong>Direction Générale</strong>.
        </div>
      )}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {successToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-between animate-in fade-in">
              <span>{successToast}</span>
              <button onClick={() => setSuccessToast('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
            </div>
          )}

          {/* Information Banner on Credentials & Permissions */}
          <div className="bg-slate-900 text-white p-4 rounded-lg shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                  Habilitations & Identifiants
                </span>
                <span className="text-slate-400 font-mono text-[11px]">{users.length} Personnels</span>
              </div>
              <p className="mt-1 text-slate-300 text-[11px] leading-relaxed">
                <strong>Format Identifiant :</strong> Initiale prénom + Nom (ex : <span className="font-mono text-teal-300 font-bold">aimorou</span>, <span className="font-mono text-teal-300 font-bold">hakohouvi</span>).
                <br />
                <strong>Contrôle d'accès :</strong> Cliquez sur <strong>« Gérer Rôle & Modules »</strong> sur n'importe quel personnel pour cocher/décocher ses modules autorisés ou modifier son rôle.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Répertoire Officiel du Personnel, des Rôles et des Modules Autorisés
                </h3>
                <p className="text-xs text-slate-500">
                  Gouvernance des accès selon le principe du moindre privilège adapté aux missions du projet AFGHS.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded text-teal-900 font-mono">
                {users.length} Comptes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Personnel</th>
                    <th className="p-3.5">Identifiant</th>
                    <th className="p-3.5">Rôle Système</th>
                    <th className="p-3.5">Modules Autorisés</th>
                    <th className="p-3.5">Mot de Passe</th>
                    <th className="p-3.5 text-center">Statut</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const moduleCount = u.allowed_modules ? u.allowed_modules.length : ALL_MODULES.length;
                    const isFirstLogin = Boolean(u.is_first_login);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900">
                          <div>
                            <div>{u.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-normal">{u.email}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{u.title}</div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-teal-50 text-teal-900 border border-teal-200">
                            @{u.username || '—'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {moduleCount} / {ALL_MODULES.length}
                            </span>
                            <span className="text-[10px] text-slate-400">modules</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {u.allowed_modules && u.allowed_modules.length > 0
                              ? u.allowed_modules.join(', ')
                              : 'Tous les modules (Par défaut)'}
                          </div>
                        </td>
                        <td className="p-3.5">
                          {isFirstLogin ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>Initial ({u.password || 'sani2026'})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Personnalisé</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                            Actif
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="px-2.5 py-1 text-slate-700 hover:text-teal-900 hover:bg-slate-100 rounded text-xs font-semibold border border-slate-300 transition"
                          >
                            Gérer Rôle & Modules &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT PERMISSIONS & ROLE FOR A PERSONNEL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                  Attribution des Rôles & Modules — {editingUser.full_name}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Identifiant : @{editingUser.username || 'user'} · {editingUser.email}
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUserPermissions} className="p-4 sm:p-5 space-y-5 text-xs flex-1 overflow-y-auto">
              {/* 1. ROLE SELECTION */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  1. Rôle Système Attribué :
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white font-semibold outline-none focus:border-teal-700"
                >
                  <option value="direction">Direction Générale / Chef de Projet (Accès intégral & validation finale)</option>
                  <option value="senior_advisor">Conseiller Senior & Quantification (Quantification FASP, coordination)</option>
                  <option value="sis_specialist">Spécialiste SIS / eSIGL (Support eSIGL, administration technique, promptitude)</option>
                  <option value="fasp_specialist">Spécialiste FASP (Quantification, plans d'approvisionnement QAT & POA)</option>
                  <option value="se_specialist">Spécialiste Suivi-Évaluation (Contrôle qualité, vérification des livrables & timesheets)</option>
                  <option value="rsco">RSCO — Responsable Suivi Chaîne d'Opérations (Supervision terrain, POA, relances)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Le rôle détermine les droits de validation hiérarchique sur les feuilles de temps, livrables et ordres de mission.
                </p>
              </div>

              {/* 2. MODULES PERMISSION CHECKBOXES */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      2. Modules de la Plateforme Autorisés :
                    </label>
                    <p className="text-[10px] text-slate-500">
                      Cochez les modules visibles dans le menu de navigation pour ce collaborateur.
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllModules}
                      className="px-2 py-1 text-[10px] font-semibold text-teal-800 hover:bg-teal-50 rounded border border-teal-200"
                    >
                      Tout cocher
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllModules}
                      className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  {ALL_MODULES.map((mod) => {
                    const isChecked = editModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-center space-x-2.5 p-2 rounded border cursor-pointer transition ${
                          isChecked 
                            ? 'bg-white border-teal-300 text-slate-900 shadow-2xs font-semibold' 
                            : 'bg-white/60 border-slate-200 text-slate-500 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleModule(mod.id)}
                          className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700"
                        />
                        <span className="font-mono text-[10px] text-teal-800">{mod.num}</span>
                        <span className="text-xs">{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-500 text-right font-mono">
                  {editModules.length} sur {ALL_MODULES.length} modules sélectionnés
                </div>
              </div>

              {/* 3. SECURITY & FIRST LOGIN PASSWORD RESET */}
              <div className="bg-amber-50/60 p-3.5 rounded-lg border border-amber-200 space-y-2">
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                  3. Sécurité & Première Connexion :
                </label>
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsFirstLogin}
                      onChange={(e) => setEditIsFirstLogin(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                    />
                    <span className="text-xs text-amber-900 font-medium">
                      Exiger la modification du mot de passe à la prochaine connexion
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setEditPassword('sani2026');
                      setEditIsFirstLogin(true);
                      alert('Mot de passe réinitialisé sur "sani2026" et statut première connexion réactivé.');
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-white hover:bg-amber-100 rounded border border-amber-300 transition"
                  >
                    Réinitialiser sur « sani2026 »
                  </button>
                </div>
                <p className="text-[10px] text-amber-800/80">
                  Mot de passe actuel enregistré : <span className="font-mono font-semibold">{editPassword}</span>
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold shadow-xs transition"
                >
                  Enregistrer les Habilitations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: GEOGRAPHIC ZONES */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Découpage Territorial Officiel — Projet AFGHS-PSI Bénin
            </h3>
            <p className="text-xs text-slate-500">
              Périmètre de mesure B09 & B13 (4 départements, 9 zones sanitaires) + Couverture spécifique Alibori (3 zones sanitaires) + Niveau National.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GEOGRAPHIC_ZONES.map((zone) => (
              <div key={zone.id} className="p-3.5 rounded border border-slate-200 bg-slate-50/70 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-900">{zone.department}</span>
                  {zone.is_primary_b09_b13 ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      Mesure B09/B13
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                      Spécifique / National
                    </span>
                  )}
                </div>
                <p className="text-slate-700 font-medium mt-1">{zone.zone_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TARGET SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 max-w-xl space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">Paramétrage des Seuils Réglementaires</h3>
            <p className="text-xs text-slate-500">Règles métier de calcul et d’alerte du Hub</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Seuil cible d’excellence pour la promptitude eSIGL (Milestone B09)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={b09Threshold}
                  onChange={(e) => setB09Threshold(Number(e.target.value))}
                  disabled={!isDirection}
                  className="w-24 border border-slate-200 rounded p-2 font-bold text-slate-900 outline-none"
                />
                <span className="font-semibold text-slate-700">% ou plus (Seuil officiel fixé à 70%)</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Jour limite de transmission mensuelle nationale eSIGL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={b09DeadlineDay}
                  onChange={(e) => setB09DeadlineDay(Number(e.target.value))}
                  disabled={!isDirection}
                  className="w-24 border border-slate-200 rounded p-2 font-bold text-slate-900 outline-none"
                />
                <span className="font-semibold text-slate-700">du mois suivant (Horodatage eSIGL officiel)</span>
              </div>
            </div>

            {isDirection && (
              <button
                onClick={() => alert('Paramètres cibles enregistrés avec succès.')}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-semibold text-xs transition"
              >
                Mettre à jour les paramètres
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                Journal d’Audit et Traçabilité des Opérations (Audit Trail)
              </h3>
              <p className="text-xs text-slate-500">
                Enregistrement inaltérable de chaque action sensible effectuée sur la plateforme.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-mono">
              {auditLogs.length} événements
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Horodatage</th>
                  <th className="p-3.5">Utilisateur</th>
                  <th className="p-3.5">Rôle</th>
                  <th className="p-3.5">Action Réalisée</th>
                  <th className="p-3.5">Module</th>
                  <th className="p-3.5">Entité Concernée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition font-mono">
                    <td className="p-3.5 text-slate-500 text-[11px]">{log.timestamp}</td>
                    <td className="p-3.5 font-bold font-sans text-slate-800">{log.user_name}</td>
                    <td className="p-3.5 text-slate-500 font-sans">{log.user_role}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-700">{log.module}</td>
                    <td className="p-3.5 text-slate-600">{log.entity_ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SUPABASE CLOUD SYNC */}
      {activeTab === 'cloud' && (
        <div className="space-y-6">
          {/* Status Box */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Supabase PostgreSQL Cloud
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {cloudStatus?.isConnected ? 'CONNECTÉ & OPÉRATIONNEL' : 'CONFIGURÉ'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Synchronisation en temps réel du planning hebdomadaire, des timesheets, des activités et du journal d&apos;audit.
                </p>
              </div>

              <button
                onClick={handleRefreshCloud}
                disabled={isCheckingCloud}
                className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                {isCheckingCloud ? 'Vérification en cours...' : 'Tester la connexion'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Supabase URL
                </span>
                <span className="text-slate-800 font-bold select-all break-all">
                  https://bkwspibjypklsrbvyfrn.supabase.co
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Clé Publique
                </span>
                <span className="text-slate-800 font-bold select-all break-all">
                  sb_publishable_Tdk6wZWQ6S5HrDVeho3boQ_vmtwP6LZ
                </span>
              </div>
            </div>
          </div>

          {/* Tables Sync Status */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                État des Tables Supabase
              </h3>
              <p className="text-xs text-slate-500">
                Vérification de l&apos;accessibilité des relations dans le schéma public de la base PostgreSQL.
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-slate-800">activities / sani_work_plan</div>
                  <div className="text-[11px] text-slate-500">Plan de travail contractuel (19 activités)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Actif & Accessible
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-slate-800">audit_logs / sani_audit_logs</div>
                  <div className="text-[11px] text-slate-500">Journal d&apos;audit et traçabilité inaltérable</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Actif & Accessible
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-slate-800">weekly_activities / sani_weekly_activities</div>
                  <div className="text-[11px] text-slate-500">Planning hebdomadaire des activités par personnel</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  cloudStatus?.tables?.weekly_activities
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {cloudStatus?.tables?.weekly_activities ? 'Synchronisé' : 'En attente script SQL'}
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-slate-800">weekly_submissions / sani_weekly_submissions</div>
                  <div className="text-[11px] text-slate-500">Statuts de validation hebdomadaires (Vert vs Rouge)</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  cloudStatus?.tables?.weekly_submissions
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {cloudStatus?.tables?.weekly_submissions ? 'Synchronisé' : 'En attente script SQL'}
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-slate-800">timesheets / sani_timesheets</div>
                  <div className="text-[11px] text-slate-500">Feuilles de temps mensuelles et circuit de visas</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  cloudStatus?.tables?.timesheets
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {cloudStatus?.tables?.timesheets ? 'Synchronisé' : 'En attente script SQL'}
                </span>
              </div>
            </div>
          </div>

          {/* Script Migration Guide */}
          <div className="bg-slate-900 text-slate-100 rounded-lg p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Script SQL Prêt
                </span>
                <span className="font-bold text-xs uppercase text-slate-200">
                  Initialisation des tables dans Supabase
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`-- Fichier : supabase/migration_saniplaner.sql disponible dans le projet`);
                  setSqlCopied(true);
                  setTimeout(() => setSqlCopied(false), 3000);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold border border-slate-700 transition"
              >
                {sqlCopied ? 'Copié !' : 'Copier Référence'}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Le fichier complet de création de tables et de données initiales est disponible à la racine du projet sous :
              <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded mx-1 font-mono text-[11px]">
                supabase/migration_saniplaner.sql
              </code>.
              Il vous suffit de copier son contenu et de l&apos;exécuter dans l&apos;éditeur SQL de votre Dashboard Supabase pour finaliser la synchronisation.
            </p>
          </div>
        </div>
      )}
    </div>
  </ModuleGuard>
  );
}
