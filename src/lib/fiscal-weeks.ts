/**
 * Configuration Officielle de l'Année Fiscale FY2026-2027
 * Période : 1er Octobre 2026 au 30 Septembre 2027 (53 semaines)
 * Projet AFGHS / SaniNova - PSI Bénin
 */

export interface FiscalWeek {
  num: number;
  fiscalWeek: number;
  calWeek: number;
  label: string;
  start: string;
  end: string;
  quarter: 'T1' | 'T2' | 'T3' | 'T4';
  isCurrent: boolean;
}

export const FISCAL_YEAR = {
  label: 'Année Fiscale 2026 - 2027',
  fullLabel: 'Année Fiscale (01 Octobre 2026 – 30 Septembre 2027)',
  shortLabel: 'FY2026-2027',
  start: '2026-10-01',
  end: '2027-09-30',
};

export const CURRENT_FISCAL_WEEK_NUM = 6; // Semaine 06 (02 Nov - 08 Nov 2026)

export const FISCAL_QUARTERS = [
  { id: 'ALL', label: 'Toutes les semaines (FY27)' },
  { id: 'T1', label: 'T1 : Octobre – Décembre 2026 (S01 - S14)' },
  { id: 'T2', label: 'T2 : Janvier – Mars 2027 (S15 - S26)' },
  { id: 'T3', label: 'T3 : Avril – Juin 2027 (S27 - S39)' },
  { id: 'T4', label: 'T4 : Juillet – Septembre 2027 (S40 - S53)' },
] as const;

export const FISCAL_MONTHS = [
  { id: 'ALL', label: 'Tous les mois (FY27)', shortLabel: 'Tous les mois', quarter: 'ALL' },
  { id: '2026-10', label: 'Octobre 2026', shortLabel: 'Oct 2026', quarter: 'T1' },
  { id: '2026-11', label: 'Novembre 2026 (En cours)', shortLabel: 'Nov 2026', quarter: 'T1', isCurrent: true },
  { id: '2026-12', label: 'Décembre 2026', shortLabel: 'Déc 2026', quarter: 'T1' },
  { id: '2027-01', label: 'Janvier 2027', shortLabel: 'Jan 2027', quarter: 'T2' },
  { id: '2027-02', label: 'Février 2027', shortLabel: 'Fév 2027', quarter: 'T2' },
  { id: '2027-03', label: 'Mars 2027', shortLabel: 'Mar 2027', quarter: 'T2' },
  { id: '2027-04', label: 'Avril 2027', shortLabel: 'Avr 2027', quarter: 'T3' },
  { id: '2027-05', label: 'Mai 2027', shortLabel: 'Mai 2027', quarter: 'T3' },
  { id: '2027-06', label: 'Juin 2027', shortLabel: 'Juin 2027', quarter: 'T3' },
  { id: '2027-07', label: 'Juillet 2027', shortLabel: 'Juil 2027', quarter: 'T4' },
  { id: '2027-08', label: 'Août 2027', shortLabel: 'Août 2027', quarter: 'T4' },
  { id: '2027-09', label: 'Septembre 2027', shortLabel: 'Sept 2027', quarter: 'T4' },
] as const;

export function weekMatchesMonth(w: FiscalWeek, monthId: string): boolean {
  if (monthId === 'ALL') return true;
  return w.start.startsWith(monthId) || w.end.startsWith(monthId);
}

export function getMonthLabel(monthId: string): string {
  const m = FISCAL_MONTHS.find(x => x.id === monthId);
  return m ? m.label : monthId;
}

export const FISCAL_WEEKS_LIST: FiscalWeek[] = [
  // TRIMESTRE 1 : OCTOBRE - DÉCEMBRE 2026 (S01 à S14)
  {
    num: 1,
    fiscalWeek: 1,
    calWeek: 40,
    label: 'Semaine 01 (01 Oct - 04 Oct 2026)',
    start: '2026-10-01',
    end: '2026-10-04',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 2,
    fiscalWeek: 2,
    calWeek: 41,
    label: 'Semaine 02 (05 Oct - 11 Oct 2026)',
    start: '2026-10-05',
    end: '2026-10-11',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 3,
    fiscalWeek: 3,
    calWeek: 42,
    label: 'Semaine 03 (12 Oct - 18 Oct 2026)',
    start: '2026-10-12',
    end: '2026-10-18',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 4,
    fiscalWeek: 4,
    calWeek: 43,
    label: 'Semaine 04 (19 Oct - 25 Oct 2026)',
    start: '2026-10-19',
    end: '2026-10-25',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 5,
    fiscalWeek: 5,
    calWeek: 44,
    label: 'Semaine 05 (26 Oct - 01 Nov 2026)',
    start: '2026-10-26',
    end: '2026-11-01',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 6,
    fiscalWeek: 6,
    calWeek: 45,
    label: 'Semaine 06 (02 Nov - 08 Nov 2026)',
    start: '2026-11-02',
    end: '2026-11-08',
    quarter: 'T1',
    isCurrent: true,
  },
  {
    num: 7,
    fiscalWeek: 7,
    calWeek: 46,
    label: 'Semaine 07 (09 Nov - 15 Nov 2026)',
    start: '2026-11-09',
    end: '2026-11-15',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 8,
    fiscalWeek: 8,
    calWeek: 47,
    label: 'Semaine 08 (16 Nov - 22 Nov 2026)',
    start: '2026-11-16',
    end: '2026-11-22',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 9,
    fiscalWeek: 9,
    calWeek: 48,
    label: 'Semaine 09 (23 Nov - 29 Nov 2026)',
    start: '2026-11-23',
    end: '2026-11-29',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 10,
    fiscalWeek: 10,
    calWeek: 49,
    label: 'Semaine 10 (30 Nov - 06 Déc 2026)',
    start: '2026-11-30',
    end: '2026-12-06',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 11,
    fiscalWeek: 11,
    calWeek: 50,
    label: 'Semaine 11 (07 Déc - 13 Déc 2026)',
    start: '2026-12-07',
    end: '2026-12-13',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 12,
    fiscalWeek: 12,
    calWeek: 51,
    label: 'Semaine 12 (14 Déc - 20 Déc 2026)',
    start: '2026-12-14',
    end: '2026-12-20',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 13,
    fiscalWeek: 13,
    calWeek: 52,
    label: 'Semaine 13 (21 Déc - 27 Déc 2026)',
    start: '2026-12-21',
    end: '2026-12-27',
    quarter: 'T1',
    isCurrent: false,
  },
  {
    num: 14,
    fiscalWeek: 14,
    calWeek: 1,
    label: 'Semaine 14 (28 Déc 2026 - 03 Jan 2027)',
    start: '2026-12-28',
    end: '2027-01-03',
    quarter: 'T1',
    isCurrent: false,
  },

  // TRIMESTRE 2 : JANVIER - MARS 2027 (S15 à S26)
  {
    num: 15,
    fiscalWeek: 15,
    calWeek: 2,
    label: 'Semaine 15 (04 Jan - 10 Jan 2027)',
    start: '2027-01-04',
    end: '2027-01-10',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 16,
    fiscalWeek: 16,
    calWeek: 3,
    label: 'Semaine 16 (11 Jan - 17 Jan 2027)',
    start: '2027-01-11',
    end: '2027-01-17',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 17,
    fiscalWeek: 17,
    calWeek: 4,
    label: 'Semaine 17 (18 Jan - 24 Jan 2027)',
    start: '2027-01-18',
    end: '2027-01-24',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 18,
    fiscalWeek: 18,
    calWeek: 5,
    label: 'Semaine 18 (25 Jan - 31 Jan 2027)',
    start: '2027-01-25',
    end: '2027-01-31',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 19,
    fiscalWeek: 19,
    calWeek: 6,
    label: 'Semaine 19 (01 Fév - 07 Fév 2027)',
    start: '2027-02-01',
    end: '2027-02-07',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 20,
    fiscalWeek: 20,
    calWeek: 7,
    label: 'Semaine 20 (08 Fév - 14 Fév 2027)',
    start: '2027-02-08',
    end: '2027-02-14',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 21,
    fiscalWeek: 21,
    calWeek: 8,
    label: 'Semaine 21 (15 Fév - 21 Fév 2027)',
    start: '2027-02-15',
    end: '2027-02-21',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 22,
    fiscalWeek: 22,
    calWeek: 9,
    label: 'Semaine 22 (22 Fév - 28 Fév 2027)',
    start: '2027-02-22',
    end: '2027-02-28',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 23,
    fiscalWeek: 23,
    calWeek: 10,
    label: 'Semaine 23 (01 Mar - 07 Mar 2027)',
    start: '2027-03-01',
    end: '2027-03-07',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 24,
    fiscalWeek: 24,
    calWeek: 11,
    label: 'Semaine 24 (08 Mar - 14 Mar 2027)',
    start: '2027-03-08',
    end: '2027-03-14',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 25,
    fiscalWeek: 25,
    calWeek: 12,
    label: 'Semaine 25 (15 Mar - 21 Mar 2027)',
    start: '2027-03-15',
    end: '2027-03-21',
    quarter: 'T2',
    isCurrent: false,
  },
  {
    num: 26,
    fiscalWeek: 26,
    calWeek: 13,
    label: 'Semaine 26 (22 Mar - 28 Mar 2027)',
    start: '2027-03-22',
    end: '2027-03-28',
    quarter: 'T2',
    isCurrent: false,
  },

  // TRIMESTRE 3 : AVRIL - JUIN 2027 (S27 à S39)
  {
    num: 27,
    fiscalWeek: 27,
    calWeek: 14,
    label: 'Semaine 27 (29 Mar - 04 Avr 2027)',
    start: '2027-03-29',
    end: '2027-04-04',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 28,
    fiscalWeek: 28,
    calWeek: 15,
    label: 'Semaine 28 (05 Avr - 11 Avr 2027)',
    start: '2027-04-05',
    end: '2027-04-11',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 29,
    fiscalWeek: 29,
    calWeek: 16,
    label: 'Semaine 29 (12 Avr - 18 Avr 2027)',
    start: '2027-04-12',
    end: '2027-04-18',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 30,
    fiscalWeek: 30,
    calWeek: 17,
    label: 'Semaine 30 (19 Avr - 25 Avr 2027)',
    start: '2027-04-19',
    end: '2027-04-25',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 31,
    fiscalWeek: 31,
    calWeek: 18,
    label: 'Semaine 31 (26 Avr - 02 Mai 2027)',
    start: '2027-04-26',
    end: '2027-05-02',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 32,
    fiscalWeek: 32,
    calWeek: 19,
    label: 'Semaine 32 (03 Mai - 09 Mai 2027)',
    start: '2027-05-03',
    end: '2027-05-09',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 33,
    fiscalWeek: 33,
    calWeek: 20,
    label: 'Semaine 33 (10 Mai - 16 Mai 2027)',
    start: '2027-05-10',
    end: '2027-05-16',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 34,
    fiscalWeek: 34,
    calWeek: 21,
    label: 'Semaine 34 (17 Mai - 23 Mai 2027)',
    start: '2027-05-17',
    end: '2027-05-23',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 35,
    fiscalWeek: 35,
    calWeek: 22,
    label: 'Semaine 35 (24 Mai - 30 Mai 2027)',
    start: '2027-05-24',
    end: '2027-05-30',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 36,
    fiscalWeek: 36,
    calWeek: 23,
    label: 'Semaine 36 (31 Mai - 06 Juin 2027)',
    start: '2027-05-31',
    end: '2027-06-06',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 37,
    fiscalWeek: 37,
    calWeek: 24,
    label: 'Semaine 37 (07 Juin - 13 Juin 2027)',
    start: '2027-06-07',
    end: '2027-06-13',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 38,
    fiscalWeek: 38,
    calWeek: 25,
    label: 'Semaine 38 (14 Juin - 20 Juin 2027)',
    start: '2027-06-14',
    end: '2027-06-20',
    quarter: 'T3',
    isCurrent: false,
  },
  {
    num: 39,
    fiscalWeek: 39,
    calWeek: 26,
    label: 'Semaine 39 (21 Juin - 27 Juin 2027)',
    start: '2027-06-21',
    end: '2027-06-27',
    quarter: 'T3',
    isCurrent: false,
  },

  // TRIMESTRE 4 : JUILLET - SEPTEMBRE 2027 (S40 à S53)
  {
    num: 40,
    fiscalWeek: 40,
    calWeek: 27,
    label: 'Semaine 40 (28 Juin - 04 Juil 2027)',
    start: '2027-06-28',
    end: '2027-07-04',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 41,
    fiscalWeek: 41,
    calWeek: 28,
    label: 'Semaine 41 (05 Juil - 11 Juil 2027)',
    start: '2027-07-05',
    end: '2027-07-11',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 42,
    fiscalWeek: 42,
    calWeek: 29,
    label: 'Semaine 42 (12 Juil - 18 Juil 2027)',
    start: '2027-07-12',
    end: '2027-07-18',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 43,
    fiscalWeek: 43,
    calWeek: 30,
    label: 'Semaine 43 (19 Juil - 25 Juil 2027)',
    start: '2027-07-19',
    end: '2027-07-25',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 44,
    fiscalWeek: 44,
    calWeek: 31,
    label: 'Semaine 44 (26 Juil - 01 Août 2027)',
    start: '2027-07-26',
    end: '2027-08-01',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 45,
    fiscalWeek: 45,
    calWeek: 32,
    label: 'Semaine 45 (02 Août - 08 Août 2027)',
    start: '2027-08-02',
    end: '2027-08-08',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 46,
    fiscalWeek: 46,
    calWeek: 33,
    label: 'Semaine 46 (09 Août - 15 Août 2027)',
    start: '2027-08-09',
    end: '2027-08-15',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 47,
    fiscalWeek: 47,
    calWeek: 34,
    label: 'Semaine 47 (16 Août - 22 Août 2027)',
    start: '2027-08-16',
    end: '2027-08-22',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 48,
    fiscalWeek: 48,
    calWeek: 35,
    label: 'Semaine 48 (23 Août - 29 Août 2027)',
    start: '2027-08-23',
    end: '2027-08-29',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 49,
    fiscalWeek: 49,
    calWeek: 36,
    label: 'Semaine 49 (30 Août - 05 Sept 2027)',
    start: '2027-08-30',
    end: '2027-09-05',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 50,
    fiscalWeek: 50,
    calWeek: 37,
    label: 'Semaine 50 (06 Sept - 12 Sept 2027)',
    start: '2027-09-06',
    end: '2027-09-12',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 51,
    fiscalWeek: 51,
    calWeek: 38,
    label: 'Semaine 51 (13 Sept - 19 Sept 2027)',
    start: '2027-09-13',
    end: '2027-09-19',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 52,
    fiscalWeek: 52,
    calWeek: 39,
    label: 'Semaine 52 (20 Sept - 26 Sept 2027)',
    start: '2027-09-20',
    end: '2027-09-26',
    quarter: 'T4',
    isCurrent: false,
  },
  {
    num: 53,
    fiscalWeek: 53,
    calWeek: 39,
    label: 'Semaine 53 (27 Sept - 30 Sept 2027)',
    start: '2027-09-27',
    end: '2027-09-30',
    quarter: 'T4',
    isCurrent: false,
  },
];

/**
 * Normalise un numéro de semaine vers le calendrier fiscal FY27.
 * Prend en charge la compatibilité avec les anciens numéros de semaine (44..49 -> 5..10)
 */
export function normalizeWeekNumber(weekNum: number): number {
  if (weekNum === 44) return 5;
  if (weekNum === 45) return 6;
  if (weekNum === 46) return 7;
  if (weekNum === 47) return 8;
  if (weekNum === 48) return 9;
  if (weekNum === 49) return 10;
  return weekNum;
}

/**
 * Récupère les métadonnées d'une semaine fiscale par son numéro (ou son alias historique).
 */
export function getFiscalWeek(weekNum: number): FiscalWeek {
  const normalized = normalizeWeekNumber(weekNum);
  const found = FISCAL_WEEKS_LIST.find(w => w.num === normalized);
  return found || FISCAL_WEEKS_LIST[5]; // Par défaut Semaine 06 (en cours)
}

/**
 * Vérifie si une activité correspond à la semaine fiscale sélectionnée
 */
export function matchesFiscalWeek(activityWeekNumber: number, selectedWeekNum: number): boolean {
  if (activityWeekNumber === selectedWeekNum) return true;
  return normalizeWeekNumber(activityWeekNumber) === selectedWeekNum;
}
