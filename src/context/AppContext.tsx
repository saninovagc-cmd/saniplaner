'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserProfile, 
  WorkPlanActivity, 
  WorkPlanSubActivity,
  ActivityStatus,
  B09MonthlyMetric, 
  B09ReminderRecord,
  B09QuarterlyDossier,
  B13Item, 
  FieldMission, 
  Training, 
  Deliverable, 
  DocumentItem, 
  AuditLogItem,
  DeliverableStatus,
  MissionStatus,
  WeeklyActivity,
  WeeklySubmission,
  MonthlyTimesheet,
  ProjectRisk,
  BudgetExpenditure,
  MeetingSession,
  GalleryItem,
  GalleryPhotoItem
} from '@/types';
import { 
  MOCK_USERS, 
  MOCK_WORK_PLAN, 
  MOCK_B09_METRICS, 
  MOCK_B09_REMINDERS,
  MOCK_B09_DOSSIERS,
  MOCK_B13_ITEMS, 
  MOCK_FIELD_MISSIONS, 
  MOCK_TRAININGS, 
  MOCK_DELIVERABLES, 
  MOCK_DOCUMENTS, 
  MOCK_AUDIT_LOGS,
  MOCK_WEEKLY_ACTIVITIES,
  MOCK_WEEKLY_SUBMISSIONS,
  MOCK_TIMESHEETS,
  MOCK_PROJECT_RISKS,
  MOCK_EXPENDITURES,
  MOCK_GALLERY_ITEMS
} from '@/lib/mock-data';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  syncWeeklyActivitiesToCloud, 
  syncWeeklySubmissionToCloud, 
  syncTimesheetToCloud, 
  syncAuditLogToCloud,
  syncUserCredentialsToCloud,
  fetchUsersFromCloud,
  saveModuleToCloud,
  fetchCloudModulesWithMeta,
  fetchFastCloudModules,
  fetchMissionsCloudModule,
  deleteWeeklyActivityFromCloud,
  deleteMissionFromCloud,
  filterOutFictitiousActivities,
  filterOutFictitiousSubmissions,
  filterOutMockMissions,
  filterOutMockDeliverables,
  getGlobalLiveChannel,
  broadcastModuleUpdate,
  checkModulesLastUpdated,
  MOCK_MEETING_IDS,
  filterOutMockMeetings,
  addCloudTombstones,
  CLOUD_MODULE_KEYS,
  HEAVY_MODULE_KEYS,
  SYNC_CLIENT_ID
} from '@/lib/supabase-sync';

// ====================================================================
// SÉANCES : persistance robuste (anti-disparition)
// ====================================================================
const MEETINGS_LS_KEY = 'saniplaner_meetings';
const MEETINGS_PENDING_LS_KEY = 'saniplaner_meetings_pending';
const MEETINGS_DELETED_LS_KEY = 'saniplaner_deleted_meeting_ids';

function meetingTs(m: any): number {
  const raw = m?.updated_at || m?.created_at || '';
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : 0;
}

// Retire les pièces jointes volumineuses (base64) pour tenir dans le quota du navigateur
function stripHeavyDataUrls<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) =>
    typeof v === 'string' && v.startsWith('data:') && v.length > 20000 ? '' : v
  ));
}

// Écriture localStorage tolérante au quota : n'allège les pièces jointes que si > 900 Ko ou quota dépassé
function safeLocalSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = JSON.stringify(value);
    if (raw.length > 900_000) {
      localStorage.setItem(key, JSON.stringify(stripHeavyDataUrls(value)));
    } else {
      localStorage.setItem(key, raw);
    }
  } catch {
    try { localStorage.setItem(key, JSON.stringify(stripHeavyDataUrls(value))); } catch { /* ignore */ }
  }
}

function readLocalArray<T = any>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const s = localStorage.getItem(key);
    const parsed = s ? JSON.parse(s) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function readDeletedMeetingIds(): Set<string> {
  return new Set(readLocalArray<string>(MEETINGS_DELETED_LS_KEY));
}

function addLocalDeletedMeetingId(id: string): void {
  const existing = readLocalArray<string>(MEETINGS_DELETED_LS_KEY);
  if (!existing.includes(id)) {
    safeLocalSet(MEETINGS_DELETED_LS_KEY, [...existing, id]);
  }
  const pending = readLocalArray<MeetingSession>(MEETINGS_PENDING_LS_KEY);
  const nextPending = pending.filter(p => p && p.id !== id);
  if (nextPending.length !== pending.length) {
    safeLocalSet(MEETINGS_PENDING_LS_KEY, nextPending);
  }
}

function savePendingMeeting(m: MeetingSession): void {
  const pending = readLocalArray<MeetingSession>(MEETINGS_PENDING_LS_KEY).filter(p => p && p.id !== m.id);
  safeLocalSet(MEETINGS_PENDING_LS_KEY, [m, ...pending]);
}

function clearPendingMeeting(id: string, savedUpdatedAt?: string): void {
  const pending = readLocalArray<MeetingSession>(MEETINGS_PENDING_LS_KEY);
  const savedTs = savedUpdatedAt ? Date.parse(savedUpdatedAt) : Infinity;
  const remaining = pending.filter(p => {
    if (!p) return false;
    if (p.id !== id) return true;
    const pTs = meetingTs(p);
    return Number.isFinite(savedTs) && pTs > savedTs;
  });
  if (remaining.length !== pending.length) {
    safeLocalSet(MEETINGS_PENDING_LS_KEY, remaining);
  }
}

// ====================================================================
// BUDGET / COMPTABILITÉ : persistance robuste (anti-disparition)
// ====================================================================
const BUDGET_LS_KEY = 'saniplaner_expenditures';
const BUDGET_PENDING_LS_KEY = 'saniplaner_expenditures_pending';
const BUDGET_DELETED_LS_KEY = 'saniplaner_deleted_expenditure_ids';

function readDeletedBudgetIds(): Set<string> {
  return new Set(readLocalArray<string>(BUDGET_DELETED_LS_KEY));
}

function addLocalDeletedBudgetId(id: string): void {
  const existing = readLocalArray<string>(BUDGET_DELETED_LS_KEY);
  if (!existing.includes(id)) {
    safeLocalSet(BUDGET_DELETED_LS_KEY, [...existing, id]);
  }
  const pending = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY);
  const nextPending = pending.filter(p => p && p.id !== id);
  if (nextPending.length !== pending.length) {
    safeLocalSet(BUDGET_PENDING_LS_KEY, nextPending);
  }
}

function savePendingExpenditure(exp: BudgetExpenditure): void {
  const pending = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY).filter(p => p && p.id !== exp.id);
  safeLocalSet(BUDGET_PENDING_LS_KEY, [exp, ...pending]);
}

function savePendingExpendituresBatch(exps: BudgetExpenditure[]): void {
  const incomingIds = new Set(exps.map(e => e.id));
  const pending = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY).filter(p => p && !incomingIds.has(p.id));
  safeLocalSet(BUDGET_PENDING_LS_KEY, [...exps, ...pending]);
}

function clearPendingExpenditure(id: string, savedUpdatedAt?: string): void {
  const pending = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY);
  const savedTs = savedUpdatedAt ? Date.parse(savedUpdatedAt) : Infinity;
  const remaining = pending.filter(p => {
    if (!p) return false;
    if (p.id !== id) return true;
    const pTs = meetingTs(p);
    return Number.isFinite(savedTs) && pTs > savedTs;
  });
  if (remaining.length !== pending.length) {
    safeLocalSet(BUDGET_PENDING_LS_KEY, remaining);
  }
}

function clearPendingExpenditures(ids: Set<string>): void {
  const pending = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY);
  const remaining = pending.filter(p => p && !ids.has(p.id));
  if (remaining.length !== pending.length) {
    safeLocalSet(BUDGET_PENDING_LS_KEY, remaining);
  }
}

interface AppContextType {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  users: UserProfile[];
  allUsers?: UserProfile[];
  activities: WorkPlanActivity[];
  updateActivity: (activity: WorkPlanActivity) => void;
  updateSubActivity: (activityId: string, subActivity: WorkPlanSubActivity) => void;
  addSubActivity: (activityId: string, subActivity: WorkPlanSubActivity) => void;
  deleteSubActivity: (activityId: string, subId: string) => void;
  addActivity: (activity: WorkPlanActivity) => void;
  weeklyActivities: WeeklyActivity[];
  weeklySubmissions: WeeklySubmission[];
  addWeeklyActivity: (act: WeeklyActivity) => void;
  updateWeeklyActivity: (act: WeeklyActivity) => void;
  deleteWeeklyActivity: (id: string) => void;
  saveBatchWeeklyActivities: (acts: WeeklyActivity[]) => void;
  submitWeeklyPlanning: (expertId: string, weekNumber: number) => void;
  toggleWeeklySubmission: (expertId: string, weekNumber: number) => void;
  timesheets: MonthlyTimesheet[];
  createOrUpdateTimesheet: (ts: MonthlyTimesheet) => void;
  submitTimesheet: (id: string) => void;
  verifyTimesheet: (id: string, verifierName: string) => void;
  validateTimesheet: (id: string, validatorName: string) => void;
  rejectTimesheet: (id: string, reason: string) => void;
  projectRisks: ProjectRisk[];
  updateProjectRisk: (risk: ProjectRisk) => void;
  b09Metrics: B09MonthlyMetric[];
  updateB09Metric: (metric: B09MonthlyMetric) => void;
  addB09Metric: (metric: B09MonthlyMetric) => void;
  deleteB09Metric: (id: string) => void;
  initB09MonthZones: (month: number, year: number) => void;
  resetB09Metrics: (month?: number, year?: number) => void;
  b09Reminders: B09ReminderRecord[];
  addB09Reminder: (reminder: B09ReminderRecord) => void;
  deleteB09Reminder: (id: string) => void;
  b09Dossiers: B09QuarterlyDossier[];
  updateB09Dossier: (dossier: B09QuarterlyDossier) => void;
  b13Items: B13Item[];
  updateB13Item: (item: B13Item) => void;
  addB13Item: (item: B13Item) => void;
  deleteB13Item: (id: string) => void;
  expenditures: BudgetExpenditure[];
  addExpenditure: (exp: BudgetExpenditure) => Promise<boolean>;
  updateExpenditure: (exp: BudgetExpenditure) => Promise<boolean>;
  deleteExpenditure: (id: string) => Promise<boolean>;
  importExpendituresBatch: (exps: BudgetExpenditure[]) => Promise<boolean>;
  missions: FieldMission[];
  updateMissionStatus: (id: string, status: MissionStatus) => void;
  updateMission: (mission: FieldMission) => void;
  addMission: (mission: FieldMission) => void;
  deleteMission: (id: string) => void;
  trainings: Training[];
  addTraining: (training: Training) => void;
  updateTraining: (training: Training) => void;
  deleteTraining: (id: string) => void;
  meetings: MeetingSession[];
  addMeeting: (meeting: MeetingSession) => Promise<boolean>;
  updateMeeting: (meeting: MeetingSession) => Promise<boolean>;
  deleteMeeting: (id: string) => Promise<boolean>;
  deliverables: Deliverable[];
  updateDeliverableStatus: (id: string, status: DeliverableStatus, comments?: string) => void;
  documents: DocumentItem[];
  addDocument: (doc: DocumentItem) => void;
  galleryItems: GalleryItem[];
  addGalleryItem: (item: GalleryItem) => void;
  updateGalleryItem: (item: GalleryItem) => void;
  deleteGalleryItem: (id: string) => void;
  addPhotoToGalleryItem: (itemId: string, photo: GalleryPhotoItem) => void;
  deletePhotoFromGalleryItem: (itemId: string, photoId: string) => void;
  auditLogs: AuditLogItem[];
  addAuditLog: (action: string, module: string, entityRef: string) => void;
  updateUser: (updatedUser: UserProfile) => void;
  changePassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  isPasswordChangeRequired: boolean;
  lastSyncTime: string;
  syncNow: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Purge automatique des données de démonstration antérieures pour un démarrage de production propre
if (typeof window !== 'undefined') {
  const PURGE_KEY = 'saniplaner_v4_demo_cleared';
  if (localStorage.getItem(PURGE_KEY) !== 'true') {
    try {
      localStorage.removeItem('saniplaner_expenditures');
      localStorage.removeItem('saniplaner_meetings');
      localStorage.removeItem('saniplaner_trainings');
      localStorage.removeItem('saniplaner_b09_reminders');
      localStorage.removeItem('saniplaner_missions');
      localStorage.removeItem('saniplaner_timesheets');
      localStorage.removeItem('saniplaner_weekly_activities');
      localStorage.removeItem('saniplaner_weekly_submissions');
      localStorage.setItem(PURGE_KEY, 'true');
    } catch {}
  }

  // Restauration de la dernière actualisation officielle et chronologie exacte des 9 zones (DCO: 51/63, NBT: 36/38, total 329/356 à 92.4%)
  const B09_RESTORE_KEY = 'saniplaner_b09_exact_chronology_all9zones_final_v9';
  if (localStorage.getItem(B09_RESTORE_KEY) !== 'true') {
    try {
      localStorage.removeItem('saniplaner_b09_metrics');
      localStorage.removeItem('saniplaner_b09_reminders');
      localStorage.setItem(B09_RESTORE_KEY, 'true');
    } catch {}
  }

  // Purge définitive des données tests résiduelles (conserve uniquement les saisies réelles)
  const PURGE_ALL_TEST_KEY = 'saniplaner_v6_test_data_purged';
  if (localStorage.getItem(PURGE_ALL_TEST_KEY) !== 'true') {
    try {
      localStorage.removeItem('saniplaner_deliverables');
      const storedMissions = localStorage.getItem('saniplaner_missions');
      if (storedMissions) {
        try {
          const parsed = JSON.parse(storedMissions);
          if (Array.isArray(parsed)) {
            const cleanM = filterOutMockMissions(parsed);
            localStorage.setItem('saniplaner_missions', JSON.stringify(cleanM));
          }
        } catch {}
      }
      localStorage.setItem(PURGE_ALL_TEST_KEY, 'true');
    } catch {}
  }
}

// Enrichit dynamiquement les activités avec leurs sous-activités contractuelles et recalcule la progression pondérée
export function enrichActivitiesWithSubActivities(acts: WorkPlanActivity[]): WorkPlanActivity[] {
  if (!Array.isArray(acts) || acts.length === 0) return MOCK_WORK_PLAN;
  const mockMap = new Map<string, WorkPlanActivity>();
  MOCK_WORK_PLAN.forEach(a => mockMap.set(a.id, a));

  const existingIds = new Set(acts.map(a => a.id));

  // 1. Enrichit les activités existantes
  const enriched: WorkPlanActivity[] = acts.map(a => {
    // Cas spécifique TRANS-02 : Espace dédié aux imprévus, pas de sous-activités prédéfinies
    if (a.id === 'act-trans-coord-02') {
      const realSubs = (a.sub_activities || []).filter(
        s => s.id !== 'sub-act-trans-02-1' && s.id !== 'sub-act-trans-02-2'
      );
      if (realSubs.length === 0) {
        return {
          ...a,
          sub_activities: [],
          progress_pct: 0,
          status: 'A_VENIR' as ActivityStatus,
          active_months: []
        };
      }
      const totalWeight = realSubs.reduce((s, sub) => s + sub.weight_pct, 0);
      const computedProg = totalWeight > 0 
        ? Math.min(100, Math.round(realSubs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / totalWeight, 0)))
        : 0;
      return {
        ...a,
        sub_activities: realSubs,
        progress_pct: computedProg,
        status: (computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : 'A_VENIR')) as ActivityStatus
      };
    }

    const mockAct = mockMap.get(a.id);
    if (!a.sub_activities || a.sub_activities.length === 0) {
      if (mockAct && mockAct.sub_activities && mockAct.sub_activities.length > 0) {
        const subs = mockAct.sub_activities;
        const computedProg = Math.round(subs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / 100, 0));
        return {
          ...a,
          sub_activities: subs,
          progress_pct: a.progress_pct > 0 ? a.progress_pct : computedProg,
          status: (a.status !== 'A_VENIR' ? a.status : (computedProg > 0 ? 'EN_COURS' : 'A_VENIR')) as ActivityStatus
        };
      }
    } else {
      const subs = a.sub_activities;
      const computedProg = Math.round(subs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / 100, 0));
      return {
        ...a,
        progress_pct: computedProg,
        status: (computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : a.status)) as ActivityStatus
      };
    }
    return a;
  });

  // 2. Intègre les nouvelles activités contractuelles du Work Plan (ex: TRANS-02) si non présentes
  MOCK_WORK_PLAN.forEach((mockAct, idx) => {
    if (!existingIds.has(mockAct.id)) {
      enriched.splice(idx, 0, mockAct);
      existingIds.add(mockAct.id);
    }
  });

  return enriched;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const toggleMobileSidebar = () => setMobileSidebarOpen(prev => !prev);
  const [users, setUsers] = useState<UserProfile[]>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('saniplaner_users');
      if (s) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const psiMock = MOCK_USERS.find(u => u.id === 'usr-psi-abms');
            if (psiMock) {
              const updated = parsed.map((u: UserProfile) => u.id === 'usr-psi-abms' ? { ...u, allowed_modules: psiMock.allowed_modules } : u);
              try { localStorage.setItem('saniplaner_users', JSON.stringify(updated)); } catch {}
              return updated;
            }
            return parsed;
          }
        } catch {}
      }
    }
    return MOCK_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      const currentSavedId = localStorage.getItem('saniplaner_user_id');
      const savedUsers = localStorage.getItem('saniplaner_users');
      if (currentSavedId) {
        let uList = MOCK_USERS;
        if (savedUsers) {
          try {
            const parsed = JSON.parse(savedUsers);
            if (Array.isArray(parsed) && parsed.length > 0) uList = parsed;
          } catch {}
        }
        const found = uList.find(u => u.id === currentSavedId);
        if (found) {
          if (found.id === 'usr-psi-abms') {
            const psiMock = MOCK_USERS.find(u => u.id === 'usr-psi-abms');
            if (psiMock) return { ...found, allowed_modules: psiMock.allowed_modules };
          }
          return found;
        }
      }
    }
    return MOCK_USERS[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('saniplaner_user_id'));
    }
    return false;
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [activities, setActivities] = useState<WorkPlanActivity[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_activities');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return enrichActivitiesWithSubActivities(parsed);
        } catch {}
      }
    }
    return MOCK_WORK_PLAN;
  });
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivity[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_weekly_activities');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanList = filterOutFictitiousActivities(parsed);
            const map = new Map<string, WeeklyActivity>();
            MOCK_WEEKLY_ACTIVITIES.forEach(a => { if (a && a.id) map.set(a.id, a); });
            cleanList.forEach((a: WeeklyActivity) => { if (a && a.id) map.set(a.id, a); });
            const result = Array.from(map.values());
            try { localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(result)); } catch {}
            return result;
          }
        } catch {}
      }
    }
    return MOCK_WEEKLY_ACTIVITIES;
  });
  const [weeklySubmissions, setWeeklySubmissions] = useState<WeeklySubmission[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_weekly_submissions');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanSubs = filterOutFictitiousSubmissions(parsed);
            const map = new Map<string, WeeklySubmission>();
            MOCK_WEEKLY_SUBMISSIONS.forEach(s => { if (s && s.id) map.set(s.id, s); });
            cleanSubs.forEach((s: WeeklySubmission) => { if (s && s.id) map.set(s.id, s); });
            const result = Array.from(map.values());
            try { localStorage.setItem('saniplaner_weekly_submissions', JSON.stringify(result)); } catch {}
            return result;
          }
        } catch {}
      }
    }
    return MOCK_WEEKLY_SUBMISSIONS;
  });
  const [timesheets, setTimesheets] = useState<MonthlyTimesheet[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_timesheets');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return MOCK_TIMESHEETS;
  });

  const weeklyActivitiesRef = useRef<WeeklyActivity[]>(weeklyActivities);
  const weeklySubmissionsRef = useRef<WeeklySubmission[]>(weeklySubmissions);

  useEffect(() => {
    weeklyActivitiesRef.current = weeklyActivities;
  }, [weeklyActivities]);

  useEffect(() => {
    weeklySubmissionsRef.current = weeklySubmissions;
  }, [weeklySubmissions]);
  const [projectRisks, setProjectRisks] = useState<ProjectRisk[]>(MOCK_PROJECT_RISKS);
  const [b09Metrics, setB09Metrics] = useState<B09MonthlyMetric[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_b09_metrics');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const hasRealData = parsed.some((m: any) => (m.submitted_on_time || 0) > 0);
            if (hasRealData) return parsed;
          }
        } catch { /* ignore */ }
      }
    }
    return MOCK_B09_METRICS;
  });
  const [b09Reminders, setB09Reminders] = useState<B09ReminderRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_b09_reminders');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore */ }
      }
    }
    return MOCK_B09_REMINDERS;
  });
  const [b09Dossiers, setB09Dossiers] = useState<B09QuarterlyDossier[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_b09_dossiers');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore */ }
      }
    }
    return MOCK_B09_DOSSIERS;
  });
  const [b13Items, setB13Items] = useState<B13Item[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_b13_items');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore */ }
      }
    }
    return MOCK_B13_ITEMS;
  });
  const b13ItemsRef = useRef<B13Item[]>(b13Items);
  useEffect(() => {
    b13ItemsRef.current = b13Items;
  }, [b13Items]);
  const [expenditures, setExpenditures] = useState<BudgetExpenditure[]>(() => {
    if (typeof window === 'undefined') return MOCK_EXPENDITURES;
    const deletedIds = readDeletedBudgetIds();
    const local = readLocalArray<BudgetExpenditure>(BUDGET_LS_KEY);
    const pending = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY);
    if (local.length === 0 && pending.length === 0) {
      return MOCK_EXPENDITURES.filter(e => !deletedIds.has(e.id));
    }
    const map = new Map<string, BudgetExpenditure>();
    [...local, ...pending].forEach(e => {
      if (!e || !e.id || deletedIds.has(e.id)) return;
      const cur = map.get(e.id);
      if (!cur || meetingTs(e) >= meetingTs(cur)) map.set(e.id, e);
    });
    return Array.from(map.values());
  });
  const expendituresRef = useRef<BudgetExpenditure[]>(expenditures);
  const activeBudgetWritesRef = useRef(0);

  useEffect(() => {
    expendituresRef.current = expenditures;
    safeLocalSet(BUDGET_LS_KEY, expenditures);
  }, [expenditures]);
  const [missions, setMissions] = useState<FieldMission[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_missions');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return filterOutMockMissions(parsed);
          }
        } catch { /* ignore */ }
      }
    }
    return [];
  });
  const missionsRef = useRef<FieldMission[]>(missions);

  useEffect(() => {
    missionsRef.current = missions;
  }, [missions]);
  const [trainings, setTrainings] = useState<Training[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_trainings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore */ }
      }
    }
    return MOCK_TRAININGS;
  });
  const trainingsRef = useRef<Training[]>(trainings);

  useEffect(() => {
    trainingsRef.current = trainings;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saniplaner_trainings', JSON.stringify(trainings));
      } catch { /* ignore */ }
    }
  }, [trainings]);
  const [meetings, setMeetings] = useState<MeetingSession[]>(() => {
    if (typeof window === 'undefined') return [];
    const deletedIds = readDeletedMeetingIds();
    const map = new Map<string, MeetingSession>();
    // Cache local + saisies en attente d'envoi (jamais perdues au rechargement)
    [...readLocalArray<MeetingSession>(MEETINGS_LS_KEY), ...readLocalArray<MeetingSession>(MEETINGS_PENDING_LS_KEY)]
      .forEach(m => {
        if (!m || !m.id || deletedIds.has(m.id)) return;
        const cur = map.get(m.id);
        if (!cur || meetingTs(m) >= meetingTs(cur)) map.set(m.id, m);
      });
    return filterOutMockMeetings(Array.from(map.values()));
  });
  const meetingsRef = useRef<MeetingSession[]>(meetings);
  const activeMeetingWritesRef = useRef(0);

  useEffect(() => {
    meetingsRef.current = meetings;
    safeLocalSet(MEETINGS_LS_KEY, meetings);
  }, [meetings]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_deliverables');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return filterOutMockDeliverables(parsed);
          }
        } catch { /* ignore */ }
      }
    }
    return [];
  });
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_gallery');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        } catch { /* ignore */ }
      }
    }
    return MOCK_GALLERY_ITEMS;
  });

  const galleryItemsRef = useRef<GalleryItem[]>(galleryItems);

  useEffect(() => {
    galleryItemsRef.current = galleryItems;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saniplaner_gallery', JSON.stringify(galleryItems));
      } catch { /* ignore */ }
    }
  }, [galleryItems]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Broadcast channel for instantaneous cross-tab AND cross-device synchronization
  const broadcastSync = (type: string, payload?: unknown) => {
    lastLocalSaveRef.current = Date.now();
    // 1. Synchronisation cross-tab locale (même machine)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('saniplaner_sync_bus');
        bc.postMessage({ type, payload, senderId: SYNC_CLIENT_ID, timestamp: Date.now() });
        bc.close();
      } catch {}
    }

    // 2. Diffusion temps réel globale (TOUS les ordinateurs distants connectés)
    try {
      const liveCh = getGlobalLiveChannel();
      if (liveCh) {
        liveCh.send({
          type: 'broadcast',
          event: 'GLOBAL_SYNC',
          payload: { type, payload, senderId: SYNC_CLIENT_ID, timestamp: Date.now() },
        }).catch(() => {});
      }
    } catch {}
  };

  const isSyncingRef = useRef(false);
  const lastLocalSaveRef = useRef(0);
  const pendingSyncKeysRef = useRef<Set<string> | 'ALL' | null>(null);
  const syncedTimestampsRef = useRef<Record<string, string>>({});
  const initialFastSyncDoneRef = useRef(false);
  const initialMissionsSyncDoneRef = useRef(false);
  const isSyncingMissionsRef = useRef(false);
  const pendingMissionsSyncRef = useRef(false);

  // Synchronisation dédiée aux missions (payload ~4.6 Mo avec PDF base64) : ne bloque jamais les autres modules
  const syncMissionsInBackground = async () => {
    if (!isSupabaseConfigured) return;
    if (isSyncingMissionsRef.current) {
      pendingMissionsSyncRef.current = true;
      return;
    }
    isSyncingMissionsRef.current = true;
    try {
      const { modules: missionStore, timestamps } = await fetchMissionsCloudModule();
      if (timestamps[CLOUD_MODULE_KEYS.MISSIONS]) {
        syncedTimestampsRef.current[CLOUD_MODULE_KEYS.MISSIONS] = timestamps[CLOUD_MODULE_KEYS.MISSIONS];
      }
      initialMissionsSyncDoneRef.current = true;

      let deletedIds = new Set<string>();
      if (typeof window !== 'undefined') {
        try {
          const d = localStorage.getItem('saniplaner_deleted_mission_ids');
          if (d) deletedIds = new Set(JSON.parse(d));
        } catch {}
      }

      if (missionStore[CLOUD_MODULE_KEYS.MISSIONS]) {
        const cloudMissions: FieldMission[] = Array.isArray(missionStore[CLOUD_MODULE_KEYS.MISSIONS])
          ? filterOutMockMissions(missionStore[CLOUD_MODULE_KEYS.MISSIONS]).filter((m: any) => m && m.id && !deletedIds.has(m.id))
          : [];

        let localMissions: FieldMission[] = [];
        if (typeof window !== 'undefined') {
          try {
            const s = localStorage.getItem('saniplaner_missions');
            if (s) {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) {
                localMissions = filterOutMockMissions(parsed).filter((m: any) => m && m.id && !deletedIds.has(m.id));
              }
            }
          } catch {}
        }

        const missionMap = new Map<string, FieldMission>();
        cloudMissions.forEach(m => { if (m && m.id && !deletedIds.has(m.id)) missionMap.set(m.id, m); });
        // Ne jamais écraser les missions cloud (qui contiennent les PDF complets) par localStorage potentiellement allégé
        localMissions.forEach(m => { if (m && m.id && !deletedIds.has(m.id) && !missionMap.has(m.id)) missionMap.set(m.id, m); });
        const mergedMissions = Array.from(missionMap.values());

        setMissions(mergedMissions);
        missionsRef.current = mergedMissions;
        safeLocalSet('saniplaner_missions', mergedMissions);

        if (mergedMissions.length !== cloudMissions.length) {
          saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', mergedMissions);
        }
      } else {
        let localMissions: FieldMission[] = [];
        if (typeof window !== 'undefined') {
          try {
            const s = localStorage.getItem('saniplaner_missions');
            if (s) {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) {
                localMissions = filterOutMockMissions(parsed).filter((m: any) => m && m.id && !deletedIds.has(m.id));
              }
            }
          } catch {}
        }
        const fallback = localMissions.length > 0 ? localMissions : [];
        setMissions(fallback);
        missionsRef.current = fallback;
      }
    } catch {
      // Offline / background fallback
    } finally {
      isSyncingMissionsRef.current = false;
      if (pendingMissionsSyncRef.current) {
        pendingMissionsSyncRef.current = false;
        syncMissionsInBackground().catch(() => {});
      }
    }
  };

  // Routine de synchronisation rapide (< 1 s) pour tous les modules légers, avec file d'attente sans perte d'événements
  const syncNowInternal = async (onlyKeys?: string[]) => {
    const hasExplicitKeys = Array.isArray(onlyKeys) && onlyKeys.length > 0;
    const requestedFastKeys = hasExplicitKeys
      ? onlyKeys.filter((k) => !HEAVY_MODULE_KEYS.has(k))
      : [];

    if (hasExplicitKeys) {
      if (onlyKeys.includes(CLOUD_MODULE_KEYS.MISSIONS)) {
        syncMissionsInBackground().catch(() => {});
      }
      if (requestedFastKeys.length === 0) {
        return;
      }
    }

    if (isSyncingRef.current) {
      if (!hasExplicitKeys) {
        pendingSyncKeysRef.current = 'ALL';
      } else if (pendingSyncKeysRef.current !== 'ALL') {
        if (!pendingSyncKeysRef.current) pendingSyncKeysRef.current = new Set<string>();
        requestedFastKeys.forEach((k) => (pendingSyncKeysRef.current as Set<string>).add(k));
      }
      return;
    }

    isSyncingRef.current = true;
    const isTargeted = hasExplicitKeys;
    const targetKeySet = isTargeted ? new Set(requestedFastKeys) : null;
    if (targetKeySet && (targetKeySet.has(CLOUD_MODULE_KEYS.MEETINGS) || targetKeySet.has(CLOUD_MODULE_KEYS.BUDGET))) {
      targetKeySet.add(CLOUD_MODULE_KEYS.TOMBSTONES);
    }
    const shouldApply = (key: string) => !targetKeySet || targetKeySet.has(key);

    try {
      if (!isTargeted && typeof window !== 'undefined') {
        const savedUsers = localStorage.getItem('saniplaner_users');
        if (savedUsers) {
          try {
            const parsed = JSON.parse(savedUsers);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const existingIds = new Set(parsed.map((savedU: UserProfile) => savedU.id));
              const missingUsers = MOCK_USERS.filter(m => !existingIds.has(m.id));

              // Synchronize latest institutional metadata (title, departments, zones) while preserving custom passwords/modules
              const merged = [
                ...parsed.map((savedU: UserProfile) => {
                  const ref = MOCK_USERS.find(m => m.id === savedU.id);
                  if (ref) {
                    return {
                      ...ref,
                      ...savedU,
                      full_name: ref.full_name,
                      title: ref.title,
                      email: ref.email,
                      username: ref.username || savedU.username,
                      role: ref.role || savedU.role,
                      is_super_admin: ref.is_super_admin,
                      is_hidden: ref.is_hidden,
                      assigned_departments: ref.assigned_departments,
                      assigned_zones: ref.assigned_zones,
                      base_location: ref.base_location,
                    };
                  }
                  return savedU;
                }),
                ...missingUsers,
              ];
              setUsers(merged);
              try {
                localStorage.setItem('saniplaner_users', JSON.stringify(merged));
              } catch { /* storage full / ignore */ }
              const currentSavedId = localStorage.getItem('saniplaner_user_id');
              if (currentSavedId) {
                const found = merged.find((u: UserProfile) => u.id === currentSavedId);
                if (found) {
                  setCurrentUser(found);
                  setIsAuthenticated(true);
                } else {
                  setIsAuthenticated(false);
                }
              } else {
                setIsAuthenticated(false);
              }
            } else {
              setIsAuthenticated(false);
            }
          } catch {}
        } else {
          const currentSavedId = localStorage.getItem('saniplaner_user_id');
          if (currentSavedId) {
            const found = MOCK_USERS.find((u: UserProfile) => u.id === currentSavedId);
            if (found) {
              setCurrentUser(found);
              setIsAuthenticated(true);
            } else {
              setIsAuthenticated(false);
            }
          } else {
            setIsAuthenticated(false);
          }
        }

        if (missionsRef.current.length === 0) {
          const savedMissions = localStorage.getItem('saniplaner_missions');
          if (savedMissions) {
            try {
              const parsedM = JSON.parse(savedMissions);
              if (Array.isArray(parsedM) && parsedM.length > 0) {
                const cleanM = filterOutMockMissions(parsedM);
                setMissions(cleanM);
                missionsRef.current = cleanM;
              }
            } catch {}
          }
        }

        const savedTimesheets = localStorage.getItem('saniplaner_timesheets');
        if (savedTimesheets) {
          try {
            const parsedT = JSON.parse(savedTimesheets);
            if (Array.isArray(parsedT)) {
              // Purge demo timesheets
              const cleanT = parsedT.filter((t: any) => t && t.id !== 'ts-2026-11-usr-rsco-3');
              if (cleanT.length !== parsedT.length) {
                localStorage.setItem('saniplaner_timesheets', JSON.stringify(cleanT));
              }
              setTimesheets(cleanT);
            }
          } catch {}
        }

        if (expendituresRef.current.length === 0 && activeBudgetWritesRef.current === 0) {
          const savedExp = localStorage.getItem(BUDGET_LS_KEY);
          if (savedExp) {
            try {
              const parsedE = JSON.parse(savedExp);
              if (Array.isArray(parsedE)) {
                const deletedExpIds = readDeletedBudgetIds();
                const cleanE = parsedE.filter((e: any) => e && e.id && !deletedExpIds.has(e.id));
                expendituresRef.current = cleanE;
                setExpenditures(cleanE);
              }
            } catch {}
          }
        }
      }

      if (isSupabaseConfigured) {
        // Chargement rapide (< 1 s) : Profils Utilisateurs + Modules légers (ou modules ciblés uniquement)
        let cloudUsers: Partial<UserProfile>[] = [];
        let cloudStore: Record<string, any> = {};
        let cloudTimestamps: Record<string, string> = {};

        try {
          if (isTargeted && targetKeySet) {
            const sRes = await fetchCloudModulesWithMeta(Array.from(targetKeySet)).catch(() => ({ modules: {}, timestamps: {} }));
            cloudStore = sRes?.modules || {};
            cloudTimestamps = sRes?.timestamps || {};
          } else {
            const [uRes, sRes] = await Promise.all([
              fetchUsersFromCloud().catch(() => []),
              fetchFastCloudModules().catch(() => ({ modules: {}, timestamps: {} })),
            ]);
            cloudUsers = uRes || [];
            cloudStore = sRes?.modules || {};
            cloudTimestamps = sRes?.timestamps || {};
          }
        } catch { /* non-blocking */ }

        Object.entries(cloudTimestamps).forEach(([id, ts]) => {
          if (ts) syncedTimestampsRef.current[id] = ts;
        });
        if (!isTargeted) {
          initialFastSyncDoneRef.current = true;
        }

        // 1. Appliquer les utilisateurs reçus
        if (cloudUsers.length > 0) {
          setUsers(prev => {
            const updated = prev.map(u => {
              const cloud = cloudUsers.find(c => c.id === u.id || (c.username && c.username.toLowerCase() === u.username?.toLowerCase()));
              if (cloud) {
                return {
                  ...u,
                  password: cloud.password || u.password,
                  is_first_login: cloud.is_first_login !== undefined ? cloud.is_first_login : u.is_first_login,
                  role: (cloud.role as any) || u.role,
                  allowed_modules: cloud.allowed_modules || u.allowed_modules,
                };
              }
              return u;
            });

            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('saniplaner_users', JSON.stringify(updated));
              } catch {}
            }

            return updated;
          });

          // Keep current logged-in user in sync with latest password/modules/role
          setCurrentUser(prevCurrent => {
            if (!prevCurrent) return prevCurrent;
            const cloudCurrent = cloudUsers.find(c => c.id === prevCurrent.id || (c.username && c.username.toLowerCase() === prevCurrent.username?.toLowerCase()));
            if (cloudCurrent) {
              return {
                ...prevCurrent,
                password: cloudCurrent.password || prevCurrent.password,
                is_first_login: cloudCurrent.is_first_login !== undefined ? cloudCurrent.is_first_login : prevCurrent.is_first_login,
                role: (cloudCurrent.role as any) || prevCurrent.role,
                allowed_modules: cloudCurrent.allowed_modules || prevCurrent.allowed_modules,
              };
            }
            return prevCurrent;
          });
        }

        // 2. Traiter les données partagées du Cloud Store (Meetings, Timesheets, B13, B09, Budget, Formations, etc.)
        try {
          if (shouldApply(CLOUD_MODULE_KEYS.MEETINGS) && activeMeetingWritesRef.current === 0) {
            const cloudTombArr: string[] = Array.isArray(cloudStore[CLOUD_MODULE_KEYS.TOMBSTONES]?.meetings)
              ? cloudStore[CLOUD_MODULE_KEYS.TOMBSTONES].meetings
              : [];
            const allDeletedIds = new Set<string>([
              ...cloudTombArr,
              ...readDeletedMeetingIds(),
              ...MOCK_MEETING_IDS,
            ]);
            safeLocalSet(MEETINGS_DELETED_LS_KEY, Array.from(allDeletedIds));

            const cloudTombSet = new Set<string>(cloudTombArr);
            const missingLocalDeletes = Array.from(allDeletedIds).filter(
              id => !cloudTombSet.has(id) && !MOCK_MEETING_IDS.has(id)
            );
            if (missingLocalDeletes.length > 0) {
              addCloudTombstones('meetings', missingLocalDeletes).catch(() => {});
            }

            const pendingMeetings = filterOutMockMeetings(readLocalArray<MeetingSession>(MEETINGS_PENDING_LS_KEY))
              .filter((m: any) => !allDeletedIds.has(m.id));
            const localMeetings = filterOutMockMeetings(readLocalArray<MeetingSession>(MEETINGS_LS_KEY))
              .filter((m: any) => !allDeletedIds.has(m.id));

            if (Array.isArray(cloudStore[CLOUD_MODULE_KEYS.MEETINGS])) {
              const rawCloudMeetings: any[] = cloudStore[CLOUD_MODULE_KEYS.MEETINGS];
              const cloudMeetings: MeetingSession[] = filterOutMockMeetings(rawCloudMeetings)
                .filter((m: any) => m && m.id && !allDeletedIds.has(m.id));
              const hadDirtyCloudItems = rawCloudMeetings.length !== cloudMeetings.length;

              const meetingMap = new Map<string, MeetingSession>();
              cloudMeetings.forEach(m => meetingMap.set(m.id, m));

              let needsCloudPush = false;
              pendingMeetings.forEach(p => {
                const cur = meetingMap.get(p.id);
                if (!cur || meetingTs(p) > meetingTs(cur)) {
                  meetingMap.set(p.id, p);
                  needsCloudPush = true;
                }
              });

              // Sauvetage automatique : conserver toute séance réelle encore locale absente du cloud
              localMeetings.forEach(l => {
                if (!meetingMap.has(l.id)) {
                  meetingMap.set(l.id, l);
                  needsCloudPush = true;
                }
              });

              const mergedMeetings = Array.from(meetingMap.values()).sort((a, b) => {
                const dCmp = (b.session_date || '').localeCompare(a.session_date || '');
                if (dCmp !== 0) return dCmp;
                return meetingTs(b) - meetingTs(a);
              });

              meetingsRef.current = mergedMeetings;
              setMeetings(mergedMeetings);
              safeLocalSet(MEETINGS_LS_KEY, mergedMeetings);

              if (needsCloudPush || hadDirtyCloudItems) {
                saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', mergedMeetings, {
                  isDeleteAction: mergedMeetings.length === 0,
                })
                  .then(ok => {
                    if (ok) safeLocalSet(MEETINGS_PENDING_LS_KEY, []);
                  })
                  .catch(() => {});
              } else if (pendingMeetings.length > 0) {
                safeLocalSet(MEETINGS_PENDING_LS_KEY, []);
              }
            } else {
              const fallbackMap = new Map<string, MeetingSession>();
              [...localMeetings, ...pendingMeetings].forEach(m => {
                const cur = fallbackMap.get(m.id);
                if (!cur || meetingTs(m) >= meetingTs(cur)) fallbackMap.set(m.id, m);
              });
              const fallback = Array.from(fallbackMap.values()).sort((a, b) => {
                const dCmp = (b.session_date || '').localeCompare(a.session_date || '');
                if (dCmp !== 0) return dCmp;
                return meetingTs(b) - meetingTs(a);
              });
              meetingsRef.current = fallback;
              setMeetings(fallback);
            }
          }

          if (shouldApply(CLOUD_MODULE_KEYS.TIMESHEETS) && cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS];
            setTimesheets(list);
            try { localStorage.setItem('saniplaner_timesheets', JSON.stringify(list)); } catch {}
          }

          if (shouldApply(CLOUD_MODULE_KEYS.B13) && cloudStore[CLOUD_MODULE_KEYS.B13] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.B13])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.B13];
            b13ItemsRef.current = list;
            setB13Items(list);
            try { localStorage.setItem('saniplaner_b13_items', JSON.stringify(list)); } catch {}
          }

          if (shouldApply(CLOUD_MODULE_KEYS.B09) && cloudStore[CLOUD_MODULE_KEYS.B09]) {
            const b09Data = cloudStore[CLOUD_MODULE_KEYS.B09];
            if (b09Data.metrics && Array.isArray(b09Data.metrics)) {
              const hasRealMetrics = b09Data.metrics.some((m: any) => (m.submitted_on_time || 0) > 0);
              const finalMetrics = hasRealMetrics ? b09Data.metrics : MOCK_B09_METRICS;
              setB09Metrics(finalMetrics);
              try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(finalMetrics)); } catch {}
            }
            if (b09Data.reminders && Array.isArray(b09Data.reminders)) {
              const finalReminders = b09Data.reminders.length > 0 ? b09Data.reminders : MOCK_B09_REMINDERS;
              setB09Reminders(finalReminders);
              try { localStorage.setItem('saniplaner_b09_reminders', JSON.stringify(finalReminders)); } catch {}
            }
            if (b09Data.dossiers && Array.isArray(b09Data.dossiers)) {
              const finalDossiers = b09Data.dossiers.some((d: any) => (d.global_rate || 0) > 0) ? b09Data.dossiers : MOCK_B09_DOSSIERS;
              setB09Dossiers(finalDossiers);
              try { localStorage.setItem('saniplaner_b09_dossiers', JSON.stringify(finalDossiers)); } catch {}
            }
          }

          if (shouldApply(CLOUD_MODULE_KEYS.BUDGET) && activeBudgetWritesRef.current === 0) {
            const cloudBudgetTombArr: string[] = Array.isArray(cloudStore[CLOUD_MODULE_KEYS.TOMBSTONES]?.budget)
              ? cloudStore[CLOUD_MODULE_KEYS.TOMBSTONES].budget
              : [];
            const allDeletedExpIds = new Set<string>([
              ...cloudBudgetTombArr,
              ...readDeletedBudgetIds(),
            ]);
            safeLocalSet(BUDGET_DELETED_LS_KEY, Array.from(allDeletedExpIds));

            const cloudBudgetTombSet = new Set<string>(cloudBudgetTombArr);
            const missingBudgetDeletes = Array.from(allDeletedExpIds).filter(id => !cloudBudgetTombSet.has(id));
            if (missingBudgetDeletes.length > 0) {
              addCloudTombstones('budget', missingBudgetDeletes).catch(() => {});
            }

            const pendingExps = readLocalArray<BudgetExpenditure>(BUDGET_PENDING_LS_KEY)
              .filter((e: any) => e && e.id && !allDeletedExpIds.has(e.id));
            const localExps = readLocalArray<BudgetExpenditure>(BUDGET_LS_KEY)
              .filter((e: any) => e && e.id && !allDeletedExpIds.has(e.id));

            if (Array.isArray(cloudStore[CLOUD_MODULE_KEYS.BUDGET])) {
              const rawCloudExps: any[] = cloudStore[CLOUD_MODULE_KEYS.BUDGET];
              const cloudExps: BudgetExpenditure[] = rawCloudExps
                .filter((e: any) => e && e.id && !allDeletedExpIds.has(e.id));
              const hadDirtyCloudExps = rawCloudExps.length !== cloudExps.length;

              const expMap = new Map<string, BudgetExpenditure>();
              cloudExps.forEach(e => expMap.set(e.id, e));

              let needsCloudPush = false;
              pendingExps.forEach(p => {
                const cur = expMap.get(p.id);
                if (!cur || meetingTs(p) > meetingTs(cur)) {
                  expMap.set(p.id, p);
                  needsCloudPush = true;
                }
              });

              // Sauvetage automatique : conserver toute dépense réelle locale encore absente du cloud
              localExps.forEach(l => {
                if (!expMap.has(l.id)) {
                  expMap.set(l.id, l);
                  needsCloudPush = true;
                }
              });

              const mergedExps = Array.from(expMap.values()).sort((a, b) => {
                const cCmp = (b.created_at || b.date || '').localeCompare(a.created_at || a.date || '');
                if (cCmp !== 0) return cCmp;
                return meetingTs(b) - meetingTs(a);
              });

              expendituresRef.current = mergedExps;
              setExpenditures(mergedExps);
              safeLocalSet(BUDGET_LS_KEY, mergedExps);

              if (needsCloudPush || hadDirtyCloudExps) {
                saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', mergedExps, {
                  isDeleteAction: mergedExps.length === 0,
                })
                  .then(ok => {
                    if (ok) safeLocalSet(BUDGET_PENDING_LS_KEY, []);
                  })
                  .catch(() => {});
              } else if (pendingExps.length > 0) {
                safeLocalSet(BUDGET_PENDING_LS_KEY, []);
              }
            }
          }

          if (shouldApply(CLOUD_MODULE_KEYS.FORMATIONS)) {
            if (cloudStore[CLOUD_MODULE_KEYS.FORMATIONS] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.FORMATIONS])) {
              const list = cloudStore[CLOUD_MODULE_KEYS.FORMATIONS];
              trainingsRef.current = list;
              setTrainings(list);
              try { localStorage.setItem('saniplaner_trainings', JSON.stringify(list)); } catch {}
            } else {
              saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', []);
            }
          }

          if (shouldApply(CLOUD_MODULE_KEYS.PLANNING_HEBDO)) {
          if (cloudStore[CLOUD_MODULE_KEYS.PLANNING_HEBDO]) {
            const planData = cloudStore[CLOUD_MODULE_KEYS.PLANNING_HEBDO];
            const rawCloudActs: WeeklyActivity[] = Array.isArray(planData?.activities) ? planData.activities : [];
            const cloudActs = filterOutFictitiousActivities(rawCloudActs);
            const rawCloudSubs: WeeklySubmission[] = Array.isArray(planData?.submissions) ? planData.submissions : [];
            const cloudSubs = filterOutFictitiousSubmissions(rawCloudSubs);

            // Read local storage to safely merge, never wipe out unsynced user work!
            let localActs: WeeklyActivity[] = [];
            if (typeof window !== 'undefined') {
              try {
                const s = localStorage.getItem('saniplaner_weekly_activities');
                if (s) localActs = filterOutFictitiousActivities(JSON.parse(s) || []);
              } catch {}
            }

            const actMap = new Map<string, WeeklyActivity>();
            MOCK_WEEKLY_ACTIVITIES.forEach(a => { if (a && a.id) actMap.set(a.id, a); });
            cloudActs.forEach(a => { if (a && a.id) actMap.set(a.id, a); });
            localActs.forEach(a => { if (a && a.id && !actMap.has(a.id)) actMap.set(a.id, a); });
            const mergedActs = Array.from(actMap.values());

            setWeeklyActivities(mergedActs);
            weeklyActivitiesRef.current = mergedActs;
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(mergedActs)); } catch {}
            }

            let localSubs: WeeklySubmission[] = [];
            if (typeof window !== 'undefined') {
              try {
                const s = localStorage.getItem('saniplaner_weekly_submissions');
                if (s) localSubs = filterOutFictitiousSubmissions(JSON.parse(s) || []);
              } catch {}
            }
            const subMap = new Map<string, WeeklySubmission>();
            MOCK_WEEKLY_SUBMISSIONS.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
            cloudSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
            localSubs.forEach(s => { if (s && s.id && !subMap.has(s.id)) subMap.set(s.id, s); });
            const mergedSubs = Array.from(subMap.values());

            setWeeklySubmissions(mergedSubs);
            weeklySubmissionsRef.current = mergedSubs;
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('saniplaner_weekly_submissions', JSON.stringify(mergedSubs)); } catch {}
            }

            // Sync clean version to cloud only if new local activities/submissions were merged in
            if (mergedActs.length > cloudActs.length || mergedSubs.length > cloudSubs.length) {
              lastLocalSaveRef.current = Date.now();
              saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
                activities: mergedActs,
                submissions: mergedSubs,
              });
            }
          } else {
            let localActs: WeeklyActivity[] = [];
            let localSubs: WeeklySubmission[] = [];
            if (typeof window !== 'undefined') {
              try {
                const a = localStorage.getItem('saniplaner_weekly_activities');
                if (a) localActs = filterOutFictitiousActivities(JSON.parse(a) || []);
                const s = localStorage.getItem('saniplaner_weekly_submissions');
                if (s) localSubs = filterOutFictitiousSubmissions(JSON.parse(s) || []);
              } catch {}
            }
            const actMap = new Map<string, WeeklyActivity>();
            MOCK_WEEKLY_ACTIVITIES.forEach(a => { if (a && a.id) actMap.set(a.id, a); });
            localActs.forEach(a => { if (a && a.id) actMap.set(a.id, a); });
            const mergedActs = Array.from(actMap.values());

            const subMap = new Map<string, WeeklySubmission>();
            MOCK_WEEKLY_SUBMISSIONS.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
            localSubs.forEach(s => { if (s && s.id) subMap.set(s.id, s); });
            const mergedSubs = Array.from(subMap.values());

            setWeeklyActivities(mergedActs);
            weeklyActivitiesRef.current = mergedActs;
            setWeeklySubmissions(mergedSubs);
            weeklySubmissionsRef.current = mergedSubs;
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(mergedActs));
                localStorage.setItem('saniplaner_weekly_submissions', JSON.stringify(mergedSubs));
              } catch {}
            }
            if (mergedActs.length > 0 || mergedSubs.length > 0) {
              lastLocalSaveRef.current = Date.now();
              saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
                activities: mergedActs,
                submissions: mergedSubs,
              });
            }
          }
          }

          if (shouldApply(CLOUD_MODULE_KEYS.WORK_PLAN) && cloudStore[CLOUD_MODULE_KEYS.WORK_PLAN] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.WORK_PLAN])) {
            const list = enrichActivitiesWithSubActivities(cloudStore[CLOUD_MODULE_KEYS.WORK_PLAN]);
            setActivities(list);
            try { localStorage.setItem('saniplaner_activities', JSON.stringify(list)); } catch {}
          }

          if (shouldApply(CLOUD_MODULE_KEYS.DELIVERABLES) && cloudStore[CLOUD_MODULE_KEYS.DELIVERABLES] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.DELIVERABLES])) {
            const cleanDelivs = filterOutMockDeliverables(cloudStore[CLOUD_MODULE_KEYS.DELIVERABLES]);
            setDeliverables(cleanDelivs);
            try { localStorage.setItem('saniplaner_deliverables', JSON.stringify(cleanDelivs)); } catch {}
          }

          if (shouldApply(CLOUD_MODULE_KEYS.DOCUMENTS) && cloudStore[CLOUD_MODULE_KEYS.DOCUMENTS] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.DOCUMENTS])) {
            setDocuments(cloudStore[CLOUD_MODULE_KEYS.DOCUMENTS]);
          }

          if (shouldApply(CLOUD_MODULE_KEYS.GALERIE) && cloudStore[CLOUD_MODULE_KEYS.GALERIE] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.GALERIE])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.GALERIE];
            galleryItemsRef.current = list;
            setGalleryItems(list);
            try { localStorage.setItem('saniplaner_gallery', JSON.stringify(list)); } catch {}
          }
        } catch { /* non-blocking */ }

        // Requêtes fallback sur les tables legacy uniquement si le store principal était absent
        if (shouldApply(CLOUD_MODULE_KEYS.PLANNING_HEBDO) && !cloudStore[CLOUD_MODULE_KEYS.PLANNING_HEBDO]) {
          const [subsRes, actsRes, sheetsRes] = await Promise.allSettled([
            supabase.from('weekly_submissions').select('*'),
            supabase.from('weekly_activities').select('*'),
            supabase.from('timesheets').select('*'),
          ]);

          if (subsRes.status === 'fulfilled' && subsRes.value.data && subsRes.value.data.length > 0) {
            setWeeklySubmissions(subsRes.value.data);
          }
          if (actsRes.status === 'fulfilled' && actsRes.value.data && actsRes.value.data.length > 0) {
            setWeeklyActivities(actsRes.value.data);
          }
          if (shouldApply(CLOUD_MODULE_KEYS.TIMESHEETS) && !cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS] && sheetsRes.status === 'fulfilled' && sheetsRes.value.data && sheetsRes.value.data.length > 0) {
            setTimesheets(sheetsRes.value.data);
          }
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString('fr-FR'));
    } catch {
      // Offline fallback
    } finally {
      isSyncingRef.current = false;
      const pending = pendingSyncKeysRef.current;
      pendingSyncKeysRef.current = null;
      if (pending === 'ALL') {
        syncNowInternal().catch(() => {});
      } else if (pending instanceof Set && pending.size > 0) {
        syncNowInternal(Array.from(pending)).catch(() => {});
      }
    }
  };

  // Wrapper public sans argument pour les boutons UI (Synchroniser) et le contexte
  const syncNow = async (): Promise<void> => {
    try {
      await syncNowInternal();
    } finally {
      syncMissionsInBackground().catch(() => {});
    }
  };

  // Synchronisation automatique et abonnements temps réel
  useEffect(() => {
    // 1. Initialisation rapide (< 1 s) puis chargement différé des missions volumineuses
    syncNowInternal()
      .catch(() => {})
      .finally(() => {
        syncMissionsInBackground().catch(() => {});
      });

    // 2. Cross-tab synchronization via BroadcastChannel & Storage event
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('saniplaner_sync_bus');
        bc.onmessage = (event) => {
          if (event?.data?.senderId === SYNC_CLIENT_ID) return;
          syncNowInternal().catch(() => {});
        };
      } catch {}
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'saniplaner_missions') {
        syncMissionsInBackground().catch(() => {});
      } else if (e.key === MEETINGS_LS_KEY || e.key === MEETINGS_DELETED_LS_KEY) {
        syncNowInternal([CLOUD_MODULE_KEYS.MEETINGS]).catch(() => {});
      } else if (e.key === BUDGET_LS_KEY || e.key === BUDGET_DELETED_LS_KEY) {
        syncNowInternal([CLOUD_MODULE_KEYS.BUDGET]).catch(() => {});
      } else if (
        e.key === 'saniplaner_users' ||
        e.key === 'saniplaner_sync_trigger'
      ) {
        syncNowInternal().catch(() => {});
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 3. Focus-based sync immédiat lors du retour sur l'onglet
    let focusTimer: NodeJS.Timeout | null = null;
    const handleFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        syncNowInternal().catch(() => {});
      }, 400);
    };
    window.addEventListener('focus', handleFocus);

    // 4. Heartbeat ultra-léger toutes les 5 secondes (comparaison par module sur horodatage ~1 Ko)
    const heartbeatInterval = setInterval(async () => {
      if (!initialFastSyncDoneRef.current) return;
      try {
        const latest = await checkModulesLastUpdated();
        const known = syncedTimestampsRef.current;
        if (Object.keys(known).length === 0) {
          if (Object.keys(latest).length > 0) {
            syncNowInternal().catch(() => {});
            syncMissionsInBackground().catch(() => {});
          }
          return;
        }
        const changedFastKeys: string[] = [];
        let missionsChanged = false;
        for (const [id, ts] of Object.entries(latest)) {
          if (HEAVY_MODULE_KEYS.has(id)) {
            if (initialMissionsSyncDoneRef.current && (!known[id] || known[id] !== ts)) {
              missionsChanged = true;
            }
          } else if (!known[id] || known[id] !== ts) {
            changedFastKeys.push(id);
          }
        }
        if (changedFastKeys.length > 0) {
          syncNowInternal(changedFastKeys).catch(() => {});
        }
        if (missionsChanged) {
          syncMissionsInBackground().catch(() => {});
        }
      } catch {}
    }, 5000);

    // Synchronisation périodique de fond garantie toutes les 30 secondes
    const fullSyncInterval = setInterval(() => {
      syncNowInternal().catch(() => {});
    }, 30000);

    // 5. Supabase Realtime Channel global (Broadcast ciblé par module sans auto-blocage inter-postes)
    let liveCh: ReturnType<typeof supabase.channel> | null = null;
    let realtimeDebounce: NodeJS.Timeout | null = null;
    const queuedRealtimeKeys = new Set<string>();
    let forceAllRealtime = false;
    if (isSupabaseConfigured) {
      try {
        const handleRemoteEvent = (msg?: any) => {
          const payload = msg?.payload ?? msg;
          if (payload?.senderId && payload.senderId === SYNC_CLIENT_ID) return;
          if (!payload?.senderId && Date.now() - lastLocalSaveRef.current < 2500) return;

          const changedKey: string | undefined = payload?.key;
          if (changedKey && HEAVY_MODULE_KEYS.has(changedKey)) {
            syncMissionsInBackground().catch(() => {});
            return;
          }

          if (changedKey) {
            queuedRealtimeKeys.add(changedKey);
          } else {
            forceAllRealtime = true;
          }

          if (realtimeDebounce) clearTimeout(realtimeDebounce);
          realtimeDebounce = setTimeout(() => {
            const keysToFetch = forceAllRealtime ? undefined : Array.from(queuedRealtimeKeys);
            queuedRealtimeKeys.clear();
            forceAllRealtime = false;
            syncNowInternal(keysToFetch).catch(() => {});
          }, 150);
        };

        liveCh = getGlobalLiveChannel();
        if (liveCh) {
          liveCh
            .on('broadcast', { event: 'GLOBAL_SYNC' }, handleRemoteEvent)
            .on('broadcast', { event: 'MODULE_UPDATED' }, handleRemoteEvent);
        }
      } catch {}
    }

    return () => {
      if (bc) bc.close();
      if (focusTimer) clearTimeout(focusTimer);
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleFocus);
      clearInterval(heartbeatInterval);
      clearInterval(fullSyncInterval);
    };
  }, []);

  const addAuditLog = (action: string, module: string, entityRef: string) => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_name: currentUser?.full_name || 'Utilisateur',
      user_role: currentUser?.title || 'Membre équipe',
      action,
      module,
      entity_ref: entityRef,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditLogs(prev => [newLog, ...prev]);
    syncAuditLogToCloud(newLog);
  };

  const updateActivity = (updated: WorkPlanActivity) => {
    let finalAct = updated;
    if (updated.sub_activities && updated.sub_activities.length > 0) {
      const computedProg = Math.min(100, Math.round(updated.sub_activities.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / 100, 0)));
      finalAct = {
        ...updated,
        progress_pct: computedProg,
        status: computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : updated.status)
      };
    }
    setActivities(prev => {
      const next = prev.map(a => a.id === finalAct.id ? finalAct : a);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_activities', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.WORK_PLAN, 'work_plan', next);
      return next;
    });
    addAuditLog('MISE_A_JOUR_ACTIVITE', 'WORK_PLAN', finalAct.code);
    broadcastSync('WORK_PLAN_UPDATED');
  };

  const updateSubActivity = (activityId: string, updatedSub: WorkPlanSubActivity) => {
    setActivities(prev => {
      const parent = prev.find(a => a.id === activityId);
      if (!parent || !parent.sub_activities) return prev;
      const syncedSub: WorkPlanSubActivity = {
        ...updatedSub,
        completed_occurrences: updatedSub.total_occurrences 
          ? Math.round((updatedSub.progress_pct / 100) * updatedSub.total_occurrences) 
          : updatedSub.completed_occurrences,
        status: (updatedSub.progress_pct >= 100 ? 'TERMINEE' : (updatedSub.progress_pct > 0 ? 'EN_COURS' : 'A_VENIR')) as any
      };
      const nextSubs = parent.sub_activities.map(s => s.id === updatedSub.id ? syncedSub : s);
      const totalWeight = nextSubs.reduce((s, sub) => s + sub.weight_pct, 0);
      const computedProg = totalWeight > 0 
        ? Math.min(100, Math.round(nextSubs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / totalWeight, 0)))
        : 0;
      const updatedMonths = Array.from(new Set([...(parent.active_months || []), ...(syncedSub.calendar_months || [])]));
      const updatedParent: WorkPlanActivity = {
        ...parent,
        active_months: updatedMonths,
        sub_activities: nextSubs,
        progress_pct: computedProg,
        status: (computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : 'A_VENIR')) as ActivityStatus
      };
      const next = prev.map(a => a.id === activityId ? updatedParent : a);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_activities', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.WORK_PLAN, 'work_plan', next);
      return next;
    });
    addAuditLog('MISE_A_JOUR_SOUS_ACTIVITE', 'WORK_PLAN', updatedSub.code);
    broadcastSync('WORK_PLAN_UPDATED');
  };

  const addSubActivity = (activityId: string, newSub: WorkPlanSubActivity) => {
    setActivities(prev => {
      const parent = prev.find(a => a.id === activityId);
      if (!parent) return prev;
      const existingSubs = parent.sub_activities || [];
      const nextSubs = [...existingSubs, newSub];
      const totalWeight = nextSubs.reduce((s, sub) => s + sub.weight_pct, 0);
      const computedProg = totalWeight > 0 
        ? Math.min(100, Math.round(nextSubs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / totalWeight, 0)))
        : 0;
      const updatedMonths = Array.from(new Set([...(parent.active_months || []), ...(newSub.calendar_months || [])]));
      const updatedParent: WorkPlanActivity = {
        ...parent,
        active_months: updatedMonths,
        sub_activities: nextSubs,
        progress_pct: computedProg,
        status: (computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : 'A_VENIR')) as ActivityStatus
      };
      const next = prev.map(a => a.id === activityId ? updatedParent : a);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_activities', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.WORK_PLAN, 'work_plan', next);
      return next;
    });
    addAuditLog('CREATION_SOUS_ACTIVITE', 'WORK_PLAN', newSub.code);
    broadcastSync('WORK_PLAN_UPDATED');
  };

  const deleteSubActivity = (activityId: string, subId: string) => {
    setActivities(prev => {
      const parent = prev.find(a => a.id === activityId);
      if (!parent || !parent.sub_activities) return prev;
      const nextSubs = parent.sub_activities.filter(s => s.id !== subId);
      const totalWeight = nextSubs.reduce((s, sub) => s + sub.weight_pct, 0);
      const computedProg = totalWeight > 0 
        ? Math.min(100, Math.round(nextSubs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / totalWeight, 0)))
        : 0;
      const updatedMonths = Array.from(new Set(nextSubs.flatMap(s => s.calendar_months || [])));
      const updatedParent: WorkPlanActivity = {
        ...parent,
        active_months: updatedMonths,
        sub_activities: nextSubs,
        progress_pct: computedProg,
        status: (nextSubs.length === 0 ? 'A_VENIR' : (computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : 'A_VENIR'))) as ActivityStatus
      };
      const next = prev.map(a => a.id === activityId ? updatedParent : a);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_activities', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.WORK_PLAN, 'work_plan', next);
      return next;
    });
    addAuditLog('SUPPRESSION_SOUS_ACTIVITE', 'WORK_PLAN', subId);
    broadcastSync('WORK_PLAN_UPDATED');
  };

  const addActivity = (newAct: WorkPlanActivity) => {
    setActivities(prev => {
      const next = [newAct, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_activities', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.WORK_PLAN, 'work_plan', next);
      return next;
    });
    addAuditLog('CREATION_ACTIVITE', 'WORK_PLAN', newAct.code);
    broadcastSync('WORK_PLAN_UPDATED');
  };

  // --- PLANNING HEBDOMADAIRE ---
  const addWeeklyActivity = (act: WeeklyActivity) => {
    const nextList = [act, ...weeklyActivitiesRef.current.filter(a => a.id !== act.id)];
    weeklyActivitiesRef.current = nextList;
    setWeeklyActivities(nextList);
    safeLocalSet('saniplaner_weekly_activities', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList,
      submissions: weeklySubmissionsRef.current
    });
    addAuditLog('NOUVELLE_ACTIVITE_HEBDO', 'PLANNING_HEBDO', `${act.week_label} - ${act.title.substring(0, 30)}`);
    syncWeeklyActivitiesToCloud([act]);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const updateWeeklyActivity = (act: WeeklyActivity) => {
    const exists = weeklyActivitiesRef.current.some(a => a.id === act.id);
    const nextList = exists
      ? weeklyActivitiesRef.current.map(a => a.id === act.id ? act : a)
      : [act, ...weeklyActivitiesRef.current];
    weeklyActivitiesRef.current = nextList;
    setWeeklyActivities(nextList);
    safeLocalSet('saniplaner_weekly_activities', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList,
      submissions: weeklySubmissionsRef.current
    });
    addAuditLog('AVANCEMENT_ACTIVITE_HEBDO', 'PLANNING_HEBDO', `${act.progress_pct}% - ${act.title.substring(0, 30)}`);
    syncWeeklyActivitiesToCloud([act]);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const deleteWeeklyActivity = (id: string) => {
    const nextList = weeklyActivitiesRef.current.filter(a => a.id !== id);
    weeklyActivitiesRef.current = nextList;
    setWeeklyActivities(nextList);
    safeLocalSet('saniplaner_weekly_activities', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList,
      submissions: weeklySubmissionsRef.current
    }, { deletedId: id, isDeleteAction: true });
    addAuditLog('SUPPRESSION_ACTIVITE_HEBDO', 'PLANNING_HEBDO', id);
    deleteWeeklyActivityFromCloud(id);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const saveBatchWeeklyActivities = (acts: WeeklyActivity[]) => {
    const newIds = new Set(acts.map(a => a.id));
    const remaining = weeklyActivitiesRef.current.filter(a => !newIds.has(a.id));
    const nextList = [...acts, ...remaining];
    weeklyActivitiesRef.current = nextList;
    setWeeklyActivities(nextList);
    safeLocalSet('saniplaner_weekly_activities', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList,
      submissions: weeklySubmissionsRef.current
    });
    addAuditLog('SAISIE_LOT_ACTIVITES_HEBDO', 'PLANNING_HEBDO', `${acts.length} activités enregistrées`);
    syncWeeklyActivitiesToCloud(acts);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const submitWeeklyPlanning = (expertId: string, weekNumber: number) => {
    const now = new Date();
    const dateStr = `${now.toISOString().substring(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let submissionToSync: WeeklySubmission | null = null;
    setWeeklySubmissions(prev => {
      const idx = prev.findIndex(s => s.expert_id === expertId && s.week_number === weekNumber);
      let next: WeeklySubmission[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], is_submitted: true, submission_date: dateStr };
        submissionToSync = next[idx];
      } else {
        const newSub: WeeklySubmission = {
          id: `sub-w${weekNumber}-${expertId}`,
          expert_id: expertId,
          week_number: weekNumber,
          is_submitted: true,
          submission_date: dateStr,
        };
        submissionToSync = newSub;
        next = [...prev, newSub];
      }
      weeklySubmissionsRef.current = next;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_weekly_submissions', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
        activities: weeklyActivitiesRef.current,
        submissions: next
      });
      return next;
    });
    if (submissionToSync) {
      syncWeeklySubmissionToCloud(submissionToSync);
    }
    const expertName = users.find(u => u.id === expertId)?.full_name || expertId;
    addAuditLog('SOUMISSION_PLANNING_HEBDO', 'PLANNING_HEBDO', `Semaine ${weekNumber} - ${expertName}`);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const toggleWeeklySubmission = (expertId: string, weekNumber: number) => {
    const now = new Date();
    const dateStr = `${now.toISOString().substring(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let submissionToSync: WeeklySubmission | null = null;
    setWeeklySubmissions(prev => {
      const idx = prev.findIndex(s => s.expert_id === expertId && s.week_number === weekNumber);
      let next: WeeklySubmission[];
      if (idx >= 0) {
        next = [...prev];
        const newStatus = !next[idx].is_submitted;
        next[idx] = {
          ...next[idx],
          is_submitted: newStatus,
          submission_date: newStatus ? dateStr : undefined,
        };
        submissionToSync = next[idx];
      } else {
        const newSub: WeeklySubmission = {
          id: `sub-w${weekNumber}-${expertId}`,
          expert_id: expertId,
          week_number: weekNumber,
          is_submitted: true,
          submission_date: dateStr,
        };
        submissionToSync = newSub;
        next = [...prev, newSub];
      }
      weeklySubmissionsRef.current = next;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_weekly_submissions', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
        activities: weeklyActivitiesRef.current,
        submissions: next
      });
      return next;
    });
    if (submissionToSync) {
      syncWeeklySubmissionToCloud(submissionToSync);
    }
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  // --- TIMESHEETS MENSUELS ---
  const saveTimesheetsState = (updatedList: MonthlyTimesheet[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saniplaner_timesheets', JSON.stringify(updatedList));
      } catch {}
    }
    saveModuleToCloud(CLOUD_MODULE_KEYS.TIMESHEETS, 'timesheets', updatedList);
    broadcastSync('TIMESHEETS_UPDATED');
  };

  const createOrUpdateTimesheet = (ts: MonthlyTimesheet) => {
    setTimesheets(prev => {
      const existingMatch = prev.find(
        t =>
          t.id === ts.id ||
          (t.expert_id === ts.expert_id &&
            t.period_year === ts.period_year &&
            t.period_month === ts.period_month)
      );
      const resolvedTs = existingMatch ? { ...ts, id: existingMatch.id } : ts;
      const deduped = prev.filter(
        t =>
          !(
            t.expert_id === ts.expert_id &&
            t.period_year === ts.period_year &&
            t.period_month === ts.period_month &&
            t.id !== resolvedTs.id
          )
      );
      const updated = existingMatch
        ? deduped.map(t => (t.id === resolvedTs.id ? resolvedTs : t))
        : [resolvedTs, ...deduped];
      saveTimesheetsState(updated);
      syncTimesheetToCloud(resolvedTs);
      return updated;
    });
    addAuditLog('EDITION_TIMESHEET', 'TIMESHEETS', `${ts.month_name} - ${ts.expert_id}`);
  };

  const submitTimesheet = (id: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setTimesheets(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const item = { ...t, status: 'SOUMIS' as const, submission_date: today };
          syncTimesheetToCloud(item);
          return item;
        }
        return t;
      });
      saveTimesheetsState(updated);
      return updated;
    });
    addAuditLog('SOUMISSION_TIMESHEET', 'TIMESHEETS', id);
  };

  const verifyTimesheet = (id: string, verifierName: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setTimesheets(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const item = {
            ...t,
            status: 'VERIFIE_SE' as const,
            verified_by: verifierName,
            verification_date: today,
            rejection_reason: undefined,
          };
          syncTimesheetToCloud(item);
          return item;
        }
        return t;
      });
      saveTimesheetsState(updated);
      return updated;
    });
    addAuditLog('VISA_SE_TIMESHEET', 'TIMESHEETS', id);
  };

  const validateTimesheet = (id: string, validatorName: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setTimesheets(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const item = {
            ...t,
            status: 'VALIDE_DIRECTION' as const,
            validated_by: validatorName,
            validation_date: today,
            rejection_reason: undefined,
          };
          syncTimesheetToCloud(item);
          return item;
        }
        return t;
      });
      saveTimesheetsState(updated);
      return updated;
    });
    addAuditLog('VALIDATION_DIRECTION_TIMESHEET', 'TIMESHEETS', id);
  };

  const rejectTimesheet = (id: string, reason: string) => {
    setTimesheets(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const item = {
            ...t,
            status: 'REJETE' as const,
            rejection_reason: reason,
          };
          syncTimesheetToCloud(item);
          return item;
        }
        return t;
      });
      saveTimesheetsState(updated);
      return updated;
    });
    addAuditLog('REJET_TIMESHEET', 'TIMESHEETS', `${id} (Raison: ${reason})`);
  };

  const resetDemoData = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('saniplaner_missions');
        localStorage.removeItem('saniplaner_timesheets');
        localStorage.removeItem('saniplaner_expenditures');
        localStorage.removeItem('saniplaner_meetings');
        localStorage.removeItem(MEETINGS_PENDING_LS_KEY);
        localStorage.removeItem('saniplaner_trainings');
        localStorage.removeItem('saniplaner_b09_reminders');
        localStorage.removeItem('saniplaner_weekly_activities');
        localStorage.removeItem('saniplaner_weekly_submissions');
        localStorage.removeItem('saniplaner_b13_items');
      } catch {}
    }
    missionsRef.current = [];
    setMissions([]);
    meetingsRef.current = [];
    setMeetings([]);
    setTimesheets([]);
    weeklyActivitiesRef.current = [];
    setWeeklyActivities([]);
    weeklySubmissionsRef.current = [];
    setWeeklySubmissions([]);
    trainingsRef.current = [];
    setTrainings([]);
    b13ItemsRef.current = MOCK_B13_ITEMS;
    setB13Items(MOCK_B13_ITEMS);
    setDocuments([]);
    setAuditLogs([]);
    setB09Reminders([]);
    galleryItemsRef.current = MOCK_GALLERY_ITEMS;
    setGalleryItems(MOCK_GALLERY_ITEMS);

    // Purge / reset cloud stores (les dépenses réelles comptables et missions terrain restent protégées)
    saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', [], { isDeleteAction: true });
    saveModuleToCloud(CLOUD_MODULE_KEYS.TIMESHEETS, 'timesheets', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', { activities: [], submissions: [] });
    saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', MOCK_B13_ITEMS);
    saveModuleToCloud(CLOUD_MODULE_KEYS.DOCUMENTS, 'documents', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.GALERIE, 'galerie', MOCK_GALLERY_ITEMS);
    addAuditLog('PURGE_DONNEES_DEMO', 'ADMINISTRATION', 'Purge complète des données de démonstration');
    broadcastSync('ALL_MODULES_RESET');
  };

  const updateProjectRisk = (risk: ProjectRisk) => {
    setProjectRisks(prev => prev.map(r => r.id === risk.id ? risk : r));
    addAuditLog('MISE_A_JOUR_RISQUE', 'WORK_PLAN', `${risk.code} - ${risk.status}`);
  };

  const updateB09Metric = (updated: B09MonthlyMetric) => {
    const rate = updated.expected_reports > 0 
      ? Number(((updated.submitted_on_time / updated.expected_reports) * 100).toFixed(1))
      : 0;
    const missing = Math.max(0, updated.expected_reports - updated.submitted_on_time - (updated.submitted_late || 0));
    const itemWithRecalc: B09MonthlyMetric = {
      ...updated,
      missing_reports: missing,
      promptitude_rate: rate,
      target_met: rate >= 70,
    };
    setB09Metrics(prev => {
      const existingMatch = prev.find(
        m =>
          m.id === updated.id ||
          (m.period_month === updated.period_month &&
            m.period_year === updated.period_year &&
            m.zone_name === updated.zone_name)
      );
      const resolvedItem: B09MonthlyMetric = existingMatch
        ? { ...itemWithRecalc, id: existingMatch.id }
        : itemWithRecalc;
      const deduped = prev.filter(
        m =>
          !(
            m.period_month === updated.period_month &&
            m.period_year === updated.period_year &&
            m.zone_name === updated.zone_name &&
            m.id !== resolvedItem.id
          )
      );
      const next = existingMatch
        ? deduped.map(m => (m.id === resolvedItem.id ? resolvedItem : m))
        : [...deduped, resolvedItem];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: next,
        reminders: b09Reminders,
        dossiers: b09Dossiers,
      });
      return next;
    });
    addAuditLog('ACTUALISATION_PROMPTITUDE', 'B09_ESIGL', `${updated.department} - ${updated.zone_name}: ${updated.submitted_on_time}/${updated.expected_reports} (${rate}%)`);
    broadcastSync('B09_UPDATED');
  };

  const addB09Metric = (metric: B09MonthlyMetric) => {
    updateB09Metric(metric);
  };

  const deleteB09Metric = (id: string) => {
    setB09Metrics(prev => {
      const next = prev.filter(m => m.id !== id);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: next,
        reminders: b09Reminders,
        dossiers: b09Dossiers,
      });
      return next;
    });
    addAuditLog('SUPPRESSION_METRIQUE_B09', 'B09_ESIGL', id);
    broadcastSync('B09_UPDATED');
  };

  const initB09MonthZones = (month: number, year: number) => {
    const OFFICIAL_9_ZONES = [
      { dept: 'Atacora', zone: 'Kouandé-Péhunco-Kérou (2KP)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIWO', expected: 45 },
      { dept: 'Atacora', zone: 'Natitingou-Boukoumbé-Toucountouna (NBT)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIWO', expected: 38 },
      { dept: 'Atacora', zone: 'Tanguiéta-Matéri-Cobly (TMC)', rscoId: 'usr-rsco-1', rscoName: 'Mohamed DJERIWO', expected: 29 },
      { dept: 'Mono', zone: 'Lokossa-Athiémé (LA)', rscoId: 'usr-rsco-2', rscoName: 'KOUAGOU Soumari', expected: 30 },
      { dept: 'Mono', zone: 'Comé-Grand-Popo-Bopa-Houéyogbé (CBGH)', rscoId: 'usr-rsco-2', rscoName: 'KOUAGOU Soumari', expected: 41 },
      { dept: 'Plateau', zone: 'Pobè-Adja-Ouèrè-Kétou (PAK)', rscoId: 'usr-rsco-2', rscoName: 'KOUAGOU Soumari', expected: 55 },
      { dept: 'Plateau', zone: 'Sakété-Ifangni (SAKIF)', rscoId: 'usr-rsco-2', rscoName: 'KOUAGOU Soumari', expected: 27 },
      { dept: 'Donga', zone: 'Djougou-Copargo-Ouaké (DCO)', rscoId: 'usr-rsco-3', rscoName: 'IMOROU T. Arafath', expected: 63 },
      { dept: 'Donga', zone: 'Bassila', rscoId: 'usr-rsco-3', rscoName: 'IMOROU T. Arafath', expected: 28 },
    ];

    const deadlineMonth = month === 12 ? 1 : month + 1;
    const deadlineYear = month === 12 ? year + 1 : year;
    const deadlineStr = `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}-20`;

    setB09Metrics(prev => {
      const newItems: B09MonthlyMetric[] = [];
      OFFICIAL_9_ZONES.forEach((z, idx) => {
        const existing = prev.find(m => m.period_month === month && m.period_year === year && m.zone_name === z.zone);
        if (!existing) {
          newItems.push({
            id: `b09-m${month}-y${year}-${idx}-${Date.now()}`,
            period_month: month,
            period_year: year,
            department: z.dept,
            zone_name: z.zone,
            rsco_id: z.rscoId,
            rsco_name: z.rscoName,
            expected_reports: z.expected,
            submitted_on_time: 0,
            submitted_late: 0,
            missing_reports: z.expected,
            promptitude_rate: 0,
            target_met: false,
            deadline_date: deadlineStr,
            reminders_sent: 0,
            evidence_status: 'EN_ATTENTE_PREUVE',
          });
        }
      });
      const next = [...prev, ...newItems];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: next,
        reminders: b09Reminders,
        dossiers: b09Dossiers,
      });
      return next;
    });
    addAuditLog('INITIALISATION_MOIS_B09', 'B09_ESIGL', `Mois ${month}/${year} - 9 zones cibles`);
    broadcastSync('B09_UPDATED');
  };

  const resetB09Metrics = (_targetMonth?: number, _targetYear?: number) => {
    // SÉCURITÉ ABSOLUE : Fonction désactivée pour empêcher toute perte accidentelle des saisies des RSCO.
    // Les saisies réelles sont préservées de manière permanente.
    addAuditLog('TENTATIVE_REINITIALISATION_BLOQUEE', 'B09_ESIGL', 'Action bloquée par le verrou de sécurité anti-perte de données');
  };

  const addB09Reminder = (reminder: B09ReminderRecord) => {
    setB09Reminders(prev => {
      const next = [reminder, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_reminders', JSON.stringify(next)); } catch {}
      }
      return next;
    });

    // Incrémente automatiquement le compteur de relances de la zone concernée
    setB09Metrics(prevM => {
      const nextM = prevM.map(m => {
        if (m.zone_name === reminder.zone_name && m.period_month === reminder.period_month && m.period_year === reminder.period_year) {
          return { ...m, reminders_sent: (Number(m.reminders_sent) || 0) + 1 };
        }
        return m;
      });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(nextM)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: nextM,
        reminders: [reminder, ...b09Reminders],
        dossiers: b09Dossiers,
      });
      return nextM;
    });

    addAuditLog('ENREGISTREMENT_RELANCE_B09', 'B09_ESIGL', `${reminder.fosa_name} (${reminder.zone_name})`);
    broadcastSync('B09_UPDATED');
  };

  const deleteB09Reminder = (id: string) => {
    const deleted = b09Reminders.find(r => r.id !== id);
    setB09Reminders(prev => {
      const next = prev.filter(r => r.id !== id);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_reminders', JSON.stringify(next)); } catch {}
      }
      return next;
    });

    if (deleted) {
      setB09Metrics(prevM => {
        const nextM = prevM.map(m => {
          if (m.zone_name === deleted.zone_name && m.period_month === deleted.period_month && m.period_year === deleted.period_year) {
            return { ...m, reminders_sent: Math.max(0, (Number(m.reminders_sent) || 0) - 1) };
          }
          return m;
        });
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(nextM)); } catch {}
        }
        saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
          metrics: nextM,
          reminders: b09Reminders.filter(r => r.id !== id),
          dossiers: b09Dossiers,
        });
        return nextM;
      });
    }
    broadcastSync('B09_UPDATED');
  };

  const updateB09Dossier = (dossier: B09QuarterlyDossier) => {
    setB09Dossiers(prev => {
      const next = prev.map(d => d.quarter === dossier.quarter ? dossier : d);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_dossiers', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: b09Metrics,
        reminders: b09Reminders,
        dossiers: next,
      });
      return next;
    });
    addAuditLog('MISE_A_JOUR_DOSSIER_B09', 'B09_ESIGL', `${dossier.label} - ${dossier.status}`);
    broadcastSync('B09_UPDATED');
  };

  const updateB13Item = (updated: B13Item) => {
    const nextList = b13ItemsRef.current.map(i => i.id === updated.id ? updated : i);
    b13ItemsRef.current = nextList;
    setB13Items(nextList);
    safeLocalSet('saniplaner_b13_items', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', nextList);
    broadcastSync('B13_ITEM_UPDATED', updated);
    addAuditLog('MISE_A_JOUR_B13', 'B13_QUANTIFICATION', `${updated.title} (${updated.progress_pct}% - ${updated.status})`);
  };

  const addB13Item = (item: B13Item) => {
    const nextList = [item, ...b13ItemsRef.current.filter(i => i.id !== item.id)];
    b13ItemsRef.current = nextList;
    setB13Items(nextList);
    safeLocalSet('saniplaner_b13_items', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', nextList);
    broadcastSync('B13_ITEM_ADDED', item);
    addAuditLog('AJOUT_ACTIVITE_B13', 'B13_QUANTIFICATION', item.title);
  };

  const deleteB13Item = (id: string) => {
    const target = b13ItemsRef.current.find(i => i.id === id);
    const nextList = b13ItemsRef.current.filter(i => i.id !== id);
    b13ItemsRef.current = nextList;
    setB13Items(nextList);
    safeLocalSet('saniplaner_b13_items', nextList);
    if (typeof window !== 'undefined') {
      try {
        const d = localStorage.getItem('saniplaner_deleted_b13_ids') || '[]';
        const arr = JSON.parse(d);
        arr.push(id);
        localStorage.setItem('saniplaner_deleted_b13_ids', JSON.stringify(arr));
      } catch {}
    }
    if (target) {
      addAuditLog('SUPPRESSION_ACTIVITE_B13', 'B13_QUANTIFICATION', target.title);
    }
    saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', nextList, { deletedId: id, isDeleteAction: true });
    broadcastSync('B13_ITEM_DELETED', { id });
  };

  const addExpenditure = async (exp: BudgetExpenditure): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const stamped: BudgetExpenditure = {
      ...exp,
      created_at: exp.created_at || nowIso,
      updated_at: nowIso,
    };
    const nextList = [stamped, ...expendituresRef.current.filter(e => e.id !== stamped.id)];
    expendituresRef.current = nextList;
    setExpenditures(nextList);
    safeLocalSet(BUDGET_LS_KEY, nextList);
    savePendingExpenditure(stamped);

    activeBudgetWritesRef.current += 1;
    let ok = false;
    try {
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', nextList);
      if (ok) {
        clearPendingExpenditure(stamped.id, stamped.updated_at);
        broadcastSync('EXPENDITURE_ADDED', stamped);
      }
      addAuditLog('AJOUT_DEPENSE_BUDGET', 'BUDGET_FINANCES', `${stamped.expense_code} - ${stamped.amount_fcfa.toLocaleString('fr-FR')} FCFA (${stamped.category_code})`);
    } finally {
      activeBudgetWritesRef.current = Math.max(0, activeBudgetWritesRef.current - 1);
    }
    return ok;
  };

  const updateExpenditure = async (exp: BudgetExpenditure): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const stamped: BudgetExpenditure = {
      ...exp,
      updated_at: nowIso,
    };
    const exists = expendituresRef.current.some(e => e.id === stamped.id);
    const nextList = exists
      ? expendituresRef.current.map(e => (e.id === stamped.id ? stamped : e))
      : [stamped, ...expendituresRef.current];
    expendituresRef.current = nextList;
    setExpenditures(nextList);
    safeLocalSet(BUDGET_LS_KEY, nextList);
    savePendingExpenditure(stamped);

    activeBudgetWritesRef.current += 1;
    let ok = false;
    try {
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', nextList);
      if (ok) {
        clearPendingExpenditure(stamped.id, stamped.updated_at);
        broadcastSync('EXPENDITURE_UPDATED', stamped);
      }
      addAuditLog('MODIFICATION_DEPENSE_BUDGET', 'BUDGET_FINANCES', `${stamped.expense_code} - ${stamped.amount_fcfa.toLocaleString('fr-FR')} FCFA`);
    } finally {
      activeBudgetWritesRef.current = Math.max(0, activeBudgetWritesRef.current - 1);
    }
    return ok;
  };

  const deleteExpenditure = async (id: string): Promise<boolean> => {
    const target = expendituresRef.current.find(e => e.id === id);
    addLocalDeletedBudgetId(id);
    const nextList = expendituresRef.current.filter(e => e.id !== id);
    expendituresRef.current = nextList;
    setExpenditures(nextList);
    safeLocalSet(BUDGET_LS_KEY, nextList);

    activeBudgetWritesRef.current += 1;
    let ok = false;
    try {
      await addCloudTombstones('budget', [id]);
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', nextList, {
        deletedId: id,
        isDeleteAction: true,
      });
      if (ok) {
        broadcastSync('EXPENDITURE_DELETED', id);
      }
      if (target) {
        addAuditLog('SUPPRESSION_DEPENSE_BUDGET', 'BUDGET_FINANCES', `${target.expense_code} - ${target.description}`);
      }
    } finally {
      activeBudgetWritesRef.current = Math.max(0, activeBudgetWritesRef.current - 1);
    }
    return ok;
  };

  const importExpendituresBatch = async (exps: BudgetExpenditure[]): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const stampedExps = exps.map(e => ({
      ...e,
      created_at: e.created_at || nowIso,
      updated_at: nowIso,
    }));
    const newIds = new Set(stampedExps.map(e => e.id));
    const nextList = [...stampedExps, ...expendituresRef.current.filter(e => !newIds.has(e.id))];
    expendituresRef.current = nextList;
    setExpenditures(nextList);
    safeLocalSet(BUDGET_LS_KEY, nextList);
    savePendingExpendituresBatch(stampedExps);

    activeBudgetWritesRef.current += 1;
    let ok = false;
    try {
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', nextList);
      if (ok) {
        clearPendingExpenditures(newIds);
        broadcastSync('EXPENDITURES_BATCH_IMPORTED', stampedExps.length);
      }
      addAuditLog('IMPORT_LOT_DEPENSES', 'BUDGET_FINANCES', `${stampedExps.length} dépenses importées`);
    } finally {
      activeBudgetWritesRef.current = Math.max(0, activeBudgetWritesRef.current - 1);
    }
    return ok;
  };

  const updateMissionStatus = (id: string, status: MissionStatus) => {
    const nextList = missionsRef.current.map(m => m.id === id ? { ...m, status } : m);
    missionsRef.current = nextList;
    setMissions(nextList);
    safeLocalSet('saniplaner_missions', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList);
    addAuditLog(`STATUT_MISSION_${status}`, 'MISSIONS', id);
    broadcastSync('MISSIONS_UPDATED');
  };

  const updateMission = (updated: FieldMission) => {
    const exists = missionsRef.current.some(m => m.id === updated.id);
    const nextList = exists
      ? missionsRef.current.map(m => m.id === updated.id ? updated : m)
      : [updated, ...missionsRef.current];
    missionsRef.current = nextList;
    setMissions(nextList);
    safeLocalSet('saniplaner_missions', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList);
    addAuditLog('MISE_A_JOUR_MISSION', 'MISSIONS', updated.title);
    broadcastSync('MISSIONS_UPDATED');
  };

  const addMission = (newMis: FieldMission) => {
    const nextList = [newMis, ...missionsRef.current.filter(m => m.id !== newMis.id)];
    missionsRef.current = nextList;
    setMissions(nextList);
    safeLocalSet('saniplaner_missions', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList);
    addAuditLog('NOUVELLE_MISSION', 'MISSIONS', newMis.title);
    broadcastSync('MISSIONS_UPDATED');
  };

  const deleteMission = async (id: string) => {
    // 1. Enregistrer dans le registre des suppressions définitives (tombstones)
    if (typeof window !== 'undefined') {
      try {
        let deletedIds: string[] = [];
        const existing = localStorage.getItem('saniplaner_deleted_mission_ids');
        if (existing) deletedIds = JSON.parse(existing) || [];
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          localStorage.setItem('saniplaner_deleted_mission_ids', JSON.stringify(deletedIds));
        }
      } catch {}
    }

    // 2. Mettre à jour l'état et le cache local de façon synchrone depuis la ref
    const nextList = missionsRef.current.filter(m => m.id !== id);
    missionsRef.current = nextList;
    setMissions(nextList);
    safeLocalSet('saniplaner_missions', nextList);

    // 3. Suppression cloud immédiate sans résurrection
    await deleteMissionFromCloud(id);
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList, { deletedId: id, isDeleteAction: true });
    addAuditLog('SUPPRESSION_MISSION', 'MISSIONS', id);
    broadcastSync('MISSIONS_UPDATED');
  };

  const addMeeting = async (newMeet: MeetingSession): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const stamped: MeetingSession = {
      ...newMeet,
      created_at: newMeet.created_at || nowIso,
      updated_at: nowIso,
    };
    const nextList = [stamped, ...meetingsRef.current.filter(m => m.id !== stamped.id)];
    meetingsRef.current = nextList;
    setMeetings(nextList);
    safeLocalSet(MEETINGS_LS_KEY, nextList);
    savePendingMeeting(stamped);

    activeMeetingWritesRef.current += 1;
    let ok = false;
    try {
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', nextList);
      if (ok) {
        clearPendingMeeting(stamped.id, stamped.updated_at);
        broadcastSync('MEETINGS_UPDATED');
      }
      addAuditLog('NOUVELLE_SEANCE', 'SEANCES', stamped.title || 'Séance');
    } finally {
      activeMeetingWritesRef.current = Math.max(0, activeMeetingWritesRef.current - 1);
    }
    return ok;
  };

  const updateMeeting = async (updatedMeet: MeetingSession): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const stamped: MeetingSession = {
      ...updatedMeet,
      updated_at: nowIso,
    };
    const exists = meetingsRef.current.some(m => m.id === stamped.id);
    const nextList = exists
      ? meetingsRef.current.map(m => (m.id === stamped.id ? stamped : m))
      : [stamped, ...meetingsRef.current];
    meetingsRef.current = nextList;
    setMeetings(nextList);
    safeLocalSet(MEETINGS_LS_KEY, nextList);
    savePendingMeeting(stamped);

    activeMeetingWritesRef.current += 1;
    let ok = false;
    try {
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', nextList);
      if (ok) {
        clearPendingMeeting(stamped.id, stamped.updated_at);
        broadcastSync('MEETINGS_UPDATED');
      }
      addAuditLog('MODIFICATION_SEANCE', 'SEANCES', stamped.title || 'Séance');
    } finally {
      activeMeetingWritesRef.current = Math.max(0, activeMeetingWritesRef.current - 1);
    }
    return ok;
  };

  const deleteMeeting = async (id: string): Promise<boolean> => {
    addLocalDeletedMeetingId(id);
    const nextList = meetingsRef.current.filter(m => m.id !== id);
    meetingsRef.current = nextList;
    setMeetings(nextList);
    safeLocalSet(MEETINGS_LS_KEY, nextList);

    activeMeetingWritesRef.current += 1;
    let ok = false;
    try {
      await addCloudTombstones('meetings', [id]);
      ok = await saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', nextList, {
        deletedId: id,
        isDeleteAction: true,
      });
      if (ok) {
        broadcastSync('MEETINGS_UPDATED');
      }
      addAuditLog('SUPPRESSION_SEANCE', 'SEANCES', id);
    } finally {
      activeMeetingWritesRef.current = Math.max(0, activeMeetingWritesRef.current - 1);
    }
    return ok;
  };

  const addTraining = (newTrain: Training) => {
    const nextList = [newTrain, ...trainingsRef.current.filter(t => t.id !== newTrain.id)];
    trainingsRef.current = nextList;
    setTrainings(nextList);
    safeLocalSet('saniplaner_trainings', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', nextList);
    addAuditLog('NOUVELLE_FORMATION', 'FORMATIONS', newTrain.topic);
    broadcastSync('TRAININGS_UPDATED');
  };

  const updateTraining = (updatedTrain: Training) => {
    const exists = trainingsRef.current.some(t => t.id === updatedTrain.id);
    const nextList = exists
      ? trainingsRef.current.map(t => t.id === updatedTrain.id ? updatedTrain : t)
      : [updatedTrain, ...trainingsRef.current];
    trainingsRef.current = nextList;
    setTrainings(nextList);
    safeLocalSet('saniplaner_trainings', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', nextList);
    addAuditLog('MODIFICATION_FORMATION', 'FORMATIONS', updatedTrain.topic);
    broadcastSync('TRAININGS_UPDATED');
  };

  const deleteTraining = (id: string) => {
    const nextList = trainingsRef.current.filter(t => t.id !== id);
    trainingsRef.current = nextList;
    setTrainings(nextList);
    safeLocalSet('saniplaner_trainings', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', nextList, { deletedId: id, isDeleteAction: true });
    addAuditLog('SUPPRESSION_FORMATION', 'FORMATIONS', id);
    broadcastSync('TRAININGS_UPDATED');
  };

  const updateDeliverableStatus = (id: string, status: DeliverableStatus, comments?: string) => {
    setDeliverables(prev => {
      const next = prev.map(d => {
        if (d.id === id) {
          return {
            ...d,
            validation_status: status,
            comments: comments || d.comments,
            actual_submission_date: status === 'TRANSMISSION_PSI' ? new Date().toISOString().substring(0, 10) : d.actual_submission_date,
            verified_by: status === 'VERIFICATION' || status === 'VALIDATION_DIRECTION' ? (currentUser?.id || 'usr-dir') : d.verified_by,
            validated_by: status === 'VALIDATION_DIRECTION' || status === 'TRANSMISSION_PSI' ? (currentUser?.id || 'usr-dir') : d.validated_by,
          };
        }
        return d;
      });
      saveModuleToCloud(CLOUD_MODULE_KEYS.DELIVERABLES, 'deliverables', next);
      return next;
    });
    addAuditLog(`WORKFLOW_LIVRABLE_${status}`, 'LIVRABLES', id);
    broadcastSync('DELIVERABLES_UPDATED');
  };

  const addDocument = (doc: DocumentItem) => {
    setDocuments(prev => {
      const next = [doc, ...prev];
      saveModuleToCloud(CLOUD_MODULE_KEYS.DOCUMENTS, 'documents', next);
      return next;
    });
    addAuditLog('DEPOT_DOCUMENT', 'DOCUMENTATION', doc.file_name);
    broadcastSync('DOCUMENTS_UPDATED');
  };

  const addGalleryItem = (item: GalleryItem) => {
    const nextList = [item, ...galleryItemsRef.current.filter(g => g.id !== item.id)];
    galleryItemsRef.current = nextList;
    setGalleryItems(nextList);
    safeLocalSet('saniplaner_gallery', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.GALERIE, 'galerie', nextList);
    addAuditLog('AJOUT_ALBUM_GALERIE', 'GALERIE', item.title);
    broadcastSync('GALLERY_UPDATED');
  };

  const updateGalleryItem = (item: GalleryItem) => {
    const exists = galleryItemsRef.current.some(g => g.id === item.id);
    const nextList = exists
      ? galleryItemsRef.current.map(g => g.id === item.id ? item : g)
      : [item, ...galleryItemsRef.current];
    galleryItemsRef.current = nextList;
    setGalleryItems(nextList);
    safeLocalSet('saniplaner_gallery', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.GALERIE, 'galerie', nextList);
    addAuditLog('MODIFICATION_ALBUM_GALERIE', 'GALERIE', item.title);
    broadcastSync('GALLERY_UPDATED');
  };

  const deleteGalleryItem = (id: string) => {
    const nextList = galleryItemsRef.current.filter(g => g.id !== id);
    galleryItemsRef.current = nextList;
    setGalleryItems(nextList);
    safeLocalSet('saniplaner_gallery', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.GALERIE, 'galerie', nextList, { deletedId: id, isDeleteAction: true });
    addAuditLog('SUPPRESSION_ALBUM_GALERIE', 'GALERIE', id);
    broadcastSync('GALLERY_UPDATED');
  };

  const addPhotoToGalleryItem = (itemId: string, photo: GalleryPhotoItem) => {
    const nextList = galleryItemsRef.current.map(g => {
      if (g.id !== itemId) return g;
      if (g.photos.length >= 7) return g; // Max 07 photos
      return {
        ...g,
        photos: [...g.photos, photo],
        updated_at: new Date().toISOString()
      };
    });
    galleryItemsRef.current = nextList;
    setGalleryItems(nextList);
    safeLocalSet('saniplaner_gallery', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.GALERIE, 'galerie', nextList);
    addAuditLog('AJOUT_PHOTO_GALERIE', 'GALERIE', `${itemId} - ${photo.caption.substring(0, 30)}`);
    broadcastSync('GALLERY_UPDATED');
  };

  const deletePhotoFromGalleryItem = (itemId: string, photoId: string) => {
    const nextList = galleryItemsRef.current.map(g => {
      if (g.id !== itemId) return g;
      return {
        ...g,
        photos: g.photos.filter(p => p.id !== photoId),
        updated_at: new Date().toISOString()
      };
    });
    galleryItemsRef.current = nextList;
    setGalleryItems(nextList);
    safeLocalSet('saniplaner_gallery', nextList);
    saveModuleToCloud(CLOUD_MODULE_KEYS.GALERIE, 'galerie', nextList);
    addAuditLog('SUPPRESSION_PHOTO_GALERIE', 'GALERIE', `${itemId} - ${photoId}`);
    broadcastSync('GALLERY_UPDATED');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUserId = localStorage.getItem('saniplaner_user_id');
      if (savedUserId) {
        const found = users.find(u => u.id === savedUserId);
        if (found) setCurrentUser(found);
      }
    }
  }, [users]);

  const handleSetCurrentUser = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('saniplaner_user_id', user.id);
    }
  };

  const login = async (usernameInput: string, passwordInput: string): Promise<{ success: boolean; message?: string }> => {
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    let currentUsersList = users;

    // 1. Toujours synchroniser les profils et mots de passe depuis Supabase Cloud en temps réel
    if (isSupabaseConfigured) {
      try {
        const cloudUsers = await fetchUsersFromCloud();
        if (cloudUsers && cloudUsers.length > 0) {
          currentUsersList = currentUsersList.map(u => {
            const cloud = cloudUsers.find(c => c.id === u.id || (c.username && c.username.toLowerCase() === u.username?.toLowerCase()));
            if (cloud) {
              return {
                ...u,
                password: cloud.password || u.password,
                is_first_login: cloud.is_first_login !== undefined ? Boolean(cloud.is_first_login) : u.is_first_login,
                role: (cloud.role as any) || u.role,
                allowed_modules: cloud.allowed_modules || u.allowed_modules,
              };
            }
            return u;
          });
          setUsers(currentUsersList);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('saniplaner_users', JSON.stringify(currentUsersList));
            } catch {}
          }
        }
      } catch {
        // Mode hors ligne
      }
    }

    let found = currentUsersList.find(u => 
      (u.username && u.username.toLowerCase() === cleanUser) ||
      (u.email && u.email.toLowerCase() === cleanUser) ||
      (u.username && `${u.username.toLowerCase()}@saninovagc.com` === cleanUser) ||
      (cleanUser === 'deddeh' && u.id === 'usr-admin-1') ||
      (cleanUser === 'geddeh' && u.id === 'usr-admin-1') ||
      (cleanUser === 'geddeh@saninovagc.com' && u.id === 'usr-admin-1') ||
      (cleanUser === 'wbolaro' && u.id === 'usr-driver-1') ||
      (cleanUser === 'psiabms' && u.id === 'usr-psi-abms')
    );

    if (!found) {
      const mockFound = MOCK_USERS.find(u => 
        (u.username && u.username.toLowerCase() === cleanUser) ||
        (u.email && u.email.toLowerCase() === cleanUser)
      );
      if (mockFound) {
        found = mockFound;
        setUsers(prev => {
          const merged = [...prev.filter(u => u.id !== mockFound.id), mockFound];
          if (typeof window !== 'undefined') {
            try { localStorage.setItem('saniplaner_users', JSON.stringify(merged)); } catch {}
          }
          return merged;
        });
      }
    }

    if (!found) {
      return { success: false, message: 'Identifiant ou e-mail introuvable.' };
    }

    if (found.password && found.password !== cleanPass) {
      return { success: false, message: 'Mot de passe incorrect.' };
    }

    handleSetCurrentUser(found);
    setIsAuthenticated(true);
    addAuditLog('CONNEXION', 'AUTHENTIFICATION', `${found.full_name} (@${found.username})`);
    return { success: true };
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('saniplaner_user_id');
    }
    setIsAuthenticated(false);
    addAuditLog('DECONNEXION', 'AUTHENTIFICATION', `${currentUser.full_name} (@${currentUser.username})`);
  };

  const updateUser = async (updatedUser: UserProfile) => {
    setUsers(prev => {
      const updated = prev.map(u => u.id === updatedUser.id ? updatedUser : u);
      if (typeof window !== 'undefined') {
        localStorage.setItem('saniplaner_users', JSON.stringify(updated));
        localStorage.setItem('saniplaner_sync_trigger', String(Date.now()));
        broadcastSync('USERS_UPDATED');
      }
      return updated;
    });

    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('saniplaner_user_id', updatedUser.id);
      }
    }

    // Persist role, allowed_modules and profile updates directly to Supabase cloud database
    await syncUserCredentialsToCloud(updatedUser);

    addAuditLog('MISE_A_JOUR_UTILISATEUR', 'ADMINISTRATION', `${updatedUser.full_name} (${updatedUser.role})`);
  };

  const changePassword = async (userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'Le mot de passe doit comporter au moins 4 caractères.' };
    }
    const cleanPass = newPassword.trim();
    if (cleanPass === 'sani2026') {
      return { success: false, message: 'Veuillez choisir un nouveau mot de passe différent du mot de passe initial (sani2026).' };
    }

    let targetUser: UserProfile | null = null;
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        targetUser = {
          ...u,
          password: cleanPass,
          is_first_login: false,
        };
        return targetUser;
      }
      return u;
    });

    if (!targetUser) {
      return { success: false, message: 'Utilisateur introuvable.' };
    }

    // 1. Sauvegarde prioritaire et synchrone dans la base Supabase Cloud
    await syncUserCredentialsToCloud(targetUser);

    // 2. Mise à jour de l'état local et du stockage navigateur
    setUsers(updatedUsers);
    if (typeof window !== 'undefined') {
      localStorage.setItem('saniplaner_users', JSON.stringify(updatedUsers));
      localStorage.setItem('saniplaner_sync_trigger', String(Date.now()));
      broadcastSync('USERS_UPDATED');
    }

    if (currentUser.id === userId) {
      setCurrentUser(targetUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('saniplaner_user_id', userId);
      }
    }

    addAuditLog('CHANGEMENT_MOT_DE_PASSE', 'SECURITE', `@${(targetUser as UserProfile).username || (targetUser as UserProfile).full_name}`);
    return { success: true };
  };

  const isPasswordChangeRequired = Boolean(currentUser && currentUser.is_first_login);

  // Filter out hidden accounts (e.g. Super Admin) from standard team selection dropdowns
  const visibleUsers = useMemo(() => {
    return users.filter(u => !u.is_hidden && u.id !== 'usr-superadmin' && !u.id.startsWith('store-') && !u.id.startsWith('11111111-9999') && (u.role as string) !== 'system');
  }, [users]);

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser: handleSetCurrentUser,
      login,
      logout,
      updateUser,
      changePassword,
      isPasswordChangeRequired,
      lastSyncTime,
      syncNow,
      isAuthenticated,
      isAuthLoading,
      users: visibleUsers,
      allUsers: users,
      activities,
      updateActivity,
      updateSubActivity,
      addSubActivity,
      deleteSubActivity,
      addActivity,
      weeklyActivities,
      weeklySubmissions,
      addWeeklyActivity,
      updateWeeklyActivity,
      deleteWeeklyActivity,
      saveBatchWeeklyActivities,
      submitWeeklyPlanning,
      toggleWeeklySubmission,
      timesheets,
      createOrUpdateTimesheet,
      submitTimesheet,
      verifyTimesheet,
      validateTimesheet,
      rejectTimesheet,
      projectRisks,
      updateProjectRisk,
      b09Metrics,
      updateB09Metric,
      addB09Metric,
      deleteB09Metric,
      initB09MonthZones,
      resetB09Metrics,
      b09Reminders,
      addB09Reminder,
      deleteB09Reminder,
      b09Dossiers,
      updateB09Dossier,
      b13Items,
      updateB13Item,
      addB13Item,
      deleteB13Item,
      expenditures,
      addExpenditure,
      updateExpenditure,
      deleteExpenditure,
      importExpendituresBatch,
      missions,
      updateMissionStatus,
      updateMission,
      addMission,
      deleteMission,
      trainings,
      addTraining,
      updateTraining,
      deleteTraining,
      meetings,
      addMeeting,
      updateMeeting,
      deleteMeeting,
      deliverables,
      updateDeliverableStatus,
      documents,
      addDocument,
      galleryItems,
      addGalleryItem,
      updateGalleryItem,
      deleteGalleryItem,
      addPhotoToGalleryItem,
      deletePhotoFromGalleryItem,
      auditLogs,
      addAuditLog,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      toggleMobileSidebar,
      resetDemoData
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
