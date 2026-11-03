import { supabase, isSupabaseConfigured } from './supabase';
import { WeeklyActivity, WeeklySubmission, MonthlyTimesheet, WorkPlanActivity, AuditLogItem } from '@/types';

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
      week_number: a.week_number,
      week_label: a.week_label,
      start_date: a.start_date,
      end_date: a.end_date,
      day_of_week: a.day_of_week || null,
      milestone: a.milestone,
      work_plan_ref: a.work_plan_code || null,
      title: a.title,
      location: a.location,
      expected_output: a.expected_output,
      status: a.status,
      progress_pct: a.progress_pct,
      notes: a.execution_notes || null,
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
