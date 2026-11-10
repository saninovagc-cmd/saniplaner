import { supabase, isSupabaseConfigured } from './supabase';
import { WeeklyActivity, WeeklySubmission, MonthlyTimesheet, WorkPlanActivity, AuditLogItem, UserProfile } from '@/types';

export interface SupabaseStatus {
  isConfigured: boolean;
  isConnected: boolean;
  url: string;
  tables: {
    activities: boolean;
    audit_logs: boolean;
    weekly_activities: boolean;
    weekly_submissions: boolean;
    timesheets: boolean;
  };
  errorMessage?: string;
}

export async function checkSupabaseStatus(): Promise<SupabaseStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!isSupabaseConfigured) {
    return {
      isConfigured: false,
      isConnected: false,
      url,
      tables: {
        activities: false,
        audit_logs: false,
        weekly_activities: false,
        weekly_submissions: false,
        timesheets: false,
      }
    };
  }

  try {
    const [actRes, logRes, weeklyRes, subRes, tsRes] = await Promise.allSettled([
      supabase.from('activities').select('id').limit(1),
      supabase.from('audit_logs').select('id').limit(1),
      supabase.from('weekly_activities').select('id').limit(1),
      supabase.from('weekly_submissions').select('id').limit(1),
      supabase.from('timesheets').select('id').limit(1),
    ]);

    const isConnected = actRes.status === 'fulfilled' && !actRes.value.error;

    return {
      isConfigured: true,
      isConnected,
      url,
      tables: {
        activities: actRes.status === 'fulfilled' && !actRes.value.error,
        audit_logs: logRes.status === 'fulfilled' && !logRes.value.error,
        weekly_activities: weeklyRes.status === 'fulfilled' && !weeklyRes.value.error,
        weekly_submissions: subRes.status === 'fulfilled' && !subRes.value.error,
        timesheets: tsRes.status === 'fulfilled' && !tsRes.value.error,
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isConfigured: true,
      isConnected: false,
      url,
      tables: {
        activities: false,
        audit_logs: false,
        weekly_activities: false,
        weekly_submissions: false,
        timesheets: false,
      },
      errorMessage: msg
    };
  }
}

// ====================================================================
// PLANNING HEBDOMADAIRE PERSISTENCE
// ====================================================================

export async function syncWeeklyActivitiesToCloud(acts: WeeklyActivity[]): Promise<void> {
  if (!isSupabaseConfigured || acts.length === 0) return;
  try {
    // Try primary table first (weekly_activities or sani_weekly_activities)
    const rows = acts.map(a => ({
      id: a.id,
      expert_id: a.expert_id,
      expert_name: a.expert_id,
      expert_role: 'Expert',
      week_number: a.week_number,
      week_label: a.week_label,
      day_of_week: a.day_of_week || null,
      milestone: a.milestone,
      work_plan_ref: a.work_plan_code || null,
      title: a.title,
      location: a.location,
      expected_output: a.expected_output,
      status: a.status,
      progress_pct: a.progress_pct,
      notes: a.execution_notes || null,
      observations: a.execution_notes || null,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('weekly_activities').upsert(rows);
    if (error) {
      // Try fallback to sani_weekly_activities
      await supabase.from('sani_weekly_activities').upsert(rows);
    }
  } catch {
    // Non-blocking for offline / local-first resilience
  }
}

export async function syncWeeklySubmissionToCloud(sub: WeeklySubmission): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const row = {
      id: sub.id,
      expert_id: sub.expert_id,
      week_number: sub.week_number,
      is_submitted: sub.is_submitted,
      submission_date: sub.submission_date || null,
      comments: sub.comments || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('weekly_submissions').upsert(row);
    if (error) {
      await supabase.from('sani_weekly_submissions').upsert(row);
    }
  } catch {
    // Non-blocking
  }
}

// ====================================================================
// TIMESHEETS PERSISTENCE
// ====================================================================

export async function syncTimesheetToCloud(ts: MonthlyTimesheet): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const row = {
      id: ts.id,
      expert_id: ts.expert_id,
      month: ts.period_month,
      year: ts.period_year,
      month_name: ts.month_name,
      status: ts.status,
      submission_date: ts.submission_date || null,
      verified_by: ts.verified_by || null,
      verification_date: ts.verification_date || null,
      validated_by: ts.validated_by || null,
      validation_date: ts.validation_date || null,
      rejection_reason: ts.rejection_reason || null,
      total_days_worked: ts.total_days_worked,
      comments: ts.comments || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('timesheets').upsert(row);
    if (error) {
      await supabase.from('sani_timesheets').upsert(row);
    }
  } catch {
    // Non-blocking
  }
}

// ====================================================================
// AUDIT LOG PERSISTENCE
// ====================================================================

export async function syncAuditLogToCloud(log: AuditLogItem): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('audit_logs').insert({
      user_name: log.user_name,
      action: log.action,
      module: log.module,
      entity_type: log.module,
      entity_id: log.entity_ref,
      entity_name: log.entity_ref,
      created_at: new Date().toISOString()
    });
  } catch {
    // Non-blocking
  }
}

// ====================================================================
// USER CREDENTIALS & PERMISSIONS PERSISTENCE (PROFILES)
// ====================================================================

export const USER_UUID_MAP: Record<string, string> = {
  'usr-dir': '11111111-0000-0000-0000-000000000001',
  'usr-cs': '11111111-0000-0000-0000-000000000002',
  'usr-sis-1': '11111111-0000-0000-0000-000000000003',
  'usr-sis-2': '11111111-0000-0000-0000-000000000004',
  'usr-se': '11111111-0000-0000-0000-000000000005',
  'usr-rsco-1': '11111111-0000-0000-0000-000000000006',
  'usr-rsco-2': '11111111-0000-0000-0000-000000000007',
  'usr-rsco-3': '11111111-0000-0000-0000-000000000008',
  'usr-fin': '11111111-0000-0000-0000-000000000009',
  'usr-admin-1': '11111111-0000-0000-0000-000000000010',
  'usr-driver-1': '11111111-0000-0000-0000-000000000011',
  'usr-superadmin': '11111111-0000-0000-0000-000000000099',
};

export async function syncUserCredentialsToCloud(u: UserProfile): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const uuid = USER_UUID_MAP[u.id] || `11111111-0000-0000-0000-${u.id.replace(/\D/g, '').padStart(12, '0')}`;
    const row = {
      id: uuid,
      email: u.email,
      full_name: u.full_name,
      department: u.assigned_departments?.[0] || 'SaniNova AFGHS',
      role: u.role,
      role_label: u.title,
      title: u.title,
      post: JSON.stringify({
        user_id: u.id,
        username: u.username,
        password: u.password,
        is_first_login: u.is_first_login === false ? false : Boolean(u.is_first_login),
        role: u.role,
        allowed_modules: u.allowed_modules,
        updated_at: new Date().toISOString()
      }),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(row);
    return !error;
  } catch {
    return false;
  }
}

export async function fetchUsersFromCloud(): Promise<Partial<UserProfile>[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error || !data) return [];
    
    const results: Partial<UserProfile>[] = [];
    for (const p of data) {
      if (p.id && (p.id.startsWith('11111111-9999') || p.role === 'system')) {
        continue; // Skip shared data store rows
      }
      if (p.post && typeof p.post === 'string') {
        try {
          const parsed = JSON.parse(p.post);
          if (parsed && parsed.user_id) {
            results.push({
              id: parsed.user_id,
              username: parsed.username,
              password: parsed.password,
              is_first_login: parsed.is_first_login !== undefined ? Boolean(parsed.is_first_login) : false,
              role: parsed.role,
              allowed_modules: parsed.allowed_modules,
            });
          }
        } catch { /* ignore non-json post */ }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ====================================================================
// REAL-TIME UNIFIED CLOUD STORE (SHARED ACROSS ALL DEVICES & USERS)
// ====================================================================

export const CLOUD_MODULE_KEYS = {
  MEETINGS: '11111111-9999-0000-0000-000000000001',
  TIMESHEETS: '11111111-9999-0000-0000-000000000002',
  B13: '11111111-9999-0000-0000-000000000003',
  B09: '11111111-9999-0000-0000-000000000004',
  BUDGET: '11111111-9999-0000-0000-000000000005',
  MISSIONS: '11111111-9999-0000-0000-000000000006',
  FORMATIONS: '11111111-9999-0000-0000-000000000007',
  WORK_PLAN: '11111111-9999-0000-0000-000000000008',
  PLANNING_HEBDO: '11111111-9999-0000-0000-000000000099',
  DELIVERABLES: '11111111-9999-0000-0000-000000000010',
  DOCUMENTS: '11111111-9999-0000-0000-000000000011',
  AUDIT_LOGS: '11111111-9999-0000-0000-000000000012',
} as const;

export async function saveModuleToCloud<T>(key: string, moduleName: string, data: T): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    let finalData = data;

    // Protection anti-écrasement et fusion automatique pour PLANNING_HEBDO
    if (key === CLOUD_MODULE_KEYS.PLANNING_HEBDO && typeof data === 'object' && data !== null) {
      const planData = data as any;
      const { data: existingRow } = await supabase.from('profiles').select('post').eq('id', key).single();
      if (existingRow && existingRow.post) {
        try {
          const existingPlan = JSON.parse(existingRow.post);
          const existingActs: any[] = Array.isArray(existingPlan.activities) ? existingPlan.activities : [];
          const existingSubs: any[] = Array.isArray(existingPlan.submissions) ? existingPlan.submissions : [];

          // Fusion des activités par identifiant
          const incomingActs: any[] = Array.isArray(planData.activities) ? planData.activities : [];
          const actMap = new Map<string, any>();
          existingActs.forEach(a => { if (a && a.id) actMap.set(a.id, a); });
          incomingActs.forEach(a => { if (a && a.id) actMap.set(a.id, a); });

          // Si le payload entrant est vide mais la base a des données, ne JAMAIS effacer les données existantes
          const mergedActs = incomingActs.length > 0 ? Array.from(actMap.values()) : existingActs;

          // Fusion des soumissions par identifiant
          const incomingSubs: any[] = Array.isArray(planData.submissions) ? planData.submissions : [];
          const subMap = new Map<string, any>();
          existingSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
          incomingSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
          const mergedSubs = Array.from(subMap.values());

          finalData = {
            activities: mergedActs,
            submissions: mergedSubs,
          } as T;
        } catch { /* use raw data */ }
      }
    }

    const row = {
      id: key,
      email: `store.${moduleName.toLowerCase()}@saninovagc.com`,
      full_name: `Cloud Store [${moduleName}]`,
      department: 'SaniNova Cloud',
      role: 'system',
      role_label: 'Store Synchronisé',
      title: moduleName,
      post: JSON.stringify(finalData),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(row);

    // Double écriture pour PLANNING_HEBDO (garantir la synchronisation universelle multi-versions)
    if (key === CLOUD_MODULE_KEYS.PLANNING_HEBDO) {
      try {
        const legacyRow = {
          ...row,
          id: '11111111-9999-0000-0000-000000000009',
          email: 'store.planning_hebdo@saninovagc.com',
        };
        await supabase.from('profiles').upsert(legacyRow);
      } catch {}
    }

    return !error;
  } catch {
    return false;
  }
}

export async function deleteWeeklyActivityFromCloud(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: existingRow } = await supabase.from('profiles').select('post').eq('id', CLOUD_MODULE_KEYS.PLANNING_HEBDO).single();
    if (existingRow && existingRow.post) {
      const existingPlan = JSON.parse(existingRow.post);
      if (Array.isArray(existingPlan.activities)) {
        const remaining = existingPlan.activities.filter((a: any) => a.id !== id);
        await supabase.from('profiles').update({
          post: JSON.stringify({ ...existingPlan, activities: remaining }),
          updated_at: new Date().toISOString()
        }).eq('id', CLOUD_MODULE_KEYS.PLANNING_HEBDO);
      }
    }
  } catch {}
}

export async function fetchAllCloudModules(): Promise<Record<string, any>> {
  if (!isSupabaseConfigured) return {};
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, post')
      .like('id', '11111111-9999%');
    if (error || !data) return {};
    const map: Record<string, any> = {};
    for (const row of data) {
      if (row.post && typeof row.post === 'string') {
        try {
          map[row.id] = JSON.parse(row.post);
        } catch {}
      }
    }
    // Fusion automatique et sécurisée des deux slots Planning Hebdo pour ne jamais perdre d'activités
    const plan99 = map[CLOUD_MODULE_KEYS.PLANNING_HEBDO];
    const plan09 = map['11111111-9999-0000-0000-000000000009'];
    if (plan99 || plan09) {
      const allActs: any[] = [
        ...(Array.isArray(plan99?.activities) ? plan99.activities : []),
        ...(Array.isArray(plan09?.activities) ? plan09.activities : []),
      ];
      const actMap = new Map<string, any>();
      allActs.forEach(a => { if (a && a.id) actMap.set(a.id, a); });

      const allSubs: any[] = [
        ...(Array.isArray(plan99?.submissions) ? plan99.submissions : []),
        ...(Array.isArray(plan09?.submissions) ? plan09.submissions : []),
      ];
      const subMap = new Map<string, any>();
      allSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });

      map[CLOUD_MODULE_KEYS.PLANNING_HEBDO] = {
        activities: Array.from(actMap.values()),
        submissions: Array.from(subMap.values()),
      };
    }
    return map;
  } catch {
    return {};
  }
}
