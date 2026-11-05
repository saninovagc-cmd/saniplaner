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
  const { missions, addMission, updateMission, updateMissionStatus, users, currentUser } = useApp();

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

  // Active selected mission for viewing/reporting
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(missions[0]?.id || null);

  // Modals state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<FieldMission | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [iovModalOpen, setIovModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<MissionIOVItem | null>(null);

  // Planning Form State
  const [planForm, setPlanForm] = useState<Partial<FieldMission>>({
    code: '',
    title: '',
    department: 'Atacora',
    zone_sanitaire: 'Natitingou-Boukoumbé-Toucountouna (NBT)',
    lead_expert_id: currentUser.id,
    companion_expert_ids: [],
    departure_date: new Date().toISOString().substring(0, 10),
    return_date: new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10),
    objectives: '',
    visited_facilities: ['Hôpital de Zone', 'Centre de Santé'],
    expected_results: '',
    status: 'PLANIFIE' as any,
  });

  const [facilityInput, setFacilityInput] = useState('');

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

  // IOV Form State (Documents & Photos)
  const [iovForm, setIovForm] = useState<{
    type: 'DOCUMENT' | 'PHOTO';
    category: MissionIOVItem['category'];
    title: string;
    description: string;
    file_name: string;
    file_size_kb: number;
    data_url?: string;
  }>({
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

  // Current active mission
  const activeMission = useMemo(() => {
    return missions.find(m => m.id === selectedMissionId) || missions[0] || null;
  }, [missions, selectedMissionId]);

  // Is current user allowed to edit this report / attach IOVs?
  const canEditActiveMissionReport = useMemo(() => {
    if (!activeMission) return false;
    if (currentUser.role === 'direction') return true;
    return activeMission.lead_expert_id === currentUser.id || activeMission.author_id === currentUser.id;
  }, [activeMission, currentUser]);

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

      const matchSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.zone_sanitaire.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchSearch;
    });
  }, [missions, currentUser, reportMissionScope, reportStatusFilter, searchQuery]);

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
    setPlanForm({
      code: `MIS-2026-${String(missions.length + 1).padStart(3, '0')}`,
      title: '',
      department: 'Atacora',
      zone_sanitaire: 'Natitingou-Boukoumbé-Toucountouna (NBT)',
      lead_expert_id: currentUser.id,
      companion_expert_ids: [],
      departure_date: new Date().toISOString().substring(0, 10),
      return_date: new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10),
      objectives: '',
      visited_facilities: ['Centre de Santé Chef-Lieu', 'Dépôt Répartiteur'],
      expected_results: '',
      status: 'VALIDEE' as any,
    });
    setFacilityInput('');
    setPlanModalOpen(true);
  };

  const handleOpenEditPlan = (m: FieldMission) => {
    setEditingMission(m);
    setPlanForm({
      code: m.code || `MIS-${m.id}`,
      title: m.title,
      department: m.department,
      zone_sanitaire: m.zone_sanitaire,
      lead_expert_id: m.lead_expert_id,
      companion_expert_ids: m.companion_expert_ids || [],
      departure_date: m.departure_date,
      return_date: m.return_date,
      objectives: m.objectives,
      visited_facilities: m.visited_facilities || [],
      expected_results: m.expected_results,
      status: m.status,
    });
    setFacilityInput('');
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
        lead_expert_id: planForm.lead_expert_id || currentUser.id,
        companion_expert_ids: planForm.companion_expert_ids || [],
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
      setSelectedMissionId(newMis.id);
    }

    setPlanModalOpen(false);
  };

  // ----------------------------------------------------
  // REPORT HANDLERS
  // ----------------------------------------------------
  const handleOpenEditReport = (m: FieldMission) => {
    setSelectedMissionId(m.id);
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
    if (!activeMission) return;

    const updated: FieldMission = {
      ...activeMission,
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
      status: reportForm.report_status === 'VALIDE' ? 'CLOTUREE' : reportForm.report_status === 'SOUMIS' ? 'REALISEE' : activeMission.status,
    };

    updateMission(updated);
    setReportModalOpen(false);
  };

  // ----------------------------------------------------
  // IOV (DOCUMENTS & PHOTOS) HANDLERS
  // ----------------------------------------------------
  const handleOpenAddIOV = (defaultType: 'DOCUMENT' | 'PHOTO' = 'DOCUMENT') => {
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

    const fileName = file.name;
    const fileSizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setIovForm(prev => ({
        ...prev,
        file_name: fileName,
        file_size_kb: fileSizeKb,
        title: prev.title || fileName.replace(/\.[^/.]+$/, ''),
        data_url: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveIOV = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMission || !iovForm.title || !iovForm.file_name) return;

    const newIOV: MissionIOVItem = {
      id: `iov-${Date.now()}`,
      type: iovForm.type,
      category: iovForm.category,
      title: iovForm.title,
      description: iovForm.description,
      file_name: iovForm.file_name,
      file_size_kb: iovForm.file_size_kb,
      uploaded_at: new Date().toISOString().substring(0, 10),
      uploaded_by: currentUser.full_name,
      data_url: iovForm.data_url,
    };

    const currentItems = activeMission.iov_items || [];
    const updatedIOVs = [newIOV, ...currentItems];
    const photosCount = updatedIOVs.filter(i => i.type === 'PHOTO').length;

    const updated: FieldMission = {
      ...activeMission,
      iov_items: updatedIOVs,
      photos_count: photosCount,
    };

    updateMission(updated);
    setIovModalOpen(false);
  };

  const handleDeleteIOV = (iovId: string) => {
    if (!activeMission) return;
    const updatedIOVs = (activeMission.iov_items || []).filter(i => i.id !== iovId);
    const photosCount = updatedIOVs.filter(i => i.type === 'PHOTO').length;

    const updated: FieldMission = {
      ...activeMission,
      iov_items: updatedIOVs,
      photos_count: photosCount,
    };

    updateMission(updated);
  };

  const handleDownloadIOVDocument = (iov: MissionIOVItem) => {
    if (iov.data_url) {
      const a = document.createElement('a');
      a.href = iov.data_url;
      a.download = iov.file_name;
      a.click();
      return;
    }

    // Text proof fallback
    const content = `============================================================
SANINOVA GLOBAL CONSULTING — PROJET AFGHS-PSI BÉNIN
INDICATEUR OBJECTIVEMENT VÉRIFIABLE (IOV) - PREUVE DE TERRAIN
============================================================
Mission : ${activeMission?.title} (${activeMission?.code || activeMission?.id})
Département & Zone : ${activeMission?.department} - ${activeMission?.zone_sanitaire}
Type de preuve : ${iov.type} (${iov.category})
Titre : ${iov.title}
Fichier original : ${iov.file_name}
Déposé par : ${iov.uploaded_by} le ${iov.uploaded_at}
Description : ${iov.description || 'Preuve officielle certifiée pour audit bailleur PSI/ABMS'}
============================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${iov.file_name.replace(/\.[^/.]+$/, '')}_certifie.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // OFFICIAL MISSION REPORT PDF EXPORT
  // ----------------------------------------------------
  const handleDownloadFullReportPdf = (m: FieldMission) => {
    const lead = users.find(u => u.id === m.lead_expert_id);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header band
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPPORT OFFICIEL DE MISSION DE TERRAIN', 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 212, 191); // teal-400
    doc.text('Projet AFGHS-PSI Bénin · SaniNova Global Consulting · Fixed Amount Award SAQMMA26CA0351', 14, 22);

    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(8);
    doc.text(`Réf: ${m.code || m.id} | Édité le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);

    let currentY = 40;

    // Mission Details Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, currentY, 182, 38, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(m.title, 18, currentY + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Département : ${m.department} | Zone Sanitaire : ${m.zone_sanitaire}`, 18, currentY + 14);
    doc.text(`Dates d'exécution : du ${m.departure_date} au ${m.return_date}`, 18, currentY + 20);
    doc.text(`Responsable de mission : ${lead?.full_name || 'Expert SaniNova'} (${lead?.title || 'Lead'})`, 18, currentY + 26);
    doc.text(`Structures visitées : ${m.visited_facilities.join(', ')}`, 18, currentY + 32);

    currentY += 46;

    // Section 1: Objectifs & Résultats
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

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="w-full md:w-80">
                <input
                  type="text"
                  placeholder="Rechercher par titre, code, zone, structure..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-slate-600 font-medium">Département :</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
                >
                  <option value="ALL">Tous les départements</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <span className="text-xs text-slate-600 font-medium ml-2">Statut :</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="BROUILLON">Brouillon</option>
                  <option value="VALIDEE">Validée (Prête)</option>
                  <option value="EN_COURS">En cours sur le terrain</option>
                  <option value="REALISEE">Réalisée</option>
                  <option value="CLOTUREE">Clôturée</option>
                </select>

                <span className="text-xs text-slate-600 font-medium ml-2">Expert :</span>
                <select
                  value={selectedExpert}
                  onChange={(e) => setSelectedExpert(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none max-w-[170px]"
                >
                  <option value="ALL">Toute l’équipe</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Missions List for Planification */}
            <div className="space-y-4">
              {filteredPlannedMissions.length === 0 ? (
                <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-xs text-slate-400 space-y-3">
                  <p>Aucune mission ne correspond à vos filtres actuels.</p>
                  <button
                    onClick={handleOpenCreatePlan}
                    className="px-4 py-2 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 transition"
                  >
                    + Planifier la première mission
                  </button>
                </div>
              ) : (
                filteredPlannedMissions.map((m) => {
                  const lead = users.find(u => u.id === m.lead_expert_id);
                  const companions = (m.companion_expert_ids || []).map(id => users.find(u => u.id === id)?.full_name).filter(Boolean);
                  const isMine = m.lead_expert_id === currentUser.id || m.author_id === currentUser.id;

                  return (
                    <div
                      key={m.id}
                      className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 hover:border-slate-300 transition space-y-4"
                    >
                      {/* Top Header of Mission Card */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {m.code || 'MIS'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 uppercase">
                              {m.department}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              {m.zone_sanitaire}
                            </span>
                            {isMine && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Ma Mission
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1">{m.title}</h3>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold border ${
                            m.status === 'CLOTUREE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            m.status === 'REALISEE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            m.status === 'EN_COURS' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                            m.status === 'VALIDEE' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {m.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Objectives & Expected Results */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-slate-50/70 rounded border border-slate-200">
                          <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                            Objectifs de la mission :
                          </span>
                          <p className="text-slate-600 leading-relaxed">{m.objectives}</p>
                        </div>
                        <div className="p-3 bg-slate-50/70 rounded border border-slate-200">
                          <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                            Résultats Attendus :
                          </span>
                          <p className="text-slate-600 leading-relaxed">{m.expected_results || 'Non renseigné'}</p>
                        </div>
                      </div>

                      {/* Structures visitées */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                          Structures sanitaires à visiter ({m.visited_facilities.length}) :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {m.visited_facilities.map((fac, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700 font-medium border border-slate-200">
                              {fac}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Dates, Équipe & Action Buttons Footer */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-4 text-slate-500 text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-700">Période :</span>{' '}
                            <span className="font-mono text-slate-900 font-medium">
                              {m.departure_date} au {m.return_date}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Lead :</span>{' '}
                            <span className="text-slate-900 font-medium">{lead?.full_name}</span>
                          </div>
                          {companions.length > 0 && (
                            <div>
                              <span className="font-semibold text-slate-700">Accompagnateurs :</span>{' '}
                              <span>{companions.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleOpenEditPlan(m)}
                            className="px-2.5 py-1 border border-slate-300 hover:bg-slate-50 rounded text-slate-700 text-xs font-semibold transition"
                          >
                            Modifier Planification
                          </button>

                          <button
                            onClick={() => {
                              setSelectedMissionId(m.id);
                              setActiveSubTab('rapports');
                            }}
                            className="px-3.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition flex items-center space-x-1"
                          >
                            <span>Rapport & IOV &rarr;</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SUB-MODULE 2 : RAPPORTS DE MISSION & GESTION DES IOV */}
        {/* ==================================================== */}
        {activeSubTab === 'rapports' && (
          <div className="space-y-6">
            {/* Scope Selector: My missions vs All team missions */}
            <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                  Espace Rapports & Preuves de Vérification
                </span>
                <h2 className="text-base font-bold text-white mt-0.5">
                  Rédaction des Rapports et Dépôt des IOV (Documents & Photos)
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Chaque expert planificateur ou exécutant de mission vient ici consulter sa mission, saisir les constats, points forts, difficultés rencontrées, et attacher les pièces justificatives (ordres de mission signés, feuilles d’émargement, photos de terrain).
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
                  <option value="NON_REMPLI">Rapport non rédigé</option>
                  <option value="BROUILLON">Brouillon en cours</option>
                  <option value="SOUMIS">Soumis pour validation</option>
                  <option value="VALIDE">Validé Direction</option>
                </select>
              </div>
            </div>

            {/* Split View : List of Missions on the Left, Detailed Report & IOV Dashboard on the Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (4 cols) : Missions List */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Missions sélectionnées ({filteredReportMissions.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Cliquez pour ouvrir</span>
                </div>

                {filteredReportMissions.length === 0 ? (
                  <div className="bg-white p-6 rounded-lg border border-slate-200 text-center text-xs text-slate-400">
                    Aucune mission trouvée pour le filtre sélectionné.
                  </div>
                ) : (
                  filteredReportMissions.map((m) => {
                    const isSelected = activeMission?.id === m.id;
                    const lead = users.find(u => u.id === m.lead_expert_id);
                    const iovs = m.iov_items || [];
                    const docsCount = iovs.filter(i => i.type === 'DOCUMENT').length;
                    const photosCount = iovs.filter(i => i.type === 'PHOTO').length;
                    const rStatus = m.report_status || 'NON_REMPLI';

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMissionId(m.id)}
                        className={`p-4 rounded-lg border transition cursor-pointer text-xs space-y-2.5 ${
                          isSelected
                            ? 'bg-teal-50/50 border-teal-600 ring-1 ring-teal-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-[11px] text-teal-800 bg-teal-100/60 px-1.5 py-0.2 rounded border border-teal-200">
                            {m.code || 'MIS'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rStatus === 'VALIDE' ? 'bg-emerald-100 text-emerald-900' :
                            rStatus === 'SOUMIS' ? 'bg-indigo-100 text-indigo-900' :
                            rStatus === 'BROUILLON' ? 'bg-blue-100 text-blue-900' :
                            'bg-amber-100 text-amber-900'
                          }`}>
                            {rStatus === 'NON_REMPLI' ? 'Rapport à rédiger' :
                             rStatus === 'BROUILLON' ? 'Brouillon' :
                             rStatus === 'SOUMIS' ? 'Rapport Soumis' : 'Validé'}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 leading-snug line-clamp-2">
                          {m.title}
                        </h4>

                        <div className="text-[11px] text-slate-500">
                          <div>{m.department} &bull; {m.zone_sanitaire}</div>
                          <div className="mt-0.5">Responsable : <span className="font-semibold text-slate-700">{lead?.full_name}</span></div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-mono">{m.departure_date}</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                              {docsCount} doc(s)
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                              {photosCount} photo(s)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column (8 cols) : Mission Report & IOV Dashboard */}
              <div className="lg:col-span-8 space-y-5">
                {activeMission ? (
                  <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 space-y-6">
                    {/* Header of Active Mission Report */}
                    <div className="pb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                            {activeMission.code || 'MIS'}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">{activeMission.department} &bull; {activeMission.zone_sanitaire}</span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-1">
                          {activeMission.title}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Mission exécutée du <strong className="text-slate-800">{activeMission.departure_date}</strong> au <strong className="text-slate-800">{activeMission.return_date}</strong>
                        </p>
                      </div>

                      {/* Header Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {canEditActiveMissionReport && (
                          <>
                            <button
                              onClick={() => handleOpenEditReport(activeMission)}
                              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shadow-xs flex items-center space-x-1"
                            >
                              <span>Rédiger / Modifier le Rapport</span>
                            </button>

                            <button
                              onClick={() => handleOpenAddIOV('DOCUMENT')}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-bold transition"
                            >
                              + Ajouter IOV
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDownloadFullReportPdf(activeMission)}
                          className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded text-xs font-bold transition shadow-2xs"
                        >
                          Télécharger PDF Certifié
                        </button>
                      </div>
                    </div>

                    {/* Report Status Callout */}
                    <div className={`p-4 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      activeMission.report_status === 'VALIDE' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                      activeMission.report_status === 'SOUMIS' ? 'bg-indigo-50 border-indigo-300 text-indigo-900' :
                      activeMission.report_status === 'BROUILLON' ? 'bg-blue-50 border-blue-300 text-blue-900' :
                      'bg-amber-50 border-amber-300 text-amber-900'
                    }`}>
                      <div>
                        <div className="font-bold uppercase tracking-wider text-[10px]">
                          Statut Actuel du Compte-Rendu :
                        </div>
                        <div className="font-bold text-sm mt-0.5">
                          {activeMission.report_status === 'VALIDE' ? 'Rapport Validé & Clôturé par la Direction' :
                           activeMission.report_status === 'SOUMIS' ? 'Rapport Soumis pour Validation Direction' :
                           activeMission.report_status === 'BROUILLON' ? 'Rapport en Cours de Rédaction (Brouillon)' :
                           'Rapport non encore rédigé pour cette mission'}
                        </div>
                        {activeMission.report_date && (
                          <div className="text-[11px] opacity-80 mt-0.5">
                            Dernière mise à jour le {activeMission.report_date} par {activeMission.report_author_name || 'le responsable de mission'}.
                          </div>
                        )}
                      </div>

                      {canEditActiveMissionReport && activeMission.report_status !== 'VALIDE' && (
                        <button
                          onClick={() => handleOpenEditReport(activeMission)}
                          className="px-3 py-1.5 rounded font-bold text-xs bg-white text-slate-800 border border-slate-300 shadow-2xs hover:bg-slate-50 transition shrink-0"
                        >
                          Éditer maintenant &rarr;
                        </button>
                      )}
                    </div>

                    {/* 1. Synthèse Exécutive */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">
                        1. Synthèse Exécutive du Rapport
                      </h3>
                      {activeMission.mission_report_summary ? (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                          {activeMission.mission_report_summary}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                          Aucun résumé de rapport saisi pour l’instant. Cliquez sur <strong>Rédiger / Modifier le Rapport</strong> pour documenter la mission.
                        </div>
                      )}
                    </div>

                    {/* 2. Constats, Méthodologie & Difficultés */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-800 uppercase text-[10px] block">
                          2. Méthodologie & Déroulement sur le Terrain
                        </span>
                        <p className="text-slate-600 leading-relaxed">
                          {activeMission.methodology || 'Non renseigné'}
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-800 uppercase text-[10px] block">
                          3. Principaux Constats & Résultats
                        </span>
                        <p className="text-slate-600 leading-relaxed">
                          {activeMission.key_findings || 'Non renseigné'}
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-800 uppercase text-[10px] block">
                          4. Difficultés Rencontrées
                        </span>
                        <p className="text-slate-600 leading-relaxed">
                          {activeMission.difficulties_encountered || 'Aucune difficulté majeure signalée.'}
                        </p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-800 uppercase text-[10px] block">
                          5. Prochaines Étapes & Perspectives
                        </span>
                        <p className="text-slate-600 leading-relaxed">
                          {activeMission.next_steps || 'Suivi des recommandations opérationnelles.'}
                        </p>
                      </div>
                    </div>

                    {/* 3. Recommandations de Terrain */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                          6. Recommandations Opérationnelles ({activeMission.recommendations?.length || 0})
                        </h3>
                        {canEditActiveMissionReport && (
                          <button
                            onClick={() => handleOpenEditReport(activeMission)}
                            className="text-xs font-semibold text-teal-800 hover:underline"
                          >
                            + Gérer les recommandations
                          </button>
                        )}
                      </div>

                      {!activeMission.recommendations || activeMission.recommendations.length === 0 ? (
                        <div className="p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                          Aucune recommandation formulée pour cette mission.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs min-w-[550px]">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                                <th className="p-2.5">Recommandation</th>
                                <th className="p-2.5">Entité Responsable</th>
                                <th className="p-2.5">Échéance</th>
                                <th className="p-2.5 text-center">Statut</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activeMission.recommendations.map((rec) => (
                                <tr key={rec.id} className="hover:bg-slate-50">
                                  <td className="p-2.5 font-medium text-slate-900">{rec.text}</td>
                                  <td className="p-2.5 text-slate-600">{rec.target_entity}</td>
                                  <td className="p-2.5 font-mono text-[11px] text-slate-600">{rec.deadline || '-'}</td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      rec.status === 'CLOTUREE' ? 'bg-emerald-100 text-emerald-800' :
                                      rec.status === 'EN_COURS' ? 'bg-blue-100 text-blue-800' :
                                      'bg-amber-100 text-amber-800'
                                    }`}>
                                      {rec.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 4. IOV : DOCUMENTS & PIECES JUSTIFICATIVES */}
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                            7. IOV : Documents & Pièces Justificatives (Preuves)
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Ordres de mission signés, TDR, listes d’émargement, fiches de supervision eSIGL certifiées
                          </p>
                        </div>
                        {canEditActiveMissionReport && (
                          <button
                            onClick={() => handleOpenAddIOV('DOCUMENT')}
                            className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-semibold transition shadow-xs"
                          >
                            + Ajouter un Document
                          </button>
                        )}
                      </div>

                      {(() => {
                        const docItems = (activeMission.iov_items || []).filter(i => i.type === 'DOCUMENT');
                        if (docItems.length === 0) {
                          return (
                            <div className="p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              Aucun document IOV déposé pour cette mission. Cliquez sur <strong>+ Ajouter un Document</strong> pour insérer un ordre de mission signé ou une liste d’émargement.
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {docItems.map((doc) => (
                              <div
                                key={doc.id}
                                className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2 hover:border-slate-300 transition"
                              >
                                <div>
                                  <div className="flex justify-between items-start">
                                    <span className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-200">
                                      {doc.category.replace('_', ' ')}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {doc.file_size_kb} KB
                                    </span>
                                  </div>

                                  <h4 className="font-bold text-xs text-slate-900 mt-2">{doc.title}</h4>
                                  <p className="text-[11px] text-slate-500 font-mono truncate">{doc.file_name}</p>
                                  {doc.description && (
                                    <p className="text-[10px] text-slate-600 mt-1">{doc.description}</p>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                                  <span>{doc.uploaded_at} &bull; {doc.uploaded_by.split(' ')[0]}</span>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleDownloadIOVDocument(doc)}
                                      className="text-teal-800 hover:underline font-bold text-xs"
                                    >
                                      Télécharger
                                    </button>
                                    {canEditActiveMissionReport && (
                                      <button
                                        onClick={() => handleDeleteIOV(doc.id)}
                                        className="text-rose-600 hover:text-rose-800"
                                        title="Supprimer"
                                      >
                                        &times;
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 5. IOV : GALERIE PHOTOS DE TERRAIN */}
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                            8. IOV : Galerie Photos de Terrain Horodatées
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Photos de dépôts, séances de coaching eSIGL, réunions de zone et constats physiques
                          </p>
                        </div>
                        {canEditActiveMissionReport && (
                          <button
                            onClick={() => handleOpenAddIOV('PHOTO')}
                            className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-semibold transition shadow-xs"
                          >
                            + Ajouter une Photo
                          </button>
                        )}
                      </div>

                      {(() => {
                        const photoItems = (activeMission.iov_items || []).filter(i => i.type === 'PHOTO');
                        if (photoItems.length === 0) {
                          return (
                            <div className="p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              Aucune photo de terrain attachée pour l’instant. Cliquez sur <strong>+ Ajouter une Photo</strong> pour attacher un cliché géolocalisé.
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {photoItems.map((ph) => (
                              <div
                                key={ph.id}
                                className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition flex flex-col justify-between"
                              >
                                {/* Photo Preview / Placeholder */}
                                <div
                                  onClick={() => setPreviewPhoto(ph)}
                                  className="h-36 bg-slate-800 relative cursor-pointer overflow-hidden flex items-center justify-center group"
                                >
                                  {ph.data_url ? (
                                    <img
                                      src={ph.data_url}
                                      alt={ph.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    />
                                  ) : (
                                    <div className="text-center p-3 text-slate-400">
                                      <div className="text-2xl mb-1">&#128247;</div>
                                      <div className="text-[10px] font-mono text-slate-300 truncate max-w-[180px]">{ph.file_name}</div>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                                    Agrandir &#128065;
                                  </div>
                                </div>

                                {/* Photo Metadata */}
                                <div className="p-3 space-y-1">
                                  <h5 className="font-bold text-xs text-slate-900 truncate">{ph.title}</h5>
                                  {ph.description && (
                                    <p className="text-[10px] text-slate-600 line-clamp-2">{ph.description}</p>
                                  )}
                                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                                    <span>{ph.uploaded_at}</span>
                                    {canEditActiveMissionReport && (
                                      <button
                                        onClick={() => handleDeleteIOV(ph.id)}
                                        className="text-rose-600 hover:text-rose-800 font-bold"
                                        title="Supprimer la photo"
                                      >
                                        Supprimer
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-slate-400 text-xs">
                    Sélectionnez une mission dans la liste de gauche pour consulter son rapport et ses pièces justificatives (IOV).
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL 1 : PLANIFIER / MODIFIER UNE MISSION */}
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
                    <label className="block font-semibold text-slate-700 mb-1">Lead Expert (Responsable) *</label>
                    <select
                      value={planForm.lead_expert_id}
                      onChange={(e) => setPlanForm({ ...planForm, lead_expert_id: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.title})</option>
                      ))}
                    </select>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date de départ</label>
                    <input
                      type="date"
                      value={planForm.departure_date}
                      onChange={(e) => setPlanForm({ ...planForm, departure_date: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date de retour</label>
                    <input
                      type="date"
                      value={planForm.return_date}
                      onChange={(e) => setPlanForm({ ...planForm, return_date: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-mono"
                    />
                  </div>
                </div>

                {/* Accompagnateurs Multi-select */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Accompagnateurs / Membres d’équipe associés :
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded">
                    {users.map(u => {
                      const isLead = u.id === planForm.lead_expert_id;
                      const isSelected = (planForm.companion_expert_ids || []).includes(u.id);

                      return (
                        <label
                          key={u.id}
                          className={`flex items-center space-x-1.5 p-1 rounded text-[11px] cursor-pointer ${
                            isLead ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isLead}
                            checked={isSelected}
                            onChange={(e) => {
                              const current = planForm.companion_expert_ids || [];
                              if (e.target.checked) {
                                setPlanForm({ ...planForm, companion_expert_ids: [...current, u.id] });
                              } else {
                                setPlanForm({ ...planForm, companion_expert_ids: current.filter(id => id !== u.id) });
                              }
                            }}
                            className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                          />
                          <span className="truncate">{u.full_name.split(' ').slice(-1)[0]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Structures sanitaires visitées */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Structures sanitaires à visiter :
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={facilityInput}
                      onChange={(e) => setFacilityInput(e.target.value)}
                      placeholder="Ex: CS Boukoumbé, Hôpital de Zone..."
                      className="flex-1 border border-slate-300 rounded p-1.5 outline-none focus:border-teal-700 text-xs"
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
                      className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold hover:bg-slate-700"
                    >
                      + Ajouter
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(planForm.visited_facilities || []).map((fac, idx) => (
                      <span key={idx} className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-800 border border-slate-200">
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
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Objectifs de la mission *</label>
                  <textarea
                    rows={2}
                    required
                    value={planForm.objectives || ''}
                    onChange={(e) => setPlanForm({ ...planForm, objectives: e.target.value })}
                    placeholder="Précisez les objectifs techniques et opérationnels de la mission..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Résultats Attendus</label>
                  <input
                    type="text"
                    value={planForm.expected_results || ''}
                    onChange={(e) => setPlanForm({ ...planForm, expected_results: e.target.value })}
                    placeholder="Ex: Taux de promptitude > 70%, PV de visite cosigné..."
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
                    {editingMission ? 'Enregistrer les Modifications' : 'Créer et Enregistrer la Mission'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL 2 : REDIGER LE RAPPORT DE MISSION */}
        {/* ==================================================== */}
        {reportModalOpen && activeMission && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Compte-Rendu d’Exécution de la Mission — {activeMission.code || activeMission.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">Renseignez les constats, difficultés et recommandations</p>
                </div>
                <button
                  onClick={() => setReportModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveReport} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
                {/* Status and Progress bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-800 uppercase text-[10px] mb-1">
                      Statut du Rapport :
                    </label>
                    <select
                      value={reportForm.report_status}
                      onChange={(e) => setReportForm({ ...reportForm, report_status: e.target.value as any })}
                      className="w-full border border-slate-300 rounded p-2 font-bold outline-none focus:border-teal-700 bg-white"
                    >
                      <option value="BROUILLON">Brouillon (En cours de rédaction)</option>
                      <option value="SOUMIS">Soumis pour validation (Finalisé par le lead)</option>
                      {currentUser.role === 'direction' && (
                        <option value="VALIDE">Validé & Clôturé (Direction)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-bold text-slate-800 uppercase text-[10px]">
                        Taux d’atteinte des objectifs :
                      </label>
                      <span className="font-bold text-teal-800 font-mono">{reportForm.progress_pct}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={reportForm.progress_pct}
                      onChange={(e) => setReportForm({ ...reportForm, progress_pct: Number(e.target.value) })}
                      className="w-full cursor-pointer accent-teal-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[10px] mb-1">
                    1. Synthèse Exécutive du Rapport *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reportForm.mission_report_summary}
                    onChange={(e) => setReportForm({ ...reportForm, mission_report_summary: e.target.value })}
                    placeholder="Résumez l'essentiel du déroulement de la mission et des réalisations obtenues..."
                    className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 uppercase text-[10px] mb-1">
                      2. Méthodologie & Déroulement sur Site
                    </label>
                    <textarea
                      rows={3}
                      value={reportForm.methodology}
                      onChange={(e) => setReportForm({ ...reportForm, methodology: e.target.value })}
                      placeholder="Entretiens menés, audits physiques, séances de coaching..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 uppercase text-[10px] mb-1">
                      3. Principaux Constats & Résultats Clés
                    </label>
                    <textarea
                      rows={3}
                      value={reportForm.key_findings}
                      onChange={(e) => setReportForm({ ...reportForm, key_findings: e.target.value })}
                      placeholder="Disponibilité des intrants, taux de promptitude constaté, tenue des fiches..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 uppercase text-[10px] mb-1">
                      4. Difficultés Rencontrées & Goulots d’Étranglement
                    </label>
                    <textarea
                      rows={2}
                      value={reportForm.difficulties_encountered}
                      onChange={(e) => setReportForm({ ...reportForm, difficulties_encountered: e.target.value })}
                      placeholder="Problèmes de connectivité, ruptures de stock constatées, indisponibilité de personnel..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 uppercase text-[10px] mb-1">
                      5. Prochaines Étapes & Perspectives
                    </label>
                    <textarea
                      rows={2}
                      value={reportForm.next_steps}
                      onChange={(e) => setReportForm({ ...reportForm, next_steps: e.target.value })}
                      placeholder="Actions prioritaires à entreprendre sous 15 jours..."
                      className="w-full border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                {/* Formulaire des recommandations */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                  <span className="font-bold text-slate-800 uppercase text-[10px] block">
                    6. Ajouter des Recommandations Opérationnelles :
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newRecText}
                      onChange={(e) => setNewRecText(e.target.value)}
                      placeholder="Recommandation..."
                      className="sm:col-span-1 border border-slate-300 rounded p-1.5 text-xs outline-none"
                    />
                    <input
                      type="text"
                      value={newRecEntity}
                      onChange={(e) => setNewRecEntity(e.target.value)}
                      placeholder="Entité (ex: DDS, DRZS, SoBAPS)..."
                      className="border border-slate-300 rounded p-1.5 text-xs outline-none"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="date"
                        value={newRecDeadline}
                        onChange={(e) => setNewRecDeadline(e.target.value)}
                        className="border border-slate-300 rounded p-1.5 text-xs outline-none flex-1 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddRecommendation}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold hover:bg-slate-700 shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {reportForm.recommendations.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {reportForm.recommendations.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-2 bg-white rounded border border-slate-200 text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-900">{r.text}</span>
                            <span className="text-slate-500 ml-2">({r.target_entity} &bull; Échéance : {r.deadline})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecommendation(r.id)}
                            className="text-rose-600 font-bold hover:text-rose-800 ml-2"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Fermer
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
        {/* MODAL 3 : AJOUTER UN IOV (DOCUMENT OU PHOTO) */}
        {/* ==================================================== */}
        {iovModalOpen && activeMission && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-xl shrink-0">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Attacher un IOV (Indicateur Vérifiable)
                  </h3>
                  <p className="text-[11px] text-slate-400">{activeMission.code || activeMission.title}</p>
                </div>
                <button
                  onClick={() => setIovModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveIOV} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
                {/* Type Selection: Document vs Photo */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIovForm({ ...iovForm, type: 'DOCUMENT', category: 'ORDRE_MISSION' })}
                    className={`py-2 rounded border font-bold text-xs transition ${
                      iovForm.type === 'DOCUMENT'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-600'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    &#128196; Pièce / Document
                  </button>

                  <button
                    type="button"
                    onClick={() => setIovForm({ ...iovForm, type: 'PHOTO', category: 'PHOTO_TERRAIN' })}
                    className={`py-2 rounded border font-bold text-xs transition ${
                      iovForm.type === 'PHOTO'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 ring-1 ring-teal-600'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
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
        {/* MODAL 4 : VISIONNEUSE PHOTO PLEIN ECRAN */}
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
