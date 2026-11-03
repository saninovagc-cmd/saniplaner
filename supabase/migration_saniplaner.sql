-- ====================================================================
-- SANIPLANER - PROJET AFGHS-PSI BÉNIN (SANINOVA GLOBAL CONSULTING)
-- Script SQL Complet pour Supabase
-- Exécuter ce script directement dans : Supabase Dashboard > SQL Editor > New query
-- ====================================================================

-- 1. Table : Planning Hebdomadaire des Activités
CREATE TABLE IF NOT EXISTS weekly_activities (
    id TEXT PRIMARY KEY,
    expert_id TEXT NOT NULL,
    expert_name TEXT NOT NULL,
    expert_role TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    week_label TEXT NOT NULL,
    day_of_week TEXT,
    milestone TEXT NOT NULL,
    work_plan_ref TEXT,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    status TEXT DEFAULT 'A_VENIR',
    progress_pct INTEGER DEFAULT 0,
    notes TEXT,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sani_weekly_activities (
    id TEXT PRIMARY KEY,
    expert_id TEXT NOT NULL,
    expert_name TEXT NOT NULL,
    expert_role TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    week_label TEXT NOT NULL,
    day_of_week TEXT,
    milestone TEXT NOT NULL,
    work_plan_ref TEXT,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    status TEXT DEFAULT 'A_VENIR',
    progress_pct INTEGER DEFAULT 0,
    notes TEXT,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table : Statuts de Soumission Hebdomadaire par Personnel
CREATE TABLE IF NOT EXISTS weekly_submissions (
    id TEXT PRIMARY KEY,
    expert_id TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    is_submitted BOOLEAN DEFAULT FALSE,
    submission_date TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_weekly_submissions_expert_week UNIQUE (expert_id, week_number)
);

CREATE TABLE IF NOT EXISTS sani_weekly_submissions (
    id TEXT PRIMARY KEY,
    expert_id TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    is_submitted BOOLEAN DEFAULT FALSE,
    submission_date TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_sani_expert_week UNIQUE (expert_id, week_number)
);

-- 3. Table : Timesheets Mensuels
CREATE TABLE IF NOT EXISTS timesheets (
    id TEXT PRIMARY KEY,
    expert_id TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month_name TEXT NOT NULL,
    expert_name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'BROUILLON',
    submission_date TEXT,
    verified_by TEXT,
    verification_date TEXT,
    validated_by TEXT,
    validation_date TEXT,
    rejection_reason TEXT,
    total_days_worked NUMERIC(4,1) DEFAULT 0,
    tasks_summary TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_timesheets_expert_month_year UNIQUE (expert_id, month, year)
);

CREATE TABLE IF NOT EXISTS sani_timesheets (
    id TEXT PRIMARY KEY,
    expert_id TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month_name TEXT NOT NULL,
    expert_name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'BROUILLON',
    submission_date TEXT,
    verified_by TEXT,
    verification_date TEXT,
    validated_by TEXT,
    validation_date TEXT,
    rejection_reason TEXT,
    total_days_worked NUMERIC(4,1) DEFAULT 0,
    tasks_summary TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_sani_timesheets_expert_month_year UNIQUE (expert_id, month, year)
);

-- 4. Table : Risques Projet AFGHS-PSI
CREATE TABLE IF NOT EXISTS project_risks (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL,
    description TEXT NOT NULL,
    level TEXT NOT NULL,
    impact TEXT NOT NULL,
    mitigation_strategy TEXT NOT NULL,
    lead_expert TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table : Métriques B09 (Promptitude eSIGL)
CREATE TABLE IF NOT EXISTS b09_metrics (
    id TEXT PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month_name TEXT NOT NULL,
    department TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    expected_reports INTEGER NOT NULL,
    submitted_on_time INTEGER NOT NULL,
    promptitude_rate NUMERIC(5,1) NOT NULL,
    target_met BOOLEAN DEFAULT FALSE,
    deadline_date TEXT NOT NULL,
    validation_status TEXT NOT NULL,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table : Suivi B13 (Quantification, Approvisionnement)
CREATE TABLE IF NOT EXISTS b13_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    semester TEXT NOT NULL,
    lead_expert TEXT NOT NULL,
    target_date TEXT NOT NULL,
    status TEXT NOT NULL,
    deliverable_ref TEXT,
    evidence_url TEXT,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Table : Missions de Terrain
CREATE TABLE IF NOT EXISTS field_missions (
    id TEXT PRIMARY KEY,
    mission_code TEXT NOT NULL,
    title TEXT NOT NULL,
    milestone TEXT NOT NULL,
    lead_expert TEXT NOT NULL,
    companions TEXT[] DEFAULT '{}',
    department TEXT NOT NULL,
    zone_sanitaire TEXT NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    objectives TEXT NOT NULL,
    visited_facilities TEXT[] DEFAULT '{}',
    schedule_details TEXT,
    expected_results TEXT,
    mission_report_summary TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Table : Livrables Contractuels PSI/ABMS
CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    milestone TEXT NOT NULL,
    deliverable_type TEXT NOT NULL,
    lead_expert TEXT NOT NULL,
    due_date DATE NOT NULL,
    actual_submission_date DATE,
    recipient TEXT DEFAULT 'PSI/ABMS',
    version TEXT DEFAULT 'v1.0',
    validation_status TEXT NOT NULL,
    verified_by TEXT,
    validated_by TEXT,
    final_file_url TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- DÉSACTIVATION RLS POUR ACCÈS EN LECTURE ET ÉCRITURE SANS BLOCAGE
-- ====================================================================
ALTER TABLE IF EXISTS weekly_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sani_weekly_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS weekly_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sani_weekly_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timesheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sani_timesheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_risks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS b09_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS b13_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS field_missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deliverables DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- SEED DATA : SOUMISSIONS SEMAINE 45 ET 46 (VERT VS ROUGE)
-- ====================================================================
INSERT INTO weekly_submissions (id, expert_id, week_number, is_submitted, submission_date, comments) VALUES
('sub-w45-exp-01', 'exp-01', 45, TRUE, '2026-11-02 08:15', 'Planning validé'),
('sub-w45-exp-02', 'exp-02', 45, TRUE, '2026-11-02 08:30', 'Supervision S&E planifiée'),
('sub-w45-exp-03', 'exp-03', 45, TRUE, '2026-11-02 09:00', 'Clôture promptitude eSIGL'),
('sub-w45-exp-04', 'exp-04', 45, TRUE, '2026-11-02 08:45', 'Comité GTT prévu'),
('sub-w45-exp-05', 'exp-05', 45, TRUE, '2026-11-02 09:10', 'Analyse indicateurs'),
('sub-w45-exp-06', 'exp-06', 45, TRUE, '2026-11-02 07:45', 'Tournée Atacora & Plateau Sakété-Ifangni'),
('sub-w45-exp-07', 'exp-07', 45, TRUE, '2026-11-02 08:05', 'Mission Mono & Plateau PAK'),
('sub-w45-exp-08', 'exp-08', 45, FALSE, NULL, NULL),
('sub-w46-exp-01', 'exp-01', 46, TRUE, '2026-11-09 08:00', 'Réunion de cadrage trimestriel'),
('sub-w46-exp-02', 'exp-02', 46, TRUE, '2026-11-09 08:15', 'Revue qualité des données')
ON CONFLICT (id) DO UPDATE SET
    is_submitted = EXCLUDED.is_submitted,
    submission_date = EXCLUDED.submission_date;
