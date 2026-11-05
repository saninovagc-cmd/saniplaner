'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { MonthlyTimesheet, TimesheetStatus, TimesheetDayRecord, TimesheetDayType } from '@/types';
import { exportToExcel } from '@/lib/export-utils';
import {
  exportTechnicalTimesheetToExcel,
  exportTechnicalTimesheetToPdf,
  generateInitialMonthDays,
  getDaysInMonth,
  KNOWN_BENIN_HOLIDAYS,
} from '@/lib/timesheet-export';
import { FISCAL_MONTHS } from '@/lib/fiscal-weeks';
import ModuleGuard from '@/components/ModuleGuard';

const DAY_NAMES_HEADER = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-11');
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [activeTimesheet, setActiveTimesheet] = useState<MonthlyTimesheet | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);

  // Calendar form state
  const [calendarExpertId, setCalendarExpertId] = useState<string>(currentUser.id);
  const [calendarMonthId, setCalendarMonthId] = useState<string>('2026-11');
  const [calendarDays, setCalendarDays] = useState<TimesheetDayRecord[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [calendarComments, setCalendarComments] = useState<string>('');
  const [validationAlert, setValidationAlert] = useState<string>('');

  const isDirection = currentUser.role === 'direction';
  const isSE = currentUser.role === 'se_specialist' || isDirection;

  // Extraction mois / année courants depuis `selectedMonthId`
  const [curYear, curMonth] = useMemo(() => {
    const parts = selectedMonthId.split('-').map(Number);
    return [parts[0] || 2026, parts[1] || 11];
  }, [selectedMonthId]);

  const currentMonthConfig = useMemo(() => {
    return FISCAL_MONTHS.find(m => m.id === selectedMonthId) || FISCAL_MONTHS[2];
  }, [selectedMonthId]);

  // Filtrage des timesheets pour le mois actif
  const monthTimesheets = useMemo(() => {
    return timesheets.filter(t => t.period_month === curMonth && t.period_year === curYear);
  }, [timesheets, curMonth, curYear]);

  const filteredTimesheets = useMemo(() => {
    return monthTimesheets.filter(t => {
      const matchExpert = selectedExpert === 'ALL' || t.expert_id === selectedExpert;
      const matchStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
      const expertObj = users.find(u => u.id === t.expert_id);
      const matchSearch =
        (expertObj && expertObj.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.comments && t.comments.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchExpert && matchStatus && matchSearch;
    });
  }, [monthTimesheets, selectedExpert, selectedStatus, searchQuery, users]);

  // Indicateurs statistiques
  const totalDeclared = monthTimesheets.length;
  const validatedCount = monthTimesheets.filter(t => t.status === 'VALIDE_DIRECTION').length;
  const verifiedCount = monthTimesheets.filter(t => t.status === 'VERIFIE_SE').length;
  const pendingCount = monthTimesheets.filter(t => t.status === 'SOUMIS').length;
  const draftCount = monthTimesheets.filter(t => t.status === 'BROUILLON' || t.status === 'REJETE').length;
  const totalDays = monthTimesheets.reduce((s, t) => s + t.total_days_worked, 0);

  // ----------------------------------------------------
  // GESTION DU CALENDRIER (OUVERTURE & PRÉPARATION)
  // ----------------------------------------------------
  const handleOpenCalendar = (existing?: MonthlyTimesheet, viewOnly = false) => {
    setIsViewOnly(viewOnly);
    setValidationAlert('');

    if (existing) {
      setActiveTimesheet(existing);
      setCalendarExpertId(existing.expert_id);
      const monthStr = `${existing.period_year}-${String(existing.period_month).padStart(2, '0')}`;
      setCalendarMonthId(monthStr);
      setCalendarComments(existing.comments || '');

      if (existing.daily_records && existing.daily_records.length > 0) {
        setCalendarDays(existing.daily_records);
      } else {
        const initial = generateInitialMonthDays(existing.period_year, existing.period_month);
        setCalendarDays(initial);
      }
    } else {
      setActiveTimesheet(null);
      setCalendarExpertId(currentUser.id);
      setCalendarMonthId(selectedMonthId);
      setCalendarComments('');
      const initial = generateInitialMonthDays(curYear, curMonth);
      setCalendarDays(initial);
    }

    // Sélectionner le premier jour ouvré par défaut
    setSelectedDayIndex(0);
    setCalendarModalOpen(true);
  };

  // Changement de mois à l'intérieur du modal
  const handleChangeCalendarMonth = (newMonthId: string) => {
    setCalendarMonthId(newMonthId);
    const [y, m] = newMonthId.split('-').map(Number);
    const initial = generateInitialMonthDays(y, m);
    setCalendarDays(initial);
    setSelectedDayIndex(0);
  };

  // Jour actif sélectionné dans le calendrier
  const activeDayRecord: TimesheetDayRecord | undefined = calendarDays[selectedDayIndex];

  // ----------------------------------------------------
  // ÉDITION DU JOUR SÉLECTIONNÉ (MAX 8H STRICT)
  // ----------------------------------------------------
  const handleUpdateDayHours = (field: 'hours_b09' | 'hours_b13', rawVal: number) => {
    if (isViewOnly || !activeDayRecord) return;
    const val = Math.max(0, Math.min(8, isNaN(rawVal) ? 0 : rawVal));

    setCalendarDays(prev => {
      const copy = [...prev];
      const day = { ...copy[selectedDayIndex] };

      if (field === 'hours_b09') {
        const remainingForB13 = 8 - val;
        const adjustedB13 = Math.min(day.hours_b13, remainingForB13);
        day.hours_b09 = val;
        day.hours_b13 = adjustedB13;
      } else {
        const remainingForB09 = 8 - val;
        const adjustedB09 = Math.min(day.hours_b09, remainingForB09);
        day.hours_b13 = val;
        day.hours_b09 = adjustedB09;
      }

      day.type = 'WORK';
      day.hours_holiday = 0;
      day.hours_annual_leave = 0;
      day.hours_sick_leave = 0;
      day.hours_other_leave = 0;
      day.total_hours = day.hours_b09 + day.hours_b13;

      copy[selectedDayIndex] = day;
      return copy;
    });
  };

  const handleSetDayType = (type: TimesheetDayType) => {
    if (isViewOnly || !activeDayRecord) return;

    setCalendarDays(prev => {
      const copy = [...prev];
      const day = { ...copy[selectedDayIndex] };

      day.type = type;

      if (type === 'HOLIDAY') {
        day.hours_holiday = 8;
        day.hours_b09 = 0;
        day.hours_b13 = 0;
        day.hours_annual_leave = 0;
        day.hours_sick_leave = 0;
        day.hours_other_leave = 0;
        day.total_hours = 8;
        if (!day.note) {
          day.note = KNOWN_BENIN_HOLIDAYS[day.date] || 'Jour Férié';
        }
      } else if (type === 'ANNUAL_LEAVE') {
        day.hours_annual_leave = 8;
        day.hours_holiday = 0;
        day.hours_b09 = 0;
        day.hours_b13 = 0;
        day.hours_sick_leave = 0;
        day.hours_other_leave = 0;
        day.total_hours = 8;
        if (!day.note) day.note = 'Congé Annuel';
      } else if (type === 'SICK_LEAVE') {
        day.hours_sick_leave = 8;
        day.hours_holiday = 0;
        day.hours_b09 = 0;
        day.hours_b13 = 0;
        day.hours_annual_leave = 0;
        day.hours_other_leave = 0;
        day.total_hours = 8;
        if (!day.note) day.note = 'Congé Maladie';
      } else if (type === 'OTHER_LEAVE') {
        day.hours_other_leave = 8;
        day.hours_holiday = 0;
        day.hours_b09 = 0;
        day.hours_b13 = 0;
        day.hours_annual_leave = 0;
        day.hours_sick_leave = 0;
        day.total_hours = 8;
        if (!day.note) day.note = 'Autre Absence';
      } else if (type === 'OFF') {
        day.hours_b09 = 0;
        day.hours_b13 = 0;
        day.hours_holiday = 0;
        day.hours_annual_leave = 0;
        day.hours_sick_leave = 0;
        day.hours_other_leave = 0;
        day.total_hours = 0;
        day.note = '';
      } else {
        // Standard work (4h B09 / 4h B13)
        day.hours_b09 = 4;
        day.hours_b13 = 4;
        day.hours_holiday = 0;
        day.hours_annual_leave = 0;
        day.hours_sick_leave = 0;
        day.hours_other_leave = 0;
        day.total_hours = 8;
      }

      copy[selectedDayIndex] = day;
      return copy;
    });
  };

  const handleUpdateDayNote = (noteText: string) => {
    if (isViewOnly || !activeDayRecord) return;
    setCalendarDays(prev => {
      const copy = [...prev];
      copy[selectedDayIndex] = { ...copy[selectedDayIndex], note: noteText };
      return copy;
    });
  };

  // Raccourcis de pré-remplissage rapide du mois
  const handlePresetAllWeekdays = (b09: number, b13: number) => {
    if (isViewOnly) return;
    setCalendarDays(prev =>
      prev.map(d => {
        if (d.is_weekend || d.type === 'HOLIDAY' || d.type === 'ANNUAL_LEAVE' || d.type === 'SICK_LEAVE') {
          return d;
        }
        return {
          ...d,
          type: 'WORK',
          hours_b09: b09,
          hours_b13: b13,
          hours_holiday: 0,
          hours_annual_leave: 0,
          hours_sick_leave: 0,
          hours_other_leave: 0,
          total_hours: b09 + b13,
        };
      })
    );
  };

  const handleResetMonth = () => {
    if (isViewOnly) return;
    const [y, m] = calendarMonthId.split('-').map(Number);
    setCalendarDays(generateInitialMonthDays(y, m));
  };

  // Calculs totaux du calendrier en cours d'édition
  const calendarTotals = useMemo(() => {
    const totalB09 = calendarDays.reduce((s, d) => s + d.hours_b09, 0);
    const totalB13 = calendarDays.reduce((s, d) => s + d.hours_b13, 0);
    const totalHol = calendarDays.reduce((s, d) => s + d.hours_holiday, 0);
    const totalLeave = calendarDays.reduce(
      (s, d) => s + (d.hours_annual_leave + d.hours_sick_leave + d.hours_other_leave),
      0
    );
    const grandTotalHours = totalB09 + totalB13 + totalHol + totalLeave;
    const totalDaysWorked = Number((grandTotalHours / 8).toFixed(1));

    // Nombre théorique de jours ouvrés (Lun - Ven)
    const workingDaysCount = calendarDays.filter(d => !d.is_weekend).length;
    const expectedHours = workingDaysCount * 8;
    const completionPct = expectedHours > 0 ? Math.min(100, Math.round((grandTotalHours / expectedHours) * 100)) : 0;

    return {
      totalB09,
      totalB13,
      totalHol,
      totalLeave,
      grandTotalHours,
      totalDaysWorked,
      workingDaysCount,
      expectedHours,
      completionPct,
    };
  }, [calendarDays]);

  // Enregistrement du timesheet mensuel
  const handleSaveTimesheet = (andSubmit = false) => {
    const [y, m] = calendarMonthId.split('-').map(Number);
    const monthConfig = FISCAL_MONTHS.find(x => x.id === calendarMonthId) || FISCAL_MONTHS[2];
    const expert = users.find(u => u.id === calendarExpertId) || currentUser;

    const tsId = activeTimesheet
      ? activeTimesheet.id
      : `ts-${y}-${m}-${calendarExpertId}`;

    const newTs: MonthlyTimesheet = {
      id: tsId,
      expert_id: calendarExpertId,
      period_month: m,
      period_year: y,
      month_name: monthConfig.label,
      total_days_worked: calendarTotals.totalDaysWorked,
      total_hours_worked: calendarTotals.totalB09 + calendarTotals.totalB13,
      total_hours_b09: calendarTotals.totalB09,
      total_hours_b13: calendarTotals.totalB13,
      total_hours_holiday: calendarTotals.totalHol,
      total_hours_leave: calendarTotals.totalLeave,
      grand_total_hours: calendarTotals.grandTotalHours,
      daily_records: calendarDays,
      status: andSubmit ? 'SOUMIS' : activeTimesheet ? activeTimesheet.status : 'BROUILLON',
      submission_date: andSubmit
        ? new Date().toISOString().substring(0, 10)
        : activeTimesheet?.submission_date,
      comments: calendarComments,
      entries: [
        {
          id: `tse-b09-${Date.now()}`,
          category: 'B09_ESIGL',
          category_label: 'Milestone B09 : Promptitude eSIGL & Données logistiques',
          days_worked: Number((calendarTotals.totalB09 / 8).toFixed(1)),
          hours_worked: calendarTotals.totalB09,
          description_tasks: `Contribution active aux activités de promptitude eSIGL (${calendarTotals.totalB09}h déclarées).`,
        },
        {
          id: `tse-b13-${Date.now()}`,
          category: 'B13_QUANTIFICATION',
          category_label: 'Milestone B13 : Quantification & Approvisionnements',
          days_worked: Number((calendarTotals.totalB13 / 8).toFixed(1)),
          hours_worked: calendarTotals.totalB13,
          description_tasks: `Suivi des approvisionnements et plans de distribution (${calendarTotals.totalB13}h déclarées).`,
        },
      ],
    };

    createOrUpdateTimesheet(newTs);
    setCalendarModalOpen(false);
  };

  // Rejet
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

  // Calcul du premier jour de la semaine pour l'alignement de la grille calendrier
  const monthFirstDayOfWeek = useMemo(() => {
    const [y, m] = calendarMonthId.split('-').map(Number);
    const d = new Date(y, m - 1, 1).getDay(); // 0 = Dim, 1 = Lun ... 6 = Sam
    return d === 0 ? 6 : d - 1; // 0 = Lundi ... 6 = Dimanche
  }, [calendarMonthId]);

  return (
    <ModuleGuard moduleId="timesheets">
      <div className="space-y-6 font-sans">
        {/* BANNER HEADER */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wide">
                Module 04 : Temps & Imputation
              </span>
              <span className="text-xs text-slate-500 font-medium">AFGHS-PSI Bénin</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                FY2026-2027
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
              Gestion des Feuilles de Temps Mensuelles (Timesheets)
            </h1>
            <p className="text-xs text-slate-500">
              Calendrier mensuel d’imputation journalière (limite stricte 8h/j) entre les deux Milestones B09 & B13, jours fériés et congés.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sélecteur de mois de l'Année Fiscale FY27 */}
            <select
              value={selectedMonthId}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              className="text-xs border border-slate-300 font-bold rounded px-3 py-1.5 bg-slate-50 text-slate-900 outline-none focus:border-teal-700"
            >
              {FISCAL_MONTHS.filter(m => m.id !== 'ALL').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.quarter})
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                const data = filteredTimesheets.map(t => {
                  const expert = users.find(u => u.id === t.expert_id);
                  return {
                    Période: t.month_name,
                    Expert: expert?.full_name || 'Non assigné',
                    Rôle: expert?.title || '',
                    'Heures B09': t.total_hours_b09 || 0,
                    'Heures B13': t.total_hours_b13 || 0,
                    'Heures Fériées': t.total_hours_holiday || 0,
                    'Heures Congés': t.total_hours_leave || 0,
                    'Total Heures': t.grand_total_hours || (t.total_days_worked * 8),
                    'Total Jours': t.total_days_worked,
                    Statut: t.status,
                    'Date Soumission': t.submission_date || 'Non soumis',
                  };
                });
                exportToExcel(data, `SANINOVA_Recapitulatif_Timesheets_${selectedMonthId}`);
              }}
              className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold transition"
              title="Exporter la liste récapitulative"
            >
              Export Excel Liste
            </button>

            <button
              onClick={() => handleOpenCalendar()}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs transition flex items-center space-x-1"
            >
              <span>+ Renseigner ma Feuille de Temps</span>
            </button>
          </div>
        </div>

        {/* CARTES STATISTIQUES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Jours Déclarés</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-slate-900">{totalDays} j</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {totalDeclared} fiche(s)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Mois de {currentMonthConfig.label} ({totalDays * 8} heures)
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validés Direction</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-emerald-700">{validatedCount}</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Prêt Audit
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Scellés pour paiement bailleur USAID/PSI
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visés Suivi-Évaluation</p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-indigo-800">{verifiedCount}</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                Attente Direction
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

        {/* BARRE DE FILTRAGE */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Rechercher par expert ou notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-600 font-medium">Personnel :</span>
            <select
              value={selectedExpert}
              onChange={(e) => setSelectedExpert(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none max-w-[200px]"
            >
              <option value="ALL">Tout le staff ({users.length} experts)</option>
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
              <option value="BROUILLON">Brouillon</option>
              <option value="SOUMIS">Soumis (Visa S&E)</option>
              <option value="VERIFIE_SE">Visé S&E (Approbation Direction)</option>
              <option value="VALIDE_DIRECTION">Validé Direction (Final)</option>
              <option value="REJETE">Rejeté / À corriger</option>
            </select>
          </div>
        </div>

        {/* LISTE DES TIMESHEETS AVEC BOUTONS CONFORMES À L'EXEMPLAIRE */}
        <div className="space-y-4">
          {filteredTimesheets.length === 0 ? (
            <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-xs text-slate-400 space-y-3">
              <p>Aucune feuille de temps enregistrée pour {currentMonthConfig.label} avec les critères sélectionnés.</p>
              <button
                onClick={() => handleOpenCalendar()}
                className="px-4 py-2 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 transition"
              >
                + Renseigner ma Feuille de Temps pour ce mois
              </button>
            </div>
          ) : (
            filteredTimesheets.map((ts) => {
              const expert = users.find(u => u.id === ts.expert_id);
              const isAuthor = currentUser.id === ts.expert_id;
              const b09H = ts.total_hours_b09 ?? ts.entries.find(e => e.category === 'B09_ESIGL')?.hours_worked ?? 0;
              const b13H = ts.total_hours_b13 ?? ts.entries.find(e => e.category === 'B13_QUANTIFICATION')?.hours_worked ?? 0;
              const holH = ts.total_hours_holiday ?? 0;
              const leaveH = ts.total_hours_leave ?? 0;
              const grandH = ts.grand_total_hours ?? (ts.total_days_worked * 8);

              return (
                <div
                  key={ts.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition"
                >
                  {/* Ligne Header Fiche */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded bg-slate-900 text-teal-300 font-bold flex items-center justify-center text-xs shadow-2xs">
                        {expert?.full_name.charAt(0) || 'E'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {expert?.full_name}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {expert?.title} &bull; <span className="font-medium text-slate-700">{ts.month_name}</span> &bull; Base : {expert?.base_location || 'Cotonou'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Imputé</span>
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {ts.total_days_worked} jours ({grandH}h)
                        </span>
                      </div>

                      <span className={`px-2.5 py-1 rounded text-xs font-bold border ${
                        ts.status === 'VALIDE_DIRECTION' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        ts.status === 'VERIFIE_SE' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                        ts.status === 'SOUMIS' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        ts.status === 'REJETE' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {ts.status === 'VALIDE_DIRECTION' ? 'Validé par la Direction' :
                         ts.status === 'VERIFIE_SE' ? 'Visé par le S&E' :
                         ts.status === 'SOUMIS' ? 'Soumis pour vérification' :
                         ts.status === 'REJETE' ? 'Rejeté / À corriger' : 'Brouillon'}
                      </span>
                    </div>
                  </div>

                  {/* Motif de rejet si rejeté */}
                  {ts.status === 'REJETE' && ts.rejection_reason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                      <span className="font-bold block uppercase text-[10px]">Motif du rejet / Corrections demandées :</span>
                      {ts.rejection_reason}
                    </div>
                  )}

                  {/* Synthèse des 2 Milestones & Congés */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-teal-50/60 rounded border border-teal-200">
                      <span className="text-[10px] font-bold text-teal-900 uppercase block">Milestone B09 (eSIGL)</span>
                      <div className="font-bold text-sm text-teal-950 font-mono mt-0.5">
                        {b09H} h <span className="text-[11px] text-teal-700 font-normal">({(b09H / 8).toFixed(1)} j)</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 rounded border border-indigo-200">
                      <span className="text-[10px] font-bold text-indigo-900 uppercase block">Milestone B13 (Appro)</span>
                      <div className="font-bold text-sm text-indigo-950 font-mono mt-0.5">
                        {b13H} h <span className="text-[11px] text-indigo-700 font-normal">({(b13H / 8).toFixed(1)} j)</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50/60 rounded border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-900 uppercase block">Jours Fériés (8h/j)</span>
                      <div className="font-bold text-sm text-amber-950 font-mono mt-0.5">
                        {holH} h <span className="text-[11px] text-amber-700 font-normal">({(holH / 8).toFixed(1)} j)</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-100 rounded border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-700 uppercase block">Congés & Absences</span>
                      <div className="font-bold text-sm text-slate-900 font-mono mt-0.5">
                        {leaveH} h <span className="text-[11px] text-slate-600 font-normal">({(leaveH / 8).toFixed(1)} j)</span>
                      </div>
                    </div>
                  </div>

                  {/* Pied d'actions avec Exports officiels (Excel conforme à l'exemplaire & PDF) */}
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

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Bouton Consulter le Calendrier Journalier */}
                      <button
                        onClick={() => handleOpenCalendar(ts, true)}
                        className="px-2.5 py-1 text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded text-xs font-bold transition shadow-2xs"
                        title="Consulter la grille journalière du mois"
                      >
                        Voir Calendrier
                      </button>

                      {/* Export Excel Officiel (modèle exemplaire timesheet.xlsx) */}
                      <button
                        onClick={() => exportTechnicalTimesheetToExcel(ts, expert)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                        title="Télécharger le fichier Excel officiel conforme à l'exemplaire"
                      >
                        <span>Export Excel (Officiel)</span>
                      </button>

                      {/* Export PDF Officiel */}
                      <button
                        onClick={() => exportTechnicalTimesheetToPdf(ts, expert)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                        title="Télécharger la fiche de temps officielle en PDF Paysage"
                      >
                        <span>PDF Officiel</span>
                      </button>

                      {/* Modifier (si Brouillon ou Rejeté) */}
                      {(isAuthor || isDirection) && (ts.status === 'BROUILLON' || ts.status === 'REJETE') && (
                        <button
                          onClick={() => handleOpenCalendar(ts, false)}
                          className="px-2.5 py-1 text-slate-700 hover:text-slate-900 border border-slate-300 rounded text-xs font-bold transition"
                        >
                          Modifier
                        </button>
                      )}

                      {/* Soumettre */}
                      {(isAuthor || isDirection) && (ts.status === 'BROUILLON' || ts.status === 'REJETE') && (
                        <button
                          onClick={() => submitTimesheet(ts.id)}
                          className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold transition"
                        >
                          Soumettre
                        </button>
                      )}

                      {/* Visa S&E */}
                      {isSE && ts.status === 'SOUMIS' && (
                        <>
                          <button
                            onClick={() => verifyTimesheet(ts.id, currentUser.full_name)}
                            className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold transition"
                          >
                            Apposer Visa S&E
                          </button>
                          <button
                            onClick={() => handleOpenReject(ts)}
                            className="px-2.5 py-1 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded text-xs font-bold transition"
                          >
                            Rejeter
                          </button>
                        </>
                      )}

                      {/* Direction Approval */}
                      {isDirection && (ts.status === 'VERIFIE_SE' || ts.status === 'SOUMIS') && (
                        <>
                          <button
                            onClick={() => validateTimesheet(ts.id, currentUser.full_name)}
                            className="px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs transition"
                          >
                            Approuver (Direction)
                          </button>
                          {ts.status === 'VERIFIE_SE' && (
                            <button
                              onClick={() => handleOpenReject(ts)}
                              className="px-2.5 py-1 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded text-xs font-bold transition"
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

        {/* ==================================================== */}
        {/* MODAL DU CALENDRIER DU MOIS : RENSEIGNER MON TIMESHEET */}
        {/* AVEC LES 8H PAR JOUR, LES 2 MILESTONES, FÉRIÉS & CONGÉS */}
        {/* ==================================================== */}
        {calendarModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              {/* Header Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase">
                      Imputation Journalière (Max 8H/Jour)
                    </span>
                    <span className="text-xs text-slate-400">Projet AFGHS-PSI Bénin</span>
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-white mt-1">
                    {isViewOnly ? 'Consultation du Calendrier Mensuel' : 'Renseigner ma Feuille de Temps (Calendrier du Mois)'}
                  </h2>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Sélecteur de mois si pas en lecture seule */}
                  <select
                    disabled={isViewOnly}
                    value={calendarMonthId}
                    onChange={(e) => handleChangeCalendarMonth(e.target.value)}
                    className="text-xs border border-slate-700 rounded px-2.5 py-1 bg-slate-800 text-white font-semibold outline-none focus:border-teal-500"
                  >
                    {FISCAL_MONTHS.filter(m => m.id !== 'ALL').map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setCalendarModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 text-lg font-bold rounded"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Barre de synthèse & Raccourcis de pré-remplissage */}
              <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Milestone B09</span>
                    <span className="text-sm font-bold text-teal-800 font-mono">
                      {calendarTotals.totalB09} h <span className="text-[11px] font-normal text-slate-500">({(calendarTotals.totalB09 / 8).toFixed(1)} j)</span>
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Milestone B13</span>
                    <span className="text-sm font-bold text-indigo-800 font-mono">
                      {calendarTotals.totalB13} h <span className="text-[11px] font-normal text-slate-500">({(calendarTotals.totalB13 / 8).toFixed(1)} j)</span>
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Fériés Déclarés</span>
                    <span className="text-sm font-bold text-amber-700 font-mono">
                      {calendarTotals.totalHol} h <span className="text-[11px] font-normal text-slate-500">({(calendarTotals.totalHol / 8).toFixed(1)} j)</span>
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Congés & Repos</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      {calendarTotals.totalLeave} h <span className="text-[11px] font-normal text-slate-500">({(calendarTotals.totalLeave / 8).toFixed(1)} j)</span>
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded border border-teal-300 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-teal-900 uppercase block">Total Général</span>
                    <span className="text-sm font-bold text-teal-950 font-mono">
                      {calendarTotals.grandTotalHours} h / {calendarTotals.expectedHours} h
                    </span>
                  </div>
                </div>

                {/* Barre d'actions rapides (pré-remplissage) */}
                {!isViewOnly && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Raccourcis de pré-remplissage rapide des jours ouvrés (Lun - Ven) :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePresetAllWeekdays(4, 4)}
                        className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 rounded text-[11px] font-bold transition shadow-2xs"
                        title="Répartir 4h sur B09 et 4h sur B13 sur tous les jours ouvrés"
                      >
                        50% B09 (4h) / 50% B13 (4h)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetAllWeekdays(8, 0)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-[11px] font-bold transition"
                        title="Affecter 8h sur B09 sur tous les jours ouvrés"
                      >
                        100% B09 (8h/j)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetAllWeekdays(0, 8)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-[11px] font-bold transition"
                        title="Affecter 8h sur B13 sur tous les jours ouvrés"
                      >
                        100% B13 (8h/j)
                      </button>
                      <button
                        type="button"
                        onClick={handleResetMonth}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px] font-bold transition"
                        title="Réinitialiser tous les jours du mois"
                      >
                        Réinitialiser le mois
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Corps principal : Grille Calendrier (Gauche) + Volet Édition du Jour (Droite) */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* COLONNE GAUCHE (7 cols) : GRILLE MENSUELLE */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs uppercase tracking-wide text-slate-700">
                      Calendrier &bull; {FISCAL_MONTHS.find(m => m.id === calendarMonthId)?.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Cliquez sur une case de jour pour ajuster ses heures (max 8H)
                    </span>
                  </div>

                  {/* Header des jours de la semaine (Lun .. Dim) */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 uppercase tracking-wider py-1 bg-slate-100 rounded">
                    {DAY_NAMES_HEADER.map(name => (
                      <div key={name} className="py-1">
                        {name}
                      </div>
                    ))}
                  </div>

                  {/* Cases du Calendrier */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Cases vides pour le décalage du 1er jour du mois */}
                    {Array.from({ length: monthFirstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[72px] bg-slate-50/40 rounded border border-dashed border-slate-200" />
                    ))}

                    {/* Jours du mois (1..28/29/30/31) */}
                    {calendarDays.map((rec, idx) => {
                      const isSelected = selectedDayIndex === idx;
                      const is8hComplete = rec.total_hours === 8;
                      const isPartial = rec.total_hours > 0 && rec.total_hours < 8;

                      return (
                        <div
                          key={rec.day}
                          onClick={() => setSelectedDayIndex(idx)}
                          className={`min-h-[76px] p-1.5 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'ring-2 ring-teal-700 bg-teal-50/70 border-teal-700 shadow-xs'
                              : rec.is_weekend
                                ? 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                                : is8hComplete
                                  ? 'bg-emerald-50/40 border-emerald-300 hover:bg-emerald-50'
                                  : isPartial
                                    ? 'bg-amber-50/40 border-amber-300 hover:bg-amber-50'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Numéro du jour & Jour de la semaine */}
                          <div className="flex items-center justify-between">
                            <span className={`font-mono font-bold text-xs ${
                              isSelected ? 'text-teal-950 font-extrabold' : rec.is_weekend ? 'text-slate-400' : 'text-slate-800'
                            }`}>
                              {String(rec.day).padStart(2, '0')}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {rec.day_of_week}
                            </span>
                          </div>

                          {/* Badge d'heures ou d'état */}
                          <div className="my-1">
                            {rec.type === 'HOLIDAY' ? (
                              <div className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1 py-0.5 rounded border border-amber-300 text-center truncate" title={rec.note || 'Jour Férié'}>
                                Férié 8h
                              </div>
                            ) : rec.type === 'ANNUAL_LEAVE' ? (
                              <div className="text-[9px] font-bold bg-blue-100 text-blue-900 px-1 py-0.5 rounded border border-blue-300 text-center truncate">
                                Congé 8h
                              </div>
                            ) : rec.type === 'SICK_LEAVE' ? (
                              <div className="text-[9px] font-bold bg-rose-100 text-rose-900 px-1 py-0.5 rounded border border-rose-300 text-center truncate">
                                Maladie 8h
                              </div>
                            ) : rec.type === 'OTHER_LEAVE' ? (
                              <div className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-center truncate">
                                Abs. 8h
                              </div>
                            ) : rec.total_hours === 8 ? (
                              <div className="text-[9px] font-bold bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded border border-emerald-300 text-center">
                                8h ({rec.hours_b09} / {rec.hours_b13})
                              </div>
                            ) : rec.total_hours > 0 ? (
                              <div className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1 py-0.5 rounded border border-amber-300 text-center">
                                {rec.total_hours}h / 8h
                              </div>
                            ) : (
                              <div className="text-[9px] font-medium text-slate-400 text-center">
                                {rec.is_weekend ? 'Repos' : '0h'}
                              </div>
                            )}
                          </div>

                          {/* Petite jauge de progression 8h */}
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                rec.total_hours === 8 ? 'bg-emerald-600' : rec.total_hours > 0 ? 'bg-amber-500' : 'bg-transparent'
                              }`}
                              style={{ width: `${Math.min(100, (rec.total_hours / 8) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* COLONNE DROITE (5 cols) : VOLET D'ÉDITION DU JOUR SÉLECTIONNÉ */}
                <div className="lg:col-span-5 xl:col-span-4 bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 space-y-4">
                  {activeDayRecord ? (
                    <>
                      {/* En-tête du jour sélectionné avec navigation précédent/suivant */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Jour sélectionné
                          </span>
                          <h3 className="font-bold text-sm text-slate-900">
                            {activeDayRecord.day_of_week} {activeDayRecord.day} {FISCAL_MONTHS.find(m => m.id === calendarMonthId)?.shortLabel}
                          </h3>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={selectedDayIndex === 0}
                            onClick={() => setSelectedDayIndex(prev => Math.max(0, prev - 1))}
                            className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Jour précédent"
                          >
                            &larr;
                          </button>
                          <button
                            type="button"
                            disabled={selectedDayIndex === calendarDays.length - 1}
                            onClick={() => setSelectedDayIndex(prev => Math.min(calendarDays.length - 1, prev + 1))}
                            className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Jour suivant"
                          >
                            &rarr;
                          </button>
                        </div>
                      </div>

                      {/* Indicateur visuel du cumul : Max 8H */}
                      <div className={`p-3 rounded-lg border flex items-center justify-between ${
                        activeDayRecord.total_hours === 8
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : activeDayRecord.total_hours > 0
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}>
                        <div>
                          <span className="text-[10px] uppercase font-bold block">Cumul du jour :</span>
                          <span className="text-xl font-bold font-mono">
                            {activeDayRecord.total_hours} / 8 Heures
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          activeDayRecord.total_hours === 8
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}>
                          {activeDayRecord.total_hours === 8 ? 'Complet (8H)' : 'Incomplet'}
                        </span>
                      </div>

                      {/* Choix du type de journée (Travail, Férié, Congé, Repos) */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                          Statut de la journée :
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={isViewOnly}
                            onClick={() => handleSetDayType('WORK')}
                            className={`p-2 rounded text-xs font-bold transition border text-left ${
                              activeDayRecord.type === 'WORK'
                                ? 'bg-teal-800 text-white border-teal-800 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Travail (B09 / B13)
                          </button>

                          <button
                            type="button"
                            disabled={isViewOnly}
                            onClick={() => handleSetDayType('HOLIDAY')}
                            className={`p-2 rounded text-xs font-bold transition border text-left ${
                              activeDayRecord.type === 'HOLIDAY'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Jour Férié (8H)
                          </button>

                          <button
                            type="button"
                            disabled={isViewOnly}
                            onClick={() => handleSetDayType('ANNUAL_LEAVE')}
                            className={`p-2 rounded text-xs font-bold transition border text-left ${
                              activeDayRecord.type === 'ANNUAL_LEAVE'
                                ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Congé Annuel (8H)
                          </button>

                          <button
                            type="button"
                            disabled={isViewOnly}
                            onClick={() => handleSetDayType('OFF')}
                            className={`p-2 rounded text-xs font-bold transition border text-left ${
                              activeDayRecord.type === 'OFF'
                                ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Non travaillé (0H)
                          </button>
                        </div>
                      </div>

                      {/* Si Travail : Répartition entre les deux Milestones B09 & B13 */}
                      {activeDayRecord.type === 'WORK' && (
                        <div className="space-y-4 pt-2 border-t border-slate-200">
                          {/* Milestone B09 */}
                          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-bold text-xs text-teal-900 block">
                                  Milestone B09
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Promptitude eSIGL & Données logistiques
                                </span>
                              </div>
                              <div className="flex items-center space-x-1 font-mono font-bold text-sm text-teal-900">
                                <input
                                  type="number"
                                  min="0"
                                  max="8"
                                  step="0.5"
                                  disabled={isViewOnly}
                                  value={activeDayRecord.hours_b09}
                                  onChange={(e) => handleUpdateDayHours('hours_b09', parseFloat(e.target.value))}
                                  className="w-14 text-center border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 outline-none focus:border-teal-700 bg-slate-50"
                                />
                                <span>h</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="8"
                              step="0.5"
                              disabled={isViewOnly}
                              value={activeDayRecord.hours_b09}
                              onChange={(e) => handleUpdateDayHours('hours_b09', parseFloat(e.target.value))}
                              className="w-full accent-teal-800 cursor-pointer"
                            />
                          </div>

                          {/* Milestone B13 */}
                          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-bold text-xs text-indigo-900 block">
                                  Milestone B13
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Approvisionnements, Quantification & Distribution
                                </span>
                              </div>
                              <div className="flex items-center space-x-1 font-mono font-bold text-sm text-indigo-900">
                                <input
                                  type="number"
                                  min="0"
                                  max="8"
                                  step="0.5"
                                  disabled={isViewOnly}
                                  value={activeDayRecord.hours_b13}
                                  onChange={(e) => handleUpdateDayHours('hours_b13', parseFloat(e.target.value))}
                                  className="w-14 text-center border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 outline-none focus:border-indigo-700 bg-slate-50"
                                />
                                <span>h</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="8"
                              step="0.5"
                              disabled={isViewOnly}
                              value={activeDayRecord.hours_b13}
                              onChange={(e) => handleUpdateDayHours('hours_b13', parseFloat(e.target.value))}
                              className="w-full accent-indigo-800 cursor-pointer"
                            />
                          </div>

                          {/* Raccourcis de ventilation rapide pour ce jour */}
                          {!isViewOnly && (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateDayHours('hours_b09', 4);
                                  handleUpdateDayHours('hours_b13', 4);
                                }}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition"
                              >
                                4h / 4h (50-50)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateDayHours('hours_b09', 8);
                                  handleUpdateDayHours('hours_b13', 0);
                                }}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition"
                              >
                                8h sur B09
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateDayHours('hours_b09', 0);
                                  handleUpdateDayHours('hours_b13', 8);
                                }}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition"
                              >
                                8h sur B13
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateDayHours('hours_b09', 6);
                                  handleUpdateDayHours('hours_b13', 2);
                                }}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition"
                              >
                                6h B09 / 2h B13
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Note / Précisions pour le jour */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                          {activeDayRecord.type === 'HOLIDAY' ? 'Nom du jour férié :' : 'Activités / Tâches du jour :'}
                        </label>
                        <input
                          type="text"
                          disabled={isViewOnly}
                          placeholder={activeDayRecord.type === 'HOLIDAY' ? 'Ex: Ramadan, Toussaint...' : 'Ex: Validation des rapports SIGL, réunion appro...'}
                          value={activeDayRecord.note || ''}
                          onChange={(e) => handleUpdateDayNote(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded p-2 bg-white outline-none focus:border-teal-700"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Sélectionnez un jour dans le calendrier.
                    </div>
                  )}
                </div>
              </div>

              {/* Commentaires globaux & Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 shrink-0 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Commentaires généraux sur le mois (Optionnel) :
                  </label>
                  <textarea
                    rows={1}
                    disabled={isViewOnly}
                    placeholder="Observations particulières, jalons atteints ou difficultés rencontrées..."
                    value={calendarComments}
                    onChange={(e) => setCalendarComments(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white outline-none focus:border-teal-700"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Total validé : <strong className="text-slate-900">{calendarTotals.grandTotalHours} heures ({calendarTotals.totalDaysWorked} jours)</strong> &bull; Limite contractuelle de 8H max par jour ouvré.
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setCalendarModalOpen(false)}
                      className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                    >
                      {isViewOnly ? 'Fermer' : 'Annuler'}
                    </button>

                    {!isViewOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveTimesheet(false)}
                          className="px-3.5 py-1.5 border border-teal-300 text-teal-800 hover:bg-teal-50 rounded text-xs font-bold transition shadow-2xs"
                        >
                          Enregistrer Brouillon
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveTimesheet(true)}
                          className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold shadow-xs transition"
                        >
                          Soumettre pour Visa S&E
                        </button>
                      </>
                    )}
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
                  &times;
                </button>
              </div>

              <form onSubmit={handleConfirmReject} className="p-5 space-y-3 text-xs">
                <p className="text-slate-600">
                  Veuillez indiquer les anomalies constatées ou les corrections attendues avant nouvelle soumission :
                </p>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Justification insuffisante des heures déclarées sur le Milestone B13..."
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
                    className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded font-semibold"
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
