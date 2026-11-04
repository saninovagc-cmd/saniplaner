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

export interface UserProfile {
  id: string;
  username?: string;
  password?: string;
  email: string;
  full_name: string;
  role: UserRole;
  title: string;
  phone?: string;
  assigned_departments: string[];
  avatar_url?: string;
  is_active: boolean;
  hourly_rate?: number;
  daily_rate?: number;
  loe_b09?: number;
  loe_b13?: number;
  loe_total?: number;
  total_fees_fcfa?: number;
}

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

export interface FieldMission {
  id: string;
  title: string;
  lead_expert_id: string;
  companion_expert_ids: string[];
  department: string;
  zone_sanitaire: string;
  departure_date: string;
  return_date: string;
  objectives: string;
  visited_facilities: string[];
  schedule_details?: string;
  expected_results: string;
  mission_report_summary?: string;
  recommendations: Array<{
    id: string;
    text: string;
    target_entity: string;
    status: 'OUVERTE' | 'EN_COURS' | 'CLOTUREE';
  }>;
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
  day_of_week: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Toute la semaine';
  title: string;
  milestone: MilestoneType;
  location: string;
  expected_output: string;
  progress_pct: number; // 0 à 100%
  status: WeeklyActivityStatus;
  execution_notes?: string;
  work_plan_code?: string;
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
