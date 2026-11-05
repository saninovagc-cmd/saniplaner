export type UserRole = 
  | 'direction'
  | 'senior_advisor'
  | 'sis_specialist'
  | 'fasp_specialist'
  | 'se_specialist'
  | 'rsco';

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
  { id: 'livrables', label: 'Livrables PSI', href: '/livrables', num: '10' },
  { id: 'documentation', label: 'Documentation & GED', href: '/documentation', num: '11' },
  { id: 'rapports', label: 'Rapports & Exports', href: '/rapports', num: '12' },
  { id: 'administration', label: 'Administration', href: '/administration', num: '13' },
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

export interface B09MonthlyMetric {
  id: string;
  period_month: number;
  period_year: number;
  department: string;
  zone_name: string;
  expected_reports: number;
  submitted_on_time: number;
  submitted_late: number;
  missing_reports: number;
  promptitude_rate: number; // calculated %
  target_met: boolean; // >= 70%
  deadline_date: string; // 20th of following month
  reminders_sent: number;
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

export interface Training {
  id: string;
  topic: string;
  milestone: MilestoneType;
  department: string;
  zone_sanitaire: string;
  training_date: string;
  trainer_ids: string[];
  participants_count: number;
  pre_test_avg: number;
  post_test_avg: number;
  status: 'PLANIFIEE' | 'REALISEE' | 'EVALUEE';
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
