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
  'usr-psi-abms': '11111111-0000-0000-0000-000000000088',
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
    // Ne sélectionne que les vrais profils utilisateurs (exclut les 12 slots volumineux du Cloud Store)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, post')
      .neq('role', 'system');
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
  GALERIE: '11111111-9999-0000-0000-000000000013',
  // Registre partagé des suppressions définitives (tombstones) commun à tous les postes
  TOMBSTONES: '11111111-9999-0000-0000-000000000014',
} as const;

// File de sérialisation des écritures par module : empêche les courses lors d'ajouts/suppressions rapides
const moduleWriteQueues = new Map<string, Promise<unknown>>();
function enqueueModuleWrite<R>(key: string, task: () => Promise<R>): Promise<R> {
  const prev = moduleWriteQueues.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  moduleWriteQueues.set(key, next);
  next.finally(() => {
    if (moduleWriteQueues.get(key) === next) moduleWriteQueues.delete(key);
  });
  return next;
}

// Séances de démonstration supprimées définitivement par la Direction (26/11/2026)
export const MOCK_MEETING_IDS = new Set([
  'meet-2026-gtt-01',
  'meet-2026-gtt-02',
  'meet-2026-coord-01',
  'meet-2026-atelier-01',
]);

export function filterOutMockMeetings(meetings: any[]): any[] {
  if (!Array.isArray(meetings)) return [];
  return meetings.filter(m => m && m.id && !MOCK_MEETING_IDS.has(m.id));
}

function itemTimestamp(item: any): number {
  const raw = item?.updated_at || item?.created_at || '';
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Lit le registre partagé des suppressions pour un module (ex: 'meetings'). */
export async function fetchCloudTombstones(moduleName: string): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  try {
    const { data } = await supabase.from('profiles').select('post').eq('id', CLOUD_MODULE_KEYS.TOMBSTONES);
    const row = data && data[0];
    if (row && row.post) {
      const parsed = JSON.parse(row.post);
      if (parsed && Array.isArray(parsed[moduleName])) return new Set(parsed[moduleName]);
    }
  } catch { /* non-blocking */ }
  return new Set();
}

/** Ajoute des identifiants supprimés au registre partagé : la suppression s'applique alors sur TOUS les postes. */
export async function addCloudTombstones(moduleName: string, ids: string[]): Promise<boolean> {
  if (!isSupabaseConfigured || ids.length === 0) return false;
  return enqueueModuleWrite(CLOUD_MODULE_KEYS.TOMBSTONES, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error: selectErr } = await supabase.from('profiles').select('post').eq('id', CLOUD_MODULE_KEYS.TOMBSTONES);
        if (selectErr) throw selectErr;
        let registry: Record<string, string[]> = {};
        if (data && data[0] && data[0].post) {
          try { registry = JSON.parse(data[0].post) || {}; } catch { registry = {}; }
        }
        const current = new Set(Array.isArray(registry[moduleName]) ? registry[moduleName] : []);
        ids.forEach(id => current.add(id));
        registry[moduleName] = Array.from(current);
        const { error } = await supabase.from('profiles').upsert({
          id: CLOUD_MODULE_KEYS.TOMBSTONES,
          email: 'store.tombstones@saninovagc.com',
          full_name: 'Cloud Store [tombstones]',
          department: 'SaniNova Cloud',
          role: 'system',
          role_label: 'Registre des suppressions',
          title: 'tombstones',
          post: JSON.stringify(registry),
          updated_at: new Date().toISOString(),
        });
        if (!error) {
          broadcastModuleUpdate(CLOUD_MODULE_KEYS.TOMBSTONES, 'tombstones');
          return true;
        }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
    return false;
  });
}

export const FICTITIOUS_ACTIVITY_IDS = new Set([
  'act-hope-w07-01', 'act-hope-w07-02', 'act-hope-w06-01',
  'act-edith-w07-01', 'act-edith-w07-02', 'act-edith-w07-03', 'act-edith-w06-01',
  'act-mylene-w07-01', 'act-mylene-w07-02', 'act-mylene-w06-01',
  'act-tosse-w07-02',
  'act-amegan-w07-01', 'act-amegan-w07-02', 'act-amegan-w06-01',
  'act-djeriwo-w07-01', 'act-djeriwo-w07-02', 'act-djeriwo-w06-01',
  'act-soumari-w07-01', 'act-soumari-w07-02', 'act-soumari-w06-01',
  'act-arafath-w07-01', 'act-arafath-w07-02',
  'act-koussahoue-w07-01', 'act-koussahoue-w07-02', 'act-koussahoue-w06-01',
  'act-eddeh-w07-01', 'act-eddeh-w07-02', 'act-eddeh-w06-01',
  'act-bolaro-w07-01', 'act-bolaro-w06-01',
]);

export const FICTITIOUS_SUBMISSION_IDS = new Set([
  'sub-hope-w07', 'sub-hope-w06',
  'sub-edith-w07', 'sub-edith-w06',
  'sub-mylene-w07', 'sub-mylene-w06',
  'sub-amegan-w07', 'sub-amegan-w06',
  'sub-djeriwo-w07', 'sub-djeriwo-w06',
  'sub-soumari-w07', 'sub-soumari-w06',
  'sub-arafath-w07',
  'sub-koussahoue-w07', 'sub-koussahoue-w06',
  'sub-eddeh-w07', 'sub-eddeh-w06',
  'sub-bolaro-w07', 'sub-bolaro-w06',
]);

export const MOCK_MISSION_IDS = new Set([
  'mis-afghs-2026-001'
]);

export const MOCK_DELIVERABLE_IDS = new Set([
  'del-01', 'del-02', 'del-03', 'del-04', 'del-05', 'del-06', 'del-07'
]);

export function filterOutFictitiousActivities(acts: any[]): any[] {
  if (!Array.isArray(acts)) return [];
  return acts.filter(a => a && a.id && !FICTITIOUS_ACTIVITY_IDS.has(a.id));
}

export function filterOutFictitiousSubmissions(subs: any[]): any[] {
  if (!Array.isArray(subs)) return [];
  return subs.filter(s => s && s.id && !FICTITIOUS_SUBMISSION_IDS.has(s.id));
}

// ====================================================================
// REAL-TIME BROADCAST & WEBSOCKET ENGINE (ALL CONNECTED COMPUTERS)
// ====================================================================

let globalLiveChannel: ReturnType<typeof supabase.channel> | null = null;

export function getGlobalLiveChannel() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return null;
  if (!globalLiveChannel) {
    try {
      globalLiveChannel = supabase.channel('saniplaner_live_sync', {
        config: {
          broadcast: { self: false },
        },
      });
      globalLiveChannel.subscribe((status, err) => {
        if (err) {
          console.warn('[SaniNova LiveSync] Canal temps réel indisponible, repli sur polling HTTPS :', err);
        }
      });
    } catch {
      return null;
    }
  }
  return globalLiveChannel;
}

export function broadcastModuleUpdate(key: string, moduleName: string) {
  if (typeof window === 'undefined') return;
  try {
    const ch = getGlobalLiveChannel();
    if (ch) {
      ch.send({
        type: 'broadcast',
        event: 'MODULE_UPDATED',
        payload: { key, moduleName, timestamp: Date.now() },
      }).catch(() => { /* silent safe fallback */ });
    }
  } catch {}
}

export async function checkModulesLastUpdated(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  try {
    const keys = Object.values(CLOUD_MODULE_KEYS);
    const { data } = await supabase.from('profiles').select('id, updated_at').in('id', keys);
    const res: Record<string, string> = {};
    if (data && Array.isArray(data)) {
      data.forEach((r: any) => {
        if (r.id && r.updated_at) res[r.id] = r.updated_at;
      });
    }
    return res;
  } catch {
    return {};
  }
}

export function filterOutMockMissions(missions: any[]): any[] {
  if (!Array.isArray(missions)) return [];
  return missions.filter(m => m && m.id && !MOCK_MISSION_IDS.has(m.id));
}

export function filterOutMockDeliverables(deliverables: any[]): any[] {
  if (!Array.isArray(deliverables)) return [];
  return deliverables.filter(d => d && d.id && !MOCK_DELIVERABLE_IDS.has(d.id));
}

export async function saveModuleToCloud<T>(
  key: string, 
  moduleName: string, 
  data: T,
  options?: { deletedId?: string; isDeleteAction?: boolean }
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  return enqueueModuleWrite(key, async () => {
    try {
      let finalData = data;
      const deletedId = options?.deletedId;
      const backupId = key.replace('9999', '8888');

      // 1. Lire l'état existant (live + backup) en une seule requête groupée avec 1 réessai en cas d'erreur réseau
      let pairRows: any[] | null = null;
      let selectError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await supabase.from('profiles').select('id, post').in('id', [key, backupId]);
        if (!res.error) {
          pairRows = res.data || [];
          selectError = null;
          break;
        }
        selectError = res.error;
        if (attempt === 0) await new Promise(r => setTimeout(r, 500));
      }

      if (selectError && !options?.isDeleteAction) {
        console.error('[SupabaseSync] Select error before save:', moduleName, selectError);
        return false;
      }

      const existingRow = pairRows?.find((r: any) => r.id === key) || null;
      const backupRow = pairRows?.find((r: any) => r.id === backupId) || null;

      // PROTECTION UNIVERSELLE : Ne JAMAIS écraser un tableau existant par un tableau vide (sauf si action de vidage explicite)
      if (Array.isArray(data) && data.length === 0 && !options?.isDeleteAction) {
        let existingHasData = false;
        if (existingRow && existingRow.post) {
          try {
            const existingList = JSON.parse(existingRow.post);
            if (Array.isArray(existingList) && existingList.length > 0) existingHasData = true;
          } catch { /* non-blocking */ }
        }
        if (!existingHasData && backupRow && backupRow.post) {
          try {
            const backupList = JSON.parse(backupRow.post);
            if (Array.isArray(backupList) && backupList.length > 0) existingHasData = true;
          } catch { /* non-blocking */ }
        }
        if (existingHasData) {
          // Rejeter l'écrasement à vide accidentel et conserver les données existantes
          console.warn(`[SupabaseSync] Protection anti-écrasement activée pour ${moduleName}: écrasement par tableau vide bloqué.`);
          return true;
        }
      }

      // 2. Protection anti-écrasement et fusion automatique pour PLANNING_HEBDO
      if (key === CLOUD_MODULE_KEYS.PLANNING_HEBDO && typeof data === 'object' && data !== null) {
        const planData = data as any;
        if (existingRow && existingRow.post) {
          try {
            const existingPlan = JSON.parse(existingRow.post);
            let rawExistingActs: any[] = Array.isArray(existingPlan.activities) ? existingPlan.activities : [];
            let existingActs = filterOutFictitiousActivities(rawExistingActs);
            let rawExistingSubs: any[] = Array.isArray(existingPlan.submissions) ? existingPlan.submissions : [];
            let existingSubs = filterOutFictitiousSubmissions(rawExistingSubs);

            if (deletedId) {
              existingActs = existingActs.filter(a => a.id !== deletedId);
              existingSubs = existingSubs.filter(s => s.id !== deletedId);
            }

            // Fusion des activités par identifiant
            let incomingActs: any[] = filterOutFictitiousActivities(Array.isArray(planData.activities) ? planData.activities : []);
            if (deletedId) {
              incomingActs = incomingActs.filter(a => a.id !== deletedId);
            }
            const actMap = new Map<string, any>();
            existingActs.forEach(a => { if (a && a.id && !FICTITIOUS_ACTIVITY_IDS.has(a.id)) actMap.set(a.id, a); });
            incomingActs.forEach(a => { if (a && a.id && !FICTITIOUS_ACTIVITY_IDS.has(a.id)) actMap.set(a.id, a); });

            const mergedActs = Array.from(actMap.values());

            // Fusion des soumissions par identifiant
            let incomingSubs: any[] = filterOutFictitiousSubmissions(Array.isArray(planData.submissions) ? planData.submissions : []);
            if (deletedId) {
              incomingSubs = incomingSubs.filter(s => s.id !== deletedId);
            }
            const subMap = new Map<string, any>();
            existingSubs.forEach(s => { if (s && s.id && !FICTITIOUS_SUBMISSION_IDS.has(s.id)) subMap.set(s.id, s); });
            incomingSubs.forEach(s => { if (s && s.id && !FICTITIOUS_SUBMISSION_IDS.has(s.id)) subMap.set(s.id, s); });
            const mergedSubs = Array.from(subMap.values());

            finalData = {
              activities: mergedActs,
              submissions: mergedSubs,
            } as T;
          } catch { /* use raw data */ }
        }
      }

      // 3. Protection anti-écrasement et préservation des saisies réelles pour B09
      if (key === CLOUD_MODULE_KEYS.B09 && typeof data === 'object' && data !== null) {
        const b09Payload = { ...(data as any) };
        if (existingRow && existingRow.post) {
          try {
            const existingB09 = JSON.parse(existingRow.post);
            const existingMetrics: any[] = Array.isArray(existingB09.metrics) ? existingB09.metrics : [];
            const incomingMetrics: any[] = Array.isArray(b09Payload.metrics) ? b09Payload.metrics : [];

            const existingHasData = existingMetrics.some(m => (m.submitted_on_time || 0) > 0);
            const incomingHasData = incomingMetrics.some(m => (m.submitted_on_time || 0) > 0);

            if (existingHasData && !incomingHasData) {
              b09Payload.metrics = existingMetrics;
            } else if (existingHasData && incomingHasData) {
              b09Payload.metrics = incomingMetrics.map(inc => {
                const exist = existingMetrics.find(e => e.id === inc.id || (e.period_month === inc.period_month && e.period_year === inc.period_year && e.zone_name === inc.zone_name));
                if (exist && (exist.submitted_on_time || 0) > 0 && (inc.submitted_on_time || 0) === 0 && (!inc.update_history || inc.update_history.length === 0)) {
                  return exist;
                }
                return inc;
              });
            }

            if ((!b09Payload.reminders || b09Payload.reminders.length === 0) && Array.isArray(existingB09.reminders) && existingB09.reminders.length > 0) {
              b09Payload.reminders = existingB09.reminders;
            }
            if ((!b09Payload.dossiers || b09Payload.dossiers.length === 0) && Array.isArray(existingB09.dossiers) && existingB09.dossiers.length > 0) {
              b09Payload.dossiers = existingB09.dossiers;
            }
            finalData = b09Payload as T;
          } catch { /* use raw data */ }
        }
      }

      // 4. Fusion intelligente par ID pour les listes (MEETINGS, TIMESHEETS, MISSIONS, FORMATIONS, BUDGET, WORK_PLAN)
      if (Array.isArray(data) && key !== CLOUD_MODULE_KEYS.PLANNING_HEBDO && existingRow && existingRow.post) {
        try {
          const existingList = JSON.parse(existingRow.post);
          if (Array.isArray(existingList) && existingList.length > 0) {
            let cleanIncoming = data as any[];
            if (key === CLOUD_MODULE_KEYS.MISSIONS) cleanIncoming = filterOutMockMissions(cleanIncoming);
            if (key === CLOUD_MODULE_KEYS.DELIVERABLES) cleanIncoming = filterOutMockDeliverables(cleanIncoming);

            const itemMap = new Map<string, any>();
            existingList.forEach(item => {
              if (item && item.id && item.id !== deletedId) itemMap.set(item.id, item);
            });
            const useNewestWins = key === CLOUD_MODULE_KEYS.MEETINGS;
            cleanIncoming.forEach(item => {
              if (item && item.id && item.id !== deletedId) {
                if (useNewestWins) {
                  // Séances : la version la plus récente (updated_at) gagne — un poste en retard ne peut plus écraser une saisie récente
                  const current = itemMap.get(item.id);
                  if (!current || itemTimestamp(item) >= itemTimestamp(current)) itemMap.set(item.id, item);
                } else {
                  // L'élément entrant le plus récent prend le dessus
                  itemMap.set(item.id, item);
                }
              }
            });
            finalData = Array.from(itemMap.values()) as T;
          }
        } catch { /* use payload */ }
      }

      // Séances : appliquer les suppressions partagées (tombstones) et exclure définitivement les séances de démonstration
      if (key === CLOUD_MODULE_KEYS.MEETINGS && Array.isArray(finalData)) {
        const tombstones = await fetchCloudTombstones('meetings');
        if (deletedId) tombstones.add(deletedId);
        finalData = filterOutMockMeetings(finalData as any[]).filter((m: any) => !tombstones.has(m.id)) as T;
      }

      // Sauvegarde assainie pour MISSIONS et DELIVERABLES (exclut les mocks tests)
      if (key === CLOUD_MODULE_KEYS.MISSIONS && Array.isArray(finalData)) {
        finalData = filterOutMockMissions(finalData as any[]) as T;
      }
      if (key === CLOUD_MODULE_KEYS.DELIVERABLES && Array.isArray(finalData)) {
        finalData = filterOutMockDeliverables(finalData as any[]) as T;
      }

      const serialized = JSON.stringify(finalData);
      const nowIso = new Date().toISOString();
      const row = {
        id: key,
        email: `store.${moduleName.toLowerCase()}@saninovagc.com`,
        full_name: `Cloud Store [${moduleName}]`,
        department: 'SaniNova Cloud',
        role: 'system',
        role_label: 'Store Synchronisé',
        title: moduleName,
        post: serialized,
        updated_at: nowIso
      };

      // Réessais automatiques avec backoff en cas de micro-coupure réseau
      let upsertErr: any = null;
      const retryDelays = [500, 1200];
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase.from('profiles').upsert(row);
        upsertErr = res.error;
        if (!upsertErr) break;
        if (attempt < retryDelays.length) {
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
        }
      }

      if (upsertErr) {
        console.error('[SupabaseSync] Upsert error:', moduleName, upsertErr);
        return false;
      }

      // DUAL-WRITE : Synchroniser le slot miroir 8888 (y compris si suppression complète des séances)
      const shouldSyncBackup =
        (finalData && (!Array.isArray(finalData) || finalData.length > 0)) ||
        (key === CLOUD_MODULE_KEYS.MEETINGS && options?.isDeleteAction);
      if (shouldSyncBackup) {
        try {
          await supabase.from('profiles').upsert({
            id: backupId,
            email: `backup.${moduleName.toLowerCase()}@saninovagc.com`,
            full_name: `Cloud Backup [${moduleName}]`,
            department: 'SaniNova Cloud',
            role: 'system',
            role_label: 'Sauvegarde Permanente',
            title: moduleName,
            post: serialized,
            updated_at: nowIso
          });
        } catch { /* non-blocking */ }
      }

      // 5. NOTIFICATION TEMPS RÉEL (BROADCAST EN DIRECT VERS TOUS LES POSTES CONNECTÉS)
      broadcastModuleUpdate(key, moduleName);
      return true;
    } catch (err) {
      console.error('[SupabaseSync] Unexpected save error:', moduleName, err);
      return false;
    }
  });
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

export async function deleteMissionFromCloud(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: existingRow } = await supabase.from('profiles').select('post').eq('id', CLOUD_MODULE_KEYS.MISSIONS).single();
    if (existingRow && existingRow.post) {
      const existingList = JSON.parse(existingRow.post);
      if (Array.isArray(existingList)) {
        const remaining = existingList.filter((m: any) => m && m.id !== id);
        await supabase.from('profiles').update({
          post: JSON.stringify(remaining),
          updated_at: new Date().toISOString()
        }).eq('id', CLOUD_MODULE_KEYS.MISSIONS);
      }
    }
  } catch {}
}

export async function fetchAllCloudModules(): Promise<Record<string, any>> {
  if (!isSupabaseConfigured) return {};
  try {
    const storeIds = Object.values(CLOUD_MODULE_KEYS);
    
    // Tentative de lecture avec retry automatique si erreur réseau
    let data: any[] | null = null;
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const res = await supabase
        .from('profiles')
        .select('id, post')
        .in('id', storeIds);
      if (!res.error && res.data && res.data.length > 0) {
        data = res.data;
        break;
      }
      if (attempts < 3) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (!data || data.length === 0) {
      // Secours de redondance : interroger les slots miroirs de sauvegarde (8888)
      const backupIds = storeIds.map(id => id.replace('9999', '8888'));
      const { data: backupData } = await supabase
        .from('profiles')
        .select('id, post')
        .in('id', backupIds);
      if (backupData && backupData.length > 0) {
        data = backupData.map(r => ({ ...r, id: r.id.replace('8888', '9999') }));
      }
    }

    if (!data) return {};

    const map: Record<string, any> = {};
    for (const row of data) {
      if (row.post && typeof row.post === 'string') {
        try {
          const parsed = JSON.parse(row.post);
          if (row.id === CLOUD_MODULE_KEYS.PLANNING_HEBDO && parsed) {
            map[row.id] = {
              activities: filterOutFictitiousActivities(parsed.activities),
              submissions: filterOutFictitiousSubmissions(parsed.submissions),
            };
          } else if (row.id === CLOUD_MODULE_KEYS.MISSIONS && Array.isArray(parsed)) {
            map[row.id] = filterOutMockMissions(parsed);
          } else if (row.id === CLOUD_MODULE_KEYS.DELIVERABLES && Array.isArray(parsed)) {
            map[row.id] = filterOutMockDeliverables(parsed);
          } else if (row.id === CLOUD_MODULE_KEYS.MEETINGS && Array.isArray(parsed)) {
            map[row.id] = filterOutMockMeetings(parsed);
          } else {
            map[row.id] = parsed;
          }
        } catch {}
      }
    }
    // Appliquer le registre partagé des suppressions aux séances
    const tomb = map[CLOUD_MODULE_KEYS.TOMBSTONES];
    if (tomb && Array.isArray(tomb.meetings) && Array.isArray(map[CLOUD_MODULE_KEYS.MEETINGS])) {
      const dead = new Set<string>(tomb.meetings);
      map[CLOUD_MODULE_KEYS.MEETINGS] = map[CLOUD_MODULE_KEYS.MEETINGS].filter((m: any) => m && !dead.has(m.id));
    }
    // Auto-récupération par module : si un module critique est absent ou vide, récupérer immédiatement son slot backup 8888 en un seul appel groupé
    const criticalKeys = [CLOUD_MODULE_KEYS.BUDGET, CLOUD_MODULE_KEYS.MISSIONS, CLOUD_MODULE_KEYS.WORK_PLAN, CLOUD_MODULE_KEYS.TIMESHEETS];
    const emptyKeys = criticalKeys.filter(k => !map[k] || (Array.isArray(map[k]) && map[k].length === 0));
    if (emptyKeys.length > 0) {
      const backupIds = emptyKeys.map(k => k.replace('9999', '8888'));
      try {
        const { data: bRows } = await supabase.from('profiles').select('id, post').in('id', backupIds);
        if (bRows && bRows.length > 0) {
          for (const bRow of bRows) {
            if (bRow.post) {
              try {
                const bParsed = JSON.parse(bRow.post);
                if (Array.isArray(bParsed) && bParsed.length > 0) {
                  const liveId = bRow.id.replace('8888', '9999');
                  map[liveId] = bParsed;
                  // Restauration automatique asynchrone non-bloquante dans le slot live
                  supabase.from('profiles').update({
                    post: bRow.post,
                    updated_at: new Date().toISOString()
                  }).eq('id', liveId).then(() => {});
                }
              } catch {}
            }
          }
        }
      } catch { /* non-blocking */ }
    }

    return map;
  } catch {
    return {};
  }
}
