'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  B09MonthlyMetric, 
  B09ReminderRecord, 
  B09QuarterlyDossier, 
  WorkPlanActivity 
} from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

// Définition des 12 mois de l'Année Fiscale FY26-27
const FISCAL_MONTHS = [
  { month: 10, year: 2026, label: 'Octobre 2026', quarter: 'T1', deadline: '20 Novembre 2026' },
  { month: 11, year: 2026, label: 'Novembre 2026', quarter: 'T1', deadline: '20 Décembre 2026' },
  { month: 12, year: 2026, label: 'Décembre 2026', quarter: 'T1', deadline: '20 Janvier 2027' },
  { month: 1, year: 2027, label: 'Janvier 2027', quarter: 'T2', deadline: '20 Février 2027' },
  { month: 2, year: 2027, label: 'Février 2027', quarter: 'T2', deadline: '20 Mars 2027' },
  { month: 3, year: 2027, label: 'Mars 2027', quarter: 'T2', deadline: '20 Avril 2027' },
  { month: 4, year: 2027, label: 'Avril 2027', quarter: 'T3', deadline: '20 Mai 2027' },
  { month: 5, year: 2027, label: 'Mai 2027', quarter: 'T3', deadline: '20 Juin 2027' },
  { month: 6, year: 2027, label: 'Juin 2027', quarter: 'T3', deadline: '20 Juillet 2027' },
  { month: 7, year: 2027, label: 'Juillet 2027', quarter: 'T4', deadline: '20 Août 2027' },
  { month: 8, year: 2027, label: 'Août 2027', quarter: 'T4', deadline: '20 Septembre 2027' },
  { month: 9, year: 2027, label: 'Septembre 2027', quarter: 'T4', deadline: '20 Octobre 2027' },
];

// Les 9 zones sanitaires cibles officielles du jalon B09 (Total : 356 FOSA)
const OFFICIAL_9_ZONES = [
  { dept: 'Atacora', zone: 'Kouandé-Péhunco-Kérou (2KP)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIHO', expectedFosa: 45 },
  { dept: 'Atacora', zone: 'Natitingou-Boukoumbé-Toucountouna (NBT)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIHO', expectedFosa: 38 },
  { dept: 'Atacora', zone: 'Tanguiéta-Matéri-Cobly (TMC)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIHO', expectedFosa: 29 },
  { dept: 'Plateau', zone: 'Sakété-Ifangni (SAKIF)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIHO', expectedFosa: 27 },
  { dept: 'Mono', zone: 'Lokossa-Athiémé (LA)', rscoId: 'usr-rsco-2', rscoName: 'Soumari KOUAGOU', expectedFosa: 30 },
  { dept: 'Mono', zone: 'Comé-Grand-Popo-Bopa-Houéyogbé (CBGH)', rscoId: 'usr-rsco-2', rscoName: 'Soumari KOUAGOU', expectedFosa: 41 },
  { dept: 'Plateau', zone: 'Pobè-Adja-Ouèrè-Kétou (PAK)', rscoId: 'usr-rsco-2', rscoName: 'Soumari KOUAGOU', expectedFosa: 55 },
  { dept: 'Donga', zone: 'Djougou-Copargo-Ouaké (DCO)', rscoId: 'usr-rsco-3', rscoName: 'Arafath IMOROU', expectedFosa: 63 },
  { dept: 'Donga', zone: 'Bassila', rscoId: 'usr-rsco-3', rscoName: 'Arafath IMOROU', expectedFosa: 28 },
];

export default function B09Page() {
  const { 
    b09Metrics, 
    updateB09Metric, 
    addB09Metric, 
    deleteB09Metric,
    initB09MonthZones,
    b09Reminders, 
    addB09Reminder, 
    deleteB09Reminder,
    b09Dossiers, 
    updateB09Dossier,
    activities,
    users,
    currentUser
  } = useApp();

  // Navigation par onglets
  const [activeTab, setActiveTab] = useState<'matrice' | 'relances' | 'activites' | 'dossiers' | 'analyse'>('matrice');

  // Filtres temporels et géographiques
  const [selectedQuarter, setSelectedQuarter] = useState<string>('ALL');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('10-2026'); // Octobre 2026 par défaut
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedRsco, setSelectedRsco] = useState<string>('ALL');
  const [searchZone, setSearchZone] = useState<string>('');

  // Modales
  const [editingMetric, setEditingMetric] = useState<B09MonthlyMetric | null>(null);
  const [isNewMetricModalOpen, setIsNewMetricModalOpen] = useState(false);
  const [newMetricForm, setNewMetricForm] = useState<Partial<B09MonthlyMetric>>({
    department: 'Atacora',
    zone_name: 'Natitingou-Boukoumbé-Toucountouna (NBT)',
    period_month: 11,
    period_year: 2026,
    expected_reports: 38,
    submitted_on_time: 0,
    submitted_late: 0,
    missing_reports: 38,
    reminders_sent: 0,
    rsco_id: 'usr-rsco-1',
    rsco_name: 'Mohamed DJERIHO',
    evidence_status: 'EN_ATTENTE_PREUVE',
  });

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [newReminderForm, setNewReminderForm] = useState<Partial<B09ReminderRecord>>({
    zone_name: 'Natitingou-Boukoumbé-Toucountouna (NBT)',
    department: 'Atacora',
    fosa_name: '',
    rsco_id: currentUser.id.startsWith('usr-rsco') ? currentUser.id : 'usr-rsco-1',
    rsco_name: users.find(u => u.id === (currentUser.id.startsWith('usr-rsco') ? currentUser.id : 'usr-rsco-1'))?.full_name || 'Mohamed DJERIHO',
    contact_person: '',
    contact_phone: '',
    reminder_channel: 'TELEPHONE',
    reminder_date: new Date().toISOString().substring(0, 10),
    delay_cause: 'Instabilité connexion internet',
    outcome: 'PROMESSE_24H',
    notes: '',
  });

  const [editingDossier, setEditingDossier] = useState<B09QuarterlyDossier | null>(null);

  // Activités officielles B09 (B09.1 à B09.7)
  const b09Activities = useMemo(() => {
    return activities.filter(a => a.milestone === 'B09');
  }, [activities]);

  // Mois actif sélectionné
  const activeMonthInfo = useMemo(() => {
    if (selectedMonthKey === 'ALL') return null;
    const [m, y] = selectedMonthKey.split('-').map(Number);
    return FISCAL_MONTHS.find(fm => fm.month === m && fm.year === y) || FISCAL_MONTHS[0];
  }, [selectedMonthKey]);

  // Filtrage des métriques de promptitude
  const filteredMetrics = useMemo(() => {
    return b09Metrics.filter((m) => {
      const matchMonth = selectedMonthKey === 'ALL' || `${m.period_month}-${m.period_year}` === selectedMonthKey;
      const matchQuarter = selectedQuarter === 'ALL' || (
        FISCAL_MONTHS.find(fm => fm.month === m.period_month && fm.year === m.period_year)?.quarter === selectedQuarter
      );
      const matchDept = selectedDept === 'ALL' || m.department === selectedDept;
      const matchRsco = selectedRsco === 'ALL' || m.rsco_id === selectedRsco || (m.rsco_name && m.rsco_name.toLowerCase().includes(selectedRsco.toLowerCase()));
      const matchSearch = m.zone_name.toLowerCase().includes(searchZone.toLowerCase()) || m.department.toLowerCase().includes(searchZone.toLowerCase());

      return matchMonth && matchQuarter && matchDept && matchRsco && matchSearch;
    });
  }, [b09Metrics, selectedMonthKey, selectedQuarter, selectedDept, selectedRsco, searchZone]);

  // Calculs agrégés sur la sélection active
  const totalExpected = filteredMetrics.reduce((s, m) => s + (Number(m.expected_reports) || 0), 0);
  const totalOnTime = filteredMetrics.reduce((s, m) => s + (Number(m.submitted_on_time) || 0), 0);
  const totalLate = filteredMetrics.reduce((s, m) => s + (Number(m.submitted_late) || 0), 0);
  const totalMissing = filteredMetrics.reduce((s, m) => s + (Number(m.missing_reports) || 0), 0);
  const totalReminders = filteredMetrics.reduce((s, m) => s + (Number(m.reminders_sent) || 0), 0);

  const globalRate = totalExpected > 0 ? Number(((totalOnTime / totalExpected) * 100).toFixed(1)) : 0;
  const targetMet = globalRate >= 70;
  const countZonesTargetMet = filteredMetrics.filter(m => m.target_met).length;
  const countZonesTotal = filteredMetrics.length;

  // Calcul du palier d'atteinte FAA
  const getPerformanceTier = (rate: number) => {
    if (rate >= 70) return { label: 'Excellent (100% Payout)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (rate >= 60) return { label: 'Satisfaisant (Effort)', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (rate >= 50) return { label: 'Minimal (Alerte GOR)', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Insuffisant (<50%)', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  const performanceTier = getPerformanceTier(globalRate);

  // Sauvegarde métrique éditée
  const handleSaveMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetric) return;

    const expected = Number(editingMetric.expected_reports) || 0;
    const onTime = Number(editingMetric.submitted_on_time) || 0;
    const rate = expected > 0 ? Number(((onTime / expected) * 100).toFixed(1)) : 0;
    const isTargetMet = rate >= 70;

    updateB09Metric({
      ...editingMetric,
      expected_reports: expected,
      submitted_on_time: onTime,
      submitted_late: Number(editingMetric.submitted_late) || 0,
      missing_reports: Number(editingMetric.missing_reports) || 0,
      reminders_sent: Number(editingMetric.reminders_sent) || 0,
      promptitude_rate: rate,
      target_met: isTargetMet,
    });
    setEditingMetric(null);
  };

  // Ajout d'une nouvelle saisie de zone
  const handleCreateNewMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetricForm.zone_name) return;

    const expected = Number(newMetricForm.expected_reports) || 0;
    const onTime = Number(newMetricForm.submitted_on_time) || 0;
    const rate = expected > 0 ? Number(((onTime / expected) * 100).toFixed(1)) : 0;

    const selectedZoneConfig = OFFICIAL_9_ZONES.find(z => z.zone === newMetricForm.zone_name);
    const mMonth = Number(newMetricForm.period_month) || 11;
    const mYear = Number(newMetricForm.period_year) || 2026;
    const dMonth = mMonth === 12 ? 1 : mMonth + 1;
    const dYear = mMonth === 12 ? mYear + 1 : mYear;

    const item: B09MonthlyMetric = {
      id: `b09-m${mMonth}-y${mYear}-${Date.now()}`,
      period_month: mMonth,
      period_year: mYear,
      department: selectedZoneConfig?.dept || newMetricForm.department || 'Atacora',
      zone_name: newMetricForm.zone_name,
      rsco_id: selectedZoneConfig?.rscoId || newMetricForm.rsco_id || 'usr-rsco-1',
      rsco_name: selectedZoneConfig?.rscoName || newMetricForm.rsco_name || 'Mohamed DJERIHO',
      expected_reports: expected,
      submitted_on_time: onTime,
      submitted_late: Number(newMetricForm.submitted_late) || 0,
      missing_reports: Number(newMetricForm.missing_reports) || 0,
      promptitude_rate: rate,
      target_met: rate >= 70,
      deadline_date: `${dYear}-${String(dMonth).padStart(2, '0')}-20`,
      reminders_sent: Number(newMetricForm.reminders_sent) || 0,
      main_constraints: newMetricForm.main_constraints || '',
      corrective_actions: newMetricForm.corrective_actions || '',
      evidence_status: newMetricForm.evidence_status || 'EN_ATTENTE_PREUVE',
    };

    addB09Metric(item);
    setIsNewMetricModalOpen(false);
  };

  // Sauvegarde nouvelle relance
  const handleSaveReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderForm.fosa_name || !newReminderForm.zone_name) return;

    const [m, y] = (selectedMonthKey !== 'ALL' ? selectedMonthKey : '11-2026').split('-').map(Number);
    const selectedZoneConfig = OFFICIAL_9_ZONES.find(z => z.zone === newReminderForm.zone_name);

    const reminder: B09ReminderRecord = {
      id: `rem-${Date.now()}`,
      period_month: m,
      period_year: y,
      zone_name: newReminderForm.zone_name,
      department: selectedZoneConfig?.dept || newReminderForm.department || 'Atacora',
      fosa_name: newReminderForm.fosa_name,
      rsco_id: newReminderForm.rsco_id || selectedZoneConfig?.rscoId || 'usr-rsco-1',
      rsco_name: users.find(u => u.id === newReminderForm.rsco_id)?.full_name || selectedZoneConfig?.rscoName || 'Mohamed DJERIHO',
      contact_person: newReminderForm.contact_person || '',
      contact_phone: newReminderForm.contact_phone || '',
      reminder_channel: newReminderForm.reminder_channel || 'TELEPHONE',
      reminder_date: newReminderForm.reminder_date || new Date().toISOString().substring(0, 10),
      delay_cause: newReminderForm.delay_cause || 'Retard de transmission A7',
      outcome: newReminderForm.outcome || 'PROMESSE_24H',
      notes: newReminderForm.notes || '',
    };

    addB09Reminder(reminder);
    setIsReminderModalOpen(false);
    setNewReminderForm({
      ...newReminderForm,
      fosa_name: '',
      contact_person: '',
      contact_phone: '',
      notes: '',
    });
  };

  // Sauvegarde mise à jour dossier trimestriel
  const handleSaveDossier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDossier) return;
    updateB09Dossier(editingDossier);
    setEditingDossier(null);
  };

  // Export complet Excel / PDF
  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = filteredMetrics.map(m => ({
        Période: `${m.period_month}/${m.period_year}`,
        Département: m.department,
        'Zone Sanitaire': m.zone_name,
        'RSCO Référent': m.rsco_name || 'Non assigné',
        'FOSA Attendues': m.expected_reports,
        'Soumis à Temps (<20)': m.submitted_on_time,
        'Soumis en Retard (>20)': m.submitted_late,
        'Manquants / Non Reçus': m.missing_reports,
        'Taux de Promptitude': `${m.promptitude_rate}%`,
        'Seuil Cible (>=70%)': m.target_met ? 'CONFORME' : 'SOUS SEUIL',
        'Date Butoir eSIGL': m.deadline_date,
        'Relances Effectuées': m.reminders_sent,
        'Preuve eSIGL': m.evidence_status || 'NON_VERIFIE',
        'Contraintes Principales': m.main_constraints || '-',
        'Actions Correctives': m.corrective_actions || '-',
      }));
      exportToExcel(data, `SANINOVA_B09_Promptitude_eSIGL_${selectedMonthKey}`);
    } else {
      const headers = ['Département', 'Zone Sanitaire', 'RSCO', 'Attendus', 'À Temps', 'Retard', 'Manquants', 'Taux %', 'Seuil >=70%'];
      const rows = filteredMetrics.map(m => [
        m.department,
        m.zone_name,
        m.rsco_name || '-',
        m.expected_reports,
        m.submitted_on_time,
        m.submitted_late,
        m.missing_reports,
        `${m.promptitude_rate}%`,
        m.target_met ? 'CONFORME (>=70%)' : 'SOUS SEUIL',
      ]);
      exportTableToPdf(
        `Suivi Milestone B09 : Promptitude eSIGL (Période : ${activeMonthInfo ? activeMonthInfo.label : selectedMonthKey})`,
        headers,
        rows,
        `SANINOVA_B09_Promptitude_${selectedMonthKey}`,
        `Seuil de performance contractuelle : >= 70% | Taux global constaté : ${globalRate}% (${countZonesTargetMet}/${countZonesTotal} zones conformes)`
      );
    }
  };

  return (
    <ModuleGuard moduleId="b09">
      <div className="space-y-6 font-sans">
        
        {/* BANNER HEADER OFFICIEL B09 */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wide">
                Module 06 : Suivi Milestone B09
              </span>
              <span className="text-xs text-slate-500 font-medium">Projet AFGHS &bull; Fixed Amount Award</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
              Promptitude du Rapportage des Données Logistiques eSIGL (&ge; 70%)
            </h1>
            <p className="text-xs text-slate-500">
              Surveillance continue des rapports A7 avant le 20 du mois sur les 9 zones sanitaires cibles (Atacora, Donga, Mono, Plateau).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport('excel')}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              title="Exporter les données du tableau en Excel (.xlsx)"
            >
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => handleExport('pdf')}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-xs"
              title="Exporter le rapport certifié en PDF"
            >
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => setIsReminderModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold shadow-xs transition flex items-center space-x-1"
            >
              <span>+ Enregistrer une Relance</span>
            </button>

            <button
              onClick={() => setIsNewMetricModalOpen(true)}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs transition flex items-center space-x-1"
            >
              <span>+ Saisie / Mettre à jour une Zone</span>
            </button>
          </div>
        </div>

        {/* CADRE STRATÉGIQUE & RÈGLES CONTRACTUELLES FAA */}
        <div className="bg-slate-900 rounded-lg p-5 text-white border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Règles de Mesure & Paliers de Déclenchement du Paiement Milestone B09
              </h2>
              <p className="text-xs text-slate-400">
                Plan de Travail AFGHS-PSI Bénin — Accord Fixed Amount Award SAQMMA26CA0351
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono bg-slate-800 px-2.5 py-1 rounded text-teal-300 border border-slate-700">
                Périmètre : 9 Zones Sanitaires (4 Départements)
              </span>
              <span className="text-[11px] font-mono bg-rose-900/60 px-2 py-1 rounded text-rose-300 border border-rose-800/80">
                Alibori Exclu du B09
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-emerald-500/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-emerald-400 uppercase text-[10px]">Palier 1 : Excellent</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">&ge; 70 %</span>
              </div>
              <p className="text-[11px] text-slate-300">
                100% de déclenchement du paiement prévu pour le jalon B09 (43 689 380 FCFA par trimestre).
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-blue-400 uppercase text-[10px]">Palier 2 : Satisfaisant</span>
                <span className="font-mono font-bold text-blue-300 text-sm">60 – 69 %</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Niveau d’effort substantiel. Plan de redressement et d’appui immédiat requis par PSI.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-amber-500/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-amber-400 uppercase text-[10px]">Palier 3 : Minimal</span>
                <span className="font-mono font-bold text-amber-300 text-sm">50 – 59 %</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Seuil de basculement avec alerte formelle au GOR via PSI et mission conjointe de cadrage.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-rose-500/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-rose-400 uppercase text-[10px]">Palier 4 : Insuffisant</span>
                <span className="font-mono font-bold text-rose-300 text-sm">&lt; 50 %</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Paiement non déclenché. Revue conjointe obligatoire et audit technique du dispositif.
              </p>
            </div>
          </div>
        </div>

        {/* BARRE D'ONGLETS DE NAVIGATION B09 */}
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('matrice')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'matrice'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>📊 Matrice de Promptitude (9 Zones)</span>
          </button>

          <button
            onClick={() => setActiveTab('relances')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'relances'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>📞 Journal des Relances Terrain ({b09Reminders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('activites')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'activites'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🎯 7 Activités Piliers B09 ({b09Activities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('dossiers')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'dossiers'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>📁 Dossiers de Preuves FAA ({b09Dossiers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analyse')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'analyse'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>👥 Performance par RSCO</span>
          </button>
        </div>

        {/* KPI DASHBOARD CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Taux Global Consolidé
                </p>
                <h3 className={`text-2xl font-bold mt-1 ${targetMet ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {globalRate}%
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${performanceTier.color}`}>
                {performanceTier.label}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${targetMet ? 'bg-emerald-600' : 'bg-amber-600'}`}
                style={{ width: `${Math.min(globalRate, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium flex justify-between items-center">
              <span>Seuil cible : &ge; 70.0%</span>
              <span className="font-bold text-slate-700">{countZonesTargetMet} / {countZonesTotal} zones conformes</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Rapports FOSA Attendus
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalExpected}</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                9 Zones Cibles
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Dont <strong className="text-emerald-700">{totalOnTime} soumis à temps</strong> (&le; 20 du mois)
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Retards & Non Reçus
                </p>
                <h3 className="text-2xl font-bold text-amber-700 mt-1">
                  {totalLate + totalMissing}
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                Vigilance
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              <span className="text-amber-800 font-semibold">{totalLate} après le 20</span> &bull; <span className="text-rose-700 font-semibold">{totalMissing} manquants</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Relances Réalisées
                </p>
                <h3 className="text-2xl font-bold text-teal-800 mt-1">{totalReminders}</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200">
                Action RSCO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Téléphone, visites sur site, SMS et groupes GDRZS
            </p>
          </div>
        </div>

        {/* ==================================================== */}
        {/* ONGLET 1 : MATRICE DE PROMPTITUDE DES 9 ZONES */}
        {/* ==================================================== */}
        {activeTab === 'matrice' && (
          <div className="space-y-4">
            {/* Barre de filtres avancés */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {/* Sélecteur de mois */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Période Mensuelle :</label>
                  <select
                    value={selectedMonthKey}
                    onChange={(e) => setSelectedMonthKey(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold outline-none focus:border-teal-700"
                  >
                    <option value="ALL">Tous les mois consolidés</option>
                    {FISCAL_MONTHS.map(fm => (
                      <option key={`${fm.month}-${fm.year}`} value={`${fm.month}-${fm.year}`}>
                        {fm.label} ({fm.quarter})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sélecteur de département */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Département :</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium outline-none"
                  >
                    <option value="ALL">Tous les 4 départements</option>
                    <option value="Atacora">Atacora (3 zones)</option>
                    <option value="Donga">Donga (2 zones)</option>
                    <option value="Mono">Mono (2 zones)</option>
                    <option value="Plateau">Plateau (2 zones)</option>
                  </select>
                </div>

                {/* Sélecteur de RSCO */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">RSCO Référent :</label>
                  <select
                    value={selectedRsco}
                    onChange={(e) => setSelectedRsco(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium outline-none"
                  >
                    <option value="ALL">Tous les 3 RSCO</option>
                    <option value="Mohamed DJERIHO">Mohamed DJERIHO (Atacora & SAKIF)</option>
                    <option value="Soumari KOUAGOU">Soumari KOUAGOU (Mono & PAK)</option>
                    <option value="Arafath IMOROU">Arafath IMOROU (Donga)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Rechercher zone, FOSA, commune..."
                  value={searchZone}
                  onChange={(e) => setSearchZone(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded outline-none focus:border-teal-700 w-full md:w-56"
                />

                {selectedMonthKey !== 'ALL' && (
                  <button
                    onClick={() => {
                      const [m, y] = selectedMonthKey.split('-').map(Number);
                      initB09MonthZones(m, y);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold border border-slate-300 transition whitespace-nowrap"
                    title="Pré-remplir les 9 zones sanitaires officielles pour ce mois si elles n'existent pas encore"
                  >
                    <span>+ Initialiser 9 Zones</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tableau principal des 9 zones */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-2">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Tableau de Promptitude par Zone Sanitaire (Seuil &ge; 70%)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {activeMonthInfo ? `Période : ${activeMonthInfo.label} • Date limite de rapportage : ${activeMonthInfo.deadline}` : 'Période consolidée sur plusieurs mois'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-mono">
                    {filteredMetrics.length} zone(s) affichée(s)
                  </span>
                </div>
              </div>

              {filteredMetrics.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 space-y-3">
                  <p>Aucune donnée de rapportage enregistrée pour cette sélection ({selectedMonthKey}).</p>
                  {selectedMonthKey !== 'ALL' && (
                    <button
                      onClick={() => {
                        const [m, y] = selectedMonthKey.split('-').map(Number);
                        initB09MonthZones(m, y);
                      }}
                      className="px-4 py-2 bg-teal-800 text-white rounded text-xs font-bold hover:bg-teal-900 transition shadow-xs"
                    >
                      + Initialiser les 9 zones sanitaires cibles pour {activeMonthInfo?.label}
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3">Département</th>
                        <th className="p-3">Zone Sanitaire</th>
                        <th className="p-3">RSCO Référent</th>
                        <th className="p-3 text-center">Attendus</th>
                        <th className="p-3 text-center text-emerald-800">À Temps (&le; 20)</th>
                        <th className="p-3 text-center text-amber-800">En Retard</th>
                        <th className="p-3 text-center text-rose-800">Manquants</th>
                        <th className="p-3 text-center">Taux</th>
                        <th className="p-3 text-center">Statut Seuil</th>
                        <th className="p-3 text-center">Relances</th>
                        <th className="p-3 text-center">Preuve eSIGL</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMetrics.map((m) => {
                        return (
                          <tr key={m.id} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-bold text-slate-900">{m.department}</td>
                            <td className="p-3 font-semibold text-slate-800">{m.zone_name}</td>
                            <td className="p-3">
                              <span className="text-[11px] font-medium text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {m.rsco_name || 'RSCO Assigné'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-800">{m.expected_reports}</td>
                            <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/40">{m.submitted_on_time}</td>
                            <td className="p-3 text-center text-amber-700 font-semibold">{m.submitted_late}</td>
                            <td className="p-3 text-center text-rose-700 font-semibold">{m.missing_reports}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                m.target_met ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                              }`}>
                                {m.promptitude_rate}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {m.target_met ? (
                                <span className="inline-flex items-center text-emerald-800 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5" />
                                  Conforme
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-rose-700 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5" />
                                  Sous Seuil
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">{m.reminders_sent}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                m.evidence_status === 'CONFORME_ESIGL'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {m.evidence_status === 'CONFORME_ESIGL' ? 'Certifiée' : 'En attente'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setEditingMetric(m)}
                                className="px-2.5 py-1 text-slate-700 hover:text-teal-800 hover:bg-slate-100 rounded text-[11px] font-bold border border-slate-300 transition"
                              >
                                Ajuster
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs text-slate-800">
                      <tr>
                        <td className="p-3" colSpan={3}>TOTAL CONSOLIDÉ ({filteredMetrics.length} ZONES)</td>
                        <td className="p-3 text-center">{totalExpected}</td>
                        <td className="p-3 text-center text-emerald-800">{totalOnTime}</td>
                        <td className="p-3 text-center text-amber-800">{totalLate}</td>
                        <td className="p-3 text-center text-rose-800">{totalMissing}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${targetMet ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                            {globalRate}%
                          </span>
                        </td>
                        <td className="p-3 text-center">{targetMet ? 'CONFORME (>=70%)' : 'SOUS SEUIL'}</td>
                        <td className="p-3 text-center">{totalReminders}</td>
                        <td className="p-3 text-center" colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ONGLET 2 : JOURNAL DES RELANCES TERRAIN (RSCO) */}
        {/* ==================================================== */}
        {activeTab === 'relances' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  Journal Opérationnel des Relances & Alertes eSIGL (RSCO)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Traçabilité des interventions des RSCO pour prévenir les retards de rapportage avant la date butoir du 20.
                </p>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(true)}
                className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shadow-xs"
              >
                + Nouvelle Relance
              </button>
            </div>

            {b09Reminders.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-xs text-slate-500 space-y-2">
                <p>Aucune relance enregistrée pour le moment.</p>
                <button
                  onClick={() => setIsReminderModalOpen(true)}
                  className="px-3.5 py-1.5 bg-teal-800 text-white rounded text-xs font-bold hover:bg-teal-900"
                >
                  + Enregistrer une première relance
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3">Date</th>
                        <th className="p-3">Zone Sanitaire</th>
                        <th className="p-3">Formation Sanitaire (FOSA)</th>
                        <th className="p-3">RSCO Référent</th>
                        <th className="p-3">Contact Relancé</th>
                        <th className="p-3">Canal</th>
                        <th className="p-3">Motif du Retard</th>
                        <th className="p-3">Résultat</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {b09Reminders.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{r.reminder_date}</td>
                          <td className="p-3 font-bold text-slate-800">{r.zone_name}</td>
                          <td className="p-3 font-medium text-slate-900">{r.fosa_name}</td>
                          <td className="p-3 text-teal-800 font-semibold">{r.rsco_name}</td>
                          <td className="p-3 text-slate-700">
                            <div>{r.contact_person}</div>
                            {r.contact_phone && <span className="text-[10px] text-slate-400 font-mono">{r.contact_phone}</span>}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                              {r.reminder_channel}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate" title={r.delay_cause}>
                            {r.delay_cause}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.outcome === 'TRANSMIS_IMMEDIAT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.outcome === 'PROMESSE_24H'
                                ? 'bg-blue-100 text-blue-800'
                                : r.outcome === 'APPUI_REQUIS'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {r.outcome === 'TRANSMIS_IMMEDIAT' ? 'Rapport Transmis' :
                               r.outcome === 'PROMESSE_24H' ? 'Promesse < 24h' :
                               r.outcome === 'APPUI_REQUIS' ? 'Appui IT Requis' : 'Injoignable'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => deleteB09Reminder(r.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold text-xs"
                              title="Supprimer la relance"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* ONGLET 3 : SUIVI DES 7 ACTIVITÉS PILIERS B09 */}
        {/* ==================================================== */}
        {activeTab === 'activites' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                Les 7 Activités Piliers du Milestone B09 (Plan de Travail FY27)
              </h3>
              <p className="text-[11px] text-slate-500">
                Chaque activité concourt directement au maintien du seuil de promptitude &ge; 70% et à la constitution des preuves trimestrielles.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {b09Activities.map((act) => {
                const lead = users.find(u => u.id === act.lead_expert_id);
                return (
                  <div key={act.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2 py-0.5 bg-teal-800 text-white rounded text-[11px] font-bold font-mono">
                          {act.code}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900">{act.title}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {act.priority}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          act.status === 'TERMINEE' ? 'bg-emerald-100 text-emerald-800' :
                          act.status === 'EN_COURS' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {act.status} ({act.progress_pct}%)
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Responsable Pilote</span>
                        <span className="font-semibold text-slate-800">{lead ? lead.full_name : 'Équipe SaniNova'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Zone Géographique</span>
                        <span className="text-slate-700">{act.geographic_zone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Budget Total Alloué</span>
                        <span className="font-mono font-bold text-teal-800">
                          {act.budget_total_fcfa ? `${act.budget_total_fcfa.toLocaleString('fr-FR')} FCFA` : 'Coûts directs'}
                        </span>
                      </div>
                    </div>

                    {act.expected_result && (
                      <div className="text-[11px] text-teal-900 bg-teal-50/60 p-2 rounded border border-teal-200">
                        <strong>Résultat attendu :</strong> {act.expected_result}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ONGLET 4 : DOSSIERS DE PREUVES DE VÉRIFICATION FAA */}
        {/* ==================================================== */}
        {activeTab === 'dossiers' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  Dossiers Trimestriels de Preuves de Vérification B09 (FAA PSI/GOR)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Contrôle des pièces probantes conditionnant le déclenchement de la subvention FAA (43 689 380 FCFA / trimestre).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {b09Dossiers.map((dos) => {
                const totalProofs = Object.keys(dos.evidence_checklist).length;
                const completedProofs = Object.values(dos.evidence_checklist).filter(Boolean).length;
                const progressPct = Math.round((completedProofs / totalProofs) * 100);

                return (
                  <div key={dos.quarter} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 font-mono">
                          {dos.quarter} &bull; FY27
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">{dos.label}</h4>
                        <p className="text-[11px] text-slate-500">{dos.months}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold border ${
                        dos.status === 'VALIDE_GOR' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                        dos.status === 'SOUMIS_PSI' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                        'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {dos.status === 'VALIDE_GOR' ? 'Validé GOR (Payé)' :
                         dos.status === 'SOUMIS_PSI' ? 'Soumis à PSI' : 'En Constitution'}
                      </span>
                    </div>

                    {/* Montant FAA et Taux */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Montant Subvention</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {dos.amount_fcfa.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Taux Trimestriel</span>
                        <span className={`font-mono font-bold text-sm ${dos.global_rate >= 70 ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {dos.global_rate > 0 ? `${dos.global_rate}%` : 'En cours'}
                        </span>
                      </div>
                    </div>

                    {/* Checklist des pièces justificatives */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                        <span>Checklist des pièces justificatives ({completedProofs}/{totalProofs})</span>
                        <span className="font-mono">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-teal-700 h-full" style={{ width: `${progressPct}%` }} />
                      </div>

                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div className="flex items-center space-x-2">
                          <span className={dos.evidence_checklist.esigl_raw_extract ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {dos.evidence_checklist.esigl_raw_extract ? '✓' : '○'}
                          </span>
                          <span className={dos.evidence_checklist.esigl_raw_extract ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            Extractions brutes certifiées du portail eSIGL au 20 du mois
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={dos.evidence_checklist.compiled_rates_sheet ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {dos.evidence_checklist.compiled_rates_sheet ? '✓' : '○'}
                          </span>
                          <span className={dos.evidence_checklist.compiled_rates_sheet ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            Tableaux consolidés de promptitude des 9 zones sanitaires
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={dos.evidence_checklist.rsco_call_logs ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {dos.evidence_checklist.rsco_call_logs ? '✓' : '○'}
                          </span>
                          <span className={dos.evidence_checklist.rsco_call_logs ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            Journal des relances RSCO et alertes aux points focaux
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={dos.evidence_checklist.supervision_reports ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {dos.evidence_checklist.supervision_reports ? '✓' : '○'}
                          </span>
                          <span className={dos.evidence_checklist.supervision_reports ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            Rapports des missions de supervision formative intégrée
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={dos.evidence_checklist.psi_joint_minutes ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {dos.evidence_checklist.psi_joint_minutes ? '✓' : '○'}
                          </span>
                          <span className={dos.evidence_checklist.psi_joint_minutes ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            Procès-verbal de revue conjointe avec l’équipe PSI Bénin
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={dos.evidence_checklist.payment_request_invoice ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {dos.evidence_checklist.payment_request_invoice ? '✓' : '○'}
                          </span>
                          <span className={dos.evidence_checklist.payment_request_invoice ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            Demande de décaissement FAA & attestation de conformité
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[11px] text-slate-500 italic truncate max-w-[240px]">
                        {dos.notes || 'En attente de consolidation.'}
                      </span>
                      <button
                        onClick={() => setEditingDossier(dos)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-bold border border-slate-300 transition"
                      >
                        Gérer le Dossier
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* ONGLET 5 : ANALYSE COMPARATIVE & SYNTHÈSE RSCO */}
        {/* ==================================================== */}
        {activeTab === 'analyse' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                Performance Comparative de Promptitude par RSCO & Département
              </h3>
              <p className="text-[11px] text-slate-500">
                Chaque RSCO est garant du respect du seuil contractuel &ge; 70% sur les zones sanitaires sous sa responsabilité.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* RSCO 1 : Mohamed DJERIHO */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    MD
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Mohamed DJERIHO</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Atacora (3 zones) & SAKIF Plateau (1 zone)</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {filteredMetrics.filter(m => m.rsco_id === 'usr-rsco-1' || m.rsco_name?.includes('DJERIHO')).map(m => (
                    <div key={m.id} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">{m.zone_name}</span>
                        <span className="text-[10px] text-slate-500">{m.submitted_on_time} / {m.expected_reports} FOSA à temps</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${m.target_met ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {m.promptitude_rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RSCO 2 : Soumari KOUAGOU */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    SK
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Soumari KOUAGOU</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Mono (2 zones) & PAK Plateau (1 zone)</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {filteredMetrics.filter(m => m.rsco_id === 'usr-rsco-2' || m.rsco_name?.includes('KOUAGOU')).map(m => (
                    <div key={m.id} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">{m.zone_name}</span>
                        <span className="text-[10px] text-slate-500">{m.submitted_on_time} / {m.expected_reports} FOSA à temps</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${m.target_met ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {m.promptitude_rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RSCO 3 : Arafath IMOROU */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    AI
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Arafath IMOROU</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Donga (Djougou-Copargo-Ouaké & Bassila)</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {filteredMetrics.filter(m => m.rsco_id === 'usr-rsco-3' || m.rsco_name?.includes('IMOROU')).map(m => (
                    <div key={m.id} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">{m.zone_name}</span>
                        <span className="text-[10px] text-slate-500">{m.submitted_on_time} / {m.expected_reports} FOSA à temps</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${m.target_met ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {m.promptitude_rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODALE 1 : SAISIE / AJUSTEMENT ZONE SANITAIRE */}
        {/* ==================================================== */}
        {editingMetric && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Mise à jour des Rapports eSIGL A7
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingMetric.zone_name} &bull; {editingMetric.period_month}/{editingMetric.period_year}
                  </p>
                </div>
                <button onClick={() => setEditingMetric(null)} className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded">
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveMetric} className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">RSCO Référent</span>
                    <span className="font-bold text-teal-900">{editingMetric.rsco_name || 'Non assigné'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Date Limite de Transmission</span>
                    <span className="font-mono font-bold text-slate-800">{editingMetric.deadline_date}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total FOSA Attendues (Dénominateur) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingMetric.expected_reports}
                    onChange={(e) => setEditingMetric({ ...editingMetric, expected_reports: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rapports Soumis à Temps (&le; 20 du mois) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingMetric.submitted_on_time}
                    onChange={(e) => setEditingMetric({ ...editingMetric, submitted_on_time: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-bold text-emerald-800 bg-emerald-50/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Soumis en Retard (&gt; 20)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMetric.submitted_late}
                      onChange={(e) => setEditingMetric({ ...editingMetric, submitted_late: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 text-amber-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Manquants / Non Transmis</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMetric.missing_reports}
                      onChange={(e) => setEditingMetric({ ...editingMetric, missing_reports: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 text-rose-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nombre de Relances Envoyées</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMetric.reminders_sent}
                      onChange={(e) => setEditingMetric({ ...editingMetric, reminders_sent: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Statut Preuve eSIGL</label>
                    <select
                      value={editingMetric.evidence_status || 'EN_ATTENTE_PREUVE'}
                      onChange={(e) => setEditingMetric({ ...editingMetric, evidence_status: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                    >
                      <option value="EN_ATTENTE_PREUVE">En attente d’extraction</option>
                      <option value="CONFORME_ESIGL">Certifiée conforme eSIGL</option>
                      <option value="NON_VERIFIE">Non vérifiée</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contraintes et Goulots d’Étranglement</label>
                  <textarea
                    rows={2}
                    value={editingMetric.main_constraints || ''}
                    onChange={(e) => setEditingMetric({ ...editingMetric, main_constraints: e.target.value })}
                    placeholder="Ex: Pannes GSM, coupures de courant, rotation de gestionnaires..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Actions Correctives Engagées</label>
                  <textarea
                    rows={2}
                    value={editingMetric.corrective_actions || ''}
                    onChange={(e) => setEditingMetric({ ...editingMetric, corrective_actions: e.target.value })}
                    placeholder="Ex: Supervision formative de proximité, relais téléphonique..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingMetric(null)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    Enregistrer la Zone
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODALE 2 : NOUVELLE SAISIE ZONE SANITAIRE */}
        {/* ==================================================== */}
        {isNewMetricModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Saisie d’une Zone Sanitaire B09
                  </h3>
                  <p className="text-[11px] text-slate-400">Rapportage mensuel des 9 zones cibles</p>
                </div>
                <button onClick={() => setIsNewMetricModalOpen(false)} className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded">
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateNewMetric} className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mois &bull; Année *</label>
                    <select
                      value={`${newMetricForm.period_month}-${newMetricForm.period_year}`}
                      onChange={(e) => {
                        const [m, y] = e.target.value.split('-').map(Number);
                        setNewMetricForm({ ...newMetricForm, period_month: m, period_year: y });
                      }}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold"
                    >
                      {FISCAL_MONTHS.map(fm => (
                        <option key={`${fm.month}-${fm.year}`} value={`${fm.month}-${fm.year}`}>
                          {fm.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Zone Sanitaire Cible *</label>
                    <select
                      value={newMetricForm.zone_name}
                      onChange={(e) => {
                        const z = OFFICIAL_9_ZONES.find(oz => oz.zone === e.target.value);
                        setNewMetricForm({
                          ...newMetricForm,
                          zone_name: e.target.value,
                          department: z?.dept || 'Atacora',
                          expected_reports: z?.expectedFosa || 30,
                          rsco_id: z?.rscoId || 'usr-rsco-1',
                          rsco_name: z?.rscoName || 'Mohamed DJERIHO',
                        });
                      }}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold"
                    >
                      {OFFICIAL_9_ZONES.map(z => (
                        <option key={z.zone} value={z.zone}>
                          {z.zone} ({z.dept})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">FOSA Attendues (Dénominateur) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newMetricForm.expected_reports}
                      onChange={(e) => setNewMetricForm({ ...newMetricForm, expected_reports: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Soumis à Temps (&le; 20) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newMetricForm.submitted_on_time}
                      onChange={(e) => setNewMetricForm({ ...newMetricForm, submitted_on_time: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-bold text-emerald-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Soumis en Retard</label>
                    <input
                      type="number"
                      min="0"
                      value={newMetricForm.submitted_late}
                      onChange={(e) => setNewMetricForm({ ...newMetricForm, submitted_late: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Manquants</label>
                    <input
                      type="number"
                      min="0"
                      value={newMetricForm.missing_reports}
                      onChange={(e) => setNewMetricForm({ ...newMetricForm, missing_reports: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsNewMetricModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    Ajouter au Suivi B09
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODALE 3 : ENREGISTREMENT D'UNE RELANCE RSCO */}
        {/* ==================================================== */}
        {isReminderModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Enregistrer une Relance Terrain eSIGL
                  </h3>
                  <p className="text-[11px] text-slate-400">Action de terrain pour sécuriser la promptitude</p>
                </div>
                <button onClick={() => setIsReminderModalOpen(false)} className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded">
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveReminder} className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Zone Sanitaire *</label>
                    <select
                      value={newReminderForm.zone_name}
                      onChange={(e) => {
                        const z = OFFICIAL_9_ZONES.find(oz => oz.zone === e.target.value);
                        setNewReminderForm({
                          ...newReminderForm,
                          zone_name: e.target.value,
                          department: z?.dept || 'Atacora',
                          rsco_id: z?.rscoId || 'usr-rsco-1',
                          rsco_name: z?.rscoName || 'Mohamed DJERIHO',
                        });
                      }}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold"
                    >
                      {OFFICIAL_9_ZONES.map(z => (
                        <option key={z.zone} value={z.zone}>
                          {z.zone} ({z.dept})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date de la Relance *</label>
                    <input
                      type="date"
                      required
                      value={newReminderForm.reminder_date}
                      onChange={(e) => setNewReminderForm({ ...newReminderForm, reminder_date: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nom de la Formation Sanitaire (FOSA) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Centre de Santé de Tanguiéta, Maternité de Bopa..."
                    value={newReminderForm.fosa_name}
                    onChange={(e) => setNewReminderForm({ ...newReminderForm, fosa_name: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Personne / Fonction Contactée</label>
                    <input
                      type="text"
                      placeholder="Ex: Dr KASSA, Responsable Pharmacie..."
                      value={newReminderForm.contact_person}
                      onChange={(e) => setNewReminderForm({ ...newReminderForm, contact_person: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Téléphone de Contact</label>
                    <input
                      type="text"
                      placeholder="Ex: +229 97 00 11 22"
                      value={newReminderForm.contact_phone}
                      onChange={(e) => setNewReminderForm({ ...newReminderForm, contact_phone: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Canal Utilisé *</label>
                    <select
                      value={newReminderForm.reminder_channel}
                      onChange={(e) => setNewReminderForm({ ...newReminderForm, reminder_channel: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                    >
                      <option value="TELEPHONE">Appel Téléphonique</option>
                      <option value="VISITE_TERRAIN">Visite sur le Terrain</option>
                      <option value="WHATSAPP">Groupe WhatsApp / Message</option>
                      <option value="SMS">Message SMS</option>
                      <option value="EMAIL">Courrier Électronique</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Résultat de la Relance *</label>
                    <select
                      value={newReminderForm.outcome}
                      onChange={(e) => setNewReminderForm({ ...newReminderForm, outcome: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold"
                    >
                      <option value="PROMESSE_24H">Promesse de transmission &lt; 24h</option>
                      <option value="TRANSMIS_IMMEDIAT">Rapport A7 transmis immédiatement</option>
                      <option value="APPUI_REQUIS">Assistance technique IT requise</option>
                      <option value="NON_JOIGNABLE">Gestionnaire non joignable</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motif Principal du Retard</label>
                  <input
                    type="text"
                    placeholder="Ex: Panne GSM, absence du gestionnaire titulaire, rupture électricité..."
                    value={newReminderForm.delay_cause}
                    onChange={(e) => setNewReminderForm({ ...newReminderForm, delay_cause: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes et Commentaires</label>
                  <textarea
                    rows={2}
                    placeholder="Détails de l'échange ou plan d'action de suivi..."
                    value={newReminderForm.notes}
                    onChange={(e) => setNewReminderForm({ ...newReminderForm, notes: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsReminderModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    Enregistrer la Relance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODALE 4 : ÉDITION DU DOSSIER DE PREUVES TRIMESTRIEL */}
        {/* ==================================================== */}
        {editingDossier && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Gestion du Dossier de Preuves {editingDossier.quarter}
                  </h3>
                  <p className="text-[11px] text-slate-400">{editingDossier.label}</p>
                </div>
                <button onClick={() => setEditingDossier(null)} className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded">
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveDossier} className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Statut du Dossier FAA</label>
                    <select
                      value={editingDossier.status}
                      onChange={(e) => setEditingDossier({ ...editingDossier, status: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold"
                    >
                      <option value="EN_CONSTITUTION">En cours de constitution</option>
                      <option value="VERIFIE_INTERNE">Vérifié en interne SaniNova</option>
                      <option value="SOUMIS_PSI">Soumis formellement à PSI/ABMS</option>
                      <option value="VALIDE_GOR">Validé par le GOR (Paiement débloqué)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Statut Paiement FAA</label>
                    <select
                      value={editingDossier.payout_status}
                      onChange={(e) => setEditingDossier({ ...editingDossier, payout_status: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold"
                    >
                      <option value="EN_ATTENTE">En attente de validation</option>
                      <option value="DECLENCHE">Déclenché (100%)</option>
                      <option value="ENCAISSE">Encaissé</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-800 text-xs">
                    Validation des Pièces Probantes Requises :
                  </label>
                  
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDossier.evidence_checklist.esigl_raw_extract}
                        onChange={(e) => setEditingDossier({
                          ...editingDossier,
                          evidence_checklist: { ...editingDossier.evidence_checklist, esigl_raw_extract: e.target.checked }
                        })}
                        className="rounded text-teal-800 h-4 w-4"
                      />
                      <span>1. Extractions brutes eSIGL certifiées au 20 du mois</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDossier.evidence_checklist.compiled_rates_sheet}
                        onChange={(e) => setEditingDossier({
                          ...editingDossier,
                          evidence_checklist: { ...editingDossier.evidence_checklist, compiled_rates_sheet: e.target.checked }
                        })}
                        className="rounded text-teal-800 h-4 w-4"
                      />
                      <span>2. Tableaux de calcul et consolidation des taux des 9 zones</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDossier.evidence_checklist.rsco_call_logs}
                        onChange={(e) => setEditingDossier({
                          ...editingDossier,
                          evidence_checklist: { ...editingDossier.evidence_checklist, rsco_call_logs: e.target.checked }
                        })}
                        className="rounded text-teal-800 h-4 w-4"
                      />
                      <span>3. Journal des relances RSCO et fiches de contact</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDossier.evidence_checklist.supervision_reports}
                        onChange={(e) => setEditingDossier({
                          ...editingDossier,
                          evidence_checklist: { ...editingDossier.evidence_checklist, supervision_reports: e.target.checked }
                        })}
                        className="rounded text-teal-800 h-4 w-4"
                      />
                      <span>4. Rapports de supervisions formatives intégrées</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDossier.evidence_checklist.psi_joint_minutes}
                        onChange={(e) => setEditingDossier({
                          ...editingDossier,
                          evidence_checklist: { ...editingDossier.evidence_checklist, psi_joint_minutes: e.target.checked }
                        })}
                        className="rounded text-teal-800 h-4 w-4"
                      />
                      <span>5. Procès-verbal de réunion technique conjointe avec PSI Bénin</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDossier.evidence_checklist.payment_request_invoice}
                        onChange={(e) => setEditingDossier({
                          ...editingDossier,
                          evidence_checklist: { ...editingDossier.evidence_checklist, payment_request_invoice: e.target.checked }
                        })}
                        className="rounded text-teal-800 h-4 w-4"
                      />
                      <span>6. Facture formelle de paiement du jalon B09</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes et Justifications</label>
                  <textarea
                    rows={2}
                    value={editingDossier.notes || ''}
                    onChange={(e) => setEditingDossier({ ...editingDossier, notes: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingDossier(null)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    Enregistrer le Dossier
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </ModuleGuard>
  );
}
