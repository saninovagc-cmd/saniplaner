'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

// Configuration des 9 zones sanitaires contractuelles du Jalon B09
const OFFICIAL_9_ZONES_CONFIG = [
  { dept: 'Atacora', zone: 'Kouandé-Péhunco-Kérou (2KP)' },
  { dept: 'Atacora', zone: 'Natitingou-Boukoumbé-Toucountouna (NBT)' },
  { dept: 'Atacora', zone: 'Tanguiéta-Matéri-Cobly (TMC)' },
  { dept: 'Mono', zone: 'Lokossa-Athiémé (LA)' },
  { dept: 'Mono', zone: 'Comé-Grand-Popo-Bopa-Houéyogbé (CBGH)' },
  { dept: 'Plateau', zone: 'Pobè-Adja-Ouèrè-Kétou (PAK)' },
  { dept: 'Plateau', zone: 'Sakété-Ifangni (SAKIF)' },
  { dept: 'Donga', zone: 'Djougou-Copargo-Ouaké (DCO)' },
  { dept: 'Donga', zone: 'Bassila' },
];

const MONTHS_CONFIG = [
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
];

export default function DashboardPage() {
  const { 
    activities, 
    b09Metrics, 
    b13Items, 
    missions, 
    deliverables, 
    users, 
    weeklyActivities, 
    weeklySubmissions, 
    timesheets,
    meetings,
    lastSyncTime,
    currentUser,
  } = useApp();

  const isPartnerView = currentUser?.role === 'partenaire' || currentUser?.username === 'psiabms';
  const router = useRouter();

  // Si l'utilisateur connecté n'a pas accès au Tableau de bord, rediriger automatiquement vers son premier module autorisé (ex: Work Plan)
  useEffect(() => {
    if (currentUser && currentUser.role !== 'direction' && currentUser.allowed_modules && !currentUser.allowed_modules.includes('dashboard')) {
      const firstAllowed = currentUser.allowed_modules[0] || 'work_plan';
      const targetPath = firstAllowed === 'work_plan' ? '/work-plan' : `/${firstAllowed}`;
      router.replace(targetPath);
    }
  }, [currentUser, router]);

  // ====================================================================
  // 1. STATS WORK PLAN ANNUEL (Activités Contractuelles Validées)
  // ====================================================================
  const totalActivities = activities.length;
  const completedActivities = activities.filter(a => a.status === 'TERMINEE').length;
  const inProgressActivities = activities.filter(a => a.status === 'EN_COURS').length;
  const upcomingActivities = activities.filter(a => a.status === 'A_VENIR').length;
  const delayedActivities = activities.filter(a => a.status === 'EN_RETARD').length;

  const avgProgress = totalActivities > 0 
    ? Math.round(activities.reduce((sum, a) => sum + (a.progress_pct || 0), 0) / totalActivities)
    : 0;

  // ====================================================================
  // 2. STATS PLANNING HEBDOMADAIRE (Semaine 07 en cours • Nov 2026)
  // ====================================================================
  // La semaine active dans le calendrier opérationnel actuel est la Semaine 07
  const currentWeekNumber = 7;
  const currentWeekActs = (weeklyActivities || []).filter(w => w?.week_number === currentWeekNumber);
  const completedWeekActs = currentWeekActs.filter(w => w?.status === 'TERMINEE' || w?.status === 'REALISE').length;
  const inProgressWeekActs = currentWeekActs.filter(w => w?.status === 'EN_COURS').length;
  const avgWeekProgress = currentWeekActs.length > 0
    ? Math.round(currentWeekActs.reduce((s, a) => s + (a?.progress_pct || 0), 0) / currentWeekActs.length)
    : 0;

  // Soumissions hebdomadaires pour la semaine 07
  const currentWeekSubmissions = (weeklySubmissions || []).filter(s => s?.week_number === currentWeekNumber && s?.is_submitted);
  const currentWeekSubmittedCount = currentWeekSubmissions.length;
  const currentWeekSubmittedExpertIds = new Set(currentWeekSubmissions.map(s => s?.expert_id).filter(Boolean));

  // Cumul global de toutes les activités hebdomadaires saisies sur le projet
  const totalWeeklyActs = (weeklyActivities || []).length;
  const totalCompletedWeeklyActs = (weeklyActivities || []).filter(w => w?.status === 'TERMINEE' || w?.status === 'REALISE').length;
  const totalInProgressWeeklyActs = (weeklyActivities || []).filter(w => w?.status === 'EN_COURS').length;

  // ====================================================================
  // 3. STATS SÉANCES & RÉUNIONS (Module 02)
  // ====================================================================
  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter(m => m.status === 'TERMINEE');
  const plannedMeetings = meetings.filter(m => m.status === 'PLANIFIEE');
  const gttMeetings = meetings.filter(m => m.meeting_type === 'GTT');
  const coordMeetings = meetings.filter(m => m.meeting_type === 'COORDINATION');
  const meetingsWithAttendance = meetings.filter(m => Boolean(m.attendance_sheet_name || m.pv_attachment_name));

  // ====================================================================
  // 4. STATS B09 (Promptitude & Complétude eSIGL - 356 FOSA)
  // ====================================================================
  // Filtre de référence globale sur Octobre 2026 (base contractuelle initiale)
  const octMetrics = (b09Metrics || []).filter(m => m?.period_month === 10 && m?.period_year === 2026);
  const targetB09Metrics = octMetrics.length > 0 ? octMetrics : (b09Metrics || []).slice(0, 9);

  const totalB09Expected = targetB09Metrics.reduce((s, m) => s + (m?.expected_reports || 0), 0);
  const totalB09OnTime = targetB09Metrics.reduce((s, m) => s + (m?.submitted_on_time || 0), 0);
  const totalB09Submitted = targetB09Metrics.reduce((s, m) => s + (m?.submitted_on_time || 0) + (m?.submitted_late || 0), 0);
  const hasB09Data = totalB09Submitted > 0;
  const b09GlobalRate = totalB09Expected > 0 ? Number(((totalB09OnTime / totalB09Expected) * 100).toFixed(1)) : 0;
  const b09TargetMet = b09GlobalRate >= 70;

  // Filtres interactifs du Jalon B09 sur le Dashboard (Mois, Année, Département, Zone)
  const [b09FilterMonth, setB09FilterMonth] = useState<string>('10'); // Octobre par défaut
  const [b09FilterYear, setB09FilterYear] = useState<string>('2026'); // 2026 par défaut
  const [b09FilterDept, setB09FilterDept] = useState<string>('ALL'); // Tous par défaut
  const [b09FilterZone, setB09FilterZone] = useState<string>('ALL'); // Toutes par défaut

  // Zones disponibles selon le département sélectionné
  const availableB09Zones = useMemo(() => {
    if (b09FilterDept === 'ALL') return OFFICIAL_9_ZONES_CONFIG;
    return OFFICIAL_9_ZONES_CONFIG.filter(z => z.dept === b09FilterDept);
  }, [b09FilterDept]);

  // Données dynamiquement filtrées pour la section B09
  const filteredB09Metrics = useMemo(() => {
    return (b09Metrics || []).filter((m) => {
      if (!m) return false;
      if (b09FilterMonth !== 'ALL' && m.period_month !== Number(b09FilterMonth)) return false;
      if (b09FilterYear !== 'ALL' && m.period_year !== Number(b09FilterYear)) return false;
      if (b09FilterDept !== 'ALL' && m.department !== b09FilterDept) return false;
      if (b09FilterZone !== 'ALL' && m.zone_name !== b09FilterZone) return false;
      return true;
    });
  }, [b09Metrics, b09FilterMonth, b09FilterYear, b09FilterDept, b09FilterZone]);

  const filteredB09Expected = filteredB09Metrics.reduce((s, m) => s + (m?.expected_reports || 0), 0);
  const filteredB09OnTime = filteredB09Metrics.reduce((s, m) => s + (m?.submitted_on_time || 0), 0);
  const filteredB09Submitted = filteredB09Metrics.reduce((s, m) => s + (m?.submitted_on_time || 0) + (m?.submitted_late || 0), 0);
  const filteredB09Rate = filteredB09Expected > 0 ? Number(((filteredB09OnTime / filteredB09Expected) * 100).toFixed(1)) : 0;

  const b09FilterPeriodLabel = useMemo(() => {
    const monthName = b09FilterMonth !== 'ALL' ? (MONTHS_CONFIG.find(m => m.value === b09FilterMonth)?.label || `Mois ${b09FilterMonth}`) : 'Tous les mois';
    const yearName = b09FilterYear !== 'ALL' ? b09FilterYear : 'Toutes années';
    const deptName = b09FilterDept !== 'ALL' ? `Dép. ${b09FilterDept}` : '4 Départements Cibles';
    const zoneName = b09FilterZone !== 'ALL' ? b09FilterZone : `${filteredB09Metrics.length} Zone(s) Contractuelle(s)`;
    return `Période : ${monthName} ${yearName} • ${deptName} • ${zoneName}`;
  }, [b09FilterMonth, b09FilterYear, b09FilterDept, b09FilterZone, filteredB09Metrics.length]);

  // ====================================================================
  // 5. STATS B13 (Unités Contractuelles Semestrielles & Quantification)
  // ====================================================================
  const b13Predefined = (b13Items || []).filter(i => i?.is_predefined_deliverable);
  const b13S1Predefined = b13Predefined.filter(i => i?.semester === 'S1_2026_2027');
  const b13CompletedPredefined = b13Predefined.filter(i => i?.status === 'VALIDE' || i?.status === 'TRANSMIS').length;

  // ====================================================================
  // 6. STATS MISSIONS DE TERRAIN
  // ====================================================================
  const totalMissions = (missions || []).length;
  const completedMissions = (missions || []).filter(m => m?.status === 'CLOTUREE' || m?.status === 'REALISEE').length;
  const activeMissions = (missions || []).filter(m => m?.status === 'VALIDEE' || m?.status === 'EN_COURS');

  // ====================================================================
  // 7. TIMESHEETS STATS (Novembre 2026)
  // ====================================================================
  const novTimesheets = (timesheets || []).filter(t => t?.period_month === 11 && t?.period_year === 2026);
  const novValidatedCount = novTimesheets.filter(t => t?.status === 'VALIDE_DIRECTION').length;
  const novPendingCount = novTimesheets.filter(t => t?.status === 'SOUMIS' || t?.status === 'VERIFIE_SE').length;

  // ====================================================================
  // 8. LIVRABLES STATS
  // ====================================================================
  const totalDeliverables = (deliverables || []).length;
  const transmittedDeliverables = (deliverables || []).filter(d => d?.validation_status === 'TRANSMISSION_PSI').length;
  const pendingDeliverables = (deliverables || []).filter(d => d?.validation_status === 'SOUMISSION_INTERNE' || d?.validation_status === 'VERIFICATION').length;

  // Alertes réelles : uniquement les alertes vérifiées (pas de fausse alerte sur données non encore collectées)
  const zonesUnderTarget = hasB09Data ? targetB09Metrics.filter(m => !m.target_met && (m.submitted_on_time > 0 || m.submitted_late > 0)) : [];

  // ====================================================================
  // EXPORT SYNTHÈSE (EXCEL & PDF)
  // ====================================================================
  const handleExportSummary = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = [
        { Indicateur: 'Taux d’Exécution Work Plan', Valeur: `${avgProgress}%` },
        { Indicateur: 'Activités Work Plan Terminées', Valeur: `${completedActivities}/${totalActivities}` },
        { Indicateur: 'Activités Hebdomadaires en Cours (S07)', Valeur: `${currentWeekActs.length} planifiées` },
        { Indicateur: 'Total Activités Hebdomadaires Saisies', Valeur: `${totalWeeklyActs} (${totalCompletedWeeklyActs} réalisées)` },
        { Indicateur: 'Soumissions Hebdomadaires S07', Valeur: `${currentWeekSubmittedCount}/${users.length}` },
        { Indicateur: 'Séances et Réunions Officielles', Valeur: `${completedMeetings.length}/${totalMeetings} tenues` },
        { Indicateur: 'Missions de Terrain Actives', Valeur: `${activeMissions.length} en déploiement (3 équipes, 9 zones)` },
        { Indicateur: 'Complétude / Promptitude B09 eSIGL', Valeur: hasB09Data ? `${b09GlobalRate}%` : 'En cours de collecte terrain (356 FOSA)' },
        { Indicateur: 'Unités Contractuelles B13 Semestre 1', Valeur: `${b13CompletedPredefined}/${b13S1Predefined.length} validées` },
        { Indicateur: 'Budget Fixed Amount Award', Valeur: '406 958 726 FCFA (Tranche T1 : 51 258 001 FCFA)' },
      ];
      exportToExcel(data, 'SANINOVA_Synthese_Projet_AFGHS');
    } else {
      const headers = ['Indicateur Clé', 'Situation Réelle', 'Cible / Cadre Contractuel', 'Statut Opérationnel'];
      const rows = [
        ['Work Plan Annuel AFGHS', `${avgProgress}% avancement`, `${totalActivities} activités contractuelles B09/B13/Transversal`, avgProgress >= 40 ? 'Conforme' : 'En cours'],
        ['Planning Hebdo (Semaine 07)', `${currentWeekActs.length} activités actives`, `${currentWeekSubmittedCount}/${users.length} soumissions d’experts`, 'Actif'],
        ['Cumul Activités Hebdo Saisies', `${totalCompletedWeeklyActs} réalisées / ${totalWeeklyActs} au total`, 'Exécution continue sur le terrain', 'Régulier'],
        ['Séances & Réunions Officielles', `${completedMeetings.length} tenues, ${plannedMeetings.length} programmées`, 'Coordination, GTT et ateliers avec PV/émargement', 'Conforme'],
        ['Missions de Terrain Déployées', `${activeMissions.length} mission majeure active`, '3 équipes régionales sur 9 zones sanitaires', 'En cours'],
        ['Promptitude Rapportage eSIGL (B09)', hasB09Data ? `${b09GlobalRate}%` : 'Collecte en cours', '>= 70.0% (Date butoir 20 du mois à 23h59 - 356 FOSA)', hasB09Data && b09TargetMet ? 'EXCELLENT' : 'Collecte terrain'],
        ['Unités Contractuelles B13 S1', `${b13CompletedPredefined}/${b13S1Predefined.length} Unités`, '2 Unités contractuelles S1 (POA 9 zones & QAT)', 'En cours S1'],
        ['Budget Global Fixed Amount Award', '406 958 726 FCFA', 'Tranche T1 (51,25M FCFA) au 30 janv 2027', 'Sécurisé'],
      ];
      exportTableToPdf(
        'Tableau de Bord Général - Synthèse Exécutive',
        headers,
        rows,
        'SANINOVA_Synthese_Executive_AFGHS',
        `Période : 1er Octobre 2026 - 30 Septembre 2027 | Situation consolidée au ${new Date().toLocaleDateString('fr-FR')}`
      );
    }
  };

  return (
    <ModuleGuard moduleId="dashboard">
      <div className="space-y-6 font-sans">
      {/* ==================================================================== */}
      {/* 1. EN-TÊTE PRINCIPAL & SYNTHÈSE TEMPS RÉEL                          */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wide">
              {isPartnerView ? 'Espace Partenaire PSI / ABMS' : 'Projet AFGHS-PSI Bénin'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Contrat Fixed Amount Award (FAA) SAQMMA26CA0351
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Année Fiscale 2026-2027
            </span>
            {isPartnerView && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Portail Bailleur & Bénéficiaire Principal
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            {isPartnerView ? 'Tableau de Bord de Suivi Contractuel — PSI / ABMS Bénin' : 'Tableau de Bord Exécutif & de Pilotage Opérationnel'}
          </h1>
          <p className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
            <span>
              {isPartnerView 
                ? 'Suivi de performance en temps réel des jalons contractuels (B09 & B13), livrables et activités de terrain' 
                : 'Coordination technique et opérationnelle — SaniNova Global Consulting'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-teal-700 font-medium">Sync Cloud : {lastSyncTime || 'Temps réel'}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => handleExportSummary('excel')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <span>📊 Export Excel</span>
          </button>
          <button
            onClick={() => handleExportSummary('pdf')}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <span>📑 Synthèse PDF</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. LES 4 INDICATEURS CLÉS CONTRACTUELS & STRATÉGIQUES               */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 : Work Plan Annuel */}
        <Link 
          href="/work-plan" 
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition block group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-700 transition">
                Work Plan Annuel (B09 & B13)
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{avgProgress}%</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200">
              {totalActivities} Activités &rarr;
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-blue-700 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${avgProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex justify-between">
            <span>{completedActivities} achevées • {inProgressActivities} en cours</span>
            <span className="font-semibold text-slate-700">{upcomingActivities} à venir</span>
          </p>
        </Link>

        {/* KPI 2 : Milestone B09 (Promptitude eSIGL) */}
        <Link 
          href="/b09" 
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition block group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-teal-700 transition">
                Promptitude eSIGL (Jalon B09)
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {hasB09Data ? `${b09GlobalRate}%` : 'Collecte'}
              </h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              hasB09Data && b09TargetMet
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-teal-50 text-teal-800 border-teal-200'
            }`}>
              {hasB09Data ? (b09TargetMet ? 'Atteint &rarr;' : 'Vigilance &rarr;') : 'En cours &rarr;'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${hasB09Data && b09TargetMet ? 'bg-emerald-600' : 'bg-teal-600'}`} 
              style={{ width: `${hasB09Data ? Math.min(b09GlobalRate, 100) : 65}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            356 FOSA cibles • Seuil contractuel &ge; 70% (20 du mois à 23h59)
          </p>
        </Link>

        {/* KPI 3 : Milestone B13 (Gestion Logistique & Quantification) */}
        <Link 
          href="/b13" 
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition block group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-700 transition">
                Quantification B13 (S1 & S2)
              </p>
              <h3 className="text-2xl font-bold text-indigo-900 mt-1">
                {b13CompletedPredefined} / 4
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
              Unités FAA &rarr;
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-indigo-700 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${(b13CompletedPredefined / 4) * 100 || 25}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            S1 : POA consolidés (9 zones) & révision QAT en cours
          </p>
        </Link>

        {/* KPI 4 : Missions de Terrain & Séances Officielles */}
        <Link 
          href="/missions" 
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition block group"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-teal-700 transition">
                Missions Terrain & Séances
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {activeMissions.length} <span className="text-sm font-normal text-slate-500">active</span> • {completedMeetings.length} <span className="text-sm font-normal text-slate-500">séances</span>
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Déploiement &rarr;
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: '100%' }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            3 équipes mobilisées (9 experts) • TDR et ordres signés
          </p>
        </Link>
      </div>

      {/* ==================================================================== */}
      {/* 3. CADRE FINANCIER & ÉCHÉANCIER FAA                                  */}
      {/* ==================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-5 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
              Cadre Budgétaire Fixed Amount Award
            </span>
            <span className="text-xs text-slate-400">Fixed Amount Award SAQMMA26CA0351</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2">
            <h3 className="text-xl font-bold font-mono tracking-tight text-white">406 958 726 FCFA</h3>
            <span className="text-xs text-slate-300">
              (Jalon B09 : <span className="text-teal-300 font-semibold">174 747 435 FCFA</span> · Jalon B13 : <span className="text-indigo-300 font-semibold">232 211 291 FCFA</span>)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Prochaine échéance : <span className="text-amber-300 font-semibold">Tranche T1 (51 258 001 FCFA)</span> à soumettre d’ici le 30 janvier 2027.
          </p>
        </div>

        <Link
          href="/budget"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded shadow-xs transition shrink-0 flex items-center space-x-1.5"
        >
          <span>Consulter le Budget & Échéancier PSI &rarr;</span>
        </Link>
      </div>

      {/* ==================================================================== */}
      {/* 4. MODULES OPÉRATIONNELS VIVANTS : HEBDO & SÉANCES                  */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Module 03 : Planning Hebdomadaire (Semaine 07 en cours) */}
        <Link 
          href="/planning-hebdo"
          className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition block group"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wide">
                  Module 03 : Hebdomadaire
                </span>
                <span className="text-[11px] text-slate-600 font-semibold">Semaine 07 (En cours)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {currentWeekSubmittedCount}/{users.length} Soumissions reçues
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-1.5 group-hover:text-teal-800 transition">
                Planning Hebdomadaire des Activités de l’Équipe
              </h3>
            </div>
            <span className="text-xs font-bold text-teal-800 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              Voir Planning &rarr;
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-slate-900">{currentWeekActs.length}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Planifiées S07</span>
            </div>
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-teal-700">{inProgressWeekActs}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">En cours S07</span>
            </div>
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-emerald-700">{totalCompletedWeeklyActs}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Réalisées (Cumul)</span>
            </div>
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-blue-700">{totalWeeklyActs}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Saisies</span>
            </div>
          </div>
        </Link>

        {/* Module 02 : Séances et Réunions Officielles (GTT, Coordination, Ateliers) */}
        <Link 
          href="/seances"
          className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs hover:border-slate-400 hover:shadow-sm transition block group"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 uppercase tracking-wide">
                  Module 02 : Gouvernance
                </span>
                <span className="text-[11px] text-slate-600 font-semibold">Séances & Réunions</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {completedMeetings.length} Tenues • {plannedMeetings.length} Planifiées
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-1.5 group-hover:text-indigo-800 transition">
                Sessions GTT, Réunions de Coordination & Ateliers
              </h3>
            </div>
            <span className="text-xs font-bold text-indigo-800 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              Gérer Séances &rarr;
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-indigo-900">{totalMeetings}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Séances</span>
            </div>
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-emerald-700">{completedMeetings.length}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Achevées</span>
            </div>
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-teal-800">{gttMeetings.length}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Sessions GTT</span>
            </div>
            <div className="bg-slate-50 p-2 rounded">
              <span className="block text-base font-bold text-purple-700">{meetingsWithAttendance.length}</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">PV & Emargement</span>
            </div>
          </div>
        </Link>
      </div>

      {/* ==================================================================== */}
      {/* 5. LIGNE CENTRALE : ALERTES OPÉRATIONNELLES & SUIVI GÉOGRAPHIQUE B09 */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Carte 1 : Alertes & Points d'Attention Réels */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Alertes & Jalons Prioritaires
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200">
              Suivi Actif
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {/* Alerte 1 : Date butoir B09 eSIGL */}
            <div className="p-3 rounded bg-amber-50/70 border border-amber-200 text-xs">
              <div className="flex justify-between font-semibold text-amber-900">
                <span>Rapportage eSIGL Octobre 2026</span>
                <span className="text-[11px] font-bold">Échéance : 20 Nov 2026</span>
              </div>
              <p className="text-amber-800 mt-1">
                Mission de collecte en cours avec 3 équipes sur les 9 zones sanitaires (Atacora, Donga, Mono, Plateau) pour assurer l’atteinte du seuil &ge; 70%.
              </p>
              <div className="mt-2 flex justify-between items-center text-[11px]">
                <span className="text-amber-700 font-medium">356 FOSA cibles</span>
                <Link href="/b09" className="text-teal-800 font-bold hover:underline">
                  Suivre B09 &rarr;
                </Link>
              </div>
            </div>

            {/* Alerte 2 : Mission terrain active */}
            <div className="p-3 rounded bg-blue-50/70 border border-blue-200 text-xs">
              <div className="flex justify-between font-semibold text-blue-900">
                <span>Mission de Prise de Contact & État des Lieux</span>
                <span className="text-[11px] font-bold">En cours</span>
              </div>
              <p className="text-blue-800 mt-1">
                9 experts déployés dans les zones sanitaires. Ordres de mission et TDR validés joints au dossier.
              </p>
              <div className="mt-2 flex justify-between items-center text-[11px]">
                <span className="text-blue-700 font-medium">3 équipes régionales</span>
                <Link href="/missions" className="text-blue-800 font-bold hover:underline">
                  Consulter la mission &rarr;
                </Link>
              </div>
            </div>

            {/* Alerte 3 : Sessions GTT & Quantification */}
            <div className="p-3 rounded bg-emerald-50/70 border border-emerald-200 text-xs">
              <div className="flex justify-between font-semibold text-emerald-900">
                <span>GTT & Approvisionnement (Jalon B13)</span>
                <span className="text-[11px] font-bold">Conforme</span>
              </div>
              <p className="text-emerald-800 mt-1">
                Session mensuelle tenue le 04 nov avec PV et liste d’émargement. Session trimestrielle T1 programmée.
              </p>
              <div className="mt-2 flex justify-between items-center text-[11px]">
                <span className="text-emerald-700 font-medium">Livrables S1 en cours</span>
                <Link href="/b13" className="text-emerald-800 font-bold hover:underline">
                  Voir B13 &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Carte 2 : Situation des 9 Zones Sanitaires (Milestone B09) */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Couverture & Promptitude eSIGL par Zone Sanitaire (Jalon B09)
                </h3>
                {(b09FilterMonth !== '10' || b09FilterYear !== '2026' || b09FilterDept !== 'ALL' || b09FilterZone !== 'ALL') && (
                  <button
                    onClick={() => {
                      setB09FilterMonth('10');
                      setB09FilterYear('2026');
                      setB09FilterDept('ALL');
                      setB09FilterZone('ALL');
                    }}
                    className="text-[10px] text-teal-700 hover:text-teal-900 underline font-semibold transition cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {b09FilterPeriodLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-teal-800 font-bold px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                {filteredB09Expected} FOSA Cibles
              </span>
              {filteredB09Metrics.length > 0 && filteredB09Expected > 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                  filteredB09Rate >= 70 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  Taux : {filteredB09Rate}%
                </span>
              )}
            </div>
          </div>

          {/* BARRE DE FILTRES INTERACTIFS : MOIS / ANNÉE / DÉPARTEMENT / ZONE */}
          <div className="bg-slate-50/90 p-3 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Filtre 1 : Mois */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Mois
              </label>
              <select
                value={b09FilterMonth}
                onChange={(e) => setB09FilterMonth(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 shadow-2xs"
              >
                <option value="ALL">Tous les mois</option>
                {MONTHS_CONFIG.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label} ({`M${m.value.padStart(2, '0')}`})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre 2 : Année */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Année
              </label>
              <select
                value={b09FilterYear}
                onChange={(e) => setB09FilterYear(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 shadow-2xs"
              >
                <option value="ALL">Toutes les années</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            {/* Filtre 3 : Département */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Département
              </label>
              <select
                value={b09FilterDept}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setB09FilterDept(newDept);
                  if (newDept !== 'ALL' && b09FilterZone !== 'ALL') {
                    const zoneStillValid = OFFICIAL_9_ZONES_CONFIG.find(z => z.zone === b09FilterZone && z.dept === newDept);
                    if (!zoneStillValid) setB09FilterZone('ALL');
                  }
                }}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 shadow-2xs"
              >
                <option value="ALL">Tous les 4 départements</option>
                <option value="Atacora">Atacora (3 zones)</option>
                <option value="Donga">Donga (2 zones)</option>
                <option value="Mono">Mono (2 zones)</option>
                <option value="Plateau">Plateau (2 zones)</option>
              </select>
            </div>

            {/* Filtre 4 : Zone Sanitaire */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Zone Sanitaire
              </label>
              <select
                value={b09FilterZone}
                onChange={(e) => setB09FilterZone(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 shadow-2xs"
              >
                <option value="ALL">Toutes les zones ({availableB09Zones.length})</option>
                {availableB09Zones.map(z => (
                  <option key={z.zone} value={z.zone}>
                    {z.zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grille des cartes de zones sanitaires filtrées */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredB09Metrics.length > 0 ? (
              filteredB09Metrics.map((m) => {
                const rate = m.promptitude_rate || 0;
                const hasData = (m.submitted_on_time || 0) + (m.submitted_late || 0) > 0;
                const isAbove = rate >= 70;

                return (
                  <div key={m.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 hover:shadow-xs transition">
                    <div className="flex justify-between items-start text-xs">
                      <div className="min-w-0 pr-1">
                        <span className="font-bold text-slate-900 truncate block" title={m.zone_name}>{m.zone_name}</span>
                        <p className="text-[11px] text-slate-500 font-medium">{m.department}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                        hasData 
                          ? (isAbove ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200')
                          : 'bg-teal-50 text-teal-800 border border-teal-200'
                      }`}>
                        {hasData ? `${rate}%` : 'Collecte'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${hasData ? (isAbove ? 'bg-emerald-600' : 'bg-amber-600') : 'bg-teal-500'}`} 
                        style={{ width: `${hasData ? Math.min(rate, 100) : 50}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                      <span className="font-medium">
                        {hasData ? `${m.submitted_on_time}/${m.expected_reports} FOSA à temps` : `${m.expected_reports} FOSA attendues`}
                      </span>
                      <span className="font-semibold text-slate-700" title={m.rsco_name}>
                        {m.rsco_name || 'RSCO'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <p className="text-xs font-semibold text-slate-700">Aucune donnée eSIGL trouvée pour les filtres sélectionnés.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Vérifiez les critères (Mois, Année, Département ou Zone) ou consultez le module B09 pour effectuer une actualisation.
                </p>
                <Link
                  href="/b09"
                  className="inline-block mt-3 px-3 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded transition"
                >
                  Accéder au module B09 &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. ENGAGEMENT ET AVANCEMENT PAR MEMBRE DE L’ÉQUIPE                  */}
      {/* ==================================================================== */}
      {!isPartnerView ? (
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Répartition des Responsabilités et Activités par Membre de l’Équipe
              </h3>
              <p className="text-[11px] text-slate-500">
                Suivi consolidé des activités réelles (Work Plan & Plannings hebdomadaires), missions de terrain et séances
              </p>
            </div>
            <Link href="/planning-hebdo" className="text-xs text-teal-800 font-semibold hover:underline shrink-0">
              Voir le planning d’équipe complet &rarr;
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(users || []).filter(u => u && u.role !== 'partenaire').map((u) => {
              // Activités réelles hebdomadaires saisies
              const userWeeklyActs = (weeklyActivities || []).filter(w => w?.expert_id === u.id);
              // Activités Work Plan assignées
              const userWorkPlanActs = (activities || []).filter(a => a?.lead_expert_id === u.id);
              const totalUserActs = userWeeklyActs.length + userWorkPlanActs.length;

              // Participation aux missions de terrain (responsable ou équipier)
              const isUserInMission = (missions || []).some(m => 
                m?.lead_expert_id === u.id || 
                m?.companion_expert_ids?.includes(u.id) || 
                m?.teams?.some(t => t?.lead_expert_id === u.id || t?.companion_expert_ids?.includes(u.id))
              );

              // Séances organisées ou auxquelles le membre participe
              const userMeetings = (meetings || []).filter(meet => 
                meet?.organizer_id === u.id || 
                meet?.internal_participants_ids?.includes(u.id)
              );

              // Statut de soumission de la semaine 07
              const hasSubmittedS07 = currentWeekSubmittedExpertIds.has(u.id);

              return (
                <div 
                  key={u.id} 
                  className="p-3.5 rounded border border-slate-200 bg-white shadow-xs hover:border-slate-400 hover:shadow-sm transition block"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded bg-teal-50 text-teal-900 font-bold flex items-center justify-center text-xs border border-teal-200 shrink-0">
                      {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={u.full_name}>
                        {u.full_name || 'Membre de l’équipe'}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate" title={u.title}>
                        {u.title || u.role}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-1.5 rounded">
                      <span className="block text-xs font-bold text-slate-800">{totalUserActs}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Activités</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded">
                      <span className="block text-xs font-bold text-slate-800">{isUserInMission ? '1' : '0'}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Mission</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded">
                      <span className="block text-xs font-bold text-slate-800">{userMeetings.length}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Séances</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium">Planning S07 :</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${
                      hasSubmittedS07 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {hasSubmittedS07 ? '✓ Soumis' : 'En attente'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Synthèse des Livrables Contractuels & Transmissions Officielles (PSI / ABMS)
              </h3>
              <p className="text-[11px] text-slate-500">
                Suivi des livrables contractuels Fixed Amount Award (FAA), rapports d&apos;étapes et approbations
              </p>
            </div>
            <Link href="/livrables" className="text-xs text-teal-800 font-semibold hover:underline shrink-0">
              Consulter tous les livrables &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Stat 1 : Livrables Transmis */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-emerald-50/40">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transmis à PSI/ABMS</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{transmittedDeliverables}</div>
              <p className="text-[11px] text-slate-500 mt-1">Livrable(s) officiel(s) déposé(s)</p>
            </div>

            {/* Stat 2 : En cours de finalisation */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-teal-50/40">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">En Revue / Validation</span>
                <span className="w-2 h-2 rounded-full bg-teal-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{pendingDeliverables}</div>
              <p className="text-[11px] text-slate-500 mt-1">En cours de contrôle qualité S&E</p>
            </div>

            {/* Stat 3 : Total Contractuel */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Périmètre Total</span>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalDeliverables}</div>
              <p className="text-[11px] text-slate-500 mt-1">Livrables du cadre contractuel</p>
            </div>
          </div>
        </div>
      )}
    </div>
  </ModuleGuard>
);
}
