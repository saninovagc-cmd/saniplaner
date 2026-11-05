export type UserRole = 
  | 'direction'
  | 'senior_advisor'
  | 'sis_specialist'
  | 'fasp_specialist'
  | 'se_specialist'
  | 'rsco'
  | 'finance';

export type MilestoneType = 'B09' | 'B13' | 'TRANSVERSAL';

export type ActivityStatus = 'A_VENIR' | 'EN_COURS' | 'TERMINEE' | 'EN_RETARD' | 'SUSPENDUE';

export type MissionStatus = 
  | 'BROUILLON' 
  | 'SOUMISE' 
  | 'VALIDEE' 
  | 'EN_COURS' 
  | 'REALISEE' 
  | 'RAPPORT_A_PRODUIRE' 
  | 'CLOTUREE';

export type DeliverableStatus = 
  | 'PREPARATION' 
  | 'SOUMISSION_INTERNE' 
  | 'VERIFICATION' 
  | 'VALIDATION_DIRECTION' 
  | 'TRANSMISSION_PSI' 
  | 'ARCHIVE';

export type AppModuleId = 
  | 'dashboard'
  | 'work_plan'
  | 'planning_hebdo'
  | 'timesheets'
  | 'budget'
  | 'b09'
  | 'b13'
  | 'missions'
  | 'formations'
  | 'seances'
  | 'livrables'
  | 'documentation'
  | 'rapports'
  | 'administration';

export const ALL_MODULES: { id: AppModuleId; label: string; href: string; num: string }[] = [
  { id: 'dashboard', label: 'Tableau de Bord', href: '/', num: '01' },
  { id: 'work_plan', label: 'Work Plan', href: '/work-plan', num: '02' },
  { id: 'planning_hebdo', label: 'Planning Hebdo', href: '/planning-hebdo', num: '03' },
  { id: 'timesheets', label: 'Timesheets Mensuels', href: '/timesheets', num: '04' },
  { id: 'budget', label: 'Budget & Finances PSI', href: '/budget', num: '05' },
  { id: 'b09', label: 'Suivi B09 (eSIGL)', href: '/b09', num: '06' },
  { id: 'b13', label: 'Suivi B13 (Quantif)', href: '/b13', num: '07' },
  { id: 'missions', label: 'Missions de Terrain', href: '/missions', num: '08' },
  { id: 'formations', label: 'Formations', href: '/formations', num: '09' },
  { id: 'seances', label: 'Séances & Réunions', href: '/seances', num: '10' },
  { id: 'livrables', label: 'Livrables PSI', href: '/livrables', num: '11' },
  { id: 'documentation', label: 'Documentation & GED', href: '/documentation', num: '12' },
  { id: 'rapports', label: 'Rapports & Exports', href: '/rapports', num: '13' },
  { id: 'administration', label: 'Administration', href: '/administration', num: '14' },
];

export interface UserProfile {
  id: string;
  username?: string;
  password?: string;
  is_first_login?: boolean;
  allowed_modules?: string[];
  email: string;
  full_name: string;
  role: UserRole;
  title: string;
  phone?: string;
  assigned_departments: string[];
  assigned_zones?: string[];
  base_location?: string;
  avatar_url?: string;
  is_active: boolean;
  hourly_rate?: number;
  daily_rate?: number;
  loe_b09?: number;
  loe_b13?: number;
  loe_total?: number;
  total_fees_fcfa?: number;
}

export type User = UserProfile;

export interface GeographicZone {
  id: string;
  department: string;
  zone_name: string;
  is_primary_b09_b13: boolean;
  assigned_rsco_id?: string;
  assigned_rsco_name?: string;
}

export interface ProjectRisk {
  id: string;
  code: string;
  description: string;
  milestones_affected: string;
  likelihood_impact: 'M / H' | 'H / M' | 'L / M' | string;
  mitigation: string;
  owner_name: string;
  owner_role: string;
  status: 'SOUS_CONTROLE' | 'VIGILANCE' | 'ACTION_REQUISE';
}

export interface WorkPlanActivity {
  id: string;
  code: string;
  milestone: MilestoneType;
  domain: string;
  title: string;
  description: string;
  methodology: string;
  lead_expert_id: string;
  collaborators_ids: string[];
  external_participants?: string[];
  associated_partners: string[];
  geographic_zone: string;
  start_date: string;
  end_date: string;
  deadline: string;
  expected_result: string;
  status: ActivityStatus;
  progress_pct: number;
  priority: 'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
  observations?: string;
  budget_a_fcfa?: number;
  budget_b_fcfa?: number;
  budget_total_fcfa?: number;
  loe_days?: number;
  active_months?: string[];
}

export interface BudgetSummaryCategory {
  rubrique: string;
  code: string;
  pct_total: number;
  b09_fcfa: number;
  b13_fcfa: number;
  total_fcfa: number;
}

export type ExpensePaymentMethod = 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';
export type ExpenseStatus = 'ENGAGE' | 'PAYE' | 'JUSTIFIE' | 'CLOTURE';
export type BudgetRubriqueCode = 'I' | 'IV' | 'VI' | 'VII' | 'VIII';

export interface BudgetExpenditure {
  id: string;
  expense_code: string; // Ex: "DEP-2026-001"
  date: string; // "2026-10-25"
  quarter: 'T1' | 'T2' | 'T3' | 'T4';
  period_month: number; // 1-12
  category_code: BudgetRubriqueCode; // 'I', 'IV', 'VI', 'VII', 'VIII'
  category_name: string; // Libellé de la rubrique budgétaire
  milestone: 'B09' | 'B13' | 'TRANSVERSAL';
  activity_id?: string; // id de l'activité du Work Plan (ex: 'act-b09-1')
  activity_code?: string; // Code d'activité (ex: 'B09.1')
  description: string; // Libellé de la dépense
  amount_fcfa: number; // Montant en FCFA
  beneficiary: string; // Fournisseur, prestataire, membre d'équipe
  invoice_ref?: string; // N° de facture / reçu / pièce
  payment_method: ExpensePaymentMethod;
  receipt_file_name?: string; // Nom du justificatif chargé
  receipt_file_url?: string;
  status: ExpenseStatus;
  recorded_by_id?: string;
  recorded_by_name: string; // Nom de la personne ayant saisi (ex: "Afia Sandrine KOUSSAHOUE")
  created_at: string;
  notes?: string;
}

export interface QuarterlyBudget {
  quarter: 'T1' | 'T2' | 'T3' | 'T4';
  period_label: string;
  b09_fees: number;
  b09_activities: number;
  b09_total: number;
  b13_fees: number;
  b13_activities: number;
  b13_total: number;
  total_quarter: number;
  psi_payment_due: number;
}

export interface PaymentMilestoneSchedule {
  id: string;
  milestone: 'B09' | 'B13';
  milestone_title: string;
  frequency: 'Trimestrielle' | 'Semestrielle (T2 & T4)';
  quarter: 'T1' | 'T2' | 'T3' | 'T4';
  submission_deadline: string;
  max_payment_fcfa: number;
  max_payment_usd?: number;
  status: 'A_VENIR' | 'EN_COURS' | 'VALIDE_PAYE' | 'RETARD';
  evidence_required: string;
}

export interface GHSDPerformanceTier {
  milestone: 'B09' | 'B13';
  level: 'Excellent' | 'Satisfaisant' | 'Minimal' | 'Insatisfaisant';
  threshold_condition: string;
  payment_pct: number;
  annual_payout_fcfa: number;
  direct_costs_fcfa: number;
  variance_fcfa: number;
}

export interface B09UpdateHistoryEntry {
  id: string;
  timestamp: string; // "05/11/2026 à 18:30"
  submitted_on_time: number;
  rate: number;
  updated_by_id: string;
  updated_by_name: string;
  passage_number: number;
  notes?: string;
}

export interface B09MonthlyMetric {
  id: string;
  period_month: number;
  period_year: number;
  department: string;
  zone_name: string;
  expected_reports: number; // Chiffre attendu fixe contractuel (FOSA cibles)
  submitted_on_time: number;
  submitted_late: number;
  missing_reports: number;
  promptitude_rate: number; // calculated % (submitted_on_time / expected_reports * 100)
  target_met: boolean; // >= 70%
  deadline_date: string; // 20th of following month (20 à 00h00)
  reminders_sent: number;
  rsco_id?: string;
  rsco_name?: string;
  main_constraints?: string;
  corrective_actions?: string;
  evidence_status?: 'NON_VERIFIE' | 'CONFORME_ESIGL' | 'EN_ATTENTE_PREUVE';
  last_updated_at?: string; // Date et heure de dernière actualisation
  last_updated_by?: string; // Nom de la personne ayant actualisé
  update_count?: number; // Nombre de passages / actualisations effectués (1, 2, 3...)
  update_history?: B09UpdateHistoryEntry[]; // Historique de chaque actualisation
  is_locked?: boolean; // Verrouillé le 20 à 00h00
}

export interface B09ReminderRecord {
  id: string;
  period_month: number;
  period_year: number;
  zone_name: string;
  department: string;
  fosa_name: string;
  rsco_id: string;
  rsco_name: string;
  contact_person: string;
  contact_phone?: string;
  reminder_channel: 'TELEPHONE' | 'VISITE_TERRAIN' | 'WHATSAPP' | 'EMAIL' | 'SMS';
  reminder_date: string;
  delay_cause: string;
  outcome: 'TRANSMIS_IMMEDIAT' | 'PROMESSE_24H' | 'APPUI_REQUIS' | 'NON_JOIGNABLE';
  notes?: string;
}

export interface B09QuarterlyDossier {
  quarter: 'T1' | 'T2' | 'T3' | 'T4';
  label: string;
  months: string;
  global_rate: number;
  target_met: boolean;
  status: 'EN_CONSTITUTION' | 'VERIFIE_INTERNE' | 'SOUMIS_PSI' | 'VALIDE_GOR';
  payout_status: 'EN_ATTENTE' | 'DECLENCHE' | 'ENCAISSE';
  amount_fcfa: number;
  evidence_checklist: {
    esigl_raw_extract: boolean;
    compiled_rates_sheet: boolean;
    rsco_call_logs: boolean;
    supervision_reports: boolean;
    psi_joint_minutes: boolean;
    payment_request_invoice: boolean;
  };
  validation_date?: string;
  notes?: string;
}

export interface B13Item {
  id: string;
  category: 'ILP_VALIDATION' | 'QUANTIFICATION' | 'SUPPLY_PLAN' | 'QAT_TRACKING' | 'GTT_MEETING' | 'POA_MANAGEMENT' | 'DISTRIBUTION' | 'CPS_CAMPAIGN';
  title: string;
  semester: 'S1_2026_2027' | 'S2_2026_2027';
  is_predefined_deliverable: boolean;
  lead_expert_id: string;
  execution_date: string;
  status: 'PLANIFIE' | 'EN_COURS' | 'VALIDE' | 'TRANSMIS';
  verification_evidence_url?: string;
  progress_pct: number;
  notes?: string;
  deliverable_code?: string;
  last_updated_at?: string;
  last_updated_by?: string;
}

export interface MissionIOVItem {
  id: string;
  type: 'DOCUMENT' | 'PHOTO';
  title: string;
  description?: string;
  file_name: string;
  file_size_kb?: number;
  uploaded_at: string;
  uploaded_by: string;
  data_url?: string;
  category: 'ORDRE_MISSION' | 'TDR' | 'PRESENCE' | 'PHOTO_TERRAIN' | 'FICHE_SUPERVISION' | 'RAPPORT_SIGNE' | 'AUTRE';
}

export interface MissionRecommendation {
  id: string;
  text: string;
  target_entity: string;
  deadline?: string;
  status: 'OUVERTE' | 'EN_COURS' | 'CLOTUREE';
}

export interface FieldMission {
  id: string;
  code?: string;
  title: string;
  author_id?: string; // User who planned / created the mission
  lead_expert_id: string; // Lead expert executing
  companion_expert_ids: string[];
  external_participants?: string[];
  department: string;
  zone_sanitaire: string;
  departure_date: string;
  return_date: string;
  objectives: string;
  visited_facilities: string[];
  schedule_details?: string;
  expected_results: string;
  // Report details
  mission_report_summary?: string;
  methodology?: string;
  key_findings?: string;
  difficulties_encountered?: string;
  next_steps?: string;
  report_author_id?: string;
  report_author_name?: string;
  report_date?: string;
  report_status?: 'NON_REMPLI' | 'BROUILLON' | 'SOUMIS' | 'VALIDE';
  progress_pct?: number;
  // Recommendations & IOV
  recommendations: MissionRecommendation[];
  iov_items?: MissionIOVItem[];
  photos_count: number;
  status: MissionStatus;
}

export type TrainingFormat = 'PRESENTIEL' | 'EN_LIGNE' | 'HYBRIDE' | 'COACHING_SITE';
export type TrainingStatus = 'PLANIFIEE' | 'EN_COURS' | 'REALISEE' | 'EVALUEE' | 'REPORTEE' | 'ANNULEE';
export type ActorGender = 'M' | 'F';
export type ActorAttendance = 'PRESENT' | 'ABSENT' | 'PARTIEL';
export type ActorEvaluationResult = 'REUSSI' | 'AJOURNE' | 'NON_EVALUE';

export interface TrainedActor {
  id: string;
  full_name: string;
  gender: ActorGender;
  profession: string; // ex: "Gestionnaire de dépôt", "Chef de poste / Infirmier", "Médecin Coordonnateur", "Pharmacien", "Technicien Labo", "Cadre DDS", "RSCO"
  structure_fosa: string; // ex: "CS Kouandé", "CHD Natitingou", "HZ Bassila", "DDS Atacora"
  department: string;
  zone_sanitaire: string;
  phone?: string;
  email?: string;
  attendance_status: ActorAttendance;
  pre_test_score?: number; // Note sur 100
  post_test_score?: number; // Note sur 100
  evaluation_result?: ActorEvaluationResult;
  certificate_issued: boolean;
  notes?: string;
}

export interface TrainingExternalTrainer {
  id: string;
  name: string;
  organization: string; // ex: "DPMED", "SoBAPS", "ANPS", "USAID/PSI", "DDS Atacora"
  role_title: string;
  phone?: string;
  email?: string;
}

export interface TrainingPhoto {
  id: string;
  url: string;
  caption: string;
}

export interface Training {
  id: string;
  code?: string; // ex: "FORM-2026-001"
  topic: string;
  category?: 'ESIGL_REPORTING' | 'QAT_QUANTIFICATION' | 'GESTION_STOCKS' | 'SUPERVISION_COACHING' | 'INTEROPERABILITE' | 'AUTRE';
  milestone: MilestoneType;
  work_plan_code?: string; // liaison avec l'activité du Work Plan (ex: "B09.1", "B13.2")
  activity_id?: string;
  activity_title?: string;
  format: TrainingFormat;
  department: string;
  zone_sanitaire: string;
  location?: string; // Nom de la salle / Lieu physique (Présentiel)
  online_link?: string; // Lien visio Meet / Teams (si en ligne)
  start_date: string; // Date de début
  end_date: string; // Date de fin
  duration_days: number; // Durée en jours
  training_date: string; // Date d'affichage / début (rétro-compatibilité)
  trainer_ids: string[]; // Formateurs internes SaniNova (users)
  external_trainers?: TrainingExternalTrainer[]; // Facilitateurs partenaires (DPMED, SoBAPS, DDS...)
  participants_count: number;
  trained_actors?: TrainedActor[]; // Liste nominative des apprenants formés
  objectives?: string; // Objectifs pédagogiques & compétences visées
  modules_covered?: string; // Modules ou agenda de la formation
  pre_test_avg: number;
  post_test_avg: number;
  passing_rate_pct?: number; // Taux de réussite (ex: 85%)
  budget_allocated_fcfa?: number;
  budget_spent_fcfa?: number;
  financial_partner?: string; // ex: "USAID / PSI Bénin", "Fonds Mondial", "Budget National"
  summary_report?: string; // Synthèse du rapport
  report_file_name?: string; // Nom du fichier rapport PDF
  attendance_sheet_file_name?: string; // Feuille d'émargement signée PDF
  photos?: TrainingPhoto[]; // Clichés justificatifs
  post_training_follow_up?: string; // Recommandations et suivi post-formation
  next_supervision_date?: string; // Prochaine supervision formative
  status: TrainingStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Deliverable {
  id: string;
  code: string;
  title: string;
  milestone: MilestoneType;
  deliverable_type: string;
  lead_expert_id: string;
  due_date: string;
  actual_submission_date?: string;
  recipient: string;
  version: string;
  validation_status: DeliverableStatus;
  verified_by?: string;
  validated_by?: string;
  final_file_name?: string;
  comments?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_type: 'PDF' | 'EXCEL' | 'WORD' | 'IMAGE';
  file_size_kb: number;
  milestone: MilestoneType;
  department?: string;
  uploaded_by: string;
  upload_date: string;
  category: 'PREUVE_VERIFICATION' | 'RAPPORT_MISSION' | 'LISTE_PRESENCE' | 'FICHIER_QAT' | 'FICHE_POA' | 'AUTRE';
}

export interface AuditLogItem {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  module: string;
  entity_ref: string;
  timestamp: string;
}

// ----------------------------------------------------
// 1. PLANNING HEBDOMADAIRE DES ACTIVITES
// ----------------------------------------------------
export type WeeklyActivityStatus = 
  | 'A_VENIR' 
  | 'EN_COURS' 
  | 'REALISE' 
  | 'TERMINEE' 
  | 'NON_REALISE' 
  | 'REPORTE' 
  | 'REPORTEE' 
  | 'ANNULE' 
  | 'BLOQUEE';

export interface WeeklySubmission {
  id: string;
  expert_id: string;
  week_number: number;
  is_submitted: boolean;
  submission_date?: string;
  comments?: string;
}

export interface WeeklyActivity {
  id: string;
  expert_id: string;
  week_number: number;
  week_label: string; // e.g. "Semaine 45 (02 Nov - 08 Nov 2026)"
  start_date: string;
  end_date: string;
  day_of_week: string; // e.g. "Lundi, Mardi" ou "Toute la semaine"
  days?: string[]; // e.g. ['Lundi', 'Mardi']
  title: string;
  milestone: MilestoneType;
  location: string;
  expected_output: string;
  progress_pct: number; // 0 à 100%
  status: WeeklyActivityStatus;
  execution_notes?: string;
  work_plan_code?: string;
  collaborators_ids?: string[];
  external_participants?: string[];
  created_at: string;
}

// ----------------------------------------------------
// 2. TIMESHEETS MENSUELS & VALIDATIONS
// ----------------------------------------------------
export type TimesheetStatus = 
  | 'BROUILLON' 
  | 'SOUMIS' 
  | 'VERIFIE_SE' 
  | 'VALIDE_DIRECTION' 
  | 'REJETE';

export type TimesheetDayType = 
  | 'WORK' 
  | 'HOLIDAY' 
  | 'ANNUAL_LEAVE' 
  | 'SICK_LEAVE' 
  | 'OTHER_LEAVE' 
  | 'OFF';

export interface TimesheetDayRecord {
  day: number; // 1 à 31
  date: string; // YYYY-MM-DD
  day_of_week: string; // 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'
  is_weekend: boolean;
  type: TimesheetDayType;
  hours_b09: number; // Heures consacrées au Jalon B09 (0 à 8)
  hours_b13: number; // Heures consacrées au Jalon B13 (0 à 8)
  hours_holiday: number; // Heures Jour Férié (0 ou 8)
  hours_annual_leave: number; // Heures Congé Annuel (0 ou 8)
  hours_sick_leave: number; // Heures Congé Maladie (0 ou 8)
  hours_other_leave: number; // Heures Autre Congé (0 ou 8)
  total_hours: number; // Total du jour (limite max 8h)
  note?: string; // Précisions, nom du jour férié ou tâche réalisée
}

export interface TimesheetEntry {
  id: string;
  category: 'B09_ESIGL' | 'B13_QUANTIFICATION' | 'MISSIONS_TERRAIN' | 'FORMATIONS' | 'COORDINATION_GESTION';
  category_label: string;
  days_worked: number;
  hours_worked: number;
  description_tasks: string;
}

export interface MonthlyTimesheet {
  id: string;
  expert_id: string;
  period_month: number;
  period_year: number;
  month_name: string;
  total_days_worked: number;
  total_hours_worked?: number;
  total_hours_b09?: number;
  total_hours_b13?: number;
  total_hours_holiday?: number;
  total_hours_leave?: number;
  grand_total_hours?: number;
  daily_records?: TimesheetDayRecord[];
  status: TimesheetStatus;
  submission_date?: string;
  verified_by?: string;
  verification_date?: string;
  validated_by?: string;
  validation_date?: string;
  rejection_reason?: string;
  comments?: string;
  entries: TimesheetEntry[];
}

// ----------------------------------------------------
// 3. SÉANCES & RÉUNIONS (GTT, COORDINATION, ETC.)
// ----------------------------------------------------
export type MeetingType = 
  | 'GTT' // Groupe de Travail Technique (Quantification / Approvisionnements / eSIGL)
  | 'COORDINATION' // Réunion de Coordination Générale ou d'Équipe SaniNova
  | 'COMITE_PILOTAGE' // Comité de Pilotage / Revue avec la Direction et Partenaires
  | 'INSTITUTIONNELLE' // Réunion Ministérielle (MS, DPMED, SoBAPS, DPAS, DDS)
  | 'ATELIER' // Atelier Technique / Revue Trimestrielle
  | 'AUTRE'; // Autre séance de travail

export type MeetingFormat = 'PRESENTIEL' | 'EN_LIGNE' | 'HYBRIDE';

export type MeetingStatus = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'REPORTEE' | 'ANNULEE';

export interface MeetingParticipant {
  id: string;
  name: string;
  organization: string; // Ex: SaniNova, DPMED, SoBAPS, USAID, DDS Atacora, etc.
  role_title?: string;
  email?: string;
  phone?: string;
  is_internal: boolean;
  present?: boolean;
}

export interface MeetingPhoto {
  id: string;
  url: string;
  caption: string;
  taken_at?: string;
}

export interface MeetingDecision {
  id: string;
  description: string;
  responsible: string;
  deadline?: string;
  status: 'A_FAIRE' | 'EN_COURS' | 'FAIT';
}

export interface MeetingSession {
  id: string;
  title: string;
  meeting_type: MeetingType;
  format: MeetingFormat;
  location?: string; // Salle / Ville si Présentiel
  online_link?: string; // Lien Meet/Teams si En ligne
  session_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  milestone?: MilestoneType;
  work_plan_code?: string;
  organizer_id: string;
  organizer_name: string;
  objectives: string;
  agenda: string;
  status: MeetingStatus;
  internal_participants_ids: string[];
  external_participants: MeetingParticipant[];
  summary_report?: string;
  decisions?: MeetingDecision[];
  pv_attachment_name?: string;
  photos: MeetingPhoto[];
  created_at: string;
  updated_at?: string;
}
