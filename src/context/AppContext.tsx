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
  MeetingSession
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
  MOCK_MEETINGS
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
  fetchAllCloudModules,
  deleteWeeklyActivityFromCloud,
  deleteMissionFromCloud,
  filterOutFictitiousActivities,
  filterOutFictitiousSubmissions,
  filterOutMockMissions,
  filterOutMockDeliverables,
  CLOUD_MODULE_KEYS
} from '@/lib/supabase-sync';

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
  addExpenditure: (exp: BudgetExpenditure) => void;
  updateExpenditure: (exp: BudgetExpenditure) => void;
  deleteExpenditure: (id: string) => void;
  importExpendituresBatch: (exps: BudgetExpenditure[]) => void;
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
  addMeeting: (meeting: MeetingSession) => void;
  updateMeeting: (meeting: MeetingSession) => void;
  deleteMeeting: (id: string) => void;
  deliverables: Deliverable[];
  updateDeliverableStatus: (id: string, status: DeliverableStatus, comments?: string) => void;
  documents: DocumentItem[];
  addDocument: (doc: DocumentItem) => void;
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

  // Purge et réinitialisation des tableaux de complétude B09 pour démarrage de la vraie saisie opérationnelle
  const B09_PURGE_KEY = 'saniplaner_b09_clean_ready_for_entry_v2';
  if (localStorage.getItem(B09_PURGE_KEY) !== 'true') {
    try {
      localStorage.removeItem('saniplaner_b09_metrics');
      localStorage.removeItem('saniplaner_b09_reminders');
      localStorage.removeItem('saniplaner_b09_dossiers');
      localStorage.setItem(B09_PURGE_KEY, 'true');
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
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
        if (found) return found;
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
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
  const [expenditures, setExpenditures] = useState<BudgetExpenditure[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saniplaner_expenditures');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore */ }
      }
    }
    return MOCK_EXPENDITURES;
  });
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saniplaner_trainings', JSON.stringify(trainings));
      } catch { /* ignore */ }
    }
  }, [trainings]);
  const [meetings, setMeetings] = useState<MeetingSession[]>(() => {
    let deletedIds = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const d = localStorage.getItem('saniplaner_deleted_meeting_ids');
        if (d) deletedIds = new Set(JSON.parse(d));
      } catch {}
      const stored = localStorage.getItem('saniplaner_meetings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((m: any) => m && m.id && !deletedIds.has(m.id));
            if (filtered.length > 0) return filtered;
          }
        } catch { /* ignore */ }
      }
    }
    return MOCK_MEETINGS.filter(m => !deletedIds.has(m.id));
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saniplaner_meetings', JSON.stringify(meetings));
      } catch { /* ignore */ }
    }
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
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Broadcast channel for instantaneous cross-tab synchronization
  const broadcastSync = (type: string, payload?: unknown) => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('saniplaner_sync_bus');
        bc.postMessage({ type, payload, timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  };

  const isSyncingRef = useRef(false);
  const lastLocalSaveRef = useRef(0);

  // Full synchronization routine (Cloud + LocalStorage)
  const syncNow = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      if (typeof window !== 'undefined') {
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

        const savedMissions = localStorage.getItem('saniplaner_missions');
        if (savedMissions) {
          try {
            const parsedM = JSON.parse(savedMissions);
            if (Array.isArray(parsedM) && parsedM.length > 0) {
              setMissions(parsedM);
              missionsRef.current = parsedM;
            }
          } catch {}
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

        const savedExp = localStorage.getItem('saniplaner_expenditures');
        if (savedExp) {
          try {
            const parsedE = JSON.parse(savedExp);
            if (Array.isArray(parsedE)) setExpenditures(parsedE);
          } catch {}
        }
      }

      if (isSupabaseConfigured) {
        // 1. Fetch persistent user credentials, passwords, roles and permissions from cloud
        try {
          const cloudUsers = await fetchUsersFromCloud();
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
        } catch { /* non-blocking */ }

        // 2. Fetch all shared platform data from Cloud Store (Meetings, Timesheets, B13, B09, Budget, Missions, etc.)
        let cloudStore: Record<string, any> = {};
        try {
          cloudStore = await fetchAllCloudModules();

          if (cloudStore[CLOUD_MODULE_KEYS.MEETINGS]) {
            let deletedIds = new Set<string>();
            if (typeof window !== 'undefined') {
              try {
                const d = localStorage.getItem('saniplaner_deleted_meeting_ids');
                if (d) deletedIds = new Set(JSON.parse(d));
              } catch {}
            }

            const cloudMeetings: MeetingSession[] = Array.isArray(cloudStore[CLOUD_MODULE_KEYS.MEETINGS])
              ? cloudStore[CLOUD_MODULE_KEYS.MEETINGS].filter((m: any) => m && m.id && !deletedIds.has(m.id))
              : [];

            let localMeetings: MeetingSession[] = [];
            if (typeof window !== 'undefined') {
              try {
                const s = localStorage.getItem('saniplaner_meetings');
                if (s) {
                  const parsed = JSON.parse(s);
                  if (Array.isArray(parsed)) {
                    localMeetings = parsed.filter((m: any) => m && m.id && !deletedIds.has(m.id));
                  }
                }
              } catch {}
            }

            const meetingMap = new Map<string, MeetingSession>();
            MOCK_MEETINGS.forEach(m => { if (m && m.id && !deletedIds.has(m.id)) meetingMap.set(m.id, m); });
            cloudMeetings.forEach(m => { if (m && m.id && !deletedIds.has(m.id)) meetingMap.set(m.id, m); });
            localMeetings.forEach(m => { if (m && m.id && !deletedIds.has(m.id)) meetingMap.set(m.id, m); });
            const mergedMeetings = Array.from(meetingMap.values());

            setMeetings(mergedMeetings);
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('saniplaner_meetings', JSON.stringify(mergedMeetings)); } catch {}
            }

            if (mergedMeetings.length !== cloudMeetings.length) {
              saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', mergedMeetings);
            }
          } else {
            let deletedIds = new Set<string>();
            if (typeof window !== 'undefined') {
              try {
                const d = localStorage.getItem('saniplaner_deleted_meeting_ids');
                if (d) deletedIds = new Set(JSON.parse(d));
              } catch {}
            }
            let localMeetings: MeetingSession[] = [];
            if (typeof window !== 'undefined') {
              try {
                const s = localStorage.getItem('saniplaner_meetings');
                if (s) {
                  const parsed = JSON.parse(s);
                  if (Array.isArray(parsed)) {
                    localMeetings = parsed.filter((m: any) => m && m.id && !deletedIds.has(m.id));
                  }
                }
              } catch {}
            }
            const fallback = localMeetings.length > 0 
              ? localMeetings 
              : MOCK_MEETINGS.filter(m => !deletedIds.has(m.id));
            setMeetings(fallback);
            saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', fallback);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS];
            setTimesheets(list);
            try { localStorage.setItem('saniplaner_timesheets', JSON.stringify(list)); } catch {}
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.TIMESHEETS, 'timesheets', []);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.B13] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.B13])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.B13];
            setB13Items(list);
            try { localStorage.setItem('saniplaner_b13_items', JSON.stringify(list)); } catch {}
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', MOCK_B13_ITEMS);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.B09]) {
            const b09Data = cloudStore[CLOUD_MODULE_KEYS.B09];
            if (b09Data.metrics && Array.isArray(b09Data.metrics)) {
              setB09Metrics(b09Data.metrics);
              try { localStorage.setItem('saniplaner_b09_metrics', JSON.stringify(b09Data.metrics)); } catch {}
            }
            if (b09Data.reminders && Array.isArray(b09Data.reminders)) {
              setB09Reminders(b09Data.reminders);
              try { localStorage.setItem('saniplaner_b09_reminders', JSON.stringify(b09Data.reminders)); } catch {}
            }
            if (b09Data.dossiers && Array.isArray(b09Data.dossiers)) {
              setB09Dossiers(b09Data.dossiers);
              try { localStorage.setItem('saniplaner_b09_dossiers', JSON.stringify(b09Data.dossiers)); } catch {}
            }
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
              metrics: MOCK_B09_METRICS,
              reminders: [],
              dossiers: MOCK_B09_DOSSIERS,
            });
          }

          if (cloudStore[CLOUD_MODULE_KEYS.BUDGET] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.BUDGET])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.BUDGET];
            setExpenditures(list);
            try { localStorage.setItem('saniplaner_expenditures', JSON.stringify(list)); } catch {}
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', []);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.MISSIONS]) {
            let deletedIds = new Set<string>();
            if (typeof window !== 'undefined') {
              try {
                const d = localStorage.getItem('saniplaner_deleted_mission_ids');
                if (d) deletedIds = new Set(JSON.parse(d));
              } catch {}
            }

            const cloudMissions: FieldMission[] = Array.isArray(cloudStore[CLOUD_MODULE_KEYS.MISSIONS])
              ? filterOutMockMissions(cloudStore[CLOUD_MODULE_KEYS.MISSIONS]).filter((m: any) => m && m.id && !deletedIds.has(m.id))
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
            localMissions.forEach(m => { if (m && m.id && !deletedIds.has(m.id)) missionMap.set(m.id, m); });
            const mergedMissions = Array.from(missionMap.values());

            setMissions(mergedMissions);
            missionsRef.current = mergedMissions;
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('saniplaner_missions', JSON.stringify(mergedMissions)); } catch {}
            }

            if (mergedMissions.length !== cloudMissions.length) {
              saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', mergedMissions);
            }
          } else {
            let deletedIds = new Set<string>();
            if (typeof window !== 'undefined') {
              try {
                const d = localStorage.getItem('saniplaner_deleted_mission_ids');
                if (d) deletedIds = new Set(JSON.parse(d));
              } catch {}
            }
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
            saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', fallback);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.FORMATIONS] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.FORMATIONS])) {
            const list = cloudStore[CLOUD_MODULE_KEYS.FORMATIONS];
            setTrainings(list);
            try { localStorage.setItem('saniplaner_trainings', JSON.stringify(list)); } catch {}
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', []);
          }

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

          if (cloudStore[CLOUD_MODULE_KEYS.WORK_PLAN] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.WORK_PLAN])) {
            const list = enrichActivitiesWithSubActivities(cloudStore[CLOUD_MODULE_KEYS.WORK_PLAN]);
            setActivities(list);
            try { localStorage.setItem('saniplaner_activities', JSON.stringify(list)); } catch {}
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.WORK_PLAN, 'work_plan', MOCK_WORK_PLAN);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.DELIVERABLES] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.DELIVERABLES])) {
            const cleanDelivs = filterOutMockDeliverables(cloudStore[CLOUD_MODULE_KEYS.DELIVERABLES]);
            setDeliverables(cleanDelivs);
            try { localStorage.setItem('saniplaner_deliverables', JSON.stringify(cleanDelivs)); } catch {}
          } else {
            setDeliverables([]);
            saveModuleToCloud(CLOUD_MODULE_KEYS.DELIVERABLES, 'deliverables', []);
          }

          if (cloudStore[CLOUD_MODULE_KEYS.DOCUMENTS] && Array.isArray(cloudStore[CLOUD_MODULE_KEYS.DOCUMENTS])) {
            setDocuments(cloudStore[CLOUD_MODULE_KEYS.DOCUMENTS]);
          } else {
            saveModuleToCloud(CLOUD_MODULE_KEYS.DOCUMENTS, 'documents', []);
          }
        } catch { /* non-blocking */ }

        // Requêtes fallback sur les tables legacy uniquement si le store principal était absent
        if (!cloudStore[CLOUD_MODULE_KEYS.PLANNING_HEBDO]) {
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
          if (!cloudStore[CLOUD_MODULE_KEYS.TIMESHEETS] && sheetsRes.status === 'fulfilled' && sheetsRes.value.data && sheetsRes.value.data.length > 0) {
            setTimesheets(sheetsRes.value.data);
          }
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString('fr-FR'));
    } catch {
      // Offline fallback
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Synchronisation automatique et abonnements temps réel
  useEffect(() => {
    // 1. Initial background sync
    syncNow();

    // 2. Cross-tab synchronization via BroadcastChannel & Storage event
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('saniplaner_sync_bus');
        bc.onmessage = () => {
          syncNow();
        };
      } catch {}
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'saniplaner_users' || e.key === 'saniplaner_missions' || e.key === 'saniplaner_sync_trigger') {
        syncNow();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 3. Focus-based sync avec anti-rebond
    let focusTimer: NodeJS.Timeout | null = null;
    const handleFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => syncNow(), 1500);
    };
    window.addEventListener('focus', handleFocus);

    // 4. Automatic background sync polling espacé (60 secondes au lieu de 12s)
    const intervalId = setInterval(syncNow, 60000);

    // 5. Supabase Realtime Channel avec protection anti-écho
    let supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
    let realtimeTimer: NodeJS.Timeout | null = null;
    if (isSupabaseConfigured) {
      try {
        const onRealtimeChange = () => {
          // Évite la boucle infinie : ignore nos propres écritures récentes
          if (Date.now() - lastLocalSaveRef.current < 4000) return;
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => {
            syncNow();
          }, 2500);
        };

        supabaseChannel = supabase
          .channel('saniplaner_realtime_sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onRealtimeChange)
          .subscribe();
      } catch {}
    }

    return () => {
      if (bc) bc.close();
      if (focusTimer) clearTimeout(focusTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  }, []);

  const addAuditLog = (action: string, module: string, entityRef: string) => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}`,
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
      const nextSubs = parent.sub_activities.map(s => s.id === updatedSub.id ? updatedSub : s);
      const computedProg = Math.min(100, Math.round(nextSubs.reduce((s, sub) => s + (sub.progress_pct * sub.weight_pct) / 100, 0)));
      const updatedParent: WorkPlanActivity = {
        ...parent,
        sub_activities: nextSubs,
        progress_pct: computedProg,
        status: computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : parent.status)
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
      const updatedParent: WorkPlanActivity = {
        ...parent,
        sub_activities: nextSubs,
        progress_pct: computedProg,
        status: computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : parent.status)
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
      const updatedParent: WorkPlanActivity = {
        ...parent,
        sub_activities: nextSubs,
        progress_pct: computedProg,
        status: computedProg >= 100 ? 'TERMINEE' : (computedProg > 0 ? 'EN_COURS' : parent.status)
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
    let nextList: WeeklyActivity[] = [];
    setWeeklyActivities(prev => {
      const next = [act, ...prev.filter(a => a.id !== act.id)];
      weeklyActivitiesRef.current = next;
      nextList = next;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(next)); } catch {}
      }
      return next;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList.length > 0 ? nextList : weeklyActivitiesRef.current,
      submissions: weeklySubmissionsRef.current
    });
    addAuditLog('NOUVELLE_ACTIVITE_HEBDO', 'PLANNING_HEBDO', `${act.week_label} - ${act.title.substring(0, 30)}`);
    syncWeeklyActivitiesToCloud([act]);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const updateWeeklyActivity = (act: WeeklyActivity) => {
    let nextList: WeeklyActivity[] = [];
    setWeeklyActivities(prev => {
      const next = prev.map(a => a.id === act.id ? act : a);
      weeklyActivitiesRef.current = next;
      nextList = next;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(next)); } catch {}
      }
      return next;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList.length > 0 ? nextList : weeklyActivitiesRef.current,
      submissions: weeklySubmissionsRef.current
    });
    addAuditLog('AVANCEMENT_ACTIVITE_HEBDO', 'PLANNING_HEBDO', `${act.progress_pct}% - ${act.title.substring(0, 30)}`);
    syncWeeklyActivitiesToCloud([act]);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const deleteWeeklyActivity = (id: string) => {
    let nextList: WeeklyActivity[] = [];
    setWeeklyActivities(prev => {
      const next = prev.filter(a => a.id !== id);
      weeklyActivitiesRef.current = next;
      nextList = next;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(next)); } catch {}
      }
      return next;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList,
      submissions: weeklySubmissionsRef.current
    });
    addAuditLog('SUPPRESSION_ACTIVITE_HEBDO', 'PLANNING_HEBDO', id);
    deleteWeeklyActivityFromCloud(id);
    broadcastSync('PLANNING_HEBDO_UPDATED');
  };

  const saveBatchWeeklyActivities = (acts: WeeklyActivity[]) => {
    let nextList: WeeklyActivity[] = [];
    setWeeklyActivities(prev => {
      const newIds = new Set(acts.map(a => a.id));
      const remaining = prev.filter(a => !newIds.has(a.id));
      const next = [...acts, ...remaining];
      weeklyActivitiesRef.current = next;
      nextList = next;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_weekly_activities', JSON.stringify(next)); } catch {}
      }
      return next;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', {
      activities: nextList.length > 0 ? nextList : weeklyActivitiesRef.current,
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
      const exists = prev.some(t => t.id === ts.id);
      const updated = exists ? prev.map(t => t.id === ts.id ? ts : t) : [ts, ...prev];
      saveTimesheetsState(updated);
      return updated;
    });
    addAuditLog('EDITION_TIMESHEET', 'TIMESHEETS', `${ts.month_name} - ${ts.expert_id}`);
    syncTimesheetToCloud(ts);
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
        localStorage.removeItem('saniplaner_trainings');
        localStorage.removeItem('saniplaner_b09_reminders');
        localStorage.removeItem('saniplaner_weekly_activities');
        localStorage.removeItem('saniplaner_weekly_submissions');
        localStorage.removeItem('saniplaner_b13_items');
      } catch {}
    }
    setMissions([]);
    setMeetings([]);
    setTimesheets([]);
    setWeeklyActivities([]);
    setWeeklySubmissions([]);
    setTrainings([]);
    setB13Items(MOCK_B13_ITEMS);
    setDocuments([]);
    setAuditLogs([]);
    setB09Reminders([]);
    setExpenditures([]);

    // Purge / reset cloud stores
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.TIMESHEETS, 'timesheets', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.PLANNING_HEBDO, 'planning_hebdo', { activities: [], submissions: [] });
    saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', MOCK_B13_ITEMS);
    saveModuleToCloud(CLOUD_MODULE_KEYS.DOCUMENTS, 'documents', []);
    saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', []);
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
      const exists = prev.some(m => m.id === updated.id);
      const next = exists ? prev.map(m => m.id === updated.id ? itemWithRecalc : m) : [...prev, itemWithRecalc];
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

  const resetB09Metrics = (targetMonth?: number, targetYear?: number) => {
    setB09Metrics(prev => {
      const next = prev.map(m => {
        if (targetMonth !== undefined && targetYear !== undefined) {
          if (m.period_month !== targetMonth || m.period_year !== targetYear) return m;
        }
        return {
          ...m,
          submitted_on_time: 0,
          submitted_late: 0,
          missing_reports: m.expected_reports,
          promptitude_rate: 0,
          target_met: false,
          reminders_sent: 0,
          evidence_status: 'EN_ATTENTE_PREUVE' as const,
          main_constraints: '',
          corrective_actions: '',
          update_count: 0,
          update_history: [],
          last_updated_at: undefined,
          last_updated_by: undefined,
          is_locked: false,
        };
      });
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
    addAuditLog('REINITIALISATION_COMPLETUDE_B09', 'B09_ESIGL', targetMonth && targetYear ? `Mois ${targetMonth}/${targetYear}` : 'Tous les mois');
    broadcastSync('B09_UPDATED');
  };

  const addB09Reminder = (reminder: B09ReminderRecord) => {
    setB09Reminders(prev => {
      const next = [reminder, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_reminders', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: b09Metrics,
        reminders: next,
        dossiers: b09Dossiers,
      });
      return next;
    });
    addAuditLog('ENREGISTREMENT_RELANCE_B09', 'B09_ESIGL', `${reminder.fosa_name} (${reminder.zone_name})`);
    broadcastSync('B09_UPDATED');
  };

  const deleteB09Reminder = (id: string) => {
    setB09Reminders(prev => {
      const next = prev.filter(r => r.id !== id);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b09_reminders', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B09, 'b09', {
        metrics: b09Metrics,
        reminders: next,
        dossiers: b09Dossiers,
      });
      return next;
    });
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
    setB13Items(prev => {
      const next = prev.map(i => i.id === updated.id ? updated : i);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b13_items', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', next);
      return next;
    });
    broadcastSync('B13_ITEM_UPDATED', updated);
    addAuditLog('MISE_A_JOUR_B13', 'B13_QUANTIFICATION', `${updated.title} (${updated.progress_pct}% - ${updated.status})`);
  };

  const addB13Item = (item: B13Item) => {
    setB13Items(prev => {
      const next = [item, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b13_items', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', next);
      return next;
    });
    broadcastSync('B13_ITEM_ADDED', item);
    addAuditLog('AJOUT_ACTIVITE_B13', 'B13_QUANTIFICATION', item.title);
  };

  const deleteB13Item = (id: string) => {
    setB13Items(prev => {
      const target = prev.find(i => i.id === id);
      const next = prev.filter(i => i.id !== id);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_b13_items', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.B13, 'b13', next);
      if (target) {
        addAuditLog('SUPPRESSION_ACTIVITE_B13', 'B13_QUANTIFICATION', target.title);
      }
      return next;
    });
    broadcastSync('B13_ITEM_DELETED', { id });
  };

  const addExpenditure = (exp: BudgetExpenditure) => {
    setExpenditures(prev => {
      const next = [exp, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_expenditures', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', next);
      return next;
    });
    broadcastSync('EXPENDITURE_ADDED', exp);
    addAuditLog('AJOUT_DEPENSE_BUDGET', 'BUDGET_FINANCES', `${exp.expense_code} - ${exp.amount_fcfa.toLocaleString('fr-FR')} FCFA (${exp.category_code})`);
  };

  const updateExpenditure = (exp: BudgetExpenditure) => {
    setExpenditures(prev => {
      const next = prev.map(e => e.id === exp.id ? exp : e);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_expenditures', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', next);
      return next;
    });
    broadcastSync('EXPENDITURE_UPDATED', exp);
    addAuditLog('MODIFICATION_DEPENSE_BUDGET', 'BUDGET_FINANCES', `${exp.expense_code} - ${exp.amount_fcfa.toLocaleString('fr-FR')} FCFA`);
  };

  const deleteExpenditure = (id: string) => {
    setExpenditures(prev => {
      const exp = prev.find(e => e.id === id);
      const next = prev.filter(e => e.id !== id);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_expenditures', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', next);
      if (exp) {
        addAuditLog('SUPPRESSION_DEPENSE_BUDGET', 'BUDGET_FINANCES', `${exp.expense_code} - ${exp.description}`);
      }
      return next;
    });
    broadcastSync('EXPENDITURE_DELETED', id);
  };

  const importExpendituresBatch = (exps: BudgetExpenditure[]) => {
    setExpenditures(prev => {
      const next = [...exps, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_expenditures', JSON.stringify(next)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.BUDGET, 'budget', next);
      return next;
    });
    broadcastSync('EXPENDITURES_BATCH_IMPORTED', exps.length);
    addAuditLog('IMPORT_LOT_DEPENSES', 'BUDGET_FINANCES', `${exps.length} dépenses importées`);
  };

  const updateMissionStatus = (id: string, status: MissionStatus) => {
    let nextList: FieldMission[] = [];
    setMissions(prev => {
      const list = prev.map(m => m.id === id ? { ...m, status } : m);
      missionsRef.current = list;
      nextList = list;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_missions', JSON.stringify(list)); } catch {}
      }
      return list;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList.length > 0 ? nextList : missionsRef.current);
    addAuditLog(`STATUT_MISSION_${status}`, 'MISSIONS', id);
    broadcastSync('MISSIONS_UPDATED');
  };

  const updateMission = (updated: FieldMission) => {
    let nextList: FieldMission[] = [];
    setMissions(prev => {
      const list = prev.map(m => m.id === updated.id ? updated : m);
      missionsRef.current = list;
      nextList = list;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_missions', JSON.stringify(list)); } catch {}
      }
      return list;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList.length > 0 ? nextList : missionsRef.current);
    addAuditLog('MISE_A_JOUR_MISSION', 'MISSIONS', updated.title);
    broadcastSync('MISSIONS_UPDATED');
  };

  const addMission = (newMis: FieldMission) => {
    let nextList: FieldMission[] = [];
    setMissions(prev => {
      const list = [newMis, ...prev.filter(m => m.id !== newMis.id)];
      missionsRef.current = list;
      nextList = list;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_missions', JSON.stringify(list)); } catch {}
      }
      return list;
    });
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList.length > 0 ? nextList : missionsRef.current);
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

    // 2. Mettre à jour l'état et le cache local
    let nextList: FieldMission[] = [];
    setMissions(prev => {
      const list = prev.filter(m => m.id !== id);
      missionsRef.current = list;
      nextList = list;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_missions', JSON.stringify(list)); } catch {}
      }
      return list;
    });

    // 3. Suppression cloud immédiate sans résurrection
    await deleteMissionFromCloud(id);
    saveModuleToCloud(CLOUD_MODULE_KEYS.MISSIONS, 'missions', nextList);
    addAuditLog('SUPPRESSION_MISSION', 'MISSIONS', id);
    broadcastSync('MISSIONS_UPDATED');
  };

  const addMeeting = (newMeet: MeetingSession) => {
    setMeetings(prev => {
      const list = [newMeet, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('saniplaner_meetings', JSON.stringify(list));
        } catch (err) {
          console.warn('[Storage] Quota exceeded or error saving meetings to localStorage:', err);
        }
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', list);
      return list;
    });
    addAuditLog('NOUVELLE_SEANCE', 'SEANCES', newMeet?.title || 'Séance');
    broadcastSync('MEETINGS_UPDATED');
  };

  const updateMeeting = (updatedMeet: MeetingSession) => {
    setMeetings(prev => {
      const list = prev.map(m => m.id === updatedMeet.id ? updatedMeet : m);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('saniplaner_meetings', JSON.stringify(list));
        } catch (err) {
          console.warn('[Storage] Quota exceeded or error updating meeting in localStorage:', err);
        }
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', list);
      return list;
    });
    addAuditLog('MODIFICATION_SEANCE', 'SEANCES', updatedMeet?.title || 'Séance');
    broadcastSync('MEETINGS_UPDATED');
  };

  const deleteMeeting = async (id: string) => {
    // 1. Enregistrer dans le registre des suppressions définitives (tombstones)
    if (typeof window !== 'undefined') {
      try {
        let deletedIds: string[] = [];
        const existing = localStorage.getItem('saniplaner_deleted_meeting_ids');
        if (existing) deletedIds = JSON.parse(existing) || [];
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          localStorage.setItem('saniplaner_deleted_meeting_ids', JSON.stringify(deletedIds));
        }
      } catch {}
    }

    // 2. Mettre à jour l'état et le cache local
    let nextList: MeetingSession[] = [];
    setMeetings(prev => {
      const list = prev.filter(m => m.id !== id);
      nextList = list;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('saniplaner_meetings', JSON.stringify(list));
        } catch (err) {
          console.warn('[Storage] Quota exceeded or error deleting meeting in localStorage:', err);
        }
      }
      return list;
    });

    // 3. Sauvegarde cloud
    saveModuleToCloud(CLOUD_MODULE_KEYS.MEETINGS, 'meetings', nextList);
    addAuditLog('SUPPRESSION_SEANCE', 'SEANCES', id);
    broadcastSync('MEETINGS_UPDATED');
  };

  const addTraining = (newTrain: Training) => {
    setTrainings(prev => {
      const list = [newTrain, ...prev];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_trainings', JSON.stringify(list)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', list);
      return list;
    });
    addAuditLog('NOUVELLE_FORMATION', 'FORMATIONS', newTrain.topic);
    broadcastSync('TRAININGS_UPDATED');
  };

  const updateTraining = (updatedTrain: Training) => {
    setTrainings(prev => {
      const list = prev.map(t => t.id === updatedTrain.id ? updatedTrain : t);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_trainings', JSON.stringify(list)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', list);
      return list;
    });
    addAuditLog('MODIFICATION_FORMATION', 'FORMATIONS', updatedTrain.topic);
    broadcastSync('TRAININGS_UPDATED');
  };

  const deleteTraining = (id: string) => {
    setTrainings(prev => {
      const list = prev.filter(t => t.id !== id);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('saniplaner_trainings', JSON.stringify(list)); } catch {}
      }
      saveModuleToCloud(CLOUD_MODULE_KEYS.FORMATIONS, 'formations', list);
      return list;
    });
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
            verified_by: status === 'VERIFICATION' || status === 'VALIDATION_DIRECTION' ? currentUser.id : d.verified_by,
            validated_by: status === 'VALIDATION_DIRECTION' || status === 'TRANSMISSION_PSI' ? currentUser.id : d.validated_by,
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

    const found = currentUsersList.find(u => 
      (u.username && u.username.toLowerCase() === cleanUser) ||
      (u.email && u.email.toLowerCase() === cleanUser) ||
      (u.username && `${u.username.toLowerCase()}@saninovagc.com` === cleanUser) ||
      (cleanUser === 'deddeh' && u.id === 'usr-admin-1') ||
      (cleanUser === 'geddeh' && u.id === 'usr-admin-1') ||
      (cleanUser === 'geddeh@saninovagc.com' && u.id === 'usr-admin-1') ||
      (cleanUser === 'wbolaro' && u.id === 'usr-driver-1')
    );

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
