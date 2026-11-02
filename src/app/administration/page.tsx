'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  ShieldCheck, 
  Users, 
  Lock, 
  Settings, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  UserX, 
  UserCheck,
  Activity,
  History
} from 'lucide-react';
import { GEOGRAPHIC_ZONES } from '@/lib/mock-data';

export default function AdministrationPage() {
  const { users, auditLogs, currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<'users' | 'zones' | 'settings' | 'audit'>('users');
  const [b09Threshold, setB09Threshold] = useState<number>(70);
  const [b09DeadlineDay, setB09DeadlineDay] = useState<number>(20);

  const isDirection = currentUser.role === 'direction';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              Module 10 : Administration
            </span>
            <span className="text-xs text-slate-500">Gouvernance, Sécurité RLS & Audit</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Administration & Paramétrage</h1>
          <p className="text-xs text-slate-500">
            Comptes individuels, attribution des rôles, référentiels territoriaux et traçabilité des opérations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-slate-100 p-1 rounded-lg flex items-center space-x-1 border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'users' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Experts ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('zones')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'zones' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Territoires (Bénin)
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'settings' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paramètres Cibles
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'audit' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Journal d’Audit
            </button>
          </div>
        </div>
      </div>

      {/* Security alert for non-direction */}
      {!isDirection && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <span>
              Mode consultation active. La modification des paramètres et des droits utilisateurs est réservée à la <strong>Direction</strong>.
            </span>
          </div>
        </div>
      )}

      {/* TAB 1: USERS (8 EXPERTS + DIRECTION) */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                Équipe Projet : La Direction et les 8 Experts Dédiés
              </h3>
              <p className="text-xs text-slate-500">
                Chaque profil dispose d’un accès individuel sécurisé et restreint selon sa fiche de poste.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-md text-teal-800">
              9 Comptes Actifs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Nom de l’Expert</th>
                  <th className="p-3.5">Rôle Système</th>
                  <th className="p-3.5">Titre Professionnel</th>
                  <th className="p-3.5">Départements Assignés</th>
                  <th className="p-3.5">Contact Téléphonique</th>
                  <th className="p-3.5 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                            {u.full_name.charAt(0)}
                          </div>
                          <div>
                            <div>{u.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 font-medium">
                        {u.title}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {u.assigned_departments.join(', ')}
                      </td>
                      <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                        {u.phone || 'Non renseigné'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Actif</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GEOGRAPHIC ZONES */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">
              Découpage Territorial Officiel — Projet AFGHS-PSI Bénin
            </h3>
            <p className="text-xs text-slate-500">
              Périmètre principal de mesure B09 & B13 (4 départements, 9 zones sanitaires) + Couverture spécifique Alibori + Niveau National.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GEOGRAPHIC_ZONES.map((zone) => (
              <div key={zone.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-900">{zone.department}</span>
                  {zone.is_primary_b09_b13 ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      Mesure B09/B13
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                      Appui / National
                    </span>
                  )}
                </div>
                <p className="text-slate-600 font-medium mt-1">{zone.zone_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TARGET SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-xl space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">Paramétrage des Seuils Réglementaires</h3>
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
                  className="w-24 border border-slate-200 rounded-lg p-2 font-bold text-slate-900 outline-none"
                />
                <span className="font-bold text-slate-700">% ou plus (Fixé à 70% dans le Cahier des charges)</span>
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
                  className="w-24 border border-slate-200 rounded-lg p-2 font-bold text-slate-900 outline-none"
                />
                <span className="font-bold text-slate-700">du mois suivant (Horodatage eSIGL faisant foi)</span>
              </div>
            </div>

            {isDirection && (
              <button
                onClick={() => alert('Paramètres cibles enregistrés avec succès.')}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold text-xs transition"
              >
                Mettre à jour les paramètres
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                Journal d’Audit et Traçabilité des Opérations (Audit Trail)
              </h3>
              <p className="text-xs text-slate-500">
                Enregistrement inaltérable de chaque action sensible effectuée sur la plateforme.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700">
              {auditLogs.length} événements récents
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
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
                  <tr key={log.id} className="hover:bg-slate-50/70 transition font-mono">
                    <td className="p-3.5 text-slate-500 text-[11px]">{log.timestamp}</td>
                    <td className="p-3.5 font-bold font-sans text-slate-800">{log.user_name}</td>
                    <td className="p-3.5 text-slate-500 font-sans">{log.user_role}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
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
    </div>
  );
}
