'use client';

import React, { createContext, useContext, useState } from 'react';
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
  MissionStatus
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
  MOCK_AUDIT_LOGS 
} from '@/lib/mock-data';

interface AppContextType {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  users: UserProfile[];
  activities: WorkPlanActivity[];
  updateActivity: (activity: WorkPlanActivity) => void;
  addActivity: (activity: WorkPlanActivity) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USERS[0]); // Direction by default
  const [users] = useState<UserProfile[]>(MOCK_USERS);
  const [activities, setActivities] = useState<WorkPlanActivity[]>(MOCK_WORK_PLAN);
  const [b09Metrics, setB09Metrics] = useState<B09MonthlyMetric[]>(MOCK_B09_METRICS);
  const [b13Items, setB13Items] = useState<B13Item[]>(MOCK_B13_ITEMS);
  const [missions, setMissions] = useState<FieldMission[]>(MOCK_FIELD_MISSIONS);
  const [trainings, setTrainings] = useState<Training[]>(MOCK_TRAININGS);
  const [deliverables, setDeliverables] = useState<Deliverable[]>(MOCK_DELIVERABLES);
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);

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
  };

  const updateActivity = (updated: WorkPlanActivity) => {
    setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
    addAuditLog('MISE_A_JOUR_ACTIVITE', 'WORK_PLAN', updated.code);
  };

  const addActivity = (newAct: WorkPlanActivity) => {
    setActivities(prev => [newAct, ...prev]);
    addAuditLog('CREATION_ACTIVITE', 'WORK_PLAN', newAct.code);
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

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      users,
      activities,
      updateActivity,
      addActivity,
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
