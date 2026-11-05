import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyTimesheet, TimesheetDayRecord, User } from '@/types';

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Jours fériés officiels au Bénin (Année Fiscale FY2026-2027)
export const KNOWN_BENIN_HOLIDAYS: Record<string, string> = {
  '2026-10-29': 'Mouloud (Naissance du Prophète)',
  '2026-11-01': 'Toussaint',
  '2026-12-25': 'Noël',
  '2027-01-01': 'Jour de l’An',
  '2027-01-10': 'Fête des Religions Traditionnelles (Vodoun)',
  '2027-03-20': 'Aïd el-Fitr (Korité / Ramadan)',
  '2027-03-29': 'Lundi de Pâques',
  '2027-05-01': 'Fête du Travail',
  '2027-05-06': 'Ascension',
  '2027-05-17': 'Lundi de Pentecôte',
  '2027-05-27': 'Aïd el-Kébir (Tabaski)',
  '2027-08-01': 'Fête Nationale de l’Indépendance',
  '2027-08-15': 'Assomption',
};

/**
 * Retourne le nombre de jours dans un mois donné.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Génère la grille journalière par défaut pour un mois de l'année fiscale.
 */
export function generateInitialMonthDays(year: number, month: number): TimesheetDayRecord[] {
  const daysCount = getDaysInMonth(year, month);
  const records: TimesheetDayRecord[] = [];
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  for (let d = 1; d <= daysCount; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeekIdx = dateObj.getDay();
    const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const holidayName = KNOWN_BENIN_HOLIDAYS[dateStr];

    if (holidayName) {
      records.push({
        day: d,
        date: dateStr,
        day_of_week: dayNamesShort[dayOfWeekIdx],
        is_weekend: isWeekend,
        type: 'HOLIDAY',
        hours_b09: 0,
        hours_b13: 0,
        hours_holiday: 8,
        hours_annual_leave: 0,
        hours_sick_leave: 0,
        hours_other_leave: 0,
        total_hours: 8,
        note: holidayName,
      });
    } else if (isWeekend) {
      records.push({
        day: d,
        date: dateStr,
        day_of_week: dayNamesShort[dayOfWeekIdx],
        is_weekend: true,
        type: 'OFF',
        hours_b09: 0,
        hours_b13: 0,
        hours_holiday: 0,
        hours_annual_leave: 0,
        hours_sick_leave: 0,
        hours_other_leave: 0,
        total_hours: 0,
      });
    } else {
      // Jour ouvré standard (répartition par défaut 4h B09 / 4h B13, modifiable)
      records.push({
        day: d,
        date: dateStr,
        day_of_week: dayNamesShort[dayOfWeekIdx],
        is_weekend: false,
        type: 'WORK',
        hours_b09: 4,
        hours_b13: 4,
        hours_holiday: 0,
        hours_annual_leave: 0,
        hours_sick_leave: 0,
        hours_other_leave: 0,
        total_hours: 8,
        note: '',
      });
    }
  }

  return records;
}

/**
 * RÈGLE D'APPROBATION HIÉRARCHIQUE DES TIMESHEETS :
 * 1. Dr Abadji ADAHIN approuve les timesheets des 3 RSCO (Mohamed DJERIWO, Soumari KOUAGOU, Arafath IMOROU).
 * 2. Mylène ADIGOUN approuve le timesheet de Valentin TOSSE.
 * 3. Dr Hope AKOHOUVI AMOU approuve les timesheets de Mylène ADIGOUN, Nicolas AMEGAN et Dr Abadji ADAHIN.
 * 4. Dr Hope AKOHOUVI AMOU est approuvé par le Directeur de Projet (Mario BADET).
 */
export function getTimesheetApprover(
  expertId: string,
  users?: User[]
): { id: string; name: string; title: string } {
  // 1. Les RSCOs sont supervisés et approuvés par Dr Abadji ADAHIN / DANHIN (usr-cs)
  if (['usr-rsco-1', 'usr-rsco-2', 'usr-rsco-3'].includes(expertId)) {
    const u = users?.find(x => x.id === 'usr-cs');
    return {
      id: 'usr-cs',
      name: u?.full_name || 'Dr Abadji T. Edith DANHIN (ADAHIN)',
      title: u?.title || 'Spécialiste FASP (Quantification & Approvisionnements)',
    };
  }

  // 2. Valentin TOSSE (usr-sis-2) est supervisé et approuvé par Mylène ADIGOUN (usr-sis-1)
  if (expertId === 'usr-sis-2') {
    const u = users?.find(x => x.id === 'usr-sis-1');
    return {
      id: 'usr-sis-1',
      name: u?.full_name || 'Mylène ADIGOUN',
      title: u?.title || 'Spécialiste Systèmes d’Information Sanitaire (eSIGL)',
    };
  }

  // 3. Mylène ADIGOUN (usr-sis-1) et Nicolas AMEGAN (usr-se) sont supervisés et approuvés par Dr Hope AKOHOUVI (usr-dir)
  if (expertId === 'usr-sis-1' || expertId === 'usr-se') {
    const u = users?.find(x => x.id === 'usr-dir');
    return {
      id: 'usr-dir',
      name: u?.full_name || 'Dr Hope AKOHOUVI AMOU',
      title: u?.title || 'Direction & Relations Institutionnelles',
    };
  }

  // 4. Dr Abadji DANHIN / ADAHIN (usr-cs) est supervisée et approuvée par Dr Hope AKOHOUVI (usr-dir)
  if (expertId === 'usr-cs') {
    const u = users?.find(x => x.id === 'usr-dir');
    return {
      id: 'usr-dir',
      name: u?.full_name || 'Dr Hope AKOHOUVI AMOU',
      title: u?.title || 'Direction & Relations Institutionnelles',
    };
  }

  // 5. Dr Hope AKOHOUVI (usr-dir) est approuvé par le Directeur de Projet COP (Mario BADET)
  if (expertId === 'usr-dir') {
    return {
      id: 'cop-mario',
      name: 'BADET Mario',
      title: 'Directeur de Projet (Chief of Party - PSI Bénin)',
    };
  }

  // Fallback Direction
  return {
    id: 'usr-dir',
    name: 'Dr Hope AKOHOUVI AMOU',
    title: 'Direction du Projet',
  };
}

/**
 * Vérifie si l'utilisateur actuellement connecté est habilité à approuver la fiche de temps donnée
 */
export function canUserApproveTimesheet(
  currentUserId: string,
  timesheetExpertId: string,
  currentUserRole?: string,
  users?: User[]
): boolean {
  // On ne peut pas approuver sa propre fiche de temps
  if (currentUserId === timesheetExpertId) return false;

  const approver = getTimesheetApprover(timesheetExpertId, users);

  // 1. Est le superviseur direct désigné
  if (currentUserId === approver.id) return true;

  // 2. Est la Direction Générale (supervision hiérarchique globale)
  if (currentUserRole === 'direction') return true;

  return false;
}

/**
 * EXPORT EXCEL OFFICIEL — MODÈLE CONFORME À L'EXEMPLAIRE FOURNI (exemplaire timesheet.xlsx)
 * Structure :
 * - Feuille 'Technical Timesheet' : Matrice exacte 1..31 jours, lignes B09, B13, Fériés, Congés, Sous-totaux, Totaux, Notes, Signatures
 * - Feuille 'Synthèse Détaillée' : Tableau chronologique jour par jour
 */
export function exportTechnicalTimesheetToExcel(
  timesheet: MonthlyTimesheet,
  expert?: User,
  supervisorName?: string,
  users?: User[]
) {
  const approver = getTimesheetApprover(timesheet.expert_id, users);
  const effectiveSupervisor = supervisorName || timesheet.validated_by || approver.name;
  const monthIdx = timesheet.period_month - 1;
  const monthNameEn = MONTH_NAMES_EN[monthIdx] || 'November';
  const monthNameFr = MONTH_NAMES_FR[monthIdx] || timesheet.month_name;
  const year = timesheet.period_year;
  const daysInMonth = getDaysInMonth(year, timesheet.period_month);

  const days: TimesheetDayRecord[] = timesheet.daily_records && timesheet.daily_records.length > 0
    ? timesheet.daily_records
    : generateInitialMonthDays(year, timesheet.period_month);

  // Helper pour obtenir la valeur d'un jour donné (1..31)
  const getDayValue = (d: number, field: keyof TimesheetDayRecord): number => {
    if (d > daysInMonth) return 0;
    const rec = days.find(x => x.day === d);
    if (!rec) return 0;
    const val = rec[field];
    return typeof val === 'number' ? val : 0;
  };

  const ws: Record<string, any> = {};

  // Utilitaires de conversion de coordonnées en référence de cellule (ex: col 0, row 0 -> A1)
  const colName = (col: number) => {
    let s = '';
    col++;
    while (col > 0) {
      const m = (col - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      col = Math.floor((col - m) / 26);
    }
    return s;
  };

  const setCell = (col: number, row: number, val: any, type: 's' | 'n' = typeof val === 'number' ? 'n' : 's') => {
    const ref = `${colName(col)}${row + 1}`;
    ws[ref] = { t: type, v: val };
  };

  // Section 1 : Bloc supérieur des paramètres (Lignes 3 à 5)
  setCell(2, 2, 'Complete All Fields in This Box Prior to Completing the Timesheet');
  setCell(2, 3, 'Pay Period (Month):');
  setCell(6, 3, monthNameEn);
  setCell(10, 3, 'Primary Work Location:');
  setCell(15, 3, expert?.base_location || 'Cotonou');

  setCell(2, 4, 'Pay Period (Year):');
  setCell(6, 4, year);
  setCell(10, 4, 'Project Name:');
  setCell(14, 4, 'AFGHS-PSI Bénin');

  // Section 2 : Titre de l'organisation
  setCell(0, 8, 'SaniNova Global Consulting / Chemonics International Inc.');
  setCell(0, 9, 'Monthly Timesheet');
  setCell(0, 10, 'for Local Professional and Support Employees');

  // Section 3 : Métadonnées employé (Ligne 12)
  setCell(2, 11, 'Employee Name:');
  setCell(6, 11, expert?.full_name || 'IMOROU T. ARAFATH');
  setCell(16, 11, 'Job Title:');
  setCell(18, 11, expert?.title || 'Expert Technique');
  setCell(28, 11, 'Project:');
  setCell(30, 11, 'AFGHS-PSI Bénin');
  setCell(36, 11, 'Month:');
  setCell(38, 11, monthNameEn);
  setCell(42, 11, 'Year:');
  setCell(43, 11, year);

  // Colonnes de jours : Colonne J = index 9 (Jour 1), K = 10 (Jour 2) ... AN = 39 (Jour 31)
  // Colonne AO = 40 (Work Hours), AP = 41 (Days)
  const START_COL = 9;

  // Ligne 14 (Index 13) : Header DATE et numéros de jours 1 à 31
  setCell(2, 13, 'DATE');
  for (let d = 1; d <= 31; d++) {
    setCell(START_COL + d - 1, 13, d);
  }
  setCell(40, 13, 'Work Hours');
  setCell(41, 13, 'Days');

  // Ligne 15 : Billing Code
  setCell(2, 14, 'Billing Code: B100030.079');

  // Ligne 16 : Billable Time Header
  setCell(2, 15, 'Billable Time, AFGHS Benin');

  // Ligne 17 (Index 16) : Milestone B09
  setCell(2, 16, 'Milestone B09 : Promptitude eSIGL & Données logistiques');
  let sumB09 = 0;
  for (let d = 1; d <= 31; d++) {
    const val = getDayValue(d, 'hours_b09');
    sumB09 += val;
    setCell(START_COL + d - 1, 16, val > 0 ? val : null, 'n');
  }
  setCell(40, 16, sumB09);
  setCell(41, 16, Number((sumB09 / 8).toFixed(1)));

  // Ligne 18 (Index 17) : Milestone B13
  setCell(2, 17, 'Milestone B13 : Approvisionnements, Quantification & Distribution');
  let sumB13 = 0;
  for (let d = 1; d <= 31; d++) {
    const val = getDayValue(d, 'hours_b13');
    sumB13 += val;
    setCell(START_COL + d - 1, 17, val > 0 ? val : null, 'n');
  }
  setCell(40, 17, sumB13);
  setCell(41, 17, Number((sumB13 / 8).toFixed(1)));

  // Ligne 50 (Index 49) : Congés & Jours Fériés Header
  setCell(2, 49, 'Leave, Billable Time');

  // Ligne 51 (Index 50) : Holidays
  setCell(2, 50, 'Holidays (describe below)*');
  let sumHol = 0;
  for (let d = 1; d <= 31; d++) {
    const val = getDayValue(d, 'hours_holiday');
    sumHol += val;
    setCell(START_COL + d - 1, 50, val > 0 ? val : null, 'n');
  }
  setCell(40, 50, sumHol);
  setCell(41, 50, Number((sumHol / 8).toFixed(1)));

  // Ligne 52 (Index 51) : Annual Leave
  setCell(2, 51, 'Annual Leave');
  let sumAnn = 0;
  for (let d = 1; d <= 31; d++) {
    const val = getDayValue(d, 'hours_annual_leave');
    sumAnn += val;
    setCell(START_COL + d - 1, 51, val > 0 ? val : null, 'n');
  }
  setCell(40, 51, sumAnn);
  setCell(41, 51, Number((sumAnn / 8).toFixed(1)));

  // Ligne 53 (Index 52) : Sick Leave
  setCell(2, 52, 'Sick Leave');
  let sumSick = 0;
  for (let d = 1; d <= 31; d++) {
    const val = getDayValue(d, 'hours_sick_leave');
    sumSick += val;
    setCell(START_COL + d - 1, 52, val > 0 ? val : null, 'n');
  }
  setCell(40, 52, sumSick);
  setCell(41, 52, Number((sumSick / 8).toFixed(1)));

  // Ligne 54 (Index 53) : Other Leave
  setCell(2, 53, 'Other Leave (describe below)*');
  let sumOth = 0;
  for (let d = 1; d <= 31; d++) {
    const val = getDayValue(d, 'hours_other_leave');
    sumOth += val;
    setCell(START_COL + d - 1, 53, val > 0 ? val : null, 'n');
  }
  setCell(40, 53, sumOth);
  setCell(41, 53, Number((sumOth / 8).toFixed(1)));

  // Ligne 55 (Index 54) : Subtotal Billable Hours
  setCell(2, 54, 'Subtotal Billable Hours');
  let sumBillable = 0;
  for (let d = 1; d <= 31; d++) {
    const dailyTotal = getDayValue(d, 'hours_b09') + getDayValue(d, 'hours_b13') +
      getDayValue(d, 'hours_holiday') + getDayValue(d, 'hours_annual_leave') +
      getDayValue(d, 'hours_sick_leave') + getDayValue(d, 'hours_other_leave');
    sumBillable += dailyTotal;
    setCell(START_COL + d - 1, 54, dailyTotal > 0 ? dailyTotal : null, 'n');
  }
  setCell(40, 54, sumBillable);
  setCell(41, 54, Number((sumBillable / 8).toFixed(1)));

  // Ligne 57 (Index 56) : Unbillable Time Header
  setCell(2, 56, 'Unbillable Time');
  setCell(2, 57, 'Leave Without Pay');
  setCell(2, 59, 'Subtotal, Unbillable Time');

  // Ligne 62 (Index 61) : Grand Total
  setCell(2, 61, 'Grand Total');
  for (let d = 1; d <= 31; d++) {
    const dailyTotal = getDayValue(d, 'total_hours');
    setCell(START_COL + d - 1, 61, dailyTotal > 0 ? dailyTotal : null, 'n');
  }
  setCell(40, 61, sumBillable);
  setCell(41, 61, Number((sumBillable / 8).toFixed(1)));

  // Ligne 63 (Index 62) : Notes
  setCell(2, 62, '*Notes:');
  const holidayNotes = days
    .filter(d => (d.hours_holiday > 0 || d.note) && d.type === 'HOLIDAY')
    .map(d => `${d.day} ${monthNameFr} : ${d.note || 'Jour Férié'}`);

  if (holidayNotes.length > 0) {
    holidayNotes.forEach((note, idx) => {
      setCell(2, 63 + idx, note);
    });
  } else {
    setCell(2, 63, 'Aucun jour férié particulier sur cette période.');
  }

  // Lignes 69 à 74 : Soldes de congés & Signatures
  const SIGN_ROW = 68;
  setCell(2, SIGN_ROW, 'Annual Leave Balance');
  setCell(10, SIGN_ROW, 'BY SIGNING BELOW, I CERTIFY THE HOURS SUBMITTED FOR THIS PAY PERIOD ARE ACCURATE AND TRUTHFUL');
  setCell(39, SIGN_ROW, 'Sick Leave Balance');

  setCell(2, SIGN_ROW + 1, 'Leave Balance:');
  setCell(6, SIGN_ROW + 1, 8);
  setCell(10, SIGN_ROW + 1, expert?.full_name || 'IMOROU T. ARAFATH');
  setCell(26, SIGN_ROW + 1, effectiveSupervisor);
  setCell(39, SIGN_ROW + 1, 'Leave Balance:');
  setCell(42, SIGN_ROW + 1, 0);

  setCell(2, SIGN_ROW + 2, 'Used This Period:');
  setCell(6, SIGN_ROW + 2, Number((sumAnn / 8).toFixed(1)));
  setCell(10, SIGN_ROW + 2, 'Print Employee Name');
  setCell(26, SIGN_ROW + 2, 'Print Supervisor Name');
  setCell(39, SIGN_ROW + 2, 'Used This Period:');
  setCell(42, SIGN_ROW + 2, Number((sumSick / 8).toFixed(1)));

  setCell(2, SIGN_ROW + 3, 'Remaining Days:');
  setCell(6, SIGN_ROW + 3, Math.max(0, 8 - Number((sumAnn / 8).toFixed(1))));
  setCell(39, SIGN_ROW + 3, 'Remaining Days:');
  setCell(42, SIGN_ROW + 3, 0);

  setCell(10, SIGN_ROW + 5, 'Employee Signature & Date');
  setCell(26, SIGN_ROW + 5, 'Supervisor Signature & Date');

  // Définir la plage de la feuille
  ws['!ref'] = `A1:AS${SIGN_ROW + 8}`;

  // Largeurs de colonnes ajustées
  const cols = [];
  for (let c = 0; c <= 45; c++) {
    if (c === 2) cols.push({ wch: 45 }); // Description
    else if (c >= START_COL && c <= START_COL + 30) cols.push({ wch: 4.5 }); // Jours 1..31
    else if (c === 40 || c === 41) cols.push({ wch: 8 }); // Work Hours / Days
    else cols.push({ wch: 10 });
  }
  ws['!cols'] = cols;

  // Création du classeur Excel
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Technical Timesheet');

  // Feuille 2 : Synthèse Détaillée
  const detailedData = days.map(d => ({
    'Jour': d.day,
    'Date': d.date,
    'Jour de la semaine': d.day_of_week,
    'Statut': d.is_weekend ? 'Week-end' : (d.type === 'HOLIDAY' ? 'Jour Férié' : d.type === 'ANNUAL_LEAVE' ? 'Congé Annuel' : d.type === 'SICK_LEAVE' ? 'Congé Maladie' : 'Travail'),
    'Heures B09': d.hours_b09,
    'Heures B13': d.hours_b13,
    'Heures Férié': d.hours_holiday,
    'Heures Congé': d.hours_annual_leave + d.hours_sick_leave + d.hours_other_leave,
    'Total Heures (max 8h)': d.total_hours,
    'Observations / Livrables': d.note || '',
  }));

  const ws2 = XLSX.utils.json_to_sheet(detailedData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Synthèse Détaillée');

  const fileName = `Timesheet_${monthNameFr}_${year}_${(expert?.full_name || 'Expert').replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * EXPORT PDF OFFICIEL — FORMAT PAYSAGE A4 CONFORME À L'EXEMPLAIRE
 */
export function exportTechnicalTimesheetToPdf(
  timesheet: MonthlyTimesheet,
  expert?: User,
  supervisorName?: string,
  users?: User[]
) {
  const approver = getTimesheetApprover(timesheet.expert_id, users);
  const effectiveSupervisor = supervisorName || timesheet.validated_by || approver.name;

  const monthIdx = timesheet.period_month - 1;
  const monthNameFr = MONTH_NAMES_FR[monthIdx] || timesheet.month_name;
  const year = timesheet.period_year;
  const daysInMonth = getDaysInMonth(year, timesheet.period_month);

  const days: TimesheetDayRecord[] = timesheet.daily_records && timesheet.daily_records.length > 0
    ? timesheet.daily_records
    : generateInitialMonthDays(year, timesheet.period_month);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header bandeau supérieur
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 297, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SANINOVA GLOBAL CONSULTING — FICHE DE TEMPS OFFICIELLE (MONTHLY TIMESHEET)', 14, 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`PROJET AFGHS-PSI BÉNIN | PÉRIODE : ${monthNameFr.toUpperCase()} ${year} | STATUT : ${timesheet.status.replace('_', ' ')}`, 14, 15);

  // Cartouche d'informations
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.text(`Employé : ${expert?.full_name || 'Non assigné'}`, 14, 25);
  doc.text(`Poste : ${expert?.title || 'Expert Technique'}`, 14, 29);
  doc.text(`Lieu principal : ${expert?.base_location || 'Cotonou'}`, 14, 33);

  const totalB09 = days.reduce((s, d) => s + d.hours_b09, 0);
  const totalB13 = days.reduce((s, d) => s + d.hours_b13, 0);
  const totalHol = days.reduce((s, d) => s + d.hours_holiday, 0);
  const totalLeave = days.reduce((s, d) => s + (d.hours_annual_leave + d.hours_sick_leave + d.hours_other_leave), 0);
  const grandTotal = totalB09 + totalB13 + totalHol + totalLeave;

  doc.text(`Total Heures : ${grandTotal} h (${(grandTotal / 8).toFixed(1)} jours)`, 180, 25);
  doc.text(`Ventilation : B09 = ${totalB09}h | B13 = ${totalB13}h | Fériés = ${totalHol}h | Congés = ${totalLeave}h`, 180, 29);
  doc.text(`Superviseur : ${effectiveSupervisor}`, 180, 33);

  // Construction de la grille matricielle (31 jours)
  const headers = ['Composante / Activité', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'Total H', 'Total J'];

  const makeRow = (label: string, field: keyof TimesheetDayRecord) => {
    let sum = 0;
    const values = Array.from({ length: 31 }, (_, i) => {
      const dayNum = i + 1;
      if (dayNum > daysInMonth) return '-';
      const rec = days.find(x => x.day === dayNum);
      const val = rec ? (typeof rec[field] === 'number' ? (rec[field] as number) : 0) : 0;
      sum += val;
      return val > 0 ? String(val) : '';
    });
    return [label, ...values, `${sum}`, `${(sum / 8).toFixed(1)}`];
  };

  const makeSubtotalRow = (label: string) => {
    let sum = 0;
    const values = Array.from({ length: 31 }, (_, i) => {
      const dayNum = i + 1;
      if (dayNum > daysInMonth) return '-';
      const rec = days.find(x => x.day === dayNum);
      const val = rec ? rec.total_hours : 0;
      sum += val;
      return val > 0 ? String(val) : '';
    });
    return [label, ...values, `${sum}`, `${(sum / 8).toFixed(1)}`];
  };

  const rows = [
    makeRow('Milestone B09 : Promptitude eSIGL', 'hours_b09'),
    makeRow('Milestone B13 : Quantification & Appro', 'hours_b13'),
    makeRow('Jours Fériés (Holidays)*', 'hours_holiday'),
    makeRow('Congés Annuels (Annual Leave)', 'hours_annual_leave'),
    makeRow('Congés Maladie (Sick Leave)', 'hours_sick_leave'),
    makeRow('Autres Congés (Other Leave)', 'hours_other_leave'),
    makeSubtotalRow('GRAND TOTAL (Cumul max 8h/j)'),
  ];

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 37,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6,
      halign: 'center',
    },
    styles: {
      fontSize: 6,
      cellPadding: 1.2,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left', fontStyle: 'bold' },
      32: { cellWidth: 12, fontStyle: 'bold', fillColor: [241, 245, 249] },
      33: { cellWidth: 12, fontStyle: 'bold', fillColor: [241, 245, 249] },
    },
    margin: { left: 10, right: 10 },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 140;

  // Notes section
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('* Notes & Jours fériés du mois :', 10, finalY);

  doc.setFont('helvetica', 'normal');
  const holidayNotes = days
    .filter(d => (d.hours_holiday > 0 || d.note) && d.type === 'HOLIDAY')
    .map(d => `${d.day} ${monthNameFr} : ${d.note || 'Jour Férié'}`);

  const notesText = holidayNotes.length > 0
    ? holidayNotes.join('  •  ')
    : 'Aucun jour férié particulier sur cette période.';
  doc.text(notesText, 55, finalY);

  // Bloc de signatures (Certification, Employé, S&E, Direction)
  const signY = finalY + 8;
  doc.rect(10, signY, 88, 30);
  doc.setFont('helvetica', 'bold');
  doc.text('Signature de l’Employé :', 12, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(expert?.full_name || '', 12, signY + 11);
  doc.text(`Date : ${timesheet.submission_date || 'Non soumis'}`, 12, signY + 16);
  doc.setFontSize(6);
  doc.text('"Je certifie sincère et conforme le temps déclaré"', 12, signY + 22);

  doc.rect(104, signY, 88, 30);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Visa Suivi & Évaluation (S&E) :', 106, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(timesheet.verified_by || 'En attente de visa', 106, signY + 11);
  doc.text(`Date : ${timesheet.verification_date || '-'}`, 106, signY + 16);
  doc.setFontSize(6);
  doc.text(timesheet.verified_by ? 'Statut : Conforme et vérifié' : 'Statut : Non vérifié', 106, signY + 22);

  doc.rect(198, signY, 89, 30);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Approbation Superviseur / Direction :', 200, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(timesheet.validated_by || effectiveSupervisor, 200, signY + 11);
  doc.text(`Date : ${timesheet.validation_date || '-'}`, 200, signY + 16);
  doc.setFontSize(6);
  doc.text(timesheet.validated_by ? 'Statut : BON POUR PAIEMENT & AUDIT' : 'Statut : En attente d’approbation', 200, signY + 22);

  // Pied de page
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — SaniNova Project Hub | Projet AFGHS-PSI Bénin`, 10, 202);

  const fileName = `Timesheet_${monthNameFr}_${year}_${(expert?.full_name || 'Expert').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
