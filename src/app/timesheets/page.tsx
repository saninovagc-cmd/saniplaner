'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { MonthlyTimesheet, TimesheetStatus, TimesheetEntry } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ModuleGuard from '@/components/ModuleGuard';

const MONTHS_LIST = [
  { month: 10, year: 2026, label: 'Octobre 2026' },
  { month: 11, year: 2026, label: 'Novembre 2026' },
  { month: 12, year: 2026, label: 'Décembre 2026' },
  { month: 1, year: 2027, label: 'Janvier 2027' },
];

const CATEGORIES = [
  { key: 'B09_ESIGL', label: 'Milestone B09 : Promptitude eSIGL' },
  { key: 'B13_QUANTIFICATION', label: 'Milestone B13 : Quantification & Approvisionnements' },
  { key: 'MISSIONS_TERRAIN', label: 'Missions de Terrain & Coaching de Proximité' },
  { key: 'FORMATIONS', label: 'Formations & Renforcement des Capacités' },
  { key: 'COORDINATION_GESTION', label: 'Coordination Générale & Gestion du Projet' },
] as const;

export default function TimesheetsPage() {
  const {
    timesheets,
    createOrUpdateTimesheet,
    submitTimesheet,
    verifyTimesheet,
    validateTimesheet,
    rejectTimesheet,
    users,
    currentUser,
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [activeTimesheet, setActiveTimesheet] = useState<MonthlyTimesheet | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Form for filling timesheet
  const [timesheetForm, setTimesheetForm] = useState<{
    expert_id: string;
    period_month: number;
    period_year: number;
    comments: string;
    entries: {
      category: TimesheetEntry['category'];
      category_label: string;
      days_worked: number;
      description_tasks: string;
    }[];
  }>({
    expert_id: currentUser.id,
    period_month: 11,
    period_year: 2026,
    comments: '',
    entries: CATEGORIES.map(c => ({
      category: c.key as any,
      category_label: c.label,
      days_worked: 0,
      description_tasks: '',
    })),
  });

  const isDirection = currentUser.role === 'direction';
  const isSE = currentUser.role === 'se_specialist' || isDirection;

  const currentMonthInfo = MONTHS_LIST.find(m => m.month === selectedMonth && m.year === selectedYear) || MONTHS_LIST[1];

  const monthTimesheets = useMemo(() => {
    return timesheets.filter(t => t.period_month === selectedMonth && t.period_year === selectedYear);
  }, [timesheets, selectedMonth, selectedYear]);

  const filteredTimesheets = useMemo(() => {
    return monthTimesheets.filter(t => {
      const matchExpert = selectedExpert === 'ALL' || t.expert_id === selectedExpert;
      const matchStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
      const expertObj = users.find(u => u.id === t.expert_id);
      const matchSearch = 
        (expertObj && expertObj.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.comments && t.comments.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.entries.some(e => e.description_tasks.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchExpert && matchStatus && matchSearch;
    });
  }, [monthTimesheets, selectedExpert, selectedStatus, searchQuery, users]);

  // Stats
  const totalDeclared = monthTimesheets.length;
  const validatedCount = monthTimesheets.filter(t => t.status === 'VALIDE_DIRECTION').length;
  const verifiedCount = monthTimesheets.filter(t => t.status === 'VERIFIE_SE').length;
  const pendingCount = monthTimesheets.filter(t => t.status === 'SOUMIS').length;
  const draftCount = monthTimesheets.filter(t => t.status === 'BROUILLON' || t.status === 'REJETE').length;
  const totalDays = monthTimesheets.reduce((s, t) => s + t.total_days_worked, 0);

  // Open Edit/Fill modal
  const handleOpenFill = (existing?: MonthlyTimesheet) => {
    if (existing) {
      setActiveTimesheet(existing);
      setTimesheetForm({
        expert_id: existing.expert_id,
        period_month: existing.period_month,
        period_year: existing.period_year,
        comments: existing.comments || '',
        entries: CATEGORIES.map(cat => {
          const found = existing.entries.find(e => e.category === cat.key);
          return {
            category: cat.key as any,
            category_label: cat.label,
            days_worked: found ? found.days_worked : 0,
            description_tasks: found ? found.description_tasks : '',
          };
        }),
      });
    } else {
      setActiveTimesheet(null);
      setTimesheetForm({
        expert_id: currentUser.id,
        period_month: selectedMonth,
        period_year: selectedYear,
        comments: '',
        entries: CATEGORIES.map(cat => ({
          category: cat.key as any,
          category_label: cat.label,
          days_worked: 0,
          description_tasks: '',
        })),
      });
    }
    setEditModalOpen(true);
  };

  const calculatedTotalDays = useMemo(() => {
    return timesheetForm.entries.reduce((sum, e) => sum + (Number(e.days_worked) || 0), 0);
  }, [timesheetForm.entries]);

  const handleSaveTimesheet = (andSubmit = false) => {
    const total = calculatedTotalDays;
    const activeEntries: TimesheetEntry[] = timesheetForm.entries
      .filter(e => (Number(e.days_worked) || 0) > 0 || e.description_tasks.trim().length > 0)
      .map((e, idx) => ({
        id: `tse-${Date.now()}-${idx}`,
        category: e.category,
        category_label: e.category_label,
        days_worked: Number(e.days_worked) || 0,
        hours_worked: (Number(e.days_worked) || 0) * 8,
        description_tasks: e.description_tasks,
      }));

    const tsId = activeTimesheet ? activeTimesheet.id : `ts-${timesheetForm.period_year}-${timesheetForm.period_month}-${timesheetForm.expert_id}`;
    const newTs: MonthlyTimesheet = {
      id: tsId,
      expert_id: timesheetForm.expert_id,
      period_month: timesheetForm.period_month,
      period_year: timesheetForm.period_year,
      month_name: currentMonthInfo.label,
      total_days_worked: total,
      status: andSubmit ? 'SOUMIS' : (activeTimesheet ? activeTimesheet.status : 'BROUILLON'),
      submission_date: andSubmit ? new Date().toISOString().substring(0, 10) : activeTimesheet?.submission_date,
      comments: timesheetForm.comments,
      entries: activeEntries,
    };

    createOrUpdateTimesheet(newTs);
    setEditModalOpen(false);
  };

  const handleOpenReject = (ts: MonthlyTimesheet) => {
    setActiveTimesheet(ts);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTimesheet) return;
    rejectTimesheet(activeTimesheet.id, rejectionReason || 'Données à corriger selon les observations');
    setRejectModalOpen(false);
  };

  // Generate Official PDF for a single timesheet
  const handleDownloadTimesheetPdf = (ts: MonthlyTimesheet) => {
    const expert = users.find(u => u.id === ts.expert_id);
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Header banner
    doc.setFillColor(0, 128, 128); // Saninova Teal
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('SANINOVA GLOBAL CONSULTING — FICHE DE TEMPS OFFICIELLE (TIMESHEET)', 14, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`PROJET AFGHS-PSI BÉNIN | PÉRIODE : ${ts.month_name.toUpperCase()}`, 14, 18);

    // Meta box
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(`Expert : ${expert?.full_name || 'Non renseigné'}`, 14, 32);
    doc.text(`Titre / Rôle : ${expert?.title || 'Expert'}`, 14, 37);
    doc.text(`Départements : ${expert?.assigned_departments.join(', ') || 'National'}`, 14, 42);

    doc.text(`Total Jours Travaillés : ${ts.total_days_worked} jours (${ts.total_days_worked * 8} heures)`, 160, 32);
    doc.text(`Statut de validation : ${ts.status.replace('_', ' ')}`, 160, 37);
    if (ts.submission_date) doc.text(`Date de soumission : ${ts.submission_date}`, 160, 42);

    // Table of entries
    const tableHeaders = ['Composante / Jalon du Projet', 'Jours', 'Heures', 'Description Détaillée des Tâches et Activités'];
    const tableRows = ts.entries.map(e => [
      e.category_label,
      `${e.days_worked} j`,
      `${e.hours_worked} h`,
      e.description_tasks || 'Aucune précision saisie',
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 'auto' },
      },
      margin: { top: 25, right: 14, bottom: 40, left: 14 },
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 150;

    // Signatures blocks
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    // Box 1: Expert
    doc.rect(14, finalY, 80, 28);
    doc.text('Signature de l’Expert :', 16, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(expert?.full_name || '', 16, finalY + 11);
    doc.text(`Date : ${ts.submission_date || 'En cours'}`, 16, finalY + 16);
    doc.text('Mention : "Certifié sincère et conforme"', 16, finalY + 22);

    // Box 2: Visa S&E
    doc.setFont('helvetica', 'bold');
    doc.rect(108, finalY, 80, 28);
    doc.text('Visa Suivi-Évaluation (S&E) :', 110, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(ts.verified_by || 'En attente de visa', 110, finalY + 11);
    doc.text(`Date : ${ts.verification_date || '-'}`, 110, finalY + 16);
    doc.text(ts.verified_by ? 'Statut : Conforme et vérifié' : 'Statut : Non vérifié', 110, finalY + 22);

    // Box 3: Direction
    doc.setFont('helvetica', 'bold');
    doc.rect(202, finalY, 81, 28);
    doc.text('Approbation Direction Générale :', 204, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(ts.validated_by || 'En attente d’approbation', 204, finalY + 11);
    doc.text(`Date : ${ts.validation_date || '-'}`, 204, finalY + 16);
    doc.text(ts.validated_by ? 'Statut : BON POUR PAIEMENT & AUDIT' : 'Statut : En attente', 204, finalY + 22);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — SaniNova Project Hub | Projet AFGHS-PSI Bénin`, 14, 204);

    doc.save(`SANINOVA_Timesheet_${ts.month_name.replace(' ', '_')}_${expert?.full_name.replace(/ /g, '_')}.pdf`);
  };

  // Export summary Excel
  const handleExportSummaryExcel = () => {
    const data = filteredTimesheets.map(t => {
      const expert = users.find(u => u.id === t.expert_id);
      return {
        Période: t.month_name,
        Expert: expert?.full_name || 'Non assigné',
        Rôle: expert?.title || '',
        'Total Jours': t.total_days_worked,
        'Heures Travaillées': t.total_days_worked * 8,
        Statut: t.status,
        'Date Soumission': t.submission_date || 'Non soumis',
        'Vérifié par (S&E)': t.verified_by || '-',
        'Date Vérification': t.verification_date || '-',
        'Validé par (Direction)': t.validated_by || '-',
        'Date Validation': t.validation_date || '-',
      };
    });
    exportToExcel(data, `SANINOVA_Recapitulatif_Timesheets_${selectedMonth}_${selectedYear}`);
  };

  return (
    <ModuleGuard moduleId="timesheets">
      <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 04 : Temps & Imputation
            </span>
            <span className="text-xs text-slate-500 font-medium">Circuit d’Approbation des Feuilles de Temps</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
            Gestion des Timesheets Mensuels
          </h1>
          <p className="text-xs text-slate-500">
            Workflow contractuel : Saisie Expert &rarr; Soumission &rarr; Visa Suivi-Évaluation &rarr; Approbation Direction Générale.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector */}
          <select
            value={`${selectedMonth}-${selectedYear}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split('-').map(Number);
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            className="text-xs border border-slate-300 font-bold rounded px-3 py-1.5 bg-slate-50 text-slate-900 outline-none focus:border-teal-700"
          >
            {MONTHS_LIST.map((m) => (
              <option key={`${m.month}-${m.year}`} value={`${m.month}-${m.year}`}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportSummaryExcel}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold transition"
          >
            Export Excel
          </button>

          <button
            onClick={() => handleOpenFill()}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition"
          >
            + Renseigner ma Feuille de Temps
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Jours Déclarés</p>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-bold text-slate-900">{totalDays} j</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {totalDeclared} fiches
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Mois de {currentMonthInfo.label} ({totalDays * 8} heures)
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validés par la Direction</p>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-bold text-emerald-700">{validatedCount}</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Prêt pour Audit
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Signés et scellés pour paiement bailleur
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visés par le S&E</p>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-2xl font-bold text-indigo-800">{verifiedCount}</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
              En attente Direction
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Contrôle de conformité documentaire effectué
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En attente / Brouillon</p>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className={`text-2xl font-bold ${pendingCount + draftCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
              {pendingCount + draftCount}
            </h3>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              pendingCount > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {pendingCount} soumis / {draftCount} brouillon
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Nécessite action de l’expert ou du S&E
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher par expert, tâches ou notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-600 font-medium">Expert :</span>
          <select
            value={selectedExpert}
            onChange={(e) => setSelectedExpert(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none max-w-[180px]"
          >
            <option value="ALL">Tous les membres ({users.length})</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-600 font-medium ml-2">Circuit :</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Toutes les étapes</option>
            <option value="BROUILLON">Brouillon (Non soumis)</option>
            <option value="SOUMIS">Soumis (En attente S&E)</option>
            <option value="VERIFIE_SE">Visé S&E (En attente Direction)</option>
            <option value="VALIDE_DIRECTION">Validé Direction (Final)</option>
            <option value="REJETE">Rejeté / À corriger</option>
          </select>
        </div>
      </div>

      {/* Timesheets List */}
      <div className="space-y-4">
        {filteredTimesheets.length === 0 ? (
          <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-xs text-slate-400">
            Aucune feuille de temps enregistrée pour {currentMonthInfo.label} avec les critères sélectionnés.
          </div>
        ) : (
          filteredTimesheets.map((ts) => {
            const expert = users.find(u => u.id === ts.expert_id);
            const isAuthor = currentUser.id === ts.expert_id;

            return (
              <div 
                key={ts.id} 
                className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition"
              >
                {/* Header row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs border border-slate-200">
                      {expert?.full_name.charAt(0) || 'E'}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {expert?.full_name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {expert?.title} &bull; {ts.month_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Imputé</span>
                      <span className="text-base font-bold text-slate-900 font-mono">
                        {ts.total_days_worked} jours
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${
                      ts.status === 'VALIDE_DIRECTION' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      ts.status === 'VERIFIE_SE' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                      ts.status === 'SOUMIS' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                      ts.status === 'REJETE' ? 'bg-red-50 text-red-800 border-red-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {ts.status === 'VALIDE_DIRECTION' ? 'Validé par la Direction' :
                       ts.status === 'VERIFIE_SE' ? 'Visé par le S&E' :
                       ts.status === 'SOUMIS' ? 'Soumis pour vérification' :
                       ts.status === 'REJETE' ? 'Rejeté / À corriger' : 'Brouillon'}
                    </span>
                  </div>
                </div>

                {/* Rejection alert */}
                {ts.status === 'REJETE' && ts.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <span className="font-bold block uppercase text-[10px]">Motif du rejet / Corrections demandées :</span>
                    {ts.rejection_reason}
                  </div>
                )}

                {/* Entries table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="p-2.5">Composante / Activité</th>
                        <th className="p-2.5 text-center">Jours Déclarés</th>
                        <th className="p-2.5 text-center">Heures</th>
                        <th className="p-2.5">Détail des Tâches & Livrables Produits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ts.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-semibold text-slate-800 whitespace-nowrap">
                            {entry.category_label}
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-900 font-mono">
                            {entry.days_worked} j
                          </td>
                          <td className="p-2.5 text-center text-slate-500 font-mono">
                            {entry.hours_worked} h
                          </td>
                          <td className="p-2.5 text-slate-600 leading-relaxed">
                            {entry.description_tasks || 'Non précisé'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Validation signatures & Action buttons footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-500 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-700">Soumis le :</span> {ts.submission_date || 'Non soumis'}
                    </div>
                    {ts.verified_by && (
                      <div>
                        <span className="font-semibold text-slate-700">Visa S&E :</span> {ts.verified_by} ({ts.verification_date})
                      </div>
                    )}
                    {ts.validated_by && (
                      <div>
                        <span className="font-semibold text-slate-700">Approuvé Direction :</span> {ts.validated_by} ({ts.validation_date})
                      </div>
                    )}
                  </div>

                  {/* Contextual actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Official PDF Download */}
                    <button
                      onClick={() => handleDownloadTimesheetPdf(ts)}
                      className="px-2.5 py-1 text-slate-700 hover:text-teal-900 hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold transition"
                    >
                      Télécharger PDF
                    </button>

                    {/* Expert can edit if draft or rejected */}
                    {(isAuthor || isDirection) && (ts.status === 'BROUILLON' || ts.status === 'REJETE') && (
                      <button
                        onClick={() => handleOpenFill(ts)}
                        className="px-2.5 py-1 text-slate-700 hover:text-slate-900 border border-slate-200 rounded text-xs font-semibold transition"
                      >
                        Modifier
                      </button>
                    )}

                    {/* Expert can submit if draft or rejected */}
                    {(isAuthor || isDirection) && (ts.status === 'BROUILLON' || ts.status === 'REJETE') && (
                      <button
                        onClick={() => submitTimesheet(ts.id)}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold transition"
                      >
                        Soumettre
                      </button>
                    )}

                    {/* S&E Visa step */}
                    {isSE && ts.status === 'SOUMIS' && (
                      <>
                        <button
                          onClick={() => verifyTimesheet(ts.id, currentUser.full_name)}
                          className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold transition"
                        >
                          Apposer Visa S&E
                        </button>
                        <button
                          onClick={() => handleOpenReject(ts)}
                          className="px-2.5 py-1 text-red-700 hover:bg-red-50 border border-red-200 rounded text-xs font-semibold transition"
                        >
                          Rejeter
                        </button>
                      </>
                    )}

                    {/* Direction Approval step */}
                    {isDirection && (ts.status === 'VERIFIE_SE' || ts.status === 'SOUMIS') && (
                      <>
                        <button
                          onClick={() => validateTimesheet(ts.id, currentUser.full_name)}
                          className="px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition"
                        >
                          Approuver (Direction)
                        </button>
                        {ts.status === 'VERIFIE_SE' && (
                          <button
                            onClick={() => handleOpenReject(ts)}
                            className="px-2.5 py-1 text-red-700 hover:bg-red-50 border border-red-200 rounded text-xs font-semibold transition"
                          >
                            Rejeter
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: REMPLIR / AJUSTER LE TIMESHEET */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg shrink-0">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  {activeTimesheet ? 'Modifier la feuille de temps' : 'Renseigner une feuille de temps'}
                </h3>
                <p className="text-[11px] text-slate-500">{currentMonthInfo.label}</p>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)} 
                className="text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Membre de l’équipe *</label>
                  <select
                    disabled={!isDirection}
                    value={timesheetForm.expert_id}
                    onChange={(e) => setTimesheetForm({ ...timesheetForm, expert_id: e.target.value })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700 font-medium bg-slate-50"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total jours saisis :</span>
                  <span className="text-xl font-bold text-teal-800 font-mono">
                    {calculatedTotalDays} jours ({calculatedTotalDays * 8} h)
                  </span>
                </div>
              </div>

              {/* Rows for each category */}
              <div className="space-y-3">
                <label className="block font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Ventilation par composante du projet :
                </label>

                {timesheetForm.entries.map((entry, index) => (
                  <div key={entry.category} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{entry.category_label}</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="31"
                          value={entry.days_worked}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const newEntries = [...timesheetForm.entries];
                            newEntries[index].days_worked = val;
                            setTimesheetForm({ ...timesheetForm, entries: newEntries });
                          }}
                          className="w-20 text-center font-bold text-slate-900 border border-slate-200 rounded px-2 py-1 outline-none focus:border-teal-700 bg-white"
                        />
                        <span className="text-slate-500 font-semibold">j</span>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Détail des actions menées, livrables produits ou structures sanitaires visitées..."
                      value={entry.description_tasks}
                      onChange={(e) => {
                        const newEntries = [...timesheetForm.entries];
                        newEntries[index].description_tasks = e.target.value;
                        setTimesheetForm({ ...timesheetForm, entries: newEntries });
                      }}
                      className="w-full text-xs border border-slate-200 rounded p-1.5 bg-white outline-none focus:border-teal-700"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Commentaires généraux ou observations</label>
                <textarea
                  rows={2}
                  placeholder="Remarques éventuelles sur la période..."
                  value={timesheetForm.comments}
                  onChange={(e) => setTimesheetForm({ ...timesheetForm, comments: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">
                  Un timesheet complet comprend généralement 20 à 22 jours ouvrés par mois.
                </span>

                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSaveTimesheet(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Sauvegarder en Brouillon
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveTimesheet(true)}
                    className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded font-semibold shadow-xs"
                  >
                    Soumettre pour Validation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOTIF DE REJET */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">Demander une correction / Rejeter</h3>
              <button 
                onClick={() => setRejectModalOpen(false)} 
                className="text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                Veuillez indiquer les anomalies constatées ou les corrections attendues avant nouvelle soumission :
              </p>
              <textarea
                required
                rows={3}
                placeholder="Ex: Justification insuffisante des 4 jours sur la composante B13..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full border border-slate-200 rounded p-2 outline-none focus:border-red-600"
              />

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded font-semibold"
                >
                  Confirmer le Rejet
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