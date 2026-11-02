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
  email: string;
  full_name: string;
  role: UserRole;
  title: string;
  phone?: string;
  assigned_departments: string[];
  avatar_url?: string;
  is_active: boolean;
}

export interface GeographicZone {
  id: string;
  department: string;
  zone_name: string;
  is_primary_b09_b13: boolean;
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
