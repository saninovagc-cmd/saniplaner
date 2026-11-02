-- ====================================================================
-- SANINOVA PROJECT HUB : Plateforme de pilotage AFGHS-PSI Bénin
-- Schéma PostgreSQL complet avec RLS, Triggers, et Référentiels
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Types ENUM
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'direction',
        'senior_advisor',
        'sis_specialist',
        'fasp_specialist',
        'se_specialist',
        'rsco'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE milestone_type AS ENUM ('B09', 'B13', 'TRANSVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE activity_status AS ENUM ('A_VENIR', 'EN_COURS', 'TERMINEE', 'EN_RETARD', 'SUSPENDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE mission_status AS ENUM ('BROUILLON', 'SOUMISE', 'VALIDEE', 'EN_COURS', 'REALISEE', 'RAPPORT_A_PRODUIRE', 'CLOTUREE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE deliverable_status AS ENUM ('PREPARATION', 'SOUMISSION_INTERNE', 'VERIFICATION', 'VALIDATION_DIRECTION', 'TRANSMISSION_PSI', 'ARCHIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    title TEXT NOT NULL,
    phone TEXT,
    assigned_departments TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: geographic_zones
CREATE TABLE IF NOT EXISTS geographic_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    is_primary_b09_b13 BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table: health_facilities
CREATE TABLE IF NOT EXISTS health_facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    zone_id UUID REFERENCES geographic_zones(id) ON DELETE SET NULL,
    facility_type TEXT NOT NULL DEFAULT 'CS',
    esigl_reporting_expected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: work_plan_activities (Module 2)
CREATE TABLE IF NOT EXISTS work_plan_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    milestone milestone_type NOT NULL,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    methodology TEXT,
    lead_expert_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    collaborators_ids UUID[] DEFAULT '{}',
    associated_partners TEXT[] DEFAULT '{}',
    geographic_zone TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    deadline DATE NOT NULL,
    expected_result TEXT,
    status activity_status DEFAULT 'A_VENIR',
    progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
    priority TEXT DEFAULT 'MOYENNE' CHECK (priority IN ('BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE')),
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table: b09_reports (Module 3 : Suivi Promptitude eSIGL)
-- Formule : (Rapports soumis à temps / Rapports attendus) * 100. Seuil excellent >= 70%.
-- Date limite nationale : le 20 du mois suivant.
CREATE TABLE IF NOT EXISTS b09_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    department TEXT NOT NULL,
    zone_id UUID REFERENCES geographic_zones(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES health_facilities(id) ON DELETE CASCADE,
    expected_deadline DATE NOT NULL,
    submission_date TIMESTAMPTZ,
    is_on_time BOOLEAN GENERATED ALWAYS AS (
        submission_date IS NOT NULL AND submission_date::date <= expected_deadline
    ) STORED,
    a7_report_ref TEXT,
    reminders_count INTEGER DEFAULT 0,
    data_quality_score NUMERIC(5,2) DEFAULT 100.00,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_facility_month_year UNIQUE (facility_id, period_month, period_year)
);

-- 7. Table: b13_quantifications (Module 4 : Quantification et Approvisionnements)
CREATE TABLE IF NOT EXISTS b13_quantifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL CHECK (category IN (
        'ILP_VALIDATION', 'QUANTIFICATION', 'SUPPLY_PLAN', 'QAT_TRACKING',
        'GTT_MEETING', 'POA_MANAGEMENT', 'DISTRIBUTION', 'CPS_CAMPAIGN'
    )),
    title TEXT NOT NULL,
    semester TEXT NOT NULL CHECK (semester IN ('S1_2026_2027', 'S2_2026_2027')),
    is_predefined_deliverable BOOLEAN DEFAULT FALSE,
    lead_expert_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    execution_date DATE,
    status TEXT DEFAULT 'PLANIFIE' CHECK (status IN ('PLANIFIE', 'EN_COURS', 'VALIDE', 'TRANSMIS')),
    verification_evidence_url TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Table: field_missions (Module 5 : Missions de Terrain)
CREATE TABLE IF NOT EXISTS field_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    lead_expert_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    companion_expert_ids UUID[] DEFAULT '{}',
    department TEXT NOT NULL,
    zone_sanitaire TEXT NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    objectives TEXT NOT NULL,
    visited_facilities TEXT[] DEFAULT '{}',
    schedule_details TEXT,
    expected_results TEXT,
    mission_report_summary TEXT,
    recommendations JSONB DEFAULT '[]',
    photos_urls TEXT[] DEFAULT '{}',
    status mission_status DEFAULT 'BROUILLON',
    validated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Table: trainings (Module 6 : Formations et Renforcement de Capacités)
CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic TEXT NOT NULL,
    milestone milestone_type DEFAULT 'B09',
    department TEXT NOT NULL,
    zone_sanitaire TEXT NOT NULL,
    training_date DATE NOT NULL,
    trainer_ids UUID[] DEFAULT '{}',
    participants_count INTEGER DEFAULT 0,
    pre_test_avg NUMERIC(4,1),
    post_test_avg NUMERIC(4,1),
    attendance_sheet_url TEXT,
    report_url TEXT,
    status TEXT DEFAULT 'PLANIFIEE' CHECK (status IN ('PLANIFIEE', 'REALISEE', 'EVALUEE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Table: deliverables (Module 7 : Livrables Contractuels PSI/ABMS)
CREATE TABLE IF NOT EXISTS deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    milestone milestone_type NOT NULL,
    deliverable_type TEXT NOT NULL,
    lead_expert_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    actual_submission_date DATE,
    recipient TEXT DEFAULT 'PSI/ABMS',
    version TEXT DEFAULT 'v1.0',
    validation_status deliverable_status DEFAULT 'PREPARATION',
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    validated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    final_file_url TEXT,
    transmission_proof_url TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Table: documents (Module 8 : Documentation et Archivage GED)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('PDF', 'EXCEL', 'WORD', 'IMAGE', 'OTHER')),
    file_size_kb INTEGER DEFAULT 0,
    milestone milestone_type DEFAULT 'B09',
    related_activity_id UUID REFERENCES work_plan_activities(id) ON DELETE SET NULL,
    related_deliverable_id UUID REFERENCES deliverables(id) ON DELETE SET NULL,
    department TEXT,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    period TEXT,
    document_category TEXT NOT NULL CHECK (document_category IN (
        'PREUVE_VERIFICATION', 'RAPPORT_MISSION', 'LISTE_PRESENCE', 'FICHIER_QAT', 'FICHE_POA', 'AUTRE'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Table: audit_logs (Module 10 : Journal d'Audit & Sécurité)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_plan_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE b09_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE b13_quantifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Profiles: readable by all authenticated users; modified by Direction only
CREATE POLICY "Profiles readable by authenticated users"
ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Profiles manageable by Direction"
ON profiles FOR ALL TO authenticated
USING (get_current_user_role() = 'direction');

-- Work Plan: readable by all; Direction and Lead Experts can update
CREATE POLICY "Activities readable by authenticated users"
ON work_plan_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Activities manageable by Direction and leads"
ON work_plan_activities FOR ALL TO authenticated
USING (
    get_current_user_role() IN ('direction', 'senior_advisor') 
    OR lead_expert_id = auth.uid()
);

-- Deliverables: Direction and Senior Advisor validate
CREATE POLICY "Deliverables readable by all"
ON deliverables FOR SELECT TO authenticated USING (true);

CREATE POLICY "Deliverables editable by Direction and Senior Advisor"
ON deliverables FOR ALL TO authenticated
USING (get_current_user_role() IN ('direction', 'senior_advisor') OR lead_expert_id = auth.uid());

-- Documents: readable by all, uploaded by authenticated experts
CREATE POLICY "Documents readable by all"
ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Documents insertable by authenticated"
ON documents FOR INSERT TO authenticated WITH CHECK (true);

-- ====================================================================
-- SEED DATA : Découpage territorial Bénin (4 Départements Clés + Alibori + National)
-- ====================================================================

INSERT INTO geographic_zones (department, zone_name, is_primary_b09_b13) VALUES
-- Atacora
('Atacora', 'Natitingou-Boukoumbé-Toucountouna (NBT)', TRUE),
('Atacora', 'Tanguiéta-Cobly-Matéri (TCM)', TRUE),
('Atacora', 'Kouandé-Péhunco-Kérou (2KP)', TRUE),
-- Donga
('Donga', 'Djougou-Copargo-Ouaké (DCO)', TRUE),
('Donga', 'Bassila', TRUE),
-- Mono
('Mono', 'Lokossa-Athiémé', TRUE),
('Mono', 'Comé-Grand-Popo-Bopa-Houéyogbé (CBGH)', TRUE),
-- Plateau
('Plateau', 'Pobè-Adja-Ouèrè-Kétou (PAK)', TRUE),
('Plateau', 'Sakété-Ifangni', TRUE),
-- Alibori (Couverture spécifique)
('Alibori', 'Kandi-Gogounou-Ségbana', FALSE),
('Alibori', 'Malanville-Karimama', FALSE),
-- Niveau Central
('National', 'Cotonou / Siège & Institutions', FALSE)
ON CONFLICT DO NOTHING;
