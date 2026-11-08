'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { FieldMission, MissionStatus, MissionIOVItem, MissionRecommendation } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DEPARTMENTS = ['Atacora', 'Donga', 'Mono', 'Plateau', 'Alibori', 'National'] as const;

export default function MissionsPage() {
  const { missions, addMission, updateMission, updateMissionStatus, deleteMission, users, currentUser } = useApp();

  // Active sub-module / sub-menu : 'planification' vs 'rapports'
  const [activeSubTab, setActiveSubTab] = useState<'planification' | 'rapports'>('planification');

  // Filters state
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedExpert, setSelectedExpert] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Report sub-module specific filter: 'MY_MISSIONS' vs 'ALL_MISSIONS'
  const [reportMissionScope, setReportMissionScope] = useState<'MY_MISSIONS' | 'ALL_MISSIONS'>('MY_MISSIONS');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('ALL');

  // Active selected mission IDs for modals
  const [viewingReportMissionId, setViewingReportMissionId] = useState<string | null>(null);
  const [viewingPlanMissionId, setViewingPlanMissionId] = useState<string | null>(null);

  // Modals state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<FieldMission | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingReportMissionId, setEditingReportMissionId] = useState<string | null>(null);

  const [iovModalOpen, setIovModalOpen] = useState(false);
  const [targetIovMissionId, setTargetIovMissionId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<MissionIOVItem | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    mission: FieldMission | null;
    context: 'PLAN' | 'REPORT';
  }>({
    open: false,
    mission: null,
    context: 'PLAN',
  });

  // Planning Form State
  const [planForm, setPlanForm] = useState<Partial<FieldMission>>({
    code: '',
    title: '',
    department: 'Atacora',
    zone_sanitaire: 'Natitingou-Boukoumbé-Toucountouna (NBT)',
    lead_expert_id: currentUser.id,
    companion_expert_ids: [],
    external_participants: [],
    departure_date: new Date().toISOString().substring(0, 10),
    return_date: new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10),
    objectives: '',
    visited_facilities: ['Hôpital de Zone', 'Centre de Santé'],
    expected_results: '',
    status: 'PLANIFIE' as any,
  });

  const [facilityInput, setFacilityInput] = useState('');
  const [planExternalInput, setPlanExternalInput] = useState('');

  const handleToggleCompanion = (userId: string) => {
    setPlanForm(prev => {
      const current = prev.companion_expert_ids || [];
      const updated = current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId];
      return { ...prev, companion_expert_ids: updated };
    });
  };

  const handleAddPlanExternal = () => {
    if (!planExternalInput.trim()) return;
    setPlanForm(prev => {
      const current = prev.external_participants || [];
      if (current.includes(planExternalInput.trim())) return prev;
      return { ...prev, external_participants: [...current, planExternalInput.trim()] };
    });
    setPlanExternalInput('');
  };

  const handleRemovePlanExternal = (index: number) => {
    setPlanForm(prev => ({
      ...prev,
      external_participants: (prev.external_participants || []).filter((_, i) => i !== index)
    }));
  };

  // Report Form State
  const [reportForm, setReportForm] = useState<{
    mission_report_summary: string;
    methodology: string;
    key_findings: string;
    difficulties_encountered: string;
    next_steps: string;
    report_status: 'NON_REMPLI' | 'BROUILLON' | 'SOUMIS' | 'VALIDE';
    progress_pct: number;
    recommendations: MissionRecommendation[];
  }>({
    mission_report_summary: '',
    methodology: '',
    key_findings: '',
    difficulties_encountered: '',
    next_steps: '',
    report_status: 'BROUILLON',
    progress_pct: 100,
    recommendations: [],
  });

  // IOV Form State
  const [iovForm, setIovForm] = useState<Partial<MissionIOVItem>>({
    type: 'DOCUMENT',
    category: 'ORDRE_MISSION',
    title: '',
    description: '',
    file_name: '',
    file_size_kb: 450,
  });

  const [newRecText, setNewRecText] = useState('');
  const [newRecEntity, setNewRecEntity] = useState('');
  const [newRecDeadline, setNewRecDeadline] = useState('');

  // Deriving active viewing mission for Report View Modal
  const viewingReportMission = useMemo(() => {
    if (!viewingReportMissionId) return null;
    return missions.find(m => m.id === viewingReportMissionId) || null;
  }, [missions, viewingReportMissionId]);

  // Deriving active viewing mission for Plan View Modal
  const viewingPlanMission = useMemo(() => {
    if (!viewingPlanMissionId) return null;
    return missions.find(m => m.id === viewingPlanMissionId) || null;
  }, [missions, viewingPlanMissionId]);

  // Check if current user can edit a mission report
  const canEditMissionReport = (m: FieldMission | null) => {
    if (!m) return false;
    if (currentUser.role === 'direction') return true;
    return m.lead_expert_id === currentUser.id || m.author_id === currentUser.id;
  };

  // Filtered missions for Tab 1 (Planification)
  const filteredPlannedMissions = useMemo(() => {
    return missions.filter(m => {
      const matchDept = selectedDept === 'ALL' || m.department === selectedDept;
      const matchStatus = selectedStatus === 'ALL' || m.status === selectedStatus;
      const matchExpert = selectedExpert === 'ALL' || m.lead_expert_id === selectedExpert || m.companion_expert_ids.includes(selectedExpert);
      const matchSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.zone_sanitaire.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchDept && matchStatus && matchExpert && matchSearch;
    });
  }, [missions, selectedDept, selectedStatus, selectedExpert, searchQuery]);

  // Filtered missions for Tab 2 (Rapports de mission)
  const filteredReportMissions = useMemo(() => {
    return missions.filter(m => {
      const isMine = m.lead_expert_id === currentUser.id || m.author_id === currentUser.id;
      if (reportMissionScope === 'MY_MISSIONS' && !isMine && currentUser.role !== 'direction') {
        return false;
      }

      if (reportStatusFilter !== 'ALL') {
        const currentReportStatus = m.report_status || 'NON_REMPLI';
        if (currentReportStatus !== reportStatusFilter) return false;
      }

      const matchDept = selectedDept === 'ALL' || m.department === selectedDept;
      const matchSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.zone_sanitaire.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchDept && matchSearch;
    });
  }, [missions, currentUser, reportMissionScope, reportStatusFilter, selectedDept, searchQuery]);

  // Stats
  const totalMissionsCount = missions.length;
  const completedMissionsCount = missions.filter(m => m.status === 'REALISEE' || m.status === 'CLOTUREE').length;
  const inProgressMissionsCount = missions.filter(m => m.status === 'EN_COURS' || m.status === 'VALIDEE').length;
  const reportsSubmittedCount = missions.filter(m => m.report_status === 'SOUMIS' || m.report_status === 'VALIDE').length;

  // ----------------------------------------------------
  // PLAN MISSION HANDLERS
  // ----------------------------------------------------
  const handleOpenCreatePlan = () => {
    setEditingMission(null);
    setPlanExternalInput('');
    setPlanForm({
      code: `MIS-2026-${String(missions.length + 1).padStart(3, '0')}`,
      title: '',
      department: 'Atacora',
      zone_sanitaire: '',
      lead_expert_id: currentUser.id,
      companion_expert_ids: [],
      external_participants: [],
      departure_date: new Date().toISOString().substring(0, 10),
      return_date: new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10),
      objectives: '',
      visited_facilities: [],
      expected_results: '',
      status: 'VALIDEE',
    });
    setPlanModalOpen(true);
  };

  const handleOpenEditPlan = (m: FieldMission) => {
    setEditingMission(m);
    setPlanExternalInput('');
    setPlanForm({
      code: m.code || '',
      title: m.title,
      department: m.department,
      zone_sanitaire: m.zone_sanitaire,
      lead_expert_id: m.lead_expert_id,
      companion_expert_ids: m.companion_expert_ids || [],
      external_participants: m.external_participants || [],
      departure_date: m.departure_date,
      return_date: m.return_date,
      objectives: m.objectives,
      visited_facilities: [...m.visited_facilities],
      expected_results: m.expected_results,
      status: m.status,
    });
    setPlanModalOpen(true);
  };

  const handleAddFacility = () => {
    if (!facilityInput.trim()) return;
    setPlanForm(prev => ({
      ...prev,
      visited_facilities: [...(prev.visited_facilities || []), facilityInput.trim()]
    }));
    setFacilityInput('');
  };

  const handleRemoveFacility = (index: number) => {
    setPlanForm(prev => ({
      ...prev,
      visited_facilities: (prev.visited_facilities || []).filter((_, i) => i !== index)
    }));
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.title || !planForm.objectives) return;

    if (editingMission) {
      const updated: FieldMission = {
        ...editingMission,
        code: planForm.code || editingMission.code,
        title: planForm.title,
        department: planForm.department || editingMission.department,
        zone_sanitaire: planForm.zone_sanitaire || editingMission.zone_sanitaire,
        lead_expert_id: planForm.lead_expert_id || editingMission.lead_expert_id,
        companion_expert_ids: planForm.companion_expert_ids || editingMission.companion_expert_ids,
        external_participants: planForm.external_participants || editingMission.external_participants,
        departure_date: planForm.departure_date || editingMission.departure_date,
        return_date: planForm.return_date || editingMission.return_date,
        objectives: planForm.objectives,
        visited_facilities: planForm.visited_facilities || editingMission.visited_facilities,
        expected_results: planForm.expected_results || editingMission.expected_results,
        status: (planForm.status as MissionStatus) || editingMission.status,
      };
      updateMission(updated);
    } else {
      const newMis: FieldMission = {
        id: `mis-${Date.now()}`,
        code: planForm.code || `MIS-2026-${String(missions.length + 1).padStart(3, '0')}`,
        title: planForm.title,
        author_id: currentUser.id,
        lead_expert_id: currentUser.id,
        companion_expert_ids: planForm.companion_expert_ids || [],
        external_participants: planForm.external_participants || [],
        department: planForm.department || 'Atacora',
        zone_sanitaire: planForm.zone_sanitaire || '',
        departure_date: planForm.departure_date || new Date().toISOString().substring(0, 10),
        return_date: planForm.return_date || new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10),
        objectives: planForm.objectives,
        visited_facilities: planForm.visited_facilities || [],
        expected_results: planForm.expected_results || '',
        status: (planForm.status as MissionStatus) || 'VALIDEE',
        report_status: 'NON_REMPLI',
        recommendations: [],
        iov_items: [],
        photos_count: 0,
      };
      addMission(newMis);
    }

    setPlanModalOpen(false);
  };

  // ----------------------------------------------------
  // REPORT HANDLERS
  // ----------------------------------------------------
  const handleOpenEditReport = (m: FieldMission) => {
    setEditingReportMissionId(m.id);
    setReportForm({
      mission_report_summary: m.mission_report_summary || '',
      methodology: m.methodology || '',
      key_findings: m.key_findings || '',
      difficulties_encountered: m.difficulties_encountered || '',
      next_steps: m.next_steps || '',
      report_status: m.report_status || 'BROUILLON',
      progress_pct: m.progress_pct !== undefined ? m.progress_pct : 100,
      recommendations: m.recommendations ? [...m.recommendations] : [],
    });
    setNewRecText('');
    setNewRecEntity('');
    setNewRecDeadline('');
    setReportModalOpen(true);
  };

  const handleAddRecommendation = () => {
    if (!newRecText.trim()) return;
    const newRec: MissionRecommendation = {
      id: `rec-${Date.now()}`,
      text: newRecText.trim(),
      target_entity: newRecEntity.trim() || 'Zone Sanitaire / DDS',
      deadline: newRecDeadline || '2026-12-15',
      status: 'OUVERTE',
    };
    setReportForm(prev => ({
      ...prev,
      recommendations: [...prev.recommendations, newRec]
    }));
    setNewRecText('');
    setNewRecEntity('');
    setNewRecDeadline('');
  };

  const handleRemoveRecommendation = (recId: string) => {
    setReportForm(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter(r => r.id !== recId)
    }));
  };

  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    const activeTarget = missions.find(m => m.id === editingReportMissionId);
    if (!activeTarget) return;

    const updated: FieldMission = {
      ...activeTarget,
      mission_report_summary: reportForm.mission_report_summary,
      methodology: reportForm.methodology,
      key_findings: reportForm.key_findings,
      difficulties_encountered: reportForm.difficulties_encountered,
      next_steps: reportForm.next_steps,
      report_status: reportForm.report_status,
      report_author_id: currentUser.id,
      report_author_name: currentUser.full_name,
      report_date: new Date().toISOString().substring(0, 10),
      progress_pct: reportForm.progress_pct,
      recommendations: reportForm.recommendations,
      status: reportForm.report_status === 'VALIDE' ? 'CLOTUREE' : reportForm.report_status === 'SOUMIS' ? 'REALISEE' : activeTarget.status,
    };

    updateMission(updated);
    setReportModalOpen(false);
  };

  // ----------------------------------------------------
  // IOV (DOCUMENTS & PHOTOS) HANDLERS
  // ----------------------------------------------------
  const handleOpenAddIOV = (missionId: string, defaultType: 'DOCUMENT' | 'PHOTO' = 'DOCUMENT') => {
    setTargetIovMissionId(missionId);
    setIovForm({
      type: defaultType,
      category: defaultType === 'PHOTO' ? 'PHOTO_TERRAIN' : 'ORDRE_MISSION',
      title: '',
      description: '',
      file_name: '',
      file_size_kb: defaultType === 'PHOTO' ? 1200 : 450,
      data_url: undefined,
    });
    setIovModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setIovForm(prev => ({
        ...prev,
        file_name: file.name,
        file_size_kb: Math.round(file.size / 1024),
        data_url: reader.result as string,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveIOV = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMission = missions.find(m => m.id === targetIovMissionId);
    if (!targetMission || !iovForm.title) return;

    const newItem: MissionIOVItem = {
      id: `iov-${Date.now()}`,
      type: iovForm.type || 'DOCUMENT',
      category: iovForm.category || 'ORDRE_MISSION',
      title: iovForm.title,
      description: iovForm.description,
      file_name: iovForm.file_name || (iovForm.type === 'PHOTO' ? `photo_${Date.now()}.jpg` : `document_${Date.now()}.pdf`),
      file_size_kb: iovForm.file_size_kb || (iovForm.type === 'PHOTO' ? 950 : 320),
      uploaded_at: new Date().toISOString().substring(0, 10),
      uploaded_by: currentUser.full_name,
      data_url: iovForm.data_url,
    };

    const currentIovs = targetMission.iov_items || [];
    const updatedIovs = [newItem, ...currentIovs];
    const newPhotosCount = updatedIovs.filter(i => i.type === 'PHOTO').length;

    const updated: FieldMission = {
      ...targetMission,
      iov_items: updatedIovs,
      photos_count: newPhotosCount,
    };

    updateMission(updated);
    setIovModalOpen(false);
  };

  const handleDeleteIOV = (missionId: string, iovId: string) => {
    const targetMission = missions.find(m => m.id === missionId);
    if (!targetMission) return;

    if (!confirm('Voulez-vous vraiment supprimer cette pièce justificative (IOV) ?')) return;

    const currentIovs = targetMission.iov_items || [];
    const updatedIovs = currentIovs.filter(i => i.id !== iovId);
    const newPhotosCount = updatedIovs.filter(i => i.type === 'PHOTO').length;

    updateMission({
      ...targetMission,
      iov_items: updatedIovs,
      photos_count: newPhotosCount,
    });
  };

  // ----------------------------------------------------
  // DELETE HANDLERS
  // ----------------------------------------------------
  const handleOpenDeleteModal = (m: FieldMission, context: 'PLAN' | 'REPORT') => {
    setDeleteModal({
      open: true,
      mission: m,
      context,
    });
  };

  const handleConfirmDeleteMission = () => {
    if (!deleteModal.mission) return;
    deleteMission(deleteModal.mission.id);
    if (viewingPlanMissionId === deleteModal.mission.id) setViewingPlanMissionId(null);
    if (viewingReportMissionId === deleteModal.mission.id) setViewingReportMissionId(null);
    setDeleteModal({ open: false, mission: null, context: 'PLAN' });
  };

  const handleResetReportOnly = () => {
    if (!deleteModal.mission) return;
    const updated: FieldMission = {
      ...deleteModal.mission,
      report_status: 'NON_REMPLI',
      mission_report_summary: undefined,
      methodology: undefined,
      key_findings: undefined,
      difficulties_encountered: undefined,
      next_steps: undefined,
      report_author_id: undefined,
      report_author_name: undefined,
      report_date: undefined,
      progress_pct: 0,
      recommendations: [],
      iov_items: [],
      photos_count: 0,
      status: 'VALIDEE',
    };
    updateMission(updated);
    setDeleteModal({ open: false, mission: null, context: 'PLAN' });
  };

  // ----------------------------------------------------
  // OFFICIAL A4 PDF GENERATION
  // ----------------------------------------------------
  const handleDownloadFullReportPdf = (m: FieldMission) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const lead = users.find(u => u.id === m.lead_expert_id);
    const companions = (m.companion_expert_ids || []).map(id => users.find(u => u.id === id)?.full_name).filter(Boolean);

    // Header Institutional Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 28, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RÉPUBLIQUE DU BÉNIN | MINISTÈRE DE LA SANTÉ', 14, 8);
    doc.text('PROJET AFGHS / PSI BÉNIN & SANINOVA EXPERTISE', 14, 13);

    doc.setFontSize(13);
    doc.text('RAPPORT OFFICIEL DE MISSION DE TERRAIN & PREUVES IOV', 14, 22);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Réf: ${m.code || m.id} | Émis le ${new Date().toLocaleDateString('fr-FR')}`, 145, 22);

    let currentY = 36;

    // Mission Identification Grid
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, 182, 38, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('INTITULÉ DE LA MISSION :', 18, currentY + 7);
    doc.setFont('helvetica', 'normal');
    const titleLines = doc.splitTextToSize(m.title, 130);
    doc.text(titleLines, 62, currentY + 7);

    const offY = currentY + 7 + Math.max(1, titleLines.length) * 4;

    doc.setFont('helvetica', 'bold');
    doc.text('DÉPARTEMENT / ZONE :', 18, offY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${m.department}  —  ${m.zone_sanitaire}`, 62, offY);

    doc.setFont('helvetica', 'bold');
    doc.text('PÉRIODE D’EXÉCUTION :', 18, offY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Du ${m.departure_date} au ${m.return_date}`, 62, offY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('ÉQUIPE DE MISSION :', 18, offY + 12);
    doc.setFont('helvetica', 'normal');
    const teamStr = `Lead : ${lead?.full_name || 'Non assigné'}${companions.length > 0 ? ' | Accompagnateur(s) : ' + companions.join(', ') : ''}`;
    doc.text(doc.splitTextToSize(teamStr, 130), 62, offY + 12);

    currentY += 46;

    // Section 1: Objectifs
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text('1. OBJECTIFS DE LA MISSION & RÉSULTATS ATTENDUS', 14, currentY);
    currentY += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const splitObj = doc.splitTextToSize(m.objectives || 'Non précisé', 182);
    doc.text(splitObj, 14, currentY + 3);
    currentY += splitObj.length * 4 + 6;

    // Section 2: Synthèse du rapport
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text('2. SYNTHÈSE EXÉCUTIVE DU RAPPORT', 14, currentY);
    currentY += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const splitSummary = doc.splitTextToSize(m.mission_report_summary || 'Rapport en cours de rédaction.', 182);
    doc.text(splitSummary, 14, currentY + 3);
    currentY += splitSummary.length * 4 + 6;

    // Section 3: Méthodologie & Constats
    if (m.key_findings || m.methodology) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136);
      doc.text('3. CONSTATS CLÉS & ACTIVITÉS RÉALISÉES', 14, currentY);
      currentY += 4;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const splitFindings = doc.splitTextToSize(m.key_findings || m.methodology || '-', 182);
      doc.text(splitFindings, 14, currentY + 3);
      currentY += splitFindings.length * 4 + 6;
    }

    // Section 4: Recommandations Table
    if (m.recommendations && m.recommendations.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136);
      doc.text('4. PLAN DE SUIVI DES RECOMMANDATIONS', 14, currentY);
      currentY += 2;

      autoTable(doc, {
        startY: currentY + 2,
        head: [['Recommandation Opérationnelle', 'Entité Responsable', 'Échéance', 'Statut']],
        body: m.recommendations.map(r => [r.text, r.target_entity, r.deadline || '-', r.status]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Section 5: IOV Table (Documents & Photos)
    const iovs = m.iov_items || [];
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text(`5. INVENTAIRE DES IOV (PREUVES & DOCUMENTS ASSOCIÉS) [${iovs.length}]`, 14, currentY);
    currentY += 2;

    if (iovs.length > 0) {
      autoTable(doc, {
        startY: currentY + 2,
        head: [['Type', 'Titre de la Pièce / Preuve', 'Fichier Original', 'Déposé Par', 'Date']],
        body: iovs.map(i => [i.type, i.title, i.file_name, i.uploaded_by, i.uploaded_at]),
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    } else {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Aucune pièce justificative (IOV) attachée pour l’instant.', 14, currentY + 5);
      currentY += 12;
    }

    // Signatures footer block
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(14, currentY, 196, currentY);
    currentY += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Visa du Rédacteur de Mission', 30, currentY);
    doc.text('Approbation de la Direction du Projet', 130, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${m.report_author_name || lead?.full_name || 'Lead Expert'}`, 30, currentY + 6);
    doc.text('Direction SaniNova / PSI Bénin', 130, currentY + 6);

    doc.save(`Rapport_Mission_${m.code || m.id}_${m.department}.pdf`);
  };

  return (
    <ModuleGuard moduleId="missions">
      <div className="space-y-6 font-sans">
        {/* Top Banner & Sub-module Nav */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wide">
                Module 08 : Missions & Terrain
              </span>
              <span className="text-xs text-slate-500 font-medium">AFGHS-PSI Bénin</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
              Missions de Terrain & Rapports d’Exécution
            </h1>
            <p className="text-xs text-slate-500">
              Planification des ordres de mission, rédaction des comptes-rendus de terrain et archivage des IOV (Documents & Photos).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const data = missions.map(m => ({
                  Code: m.code || m.id,
                  Titre: m.title,
                  Lead: users.find(u => u.id === m.lead_expert_id)?.full_name || '',
                  Département: m.department,
                  Zone: m.zone_sanitaire,
                  Départ: m.departure_date,
                  Retour: m.return_date,
                  Statut: m.status,
                  'Statut Rapport': m.report_status || 'NON_REMPLI',
                  'Nombre IOV': (m.iov_items || []).length,
                }));
                exportToExcel(data, 'SANINOVA_Missions_Terrain_Consolide');
              }}
              className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold transition"
            >
              Export Excel
            </button>

            <button
              onClick={handleOpenCreatePlan}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition flex items-center space-x-1"
            >
              <span className="font-bold">+</span>
              <span>Planifier une Mission</span>
            </button>
          </div>
        </div>

        {/* SUB-MODULE TABS (Planification vs Rapports de Mission) */}
        <div className="border-b border-slate-200 flex space-x-4 sm:space-x-8 overflow-x-auto no-scrollbar whitespace-nowrap bg-white px-5 pt-3 rounded-lg border shadow-xs">
          <button
            onClick={() => setActiveSubTab('planification')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center space-x-2 ${
              activeSubTab === 'planification'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>1. Planification des Missions</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
              {missions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('rapports')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center space-x-2 ${
              activeSubTab === 'rapports'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>2. Rapports de Mission & IOV (Preuves & Photos)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
              reportsSubmittedCount > 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600'
            }`}>
              {reportsSubmittedCount}/{missions.length} Déposés
            </span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* SUB-MODULE 1 : PLANIFICATION DES MISSIONS */}
        {/* ==================================================== */}
        {activeSubTab === 'planification' && (
          <div className="space-y-6">
            {/* KPI Cards Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missions Planifiées</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-2xl font-bold text-slate-900">{totalMissionsCount}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Total Hub
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Atacora, Donga, Mono, Plateau, Alibori</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validées / En cours</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-2xl font-bold text-blue-700">{inProgressMissionsCount}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                    Sur le terrain
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Ordres de mission visés</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missions Exécutées</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-2xl font-bold text-emerald-700">{completedMissionsCount}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Réalisées
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Données de terrain collectées</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rapports & IOV Reçus</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-2xl font-bold text-teal-800">{reportsSubmittedCount}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                    Audit Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Avec preuves justificatives</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Rechercher code, titre, zone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none focus:border-teal-700 w-60"
                />

                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none font-medium text-slate-700"
                >
                  <option value="ALL">Tous les départements</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none font-medium text-slate-700"
                >
                  <option value="ALL">Tous les statuts de mission</option>
                  <option value="PLANIFIE">Planifiée</option>
                  <option value="VALIDEE">Validée</option>
                  <option value="EN_COURS">En cours sur le terrain</option>
                  <option value="REALISEE">Réalisée</option>
                  <option value="CLOTUREE">Clôturée</option>
                </select>

                <select
                  value={selectedExpert}
                  onChange={(e) => setSelectedExpert(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none font-medium text-slate-700"
                >
                  <option value="ALL">Tous les experts</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Missions List for Planification (Table View with Voir, Modifier, Supprimer) */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-700">
                  Liste des Missions Planifiées ({filteredPlannedMissions.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Cliquez sur &laquo; Voir &raquo; pour consulter la fiche complète
                </span>
              </div>

              {filteredPlannedMissions.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 space-y-3">
                  <p>Aucune mission ne correspond à vos filtres actuels.</p>
                  <button
                    onClick={handleOpenCreatePlan}
                    className="px-4 py-2 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 transition"
                  >
                    + Planifier la première mission
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Code / Réf</th>
                        <th className="py-3 px-4">Mission & Territoire</th>
                        <th className="py-3 px-4">Responsable (Lead)</th>
                        <th className="py-3 px-4">Période</th>
                        <th className="py-3 px-4">Structures cibles</th>
                        <th className="py-3 px-4">Statut Mission</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPlannedMissions.map((m) => {
                        const lead = users.find(u => u.id === m.lead_expert_id);
                        const isMine = m.lead_expert_id === currentUser.id || m.author_id === currentUser.id;

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition group">
                            {/* Code */}
                            <td className="py-3 px-4 font-mono font-bold text-teal-900">
                              <span className="bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {m.code || 'MIS'}
                              </span>
                            </td>

                            {/* Title & Dept */}
                            <td className="py-3 px-4 max-w-xs">
                              <div className="font-bold text-slate-900 group-hover:text-teal-900 transition line-clamp-1">
                                {m.title}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1.5">
                                <span className="font-semibold text-slate-700">{m.department}</span>
                                <span>&bull;</span>
                                <span className="truncate">{m.zone_sanitaire}</span>
                              </div>
                            </td>

                            {/* Lead */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{lead?.full_name || 'Non assigné'}</div>
                              {isMine && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Ma mission
                                </span>
                              )}
                            </td>

                            {/* Dates */}
                            <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-600 font-mono">
                              <div>{m.departure_date}</div>
                              <div className="text-[10px] text-slate-400">au {m.return_date}</div>
                            </td>

                            {/* Visited facilities */}
                            <td className="py-3 px-4 text-[11px] text-slate-600">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                                {m.visited_facilities.length} structure(s)
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                m.status === 'CLOTUREE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                m.status === 'REALISEE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                m.status === 'EN_COURS' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                m.status === 'VALIDEE' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {m.status.replace('_', ' ')}
                              </span>
                            </td>

                            {/* Action Buttons: Voir, Modifier, Supprimer */}
                            <td className="py-3 px-4 whitespace-nowrap text-center">
                              <div className="inline-flex items-center space-x-1.5">
                                {/* Bouton VOIR */}
                                <button
                                  onClick={() => setViewingPlanMissionId(m.id)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                                  title="Consulter tous les détails de la mission"
                                >
                                  <span>Voir</span>
                                </button>

                                {/* Bouton MODIFIER */}
                                <button
                                  onClick={() => handleOpenEditPlan(m)}
                                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center space-x-1"
                                  title="Modifier la planification"
                                >
                                  <span>Modifier</span>
                                </button>

                                {/* Bouton SUPPRIMER */}
                                <button
                                  onClick={() => handleOpenDeleteModal(m, 'PLAN')}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition flex items-center space-x-1"
                                  title="Supprimer la mission"
                                >
                                  <span>Supprimer</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SUB-MODULE 2 : RAPPORTS DE MISSION & GESTION DES IOV */}
        {/* ==================================================== */}
        {activeSubTab === 'rapports' && (
          <div className="space-y-6">
            {/* Header Scope & Banner */}
            <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                  Espace Rapports & Preuves de Vérification
                </span>
                <h2 className="text-base font-bold text-white mt-0.5">
                  Rapports de Missions de Terrain & IOV (Documents & Photos)
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Consultez la liste des rapports, accédez au compte-rendu avec le bouton <strong>« Voir »</strong>, modifiez avec <strong>« Modifier »</strong>, ou gérez les IOV associées.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="bg-slate-800 p-1 rounded-lg flex items-center border border-slate-700">
                  <button
                    onClick={() => setReportMissionScope('MY_MISSIONS')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      reportMissionScope === 'MY_MISSIONS'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Mes Missions
                  </button>
                  <button
                    onClick={() => setReportMissionScope('ALL_MISSIONS')}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      reportMissionScope === 'ALL_MISSIONS'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Toutes les Missions
                  </button>
                </div>

                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="text-xs border border-slate-700 rounded px-2.5 py-2 bg-slate-800 text-slate-200 outline-none font-medium"
                >
                  <option value="ALL">Tous les statuts de rapport</option>
                  <option value="NON_REMPLI">Rapport à rédiger</option>
                  <option value="BROUILLON">Brouillon en cours</option>
                  <option value="SOUMIS">Soumis pour validation</option>
                  <option value="VALIDE">Validé Direction</option>
                </select>
              </div>
            </div>

            {/* Quick Search and Dept Filter for Reports */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Rechercher rapport par mot-clé, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none focus:border-teal-700 w-64"
                />

                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 outline-none font-medium text-slate-700"
                >
                  <option value="ALL">Tous les départements</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-slate-500 font-medium">
                {filteredReportMissions.length} rapport(s) affiché(s)
              </div>
            </div>

            {/* Table of Reports with Voir, Modifier, Supprimer */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-700">
                  Tableau Récapitulatif des Rapports & Preuves
                </span>
                <span className="text-[11px] text-slate-400">
                  Cliquez sur &laquo; Voir &raquo; pour consulter le contenu complet du rapport
                </span>
              </div>

              {filteredReportMissions.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                  <p>Aucun rapport ne correspond à vos critères de recherche.</p>
                  <button
                    onClick={() => {
                      setReportMissionScope('ALL_MISSIONS');
                      setReportStatusFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="text-teal-700 underline text-xs font-semibold"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Intitulé & Territoire</th>
                        <th className="py-3 px-4">Responsable (Lead)</th>
                        <th className="py-3 px-4">Période Terrain</th>
                        <th className="py-3 px-4">Statut Rapport</th>
                        <th className="py-3 px-4">IOV (Preuves)</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReportMissions.map((m) => {
                        const lead = users.find(u => u.id === m.lead_expert_id);
                        const isMine = m.lead_expert_id === currentUser.id || m.author_id === currentUser.id;
                        const iovs = m.iov_items || [];
                        const docsCount = iovs.filter(i => i.type === 'DOCUMENT').length;
                        const photosCount = iovs.filter(i => i.type === 'PHOTO').length;
                        const rStatus = m.report_status || 'NON_REMPLI';
                        const canEdit = canEditMissionReport(m);

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition group">
                            {/* Code */}
                            <td className="py-3 px-4 font-mono font-bold text-teal-900 whitespace-nowrap">
                              <span className="bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {m.code || 'MIS'}
                              </span>
                            </td>

                            {/* Title & Dept */}
                            <td className="py-3 px-4 max-w-sm">
                              <div className="font-bold text-slate-900 group-hover:text-teal-900 transition line-clamp-1">
                                {m.title}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1.5">
                                <span className="font-semibold text-slate-700">{m.department}</span>
                                <span>&bull;</span>
                                <span className="truncate">{m.zone_sanitaire}</span>
                              </div>
                            </td>

                            {/* Lead */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{lead?.full_name || 'Non assigné'}</div>
                              {isMine && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Ma mission
                                </span>
                              )}
                            </td>

                            {/* Dates */}
                            <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-600 font-mono">
                              <div>{m.departure_date}</div>
                              <div className="text-[10px] text-slate-400">au {m.return_date}</div>
                            </td>

                            {/* Statut du rapport */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded text-[10px] font-bold border inline-block ${
                                rStatus === 'VALIDE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                rStatus === 'SOUMIS' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                                rStatus === 'BROUILLON' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                'bg-amber-50 text-amber-900 border-amber-200'
                              }`}>
                                {rStatus === 'NON_REMPLI' ? 'À rédiger' :
                                 rStatus === 'BROUILLON' ? 'Brouillon en cours' :
                                 rStatus === 'SOUMIS' ? 'Soumis Direction' : 'Validé Direction'}
                              </span>
                            </td>

                            {/* Preuves / IOV count */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  {docsCount} doc(s)
                                </span>
                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  {photosCount} photo(s)
                                </span>
                              </div>
                            </td>

                            {/* Action Buttons: Voir, Modifier, Supprimer */}
                            <td className="py-3 px-4 whitespace-nowrap text-center">
                              <div className="inline-flex items-center space-x-1.5">
                                {/* Bouton VOIR */}
                                <button
                                  onClick={() => setViewingReportMissionId(m.id)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                                  title="Consulter le rapport complet et les IOV"
                                >
                                  <span>Voir</span>
                                </button>

                                {/* Bouton MODIFIER */}
                                <button
                                  onClick={() => handleOpenEditReport(m)}
                                  disabled={!canEdit}
                                  className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 border ${
                                    canEdit
                                      ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                      : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                  }`}
                                  title={canEdit ? 'Rédiger ou modifier le rapport' : 'Modification réservée au responsable ou à la direction'}
                                >
                                  <span>Modifier</span>
                                </button>

                                {/* Bouton SUPPRIMER */}
                                <button
                                  onClick={() => handleOpenDeleteModal(m, 'REPORT')}
                                  disabled={!canEdit}
                                  className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 border ${
                                    canEdit
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                      : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                  }`}
                                  title={canEdit ? 'Supprimer le rapport ou la mission' : 'Suppression réservée au responsable ou à la direction'}
                                >
                                  <span>Supprimer</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : VOIR LE RAPPORT DE MISSION & LES IOV */}
        {/* (C'EST QUAND ON FAIT VOIR QU'ON VOIT LE CONTENU) */}
        {/* ==================================================== */}
        {viewingReportMission && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              
              {/* Header Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded">
                      {viewingReportMission.code || 'MIS'}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">
                      {viewingReportMission.department} &bull; {viewingReportMission.zone_sanitaire}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      viewingReportMission.report_status === 'VALIDE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      viewingReportMission.report_status === 'SOUMIS' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' :
                      viewingReportMission.report_status === 'BROUILLON' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {viewingReportMission.report_status === 'NON_REMPLI' ? 'À rédiger' :
                       viewingReportMission.report_status === 'BROUILLON' ? 'Brouillon' :
                       viewingReportMission.report_status === 'SOUMIS' ? 'Soumis' : 'Validé'}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1 line-clamp-2">
                    {viewingReportMission.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mission exécutée du {viewingReportMission.departure_date} au {viewingReportMission.return_date} &bull; Responsable : {users.find(u => u.id === viewingReportMission.lead_expert_id)?.full_name || 'Non assigné'}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleDownloadFullReportPdf(viewingReportMission)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded text-xs font-bold transition flex items-center space-x-1"
                  >
                    <span>Télécharger PDF Certifié</span>
                  </button>

                  {canEditMissionReport(viewingReportMission) && (
                    <button
                      onClick={() => {
                        const m = viewingReportMission;
                        setViewingReportMissionId(null);
                        handleOpenEditReport(m);
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-bold transition"
                    >
                      Modifier
                    </button>
                  )}

                  <button
                    onClick={() => setViewingReportMissionId(null)}
                    className="text-slate-400 hover:text-white p-1 text-base font-bold rounded"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Body Content of Report Modal */}
              <div className="p-5 sm:p-6 space-y-6 text-xs overflow-y-auto">

                {/* Status Box */}
                <div className={`p-4 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  viewingReportMission.report_status === 'VALIDE' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                  viewingReportMission.report_status === 'SOUMIS' ? 'bg-indigo-50 border-indigo-300 text-indigo-900' :
                  viewingReportMission.report_status === 'BROUILLON' ? 'bg-blue-50 border-blue-300 text-blue-900' :
                  'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div>
                    <div className="font-bold uppercase tracking-wider text-[10px]">
                      État d’avancement & Validation du Rapport :
                    </div>
                    <div className="font-bold text-sm mt-0.5">
                      {viewingReportMission.report_status === 'VALIDE' ? 'Rapport Validé & Clôturé par la Direction' :
                       viewingReportMission.report_status === 'SOUMIS' ? 'Rapport Soumis pour Validation Direction' :
                       viewingReportMission.report_status === 'BROUILLON' ? 'Rapport en Cours de Rédaction (Brouillon)' :
                       'Rapport non encore rédigé pour cette mission'}
                    </div>
                    {viewingReportMission.report_date && (
                      <div className="text-[11px] opacity-80 mt-0.5">
                        Dernière mise à jour le {viewingReportMission.report_date} par {viewingReportMission.report_author_name || 'le responsable de mission'}.
                      </div>
                    )}
                  </div>

                  {canEditMissionReport(viewingReportMission) && (
                    <button
                      onClick={() => handleOpenAddIOV(viewingReportMission.id, 'DOCUMENT')}
                      className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shadow-xs whitespace-nowrap self-start sm:self-auto"
                    >
                      + Ajouter une Preuve (IOV)
                    </button>
                  )}
                </div>

                {/* Section 1 : Synthèse Exécutive */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                  <span className="font-bold uppercase text-[10px] text-teal-800 tracking-wide block">
                    1. Synthèse Exécutive de la Mission
                  </span>
                  <div className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                    {viewingReportMission.mission_report_summary || (
                      <span className="text-slate-400 italic">Aucune synthèse rédigée pour le moment. Cliquez sur &laquo; Modifier &raquo; pour compléter.</span>
                    )}
                  </div>
                </div>

                {/* Section 2 : Méthodologie & Approche Terrain */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                  <span className="font-bold uppercase text-[10px] text-teal-800 tracking-wide block">
                    2. Déroulement & Méthodologie Terrain
                  </span>
                  <div className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                    {viewingReportMission.methodology || (
                      <span className="text-slate-400 italic">Non renseignée.</span>
                    )}
                  </div>
                </div>

                {/* Section 3 : Constats Clés & Réalisations */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                  <span className="font-bold uppercase text-[10px] text-teal-800 tracking-wide block">
                    3. Constats Clés & Activités Réalisées
                  </span>
                  <div className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                    {viewingReportMission.key_findings || (
                      <span className="text-slate-400 italic">Non renseignés.</span>
                    )}
                  </div>
                </div>

                {/* Section 4 : Difficultés & Solutions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                    <span className="font-bold uppercase text-[10px] text-rose-800 tracking-wide block">
                      4. Difficultés & Goulots d’étranglement
                    </span>
                    <div className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                      {viewingReportMission.difficulties_encountered || (
                        <span className="text-slate-400 italic">Aucune difficulté majeure signalée.</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                    <span className="font-bold uppercase text-[10px] text-indigo-800 tracking-wide block">
                      5. Prochaines Étapes
                    </span>
                    <div className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                      {viewingReportMission.next_steps || (
                        <span className="text-slate-400 italic">Non renseignées.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 5 : Recommandations */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold uppercase text-[10px] text-teal-800 tracking-wide block">
                      6. Plan de Suivi des Recommandations ({viewingReportMission.recommendations?.length || 0})
                    </span>
                  </div>

                  {(!viewingReportMission.recommendations || viewingReportMission.recommendations.length === 0) ? (
                    <div className="text-slate-400 italic text-center py-4">
                      Aucune recommandation formulée dans ce rapport.
                    </div>
                  ) : (
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase">
                            <th className="py-2 px-3">Recommandation Opérationnelle</th>
                            <th className="py-2 px-3">Entité Responsable</th>
                            <th className="py-2 px-3">Échéance</th>
                            <th className="py-2 px-3">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingReportMission.recommendations.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-800 font-medium">{r.text}</td>
                              <td className="py-2 px-3 text-slate-600">{r.target_entity}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">{r.deadline || '-'}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.status === 'CLOTUREE' ? 'bg-emerald-100 text-emerald-900' :
                                  r.status === 'EN_COURS' ? 'bg-blue-100 text-blue-900' :
                                  'bg-amber-100 text-amber-900'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 6 : IOV - Documents Justificatifs */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <span className="font-bold uppercase text-[10px] text-teal-800 tracking-wide block">
                        7. Pièces Justificatives (IOV - Documents)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Ordres de mission visés, listes d’émargement, fiches de supervision signées.
                      </p>
                    </div>

                    {canEditMissionReport(viewingReportMission) && (
                      <button
                        onClick={() => handleOpenAddIOV(viewingReportMission.id, 'DOCUMENT')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300 transition"
                      >
                        + Ajouter un Document
                      </button>
                    )}
                  </div>

                  {(!viewingReportMission.iov_items || viewingReportMission.iov_items.filter(i => i.type === 'DOCUMENT').length === 0) ? (
                    <div className="text-slate-400 italic text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200">
                      Aucun document justificatif attaché.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {viewingReportMission.iov_items.filter(i => i.type === 'DOCUMENT').map(doc => (
                        <div key={doc.id} className="p-3 bg-slate-50 rounded border border-slate-200 flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-900 uppercase">
                                {doc.category}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">{doc.file_size_kb} KB</span>
                            </div>
                            <div className="font-bold text-slate-800 mt-1 line-clamp-1">{doc.title}</div>
                            {doc.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{doc.description}</div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{doc.uploaded_at}</span>
                            <div className="flex items-center space-x-2">
                              {doc.data_url && (
                                <a
                                  href={doc.data_url}
                                  download={doc.file_name}
                                  className="text-teal-700 font-bold hover:underline"
                                >
                                  Télécharger
                                </a>
                              )}
                              {canEditMissionReport(viewingReportMission) && (
                                <button
                                  onClick={() => handleDeleteIOV(viewingReportMission.id, doc.id)}
                                  className="text-rose-600 hover:text-rose-800 font-bold"
                                >
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 7 : IOV - Galerie Photos */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <span className="font-bold uppercase text-[10px] text-teal-800 tracking-wide block">
                        8. Galerie Photos de Terrain (IOV - Photos)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Clichés géolocalisés des formations, supervisions et séances de coaching. Cliquez sur une photo pour l’agrandir.
                      </p>
                    </div>

                    {canEditMissionReport(viewingReportMission) && (
                      <button
                        onClick={() => handleOpenAddIOV(viewingReportMission.id, 'PHOTO')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300 transition"
                      >
                        + Ajouter une Photo
                      </button>
                    )}
                  </div>

                  {(!viewingReportMission.iov_items || viewingReportMission.iov_items.filter(i => i.type === 'PHOTO').length === 0) ? (
                    <div className="text-slate-400 italic text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200">
                      Aucune photo de terrain déposée pour cette mission.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {viewingReportMission.iov_items.filter(i => i.type === 'PHOTO').map(photo => (
                        <div
                          key={photo.id}
                          className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex flex-col hover:border-teal-600 transition shadow-2xs"
                        >
                          <div
                            onClick={() => setPreviewPhoto(photo)}
                            className="aspect-4/3 w-full bg-slate-200 overflow-hidden cursor-pointer relative"
                          >
                            {photo.data_url ? (
                              <img
                                src={photo.data_url}
                                alt={photo.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">
                                &#128247;
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                              Agrandir
                            </div>
                          </div>

                          <div className="p-2 bg-white flex flex-col justify-between flex-1 text-[11px]">
                            <div className="font-semibold text-slate-800 line-clamp-1">{photo.title}</div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                              <span>{photo.uploaded_at}</span>
                              {canEditMissionReport(viewingReportMission) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteIOV(viewingReportMission.id, photo.id);
                                  }}
                                  className="text-rose-600 hover:text-rose-800 font-bold"
                                >
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-slate-400">
                  Rapport certifié SaniNova &bull; Projet AFGHS
                </span>

                <button
                  onClick={() => setViewingReportMissionId(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                >
                  Fermer
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : VOIR LA PLANIFICATION D'UNE MISSION */}
        {/* ==================================================== */}
        {viewingPlanMission && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded">
                      {viewingPlanMission.code || 'MIS'}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">
                      {viewingPlanMission.department} &bull; {viewingPlanMission.zone_sanitaire}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {viewingPlanMission.status}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1">
                    {viewingPlanMission.title}
                  </h3>
                </div>

                <button
                  onClick={() => setViewingPlanMissionId(null)}
                  className="text-slate-400 hover:text-white p-1 text-base font-bold rounded"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">Période & Durée :</span>
                    <p className="font-mono text-slate-700">
                      Du {viewingPlanMission.departure_date} au {viewingPlanMission.return_date}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">Équipe mobilisée :</span>
                    <p className="text-slate-700 font-medium">
                      Lead : {users.find(u => u.id === viewingPlanMission.lead_expert_id)?.full_name || 'Non assigné'}
                    </p>
                    {(viewingPlanMission.companion_expert_ids || []).length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Accompagnateur(s) interne(s) : {viewingPlanMission.companion_expert_ids.map(id => users.find(u => u.id === id)?.full_name).filter(Boolean).join(', ')}
                      </p>
                    )}
                    {(viewingPlanMission.external_participants || []).length > 0 && (
                      <p className="text-[11px] text-teal-800 mt-0.5 font-medium">
                        Partenaire(s) externe(s) : {viewingPlanMission.external_participants?.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">Objectifs de la mission :</span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingPlanMission.objectives}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">Résultats attendus :</span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingPlanMission.expected_results || 'Non renseigné'}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1.5">
                    Structures sanitaires programmées ({viewingPlanMission.visited_facilities.length}) :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingPlanMission.visited_facilities.map((fac, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white rounded text-[11px] text-slate-700 font-medium border border-slate-200">
                        {fac}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <button
                  onClick={() => {
                    const id = viewingPlanMission.id;
                    setViewingPlanMissionId(null);
                    setActiveSubTab('rapports');
                    setViewingReportMissionId(id);
                  }}
                  className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition flex items-center space-x-1"
                >
                  <span>Passer au Rapport & IOVs &rarr;</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const m = viewingPlanMission;
                      setViewingPlanMissionId(null);
                      handleOpenEditPlan(m);
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-100"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setViewingPlanMissionId(null)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : CONFIRMATION DE SUPPRESSION */}
        {/* ==================================================== */}
        {deleteModal.open && deleteModal.mission && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 text-rose-700">
                <span className="font-bold text-sm uppercase tracking-wide">Confirmation de suppression</span>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  Vous avez demandé la suppression concernant la mission :
                </p>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="font-mono font-bold text-teal-800">{deleteModal.mission.code || 'MIS'}</div>
                  <div className="font-bold text-slate-900 mt-0.5">{deleteModal.mission.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {deleteModal.mission.department} &bull; Du {deleteModal.mission.departure_date} au {deleteModal.mission.return_date}
                  </div>
                </div>
                {deleteModal.context === 'REPORT' && deleteModal.mission.report_status && deleteModal.mission.report_status !== 'NON_REMPLI' ? (
                  <p className="text-slate-500">
                    Souhaitez-vous supprimer définitivement la mission entière ou réinitialiser uniquement le compte-rendu pour recommencer la rédaction ?
                  </p>
                ) : (
                  <p className="text-slate-500">
                    Cette action supprimera définitivement cette mission, sa planification ainsi que ses pièces justificatives associées.
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ open: false, mission: null, context: 'PLAN' })}
                  className="px-3.5 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Annuler
                </button>

                {deleteModal.context === 'REPORT' && deleteModal.mission.report_status && deleteModal.mission.report_status !== 'NON_REMPLI' && (
                  <button
                    type="button"
                    onClick={handleResetReportOnly}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold shadow-xs transition"
                  >
                    Réinitialiser le Rapport
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmDeleteMission}
                  className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold shadow-xs transition"
                >
                  Supprimer Définitivement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : PLANIFIER / MODIFIER UNE MISSION */}
        {/* ==================================================== */}
        {planModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    {editingMission ? 'Modifier l’Ordre de Mission' : 'Planifier une Nouvelle Mission de Terrain'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Module 08 · Planification opérationnelle des supervisions</p>
                </div>
                <button
                  onClick={() => setPlanModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Code Mission</label>
                    <input
                      type="text"
                      value={planForm.code || ''}
                      onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                      placeholder="MIS-2026-001"
                      className="w-full border border-slate-300 rounded p-2 outline-none font-mono focus:border-teal-700"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Titre de la mission *</label>
                    <input
                      type="text"
                      required
                      value={planForm.title || ''}
                      onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                      placeholder="Ex: Supervision formative eSIGL et audit physique..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Département *</label>
                    <select
                      value={planForm.department}
                      onChange={(e) => setPlanForm({ ...planForm, department: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Zone Sanitaire *</label>
                    <input
                      type="text"
                      required
                      value={planForm.zone_sanitaire || ''}
                      onChange={(e) => setPlanForm({ ...planForm, zone_sanitaire: e.target.value })}
                      placeholder="Ex: Natitingou-Boukoumbé-Toucountouna (NBT)"
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-semibold text-slate-700">Lead Expert (Responsable) *</label>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                        Verrouillé
                      </span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={`${(users.find(u => u.id === (editingMission?.lead_expert_id || currentUser.id)) || currentUser).full_name} (${(users.find(u => u.id === (editingMission?.lead_expert_id || currentUser.id)) || currentUser).title})`}
                      className="w-full border border-slate-300 rounded p-2 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed select-none shadow-xs"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Votre compte est automatiquement désigné chef de mission.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Statut Initial</label>
                    <select
                      value={planForm.status}
                      onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as MissionStatus })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    >
                      <option value="BROUILLON">Brouillon</option>
                      <option value="VALIDEE">Validée (Prête à être exécutée)</option>
                      <option value="EN_COURS">En cours sur le terrain</option>
                    </select>
                  </div>
                </div>

                {/* Experts accompagnateurs / collaborateurs internes */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block font-bold text-slate-800 text-xs">
                      Personnes internes à impliquer (Experts accompagnateurs SaniNova)
                    </label>
                    <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {(planForm.companion_expert_ids || []).length} sélectionné(e){(planForm.companion_expert_ids || []).length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Cochez les autres experts de l’équipe qui participent à cette mission de terrain :
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 bg-white rounded p-2">
                    {users
                      .filter(u => u.id !== currentUser.id)
                      .map(user => {
                        const isChecked = (planForm.companion_expert_ids || []).includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCompanion(user.id)}
                                className="rounded text-teal-800 focus:ring-teal-700 h-3.5 w-3.5"
                              />
                              <span className="text-xs">{user.full_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 truncate max-w-[170px] text-right">
                              {user.title}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                {/* Personnes externes à impliquer (DDS, MCZS, Partenaires...) */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block font-bold text-slate-800 text-xs">
                      Personnes externes à impliquer (DDS, MCZS, Équipes Cadres, Partenaires...)
                    </label>
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                      {(planForm.external_participants || []).length} externe{(planForm.external_participants || []).length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Saisissez le nom des homologues ou partenaires locaux associés à la mission :
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={planExternalInput}
                      onChange={(e) => setPlanExternalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPlanExternal();
                        }
                      }}
                      placeholder="Ex: Dr KASSA (MCZS Tanguiéta), Pharmacien Dépôt Répartiteur..."
                      className="flex-1 border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-teal-700 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddPlanExternal}
                      className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shrink-0"
                    >
                      + Ajouter
                    </button>
                  </div>

                  {(planForm.external_participants || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(planForm.external_participants || []).map((ext, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-200/90 text-slate-800 text-xs font-medium border border-slate-300"
                        >
                          <span>{ext}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePlanExternal(idx)}
                            className="text-slate-500 hover:text-rose-700 ml-1 font-bold text-xs"
                            title="Retirer"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date de Départ *</label>
                    <input
                      type="date"
                      required
                      value={planForm.departure_date}
                      onChange={(e) => setPlanForm({ ...planForm, departure_date: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none font-mono focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date de Retour Prévisionnelle *</label>
                    <input
                      type="date"
                      required
                      value={planForm.return_date}
                      onChange={(e) => setPlanForm({ ...planForm, return_date: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none font-mono focus:border-teal-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Objectifs Opérationnels de la Mission *</label>
                  <textarea
                    rows={3}
                    required
                    value={planForm.objectives}
                    onChange={(e) => setPlanForm({ ...planForm, objectives: e.target.value })}
                    placeholder="Précisez les objectifs spécifiques, le coaching visé et les audits à mener..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Formations Sanitaires & Structures à Visiter</label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={facilityInput}
                      onChange={(e) => setFacilityInput(e.target.value)}
                      placeholder="Ex: Centre de Santé de Tanguiéta, Dépôt Répartiteur..."
                      className="flex-1 border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFacility();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddFacility}
                      className="px-3 py-2 bg-slate-800 text-white rounded font-semibold hover:bg-slate-700"
                    >
                      Ajouter
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded border border-slate-200 min-h-[40px]">
                    {(planForm.visited_facilities || []).map((fac, idx) => (
                      <span key={idx} className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 text-xs">
                        <span>{fac}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFacility(idx)}
                          className="text-slate-400 hover:text-rose-600 font-bold ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {(planForm.visited_facilities || []).length === 0 && (
                      <span className="text-slate-400 italic text-[11px]">Aucune structure saisie.</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Résultats Attendus & Livrables de Terrain</label>
                  <input
                    type="text"
                    value={planForm.expected_results || ''}
                    onChange={(e) => setPlanForm({ ...planForm, expected_results: e.target.value })}
                    placeholder="Ex: 100% fiches saisies, rapport d'audit et liste d'émargement signée."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setPlanModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    {editingMission ? 'Enregistrer Modifications' : 'Créer l’Ordre de Mission'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : RÉDIGER / MODIFIER LE RAPPORT DE MISSION */}
        {/* ==================================================== */}
        {reportModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-teal-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Compte-Rendu Officiel de Mission & Recommandations
                  </h3>
                  <p className="text-[11px] text-teal-200">
                    Saisie du rapport d’exécution et préparation de l’audit ready
                  </p>
                </div>
                <button
                  onClick={() => setReportModalOpen(false)}
                  className="text-teal-200 hover:text-white text-sm font-bold p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveReport} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Statut du Rapport *</label>
                    <select
                      value={reportForm.report_status}
                      onChange={(e) => setReportForm({ ...reportForm, report_status: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                    >
                      <option value="BROUILLON">Brouillon en cours de rédaction</option>
                      <option value="SOUMIS">Soumettre pour Validation Direction</option>
                      {currentUser.role === 'direction' && (
                        <option value="VALIDE">Validé Officiellement (Direction)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Taux de Réalisation des Activités (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={reportForm.progress_pct}
                      onChange={(e) => setReportForm({ ...reportForm, progress_pct: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded p-2 outline-none font-mono focus:border-teal-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">1. Synthèse Exécutive du Rapport *</label>
                  <textarea
                    rows={3}
                    required
                    value={reportForm.mission_report_summary}
                    onChange={(e) => setReportForm({ ...reportForm, mission_report_summary: e.target.value })}
                    placeholder="Résumez l'essentiel de la mission, l'accueil des équipes et les résultats majeurs..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">2. Méthodologie & Déroulement de la Mission</label>
                  <textarea
                    rows={2}
                    value={reportForm.methodology}
                    onChange={(e) => setReportForm({ ...reportForm, methodology: e.target.value })}
                    placeholder="Ateliers, entretiens bilatéraux, audits physiques des stocks, revues eSIGL..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">3. Constats Clés & Progrès Constatés sur le Terrain</label>
                  <textarea
                    rows={3}
                    value={reportForm.key_findings}
                    onChange={(e) => setReportForm({ ...reportForm, key_findings: e.target.value })}
                    placeholder="Indiquez les indicateurs de promptitude vérifiés, l'utilisation effective des outils..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">4. Difficultés Rencontrées</label>
                    <textarea
                      rows={2}
                      value={reportForm.difficulties_encountered}
                      onChange={(e) => setReportForm({ ...reportForm, difficulties_encountered: e.target.value })}
                      placeholder="Pannes réseau, retards de livraison, ruptures signalées..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">5. Prochaines Étapes</label>
                    <textarea
                      rows={2}
                      value={reportForm.next_steps}
                      onChange={(e) => setReportForm({ ...reportForm, next_steps: e.target.value })}
                      placeholder="Coaching de suivi, transmission à la DDS, rapportage à distance..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                {/* Recommendations */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    6. Recommandations Opérationnelles ({reportForm.recommendations.length})
                  </label>
                  
                  <div className="space-y-2 mb-3">
                    {reportForm.recommendations.map(r => (
                      <div key={r.id} className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold text-slate-800">{r.text}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Destinataire : <span className="font-medium text-slate-700">{r.target_entity}</span> &bull; Échéance : <span className="font-mono">{r.deadline || '-'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRecommendation(r.id)}
                          className="text-rose-600 hover:text-rose-800 font-bold ml-3"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50/80 rounded border border-slate-200 space-y-2">
                    <span className="font-semibold text-[11px] text-slate-700 block">+ Ajouter une Recommandation</span>
                    <input
                      type="text"
                      value={newRecText}
                      onChange={(e) => setNewRecText(e.target.value)}
                      placeholder="Intitulé de la recommandation opérationnelle..."
                      className="w-full border border-slate-300 rounded p-1.5 outline-none bg-white"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newRecEntity}
                        onChange={(e) => setNewRecEntity(e.target.value)}
                        placeholder="Entité responsable (ex: Médecin Chef, DDS...)"
                        className="w-full border border-slate-300 rounded p-1.5 outline-none bg-white"
                      />
                      <input
                        type="date"
                        value={newRecDeadline}
                        onChange={(e) => setNewRecDeadline(e.target.value)}
                        className="w-full border border-slate-300 rounded p-1.5 outline-none bg-white font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRecommendation}
                      className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold text-xs transition"
                    >
                      Ajouter au Rapport
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    Enregistrer le Rapport
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : AJOUTER UN IOV (DOCUMENT OU PHOTO) */}
        {/* ==================================================== */}
        {iovModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Attacher un IOV (Pièce Justificative ou Photo)
                  </h3>
                  <p className="text-[11px] text-slate-400">Preuve de vérification audit-ready</p>
                </div>
                <button
                  onClick={() => setIovModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveIOV} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIovForm({ ...iovForm, type: 'DOCUMENT', category: 'ORDRE_MISSION' })}
                    className={`p-2.5 rounded border text-center font-bold text-xs transition ${
                      iovForm.type === 'DOCUMENT'
                        ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    &#128196; Document (PDF/Doc)
                  </button>

                  <button
                    type="button"
                    onClick={() => setIovForm({ ...iovForm, type: 'PHOTO', category: 'PHOTO_TERRAIN' })}
                    className={`p-2.5 rounded border text-center font-bold text-xs transition ${
                      iovForm.type === 'PHOTO'
                        ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    &#128247; Photo de Terrain
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catégorie de la preuve *</label>
                  <select
                    value={iovForm.category}
                    onChange={(e) => setIovForm({ ...iovForm, category: e.target.value as any })}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 bg-white"
                  >
                    {iovForm.type === 'DOCUMENT' ? (
                      <>
                        <option value="ORDRE_MISSION">Ordre de mission signé / visé</option>
                        <option value="TDR">Termes de Référence (TDR)</option>
                        <option value="PRESENCE">Liste d’émargement / Fiche de présence</option>
                        <option value="FICHE_SUPERVISION">Fiche de supervision formative eSIGL</option>
                        <option value="RAPPORT_SIGNE">Rapport officiel scellé</option>
                        <option value="AUTRE">Autre pièce justificative</option>
                      </>
                    ) : (
                      <>
                        <option value="PHOTO_TERRAIN">Cliché de séance / formation sur site</option>
                        <option value="FICHE_SUPERVISION">Photo du dépôt de médicaments / étagères</option>
                        <option value="AUTRE">Photo avec le médecin coordonnateur ou équipe</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Titre descriptif de l’IOV *</label>
                  <input
                    type="text"
                    required
                    value={iovForm.title}
                    onChange={(e) => setIovForm({ ...iovForm, title: e.target.value })}
                    placeholder={iovForm.type === 'DOCUMENT' ? 'Ex: Ordre de mission visé par la DDS Atacora' : 'Ex: Coaching eSIGL au CS Boukoumbé'}
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fichier (Document PDF ou Image JPEG/PNG) *</label>
                  <input
                    type="file"
                    accept={iovForm.type === 'PHOTO' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'}
                    onChange={handleFileUpload}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs outline-none bg-slate-50 cursor-pointer"
                  />
                  {iovForm.file_name && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-teal-800 font-mono bg-teal-50 p-1.5 rounded border border-teal-200">
                      <span className="truncate">{iovForm.file_name}</span>
                      <span>{iovForm.file_size_kb} KB</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description / Observations / Horodatage</label>
                  <textarea
                    rows={2}
                    value={iovForm.description}
                    onChange={(e) => setIovForm({ ...iovForm, description: e.target.value })}
                    placeholder="Précisez la localisation, les personnes présentes ou les points vérifiés..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIovModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded font-bold shadow-xs transition"
                  >
                    Attacher l’IOV
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL : VISIONNEUSE PHOTO PLEIN ECRAN */}
        {/* ==================================================== */}
        {previewPhoto && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6">
            <div className="bg-slate-900 rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
              <div className="p-3 border-b border-slate-800 flex justify-between items-center text-white">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">{previewPhoto.title}</h4>
                  <p className="text-[10px] text-slate-400 font-mono">{previewPhoto.file_name} &bull; Déposé par {previewPhoto.uploaded_by}</p>
                </div>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="text-slate-400 hover:text-white text-base font-bold p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <div className="p-2 flex items-center justify-center bg-black min-h-[250px] max-h-[70vh] overflow-hidden">
                {previewPhoto.data_url ? (
                  <img
                    src={previewPhoto.data_url}
                    alt={previewPhoto.title}
                    className="max-h-[65vh] w-auto object-contain rounded"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <div className="text-4xl mb-2">&#128247;</div>
                    <p className="text-xs">Aperçu direct indisponible pour ce cliché d'archive.</p>
                  </div>
                )}
              </div>

              {previewPhoto.description && (
                <div className="p-3 bg-slate-950 text-slate-300 text-xs border-t border-slate-800">
                  {previewPhoto.description}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </ModuleGuard>
  );
}