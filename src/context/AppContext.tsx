'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  UserProfile, 
  WorkPlanActivity, 
  B09MonthlyMetric, 
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
  ProjectRisk
} from '@/types';
import { 
  MOCK_USERS, 
  MOCK_WORK_PLAN, 
  MOCK_B09_METRICS, 
  MOCK_B13_ITEMS, 
  MOCK_FIELD_MISSIONS, 
  MOCK_TRAININGS, 
  MOCK_DELIVERABLES, 
  MOCK_DOCUMENTS, 
  MOCK_AUDIT_LOGS,
  MOCK_WEEKLY_ACTIVITIES,
  MOCK_WEEKLY_SUBMISSIONS,
  MOCK_TIMESHEETS,
  MOCK_PROJECT_RISKS
} from '@/lib/mock-data';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  syncWeeklyActivitiesToCloud, 
  syncWeeklySubmissionToCloud, 
  syncTimesheetToCloud, 
  syncAuditLogToCloud 
} from '@/lib/supabase-sync';

interface AppContextType {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  users: UserProfile[];
  activities: WorkPlanActivity[];
  updateActivity: (activity: WorkPlanActivity) => void;
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
  b13Items: B13Item[];
  updateB13Item: (item: B13Item) => void;
  missions: FieldMission[];
  updateMissionStatus: (id: string, status: MissionStatus) => void;
  addMission: (mission: FieldMission) => void;
  trainings: Training[];
  deliverables: Deliverable[];
  updateDeliverableStatus: (id: string, status: DeliverableStatus, comments?: string) => void;
  documents: DocumentItem[];
  addDocument: (doc: DocumentItem) => void;
  auditLogs: AuditLogItem[];
  addAuditLog: (action: string, module: string, entityRef: string) => void;
  login: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USERS[0]); // Direction by default
  const [users] = useState<UserProfile[]>(MOCK_USERS);
  const [activities, setActivities] = useState<WorkPlanActivity[]>(MOCK_WORK_PLAN);
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivity[]>(MOCK_WEEKLY_ACTIVITIES);
  const [weeklySubmissions, setWeeklySubmissions] = useState<WeeklySubmission[]>(MOCK_WEEKLY_SUBMISSIONS);
  const [timesheets, setTimesheets] = useState<MonthlyTimesheet[]>(MOCK_TIMESHEETS);
  const [projectRisks, setProjectRisks] = useState<ProjectRisk[]>(MOCK_PROJECT_RISKS);
  const [b09Metrics, setB09Metrics] = useState<B09MonthlyMetric[]>(MOCK_B09_METRICS);
  const [b13Items, setB13Items] = useState<B13Item[]>(MOCK_B13_ITEMS);
  const [missions, setMissions] = useState<FieldMission[]>(MOCK_FIELD_MISSIONS);
  const [trainings, setTrainings] = useState<Training[]>(MOCK_TRAININGS);
  const [deliverables, setDeliverables] = useState<Deliverable[]>(MOCK_DELIVERABLES);
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);

  // Synchronisation descendante au chargement
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    async function loadCloudData() {
      try {
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
        if (sheetsRes.status === 'fulfilled' && sheetsRes.value.data && sheetsRes.value.data.length > 0) {
          setTimesheets(sheetsRes.value.data);
        }
      } catch {
        // Mode hors ligne / résilience par défaut
      }
    }
    loadCloudData();
  }, []);

  const addAuditLog = (action: string, module: string, entityRef: string) => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}`,
      user_name: currentUser.full_name,
      user_role: currentUser.title,
      action,
      module,
      entity_ref: entityRef,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditLogs(prev => [newLog, ...prev]);
    syncAuditLogToCloud(newLog);
  };

  const updateActivity = (updated: WorkPlanActivity) => {
    setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
    addAuditLog('MISE_A_JOUR_ACTIVITE', 'WORK_PLAN', updated.code);
  };

  const addActivity = (newAct: WorkPlanActivity) => {
    setActivities(prev => [newAct, ...prev]);
    addAuditLog('CREATION_ACTIVITE', 'WORK_PLAN', newAct.code);
  };

  // --- PLANNING HEBDOMADAIRE ---
  const addWeeklyActivity = (act: WeeklyActivity) => {
    setWeeklyActivities(prev => [act, ...prev]);
    addAuditLog('NOUVELLE_ACTIVITE_HEBDO', 'PLANNING_HEBDO', `${act.week_label} - ${act.title.substring(0, 30)}`);
    syncWeeklyActivitiesToCloud([act]);
  };

  const updateWeeklyActivity = (act: WeeklyActivity) => {
    setWeeklyActivities(prev => prev.map(a => a.id === act.id ? act : a));
    addAuditLog('AVANCEMENT_ACTIVITE_HEBDO', 'PLANNING_HEBDO', `${act.progress_pct}% - ${act.title.substring(0, 30)}`);
    syncWeeklyActivitiesToCloud([act]);
  };

  const deleteWeeklyActivity = (id: string) => {
    setWeeklyActivities(prev => prev.filter(a => a.id !== id));
    addAuditLog('SUPPRESSION_ACTIVITE_HEBDO', 'PLANNING_HEBDO', id);
  };

  const saveBatchWeeklyActivities = (acts: WeeklyActivity[]) => {
    setWeeklyActivities(prev => {
      const newIds = new Set(acts.map(a => a.id));
      const remaining = prev.filter(a => !newIds.has(a.id));
      return [...acts, ...remaining];
    });
    addAuditLog('SAISIE_LOT_ACTIVITES_HEBDO', 'PLANNING_HEBDO', `${acts.length} activités enregistrées`);
    syncWeeklyActivitiesToCloud(acts);
  };

  const submitWeeklyPlanning = (expertId: string, weekNumber: number) => {
    const now = new Date();
    const dateStr = `${now.toISOString().substring(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let submissionToSync: WeeklySubmission | null = null;
    setWeeklySubmissions(prev => {
      const idx = prev.findIndex(s => s.expert_id === expertId && s.week_number === weekNumber);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], is_submitted: true, submission_date: dateStr };
        submissionToSync = copy[idx];
        return copy;
      }
      const newSub: WeeklySubmission = {
        id: `sub-w${weekNumber}-${expertId}`,
        expert_id: expertId,
        week_number: weekNumber,
        is_submitted: true,
        submission_date: dateStr,
      };
      submissionToSync = newSub;
      return [...prev, newSub];
    });
    if (submissionToSync) {
      syncWeeklySubmissionToCloud(submissionToSync);
    }
    const expertName = users.find(u => u.id === expertId)?.full_name || expertId;
    addAuditLog('SOUMISSION_PLANNING_HEBDO', 'PLANNING_HEBDO', `Semaine ${weekNumber} - ${expertName}`);
  };

  const toggleWeeklySubmission = (expertId: string, weekNumber: number) => {
    const now = new Date();
    const dateStr = `${now.toISOString().substring(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let submissionToSync: WeeklySubmission | null = null;
    setWeeklySubmissions(prev => {
      const idx = prev.findIndex(s => s.expert_id === expertId && s.week_number === weekNumber);
      if (idx >= 0) {
        const copy = [...prev];
        const newStatus = !copy[idx].is_submitted;
        copy[idx] = {
          ...copy[idx],
          is_submitted: newStatus,
          submission_date: newStatus ? dateStr : undefined,
        };
        submissionToSync = copy[idx];
        return copy;
      }
      const newSub: WeeklySubmission = {
        id: `sub-w${weekNumber}-${expertId}`,
        expert_id: expertId,
        week_number: weekNumber,
        is_submitted: true,
        submission_date: dateStr,
      };
      submissionToSync = newSub;
      return [...prev, newSub];
    });
    if (submissionToSync) {
      syncWeeklySubmissionToCloud(submissionToSync);
    }
  };

  // --- TIMESHEETS MENSUELS ---
  const createOrUpdateTimesheet = (ts: MonthlyTimesheet) => {
    setTimesheets(prev => {
      const exists = prev.some(t => t.id === ts.id);
      if (exists) {
        return prev.map(t => t.id === ts.id ? ts : t);
      }
      return [ts, ...prev];
    });
    addAuditLog('EDITION_TIMESHEET', 'TIMESHEETS', `${ts.month_name} - ${ts.expert_id}`);
    syncTimesheetToCloud(ts);
  };

  const submitTimesheet = (id: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, status: 'SOUMIS' as const, submission_date: today };
        syncTimesheetToCloud(updated);
        return updated;
      }
      return t;
    }));
    addAuditLog('SOUMISSION_TIMESHEET', 'TIMESHEETS', id);
  };

  const verifyTimesheet = (id: string, verifierName: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        const updated = {
          ...t,
          status: 'VERIFIE_SE' as const,
          verified_by: verifierName,
          verification_date: today,
          rejection_reason: undefined,
        };
        syncTimesheetToCloud(updated);
        return updated;
      }
      return t;
    }));
    addAuditLog('VISA_SE_TIMESHEET', 'TIMESHEETS', id);
  };

  const validateTimesheet = (id: string, validatorName: string) => {
    const today = new Date().toISOString().substring(0, 10);
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        const updated = {
          ...t,
          status: 'VALIDE_DIRECTION' as const,
          validated_by: validatorName,
          validation_date: today,
          rejection_reason: undefined,
        };
        syncTimesheetToCloud(updated);
        return updated;
      }
      return t;
    }));
    addAuditLog('VALIDATION_DIRECTION_TIMESHEET', 'TIMESHEETS', id);
  };

  const rejectTimesheet = (id: string, reason: string) => {
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        const updated = {
          ...t,
          status: 'REJETE' as const,
          rejection_reason: reason,
        };
        syncTimesheetToCloud(updated);
        return updated;
      }
      return t;
    }));
    addAuditLog('REJET_TIMESHEET', 'TIMESHEETS', `${id} (Raison: ${reason})`);
  };

  const updateProjectRisk = (risk: ProjectRisk) => {
    setProjectRisks(prev => prev.map(r => r.id === risk.id ? risk : r));
    addAuditLog('MISE_A_JOUR_RISQUE', 'WORK_PLAN', `${risk.code} - ${risk.status}`);
  };

  const updateB09Metric = (updated: B09MonthlyMetric) => {
    // Recalculate promptitude
    const rate = updated.expected_reports > 0 
      ? Number(((updated.submitted_on_time / updated.expected_reports) * 100).toFixed(1))
      : 0;
    const itemWithRecalc: B09MonthlyMetric = {
      ...updated,
      promptitude_rate: rate,
      target_met: rate >= 70,
    };
    setB09Metrics(prev => prev.map(m => m.id === updated.id ? itemWithRecalc : m));
    addAuditLog('SAISIE_PROMPTITUDE', 'B09_ESIGL', `${updated.department} - ${updated.zone_name}`);
  };

  const updateB13Item = (updated: B13Item) => {
    setB13Items(prev => prev.map(i => i.id === updated.id ? updated : i));
    addAuditLog('MISE_A_JOUR_B13', 'B13_QUANTIFICATION', updated.title);
  };

  const updateMissionStatus = (id: string, status: MissionStatus) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    addAuditLog(`STATUT_MISSION_${status}`, 'MISSIONS', id);
  };

  const addMission = (newMis: FieldMission) => {
    setMissions(prev => [newMis, ...prev]);
    addAuditLog('NOUVELLE_MISSION', 'MISSIONS', newMis.title);
  };

  const updateDeliverableStatus = (id: string, status: DeliverableStatus, comments?: string) => {
    setDeliverables(prev => prev.map(d => {
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
    }));
    addAuditLog(`WORKFLOW_LIVRABLE_${status}`, 'LIVRABLES', id);
  };

  const addDocument = (doc: DocumentItem) => {
    setDocuments(prev => [doc, ...prev]);
    addAuditLog('DEPOT_DOCUMENT', 'DOCUMENTATION', doc.file_name);
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('saniplaner_user_id', user.id);
    }
  };

  const login = (usernameInput: string, passwordInput: string) => {
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();
    const found = users.find(u => 
      (u.username && u.username.toLowerCase() === cleanUser) ||
      u.email.toLowerCase() === cleanUser
    );

    if (!found) {
      return { success: false, message: 'Identifiant introuvable. Exemple : aimorou pour Arafath IMOROU.' };
    }

    if (found.password && found.password !== cleanPass) {
      return { success: false, message: 'Mot de passe incorrect.' };
    }

    handleSetCurrentUser(found);
    return { success: true };
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('saniplaner_user_id');
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser: handleSetCurrentUser,
      login,
      logout,
      users,
      activities,
      updateActivity,
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
      b13Items,
      updateB13Item,
      missions,
      updateMissionStatus,
      addMission,
      trainings,
      deliverables,
      updateDeliverableStatus,
      documents,
      addDocument,
      auditLogs,
      addAuditLog
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
