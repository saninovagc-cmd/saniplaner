'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  MeetingSession, 
  MeetingType, 
  MeetingFormat, 
  MeetingStatus, 
  MeetingParticipant, 
  MeetingDecision, 
  MeetingPhoto,
  MilestoneType 
} from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper pour compresser les photos sur canvas avant conversion en Base64 (évite l'explosion du quota localStorage)
const compressImageFile = (file: File, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

// Helper pour lire un document (PDF, Word) en DataURL avec nom et taille
const readFileAsDataUrl = (file: File): Promise<{ dataUrl: string; sizeKb: number; name: string }> => {
  return new Promise((resolve, reject) => {
    const sizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUrl: reader.result as string,
        sizeKb,
        name: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Téléchargement / ouverture directe d'une pièce jointe
const downloadAttachment = (dataUrl?: string, filename = 'document.pdf') => {
  if (!dataUrl) {
    alert('Fichier non disponible.');
    return;
  }
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const MEETING_TYPE_LABELS: Record<MeetingType, { label: string; badge: string; icon: string }> = {
  GTT: { label: 'GTT — Groupe Technique', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: '🔬' },
  COORDINATION: { label: 'Réunion de Coordination', badge: 'bg-teal-100 text-teal-800 border-teal-200', icon: '🤝' },
  COMITE_PILOTAGE: { label: 'Comité de Pilotage', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: '🏛️' },
  INSTITUTIONNELLE: { label: 'Rencontre Institutionnelle', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🏢' },
  ATELIER: { label: 'Atelier / Revue Technique', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: '📋' },
  AUTRE: { label: 'Autre Séance de Travail', badge: 'bg-slate-100 text-slate-700 border-slate-200', icon: '👥' },
};

const FORMAT_LABELS: Record<MeetingFormat, { label: string; badge: string; icon: string }> = {
  PRESENTIEL: { label: 'Présentiel', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: '📍' },
  EN_LIGNE: { label: 'En ligne (Visio)', badge: 'bg-sky-50 text-sky-800 border-sky-200', icon: '💻' },
  HYBRIDE: { label: 'Hybride (Mixte)', badge: 'bg-purple-50 text-purple-800 border-purple-200', icon: '🌐' },
};

const STATUS_LABELS: Record<MeetingStatus, { label: string; badge: string }> = {
  PLANIFIEE: { label: 'Planifiée', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  EN_COURS: { label: 'En cours', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  TERMINEE: { label: 'Terminée (PV dispo)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REPORTEE: { label: 'Reportée', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  ANNULEE: { label: 'Annulée', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export default function SeancesPage() {
  const { meetings, addMeeting, updateMeeting, deleteMeeting, activities, users, currentUser } = useApp();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'REALISEES' | 'ALL' | 'PLANIFIEES' | 'GTT' | 'COORDINATION' | 'INSTITUTIONNELLE' | 'PHOTOS'>('REALISEES');

  // View mode switcher: Table / Cards
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Filters
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingSession | null>(null);
  const [viewModalMeeting, setViewModalMeeting] = useState<MeetingSession | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<MeetingPhoto | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<MeetingSession>>({
    title: '',
    meeting_type: 'GTT',
    format: 'PRESENTIEL',
    location: '',
    online_link: '',
    session_date: '',
    start_time: '',
    end_time: '',
    milestone: 'B13',
    work_plan_code: '',
    organization_type: 'INTERNAL',
    organizing_structure: '',
    organizer_id: currentUser?.id || 'usr-dir',
    organizer_name: currentUser?.full_name || 'Direction SaniNova',
    objectives: '',
    agenda: '',
    agenda_mode: 'TEXT',
    agenda_attachment_name: '',
    agenda_attachment_url: '',
    agenda_attachment_size_kb: undefined,
    report_attachment_name: '',
    report_attachment_url: '',
    report_attachment_size_kb: undefined,
    status: 'PLANIFIEE',
    internal_participants_ids: currentUser?.id ? [currentUser.id] : ['usr-dir'],
    external_participants: [],
    summary_report: '',
    decisions: [],
    pv_attachment_name: '',
    pv_attachment_url: '',
    photos: [],
  });

  // External participant sub-form inside modal
  const [newExtPart, setNewExtPart] = useState<Partial<MeetingParticipant>>({
    name: '',
    organization: '',
    role_title: '',
    email: '',
    phone: '',
    present: true,
  });

  // Decision sub-form inside modal
  const [newDecision, setNewDecision] = useState<Partial<MeetingDecision>>({
    description: '',
    responsible: '',
    deadline: '',
    status: 'A_FAIRE',
  });

  // Photo sub-form inside modal
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');

  // Filtered Meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      // Tab filter
      if (activeTab === 'REALISEES' && m.status !== 'TERMINEE') return false;
      if (activeTab === 'PLANIFIEES' && (m.status === 'TERMINEE' || m.status === 'ANNULEE')) return false;
      if (activeTab === 'GTT' && m.meeting_type !== 'GTT') return false;
      if (activeTab === 'COORDINATION' && m.meeting_type !== 'COORDINATION') return false;
      if (activeTab === 'INSTITUTIONNELLE' && m.meeting_type !== 'INSTITUTIONNELLE') return false;

      // Select filters
      if (selectedType !== 'ALL' && m.meeting_type !== selectedType) return false;
      if (selectedOrgType === 'INTERNAL' && m.organization_type === 'EXTERNAL') return false;
      if (selectedOrgType === 'EXTERNAL' && m.organization_type !== 'EXTERNAL' && !m.organizing_structure) return false;
      if (selectedFormat !== 'ALL' && m.format !== selectedFormat) return false;
      if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false;
      if (selectedMilestone !== 'ALL' && m.milestone !== selectedMilestone) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (m.title || '').toLowerCase().includes(query);
        const matchesLocation = (m.location || '').toLowerCase().includes(query);
        const matchesOrganizer = (m.organizer_name || '').toLowerCase().includes(query);
        const matchesOrgStructure = (m.organizing_structure || '').toLowerCase().includes(query);
        const matchesAgenda = (m.agenda || '').toLowerCase().includes(query);
        const matchesExt = (m.external_participants || []).some(p => 
          (p?.name || '').toLowerCase().includes(query) || (p?.organization || '').toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesLocation && !matchesOrganizer && !matchesOrgStructure && !matchesAgenda && !matchesExt) return false;
      }

      return true;
    });
  }, [meetings, activeTab, selectedType, selectedOrgType, selectedFormat, selectedStatus, selectedMilestone, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = meetings.length;
    const completedCount = meetings.filter(m => m.status === 'TERMINEE').length;
    const plannedCount = meetings.filter(m => m.status !== 'TERMINEE' && m.status !== 'ANNULEE').length;
    const gttCount = meetings.filter(m => m.meeting_type === 'GTT').length;
    const coordCount = meetings.filter(m => m.meeting_type === 'COORDINATION').length;
    const instCount = meetings.filter(m => m.meeting_type === 'INSTITUTIONNELLE' || m.meeting_type === 'COMITE_PILOTAGE').length;
    const internalOrgCount = meetings.filter(m => (m.organization_type || 'INTERNAL') === 'INTERNAL' && !m.organizing_structure).length;
    const externalOrgCount = meetings.filter(m => m.organization_type === 'EXTERNAL' || Boolean(m.organizing_structure)).length;
    const presentielCount = meetings.filter(m => m.format === 'PRESENTIEL').length;
    const enLigneCount = meetings.filter(m => m.format === 'EN_LIGNE').length;
    const totalPhotos = meetings.reduce((sum, m) => sum + (m.photos ? m.photos.length : 0), 0);

    return { total, completedCount, plannedCount, gttCount, coordCount, instCount, internalOrgCount, externalOrgCount, presentielCount, enLigneCount, totalPhotos };
  }, [meetings]);

  // Open creation modal
  const handleOpenCreateModal = () => {
    const currentUserId = currentUser?.id || 'usr-dir';
    const currentUserName = currentUser?.full_name || 'Direction SaniNova';
    setEditingMeeting(null);
    setFormData({
      title: '',
      meeting_type: 'GTT',
      format: 'PRESENTIEL',
      location: '',
      online_link: '',
      session_date: '',
      start_time: '',
      end_time: '',
      milestone: 'B13',
      work_plan_code: '',
      organization_type: 'INTERNAL',
      organizing_structure: '',
      organizer_id: currentUserId,
      organizer_name: currentUserName,
      objectives: '',
      agenda: '',
      agenda_mode: 'TEXT',
      agenda_attachment_name: '',
      agenda_attachment_url: '',
      agenda_attachment_size_kb: undefined,
      report_attachment_name: '',
      report_attachment_url: '',
      report_attachment_size_kb: undefined,
      status: 'PLANIFIEE',
      internal_participants_ids: [currentUserId],
      external_participants: [],
      summary_report: '',
      decisions: [],
      pv_attachment_name: '',
      pv_attachment_url: '',
      photos: [],
    });
    setFormModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (meet: MeetingSession) => {
    setEditingMeeting(meet);
    setFormData({
      ...meet,
      organization_type: meet.organization_type || (meet.organizing_structure ? 'EXTERNAL' : 'INTERNAL'),
      organizing_structure: meet.organizing_structure || '',
      agenda_mode: meet.agenda_mode || (meet.agenda_attachment_name ? 'ATTACHMENT' : 'TEXT'),
      internal_participants_ids: meet.internal_participants_ids || [],
      external_participants: meet.external_participants || [],
      decisions: meet.decisions || [],
      photos: meet.photos || [],
    });
    setFormModalOpen(true);
  };

  // Save meeting (create or update)
  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.title?.trim()) {
        alert('Veuillez renseigner le titre / objet de la séance.');
        return;
      }

      const isExternal = formData.organization_type === 'EXTERNAL';
      const organizingStructure = isExternal ? (formData.organizing_structure || '').trim() : '';

      if (isExternal && !organizingStructure) {
        alert('Veuillez renseigner le nom de la structure organisatrice de la séance.');
        return;
      }

      const organizerObj = (users && users.find(u => u.id === formData.organizer_id)) || currentUser || { id: 'usr-dir', full_name: 'Direction SaniNova' };
      const safeInternalIds = formData.internal_participants_ids && formData.internal_participants_ids.length > 0
        ? formData.internal_participants_ids
        : (currentUser?.id ? [currentUser.id] : ['usr-dir']);

      // Si l'agenda a une pièce jointe mais pas de texte rédigé, mettre une note automatique
      let finalAgenda = (formData.agenda || '').trim();
      if (!finalAgenda && formData.agenda_attachment_name) {
        finalAgenda = `[Document d’agenda joint : ${formData.agenda_attachment_name}]`;
      }

      const payload: MeetingSession = {
        id: editingMeeting ? editingMeeting.id : `meet-${Date.now()}`,
        title: formData.title.trim(),
        meeting_type: formData.meeting_type || 'GTT',
        format: formData.format || 'PRESENTIEL',
        location: formData.format !== 'EN_LIGNE' ? (formData.location || '').trim() : '',
        online_link: formData.format !== 'PRESENTIEL' ? (formData.online_link || '').trim() : '',
        session_date: formData.session_date || new Date().toISOString().substring(0, 10),
        start_time: formData.start_time || '09:00',
        end_time: formData.end_time || '12:00',
        milestone: formData.milestone,
        work_plan_code: formData.work_plan_code,
        organization_type: isExternal ? 'EXTERNAL' : 'INTERNAL',
        organizing_structure: organizingStructure,
        organizer_id: organizerObj.id,
        organizer_name: organizerObj.full_name,
        objectives: (formData.objectives || '').trim(),
        agenda: finalAgenda,
        agenda_mode: formData.agenda_mode || 'TEXT',
        agenda_attachment_name: formData.agenda_attachment_name,
        agenda_attachment_url: formData.agenda_attachment_url,
        agenda_attachment_size_kb: formData.agenda_attachment_size_kb,
        status: formData.status || 'PLANIFIEE',
        internal_participants_ids: safeInternalIds,
        external_participants: formData.external_participants || [],
        summary_report: (formData.summary_report || '').trim(),
        report_attachment_name: formData.report_attachment_name,
        report_attachment_url: formData.report_attachment_url,
        report_attachment_size_kb: formData.report_attachment_size_kb,
        decisions: formData.decisions || [],
        pv_attachment_name: (formData.pv_attachment_name || '').trim(),
        pv_attachment_url: formData.pv_attachment_url,
        photos: formData.photos || [],
        created_at: editingMeeting ? editingMeeting.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (editingMeeting) {
        updateMeeting(payload);
      } else {
        addMeeting(payload);
      }

      setFormModalOpen(false);
    } catch (err: any) {
      console.error('Erreur enregistrement séance:', err);
      alert('Une erreur est survenue lors de l’enregistrement de la séance : ' + (err?.message || err));
    }
  };

  // Add external participant
  const handleAddExternalParticipant = () => {
    if (!newExtPart.name?.trim()) return;
    const p: MeetingParticipant = {
      id: `ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newExtPart.name.trim(),
      organization: (newExtPart.organization || 'Partenaire').trim(),
      role_title: (newExtPart.role_title || '').trim(),
      email: (newExtPart.email || '').trim(),
      phone: (newExtPart.phone || '').trim(),
      is_internal: false,
      present: newExtPart.present !== undefined ? newExtPart.present : true,
    };

    setFormData(prev => ({
      ...prev,
      external_participants: [...(prev.external_participants || []), p],
    }));

    setNewExtPart({ name: '', organization: '', role_title: '', email: '', phone: '', present: true });
  };

  // Remove external participant
  const handleRemoveExternalParticipant = (id: string) => {
    setFormData(prev => ({
      ...prev,
      external_participants: (prev.external_participants || []).filter(p => p.id !== id),
    }));
  };

  // Add decision
  const handleAddDecision = () => {
    if (!newDecision.description?.trim()) return;
    const d: MeetingDecision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      description: newDecision.description.trim(),
      responsible: (newDecision.responsible || 'Non assigné').trim(),
      deadline: newDecision.deadline || '',
      status: newDecision.status || 'A_FAIRE',
    };

    setFormData(prev => ({
      ...prev,
      decisions: [...(prev.decisions || []), d],
    }));

    setNewDecision({ description: '', responsible: '', deadline: '', status: 'A_FAIRE' });
  };

  // Remove decision
  const handleRemoveDecision = (id: string) => {
    setFormData(prev => ({
      ...prev,
      decisions: (prev.decisions || []).filter(d => d.id !== id),
    }));
  };

  // Add photo
  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    const photo: MeetingPhoto = {
      id: `pho-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: newPhotoUrl.trim(),
      caption: (newPhotoCaption || 'Photo de la séance').trim(),
      taken_at: formData.session_date || new Date().toISOString().substring(0, 10),
    };

    setFormData(prev => ({
      ...prev,
      photos: [...(prev.photos || []), photo],
    }));

    setNewPhotoUrl('');
    setNewPhotoCaption('');
  };

  // Remove photo
  const handleRemovePhoto = (id: string) => {
    setFormData(prev => ({
      ...prev,
      photos: (prev.photos || []).filter(p => p.id !== id),
    }));
  };

  // Handle file input for local photo loading with compression (Base64)
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageFile(file);
      if (compressedDataUrl) {
        const photo: MeetingPhoto = {
          id: `pho-${Date.now()}`,
          url: compressedDataUrl,
          caption: newPhotoCaption.trim() || file.name,
          taken_at: formData.session_date || new Date().toISOString().substring(0, 10),
        };
        setFormData(prev => ({
          ...prev,
          photos: [...(prev.photos || []), photo],
        }));
        setNewPhotoCaption('');
      }
    } catch (err) {
      console.error('Erreur compression photo:', err);
    }
  };

  // Handle file input for Agenda attachment
  const handleAgendaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Le fichier sélectionné est volumineux (> 5 Mo). Veuillez choisir un fichier compressé.');
      return;
    }

    try {
      const { dataUrl, sizeKb, name } = await readFileAsDataUrl(file);
      setFormData(prev => ({
        ...prev,
        agenda_attachment_name: name,
        agenda_attachment_url: dataUrl,
        agenda_attachment_size_kb: sizeKb,
        agenda: prev.agenda?.trim() ? prev.agenda : `[Agenda joint : ${name}]`,
      }));
    } catch (err) {
      console.error('Erreur lecture fichier agenda:', err);
      alert('Impossible de charger ce fichier.');
    }
  };

  // Handle file input for Meeting Report attachment
  const handleReportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Le fichier sélectionné est volumineux (> 5 Mo). Veuillez choisir un fichier compressé.');
      return;
    }

    try {
      const { dataUrl, sizeKb, name } = await readFileAsDataUrl(file);
      setFormData(prev => ({
        ...prev,
        report_attachment_name: name,
        report_attachment_url: dataUrl,
        report_attachment_size_kb: sizeKb,
      }));
    } catch (err) {
      console.error('Erreur lecture rapport de séance:', err);
      alert('Impossible de charger ce fichier.');
    }
  };

  // Handle file input for Official PV attachment
  const handlePvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Le fichier sélectionné est volumineux (> 5 Mo). Veuillez choisir un fichier compressé.');
      return;
    }

    try {
      const { dataUrl, name } = await readFileAsDataUrl(file);
      setFormData(prev => ({
        ...prev,
        pv_attachment_name: name,
        pv_attachment_url: dataUrl,
      }));
    } catch (err) {
      console.error('Erreur lecture PV:', err);
      alert('Impossible de charger ce fichier.');
    }
  };

  // Export meetings table to Excel
  const handleExportExcel = () => {
    const data = filteredMeetings.map(m => ({
      'Type de séance': MEETING_TYPE_LABELS[m.meeting_type]?.label || m.meeting_type,
      'Objet / Titre': m.title,
      Format: FORMAT_LABELS[m.format]?.label || m.format,
      Lieu: m.location || m.online_link || 'Non précisé',
      Date: m.session_date,
      Horaires: `${m.start_time} - ${m.end_time}`,
      Jalon: m.milestone || 'N/A',
      'Activité Work Plan': m.work_plan_code || 'N/A',
      'Initiative / Organisation': m.organization_type === 'EXTERNAL' || m.organizing_structure ? 'Organisée par autre structure' : 'Organisée par SaniNova',
      'Structure Organisatrice': m.organizing_structure || 'SaniNova',
      'Modérateur / Point focal': m.organizer_name,
      'Participants Internes': (m.internal_participants_ids || []).map(id => users.find(u => u.id === id)?.full_name).filter(Boolean).join(', '),
      'Participants Externes': (m.external_participants || []).map(p => `${p.name} (${p.organization})`).join(', '),
      Statut: STATUS_LABELS[m.status]?.label || m.status,
      'Décisions / Actions': (m.decisions || []).map(d => `${d.description} [Resp: ${d.responsible}]`).join(' | '),
    }));

    exportToExcel(data, `SANINOVA_Registre_Seances_Reunions_${new Date().toISOString().substring(0, 10)}`);
  };

  // Export meeting summary to PDF
  const handleExportPdfList = () => {
    const headers = ['Type', 'Objet / Titre de la séance', 'Format', 'Lieu / Lien', 'Date & Heure', 'Organisateur', 'Statut'];
    const rows = filteredMeetings.map(m => [
      MEETING_TYPE_LABELS[m.meeting_type]?.label || m.meeting_type,
      m.title.length > 40 ? m.title.substring(0, 40) + '...' : m.title,
      FORMAT_LABELS[m.format]?.label || m.format,
      m.format === 'EN_LIGNE' ? 'Visio en ligne' : (m.location ? m.location.substring(0, 25) : '-'),
      `${m.session_date} (${m.start_time})`,
      m.organizer_name.split(' ')[0] + ' ' + (m.organizer_name.split(' ')[1] || ''),
      STATUS_LABELS[m.status]?.label || m.status,
    ]);

    exportTableToPdf(
      'Registre Officiel des Séances & Réunions Techniques (GTT, Coordination, Partenaires)',
      headers,
      rows,
      `SANINOVA_Seances_Reunions_${new Date().toISOString().substring(0, 10)}`,
      `Total : ${filteredMeetings.length} séance(s) répertoriée(s) — Projet AFGHS PSI Bénin`
    );
  };

  // Export Single Meeting PV as official PDF document
  const handleExportSingleMeetingPdf = (m: MeetingSession) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // En-tête officiel
    doc.setFillColor(15, 118, 110); // Teal 700
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('SANINOVA PROJECT HUB — PROJET AFGHS-PSI BÉNIN', 14, 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('PROCÈS-VERBAL OFFICIEL & COMPTE-RENDU DE SÉANCE TECHNIQUE', 14, 17);

    // Titre de la séance
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(m.title, 14, 34);

    // Cartouche d'informations
    autoTable(doc, {
      startY: 40,
      theme: 'grid',
      head: [['Paramètre', 'Détails de la séance']],
      body: [
        ['Type de séance', MEETING_TYPE_LABELS[m.meeting_type]?.label || m.meeting_type],
        ['Format & Modalité', `${FORMAT_LABELS[m.format]?.label || m.format} — ${m.format === 'EN_LIGNE' ? (m.online_link || 'Lien visio') : (m.location || 'Sur site')}`],
        ['Date & Horaires', `${m.session_date} de ${m.start_time} à ${m.end_time}`],
        ['Jalon & Activité Work Plan', `${m.milestone || 'N/A'} — ${m.work_plan_code || 'Activité transversale'}`],
        [
          'Initiateur & Modérateur',
          m.organization_type === 'EXTERNAL' || m.organizing_structure
            ? `Organisée par : ${m.organizing_structure || 'Structure externe'} (Point focal SaniNova : ${m.organizer_name})`
            : `Organisée par : SaniNova (Modérateur : ${m.organizer_name})`
        ],
        ['Statut officiel', STATUS_LABELS[m.status]?.label || m.status],
      ],
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 8;

    // Ordre du jour
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('1. ORDRE DU JOUR & OBJECTIFS', 14, currentY);
    currentY += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const splitAgenda = doc.splitTextToSize(m.agenda || 'Aucun ordre du jour renseigné.', 180);
    doc.text(splitAgenda, 14, currentY);
    currentY += splitAgenda.length * 4.5 + 6;

    // Compte-rendu
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('2. COMPTE-RENDU DES DÉBATS & SYNTHÈSE', 14, currentY);
    currentY += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const splitSummary = doc.splitTextToSize(m.summary_report || 'Synthèse des travaux en cours de finalisation.', 180);
    doc.text(splitSummary, 14, currentY);
    currentY += splitSummary.length * 4.5 + 6;

    // Décisions & Recommandations
    if (m.decisions && m.decisions.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 118, 110);
      doc.text('3. DÉCISIONS, RECOMMANDATIONS & PLAN D’ACTION', 14, currentY);
      currentY += 3;

      const decRows = m.decisions.map((d, i) => [
        `${i + 1}`,
        d.description,
        d.responsible,
        d.deadline || 'Immédiat',
        d.status === 'FAIT' ? 'Réalisé' : (d.status === 'EN_COURS' ? 'En cours' : 'À faire')
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Action / Décision retenue', 'Responsable', 'Échéance', 'Statut']],
        body: decRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 }, 4: { cellWidth: 22 } },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Participants (Émargement)
    const internalNames = (m.internal_participants_ids || [])
      .map(id => users.find(u => u.id === id)?.full_name)
      .filter((name): name is string => Boolean(name));
    const externalList = (m.external_participants || []).map(p => `${p.name} (${p.organization}${p.role_title ? ' - ' + p.role_title : ''})`);

    const participantsRows: string[][] = [
      ...internalNames.map(name => ['Équipe SaniNova', name, 'Présent(e)']),
      ...externalList.map(name => ['Partenaire Extérieur', name, 'Présent(e)']),
    ];

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('4. LISTE D’ÉMARGEMENT DES PARTICIPANTS', 14, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Catégorie', 'Nom & Titre / Institution', 'Émargement']],
      body: participantsRows.length > 0 ? participantsRows : [['-', 'Aucun participant enregistré', '-']],
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    // Signature footer
    const finalY = (doc as any).lastAutoTable.finalY + 12;
    if (finalY < 265) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Le Modérateur / Organisateur de séance :', 14, finalY);
      doc.text('La Direction du Projet SaniNova :', 130, finalY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(m.organizer_name, 14, finalY + 6);
      doc.text('Dr Hope AKOHOUVI AMOU', 130, finalY + 6);
    }

    doc.save(`PV_Seance_${m.id}_${m.session_date}.pdf`);
  };

  return (
    <ModuleGuard moduleId="seances">
      <div className="space-y-6 font-sans">
        
        {/* EN-TÊTE PRINCIPAL */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-teal-500/30 text-teal-200 border border-teal-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Module 10 &bull; Gouvernance & Coordination
                </span>
                <span className="bg-white/10 text-white/90 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  GTT, Coordination, Comités & Ateliers
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
                Séances & Réunions Officielles
              </h1>
              <p className="text-teal-100/90 text-sm mt-1 max-w-2xl leading-relaxed">
                Planification, traçabilité des participants, procès-verbaux (PV), gestion des ordres du jour, décisions clés et galerie photos des sessions en présentiel et en visio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition flex items-center space-x-1.5 shadow-xs"
              >
                <span>📊</span>
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdfList}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition flex items-center space-x-1.5 shadow-xs"
              >
                <span>📄</span>
                <span>Registre PDF</span>
              </button>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                <span className="text-base font-bold">+</span>
                <span>Planifier une Séance</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARTES DE STATISTIQUES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center space-x-1">
              <span>✅</span>
              <span>Déjà Réalisées</span>
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{stats.completedCount}</div>
            <span className="text-[10px] text-emerald-700 font-medium">PV & rapports validés</span>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-blue-800 uppercase flex items-center space-x-1">
              <span>📅</span>
              <span>Planifiées</span>
            </span>
            <div className="text-2xl font-black text-blue-900 mt-1">{stats.plannedCount}</div>
            <span className="text-[10px] text-blue-700 font-medium">À venir / En cours</span>
          </div>

          <div className="bg-white rounded-xl border border-indigo-200 bg-indigo-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-indigo-800 uppercase">Groupes GTT</span>
            <div className="text-2xl font-black text-indigo-900 mt-1">{stats.gttCount}</div>
            <span className="text-[10px] text-indigo-700 font-medium">B13 Quantif & eSIGL</span>
          </div>

          <div className="bg-white rounded-xl border border-teal-200 bg-teal-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-teal-800 uppercase">Coordination</span>
            <div className="text-2xl font-black text-teal-900 mt-1">{stats.coordCount}</div>
            <span className="text-[10px] text-teal-700 font-medium">Équipe SaniNova</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Présentiel / Visio</span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {stats.presentielCount} <span className="text-xs text-slate-400 font-medium">site</span> / {stats.enLigneCount} <span className="text-xs text-slate-400 font-medium">visio</span>
            </div>
            <span className="text-[10px] text-teal-800 font-medium">Formats de réunion</span>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-800 uppercase">Clichés Photos</span>
            <div className="text-2xl font-black text-amber-900 mt-1">{stats.totalPhotos}</div>
            <span className="text-[10px] text-amber-700 font-medium">Justificatifs visuels</span>
          </div>
        </div>

        {/* ONGLET DE NAVIGATION SECONDAIRE & COMMUTATEUR DE VUE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 items-center">
            <button
              type="button"
              onClick={() => setActiveTab('REALISEES')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'REALISEES'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>✅</span>
              <span>Séances Déjà Réalisées ({stats.completedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'ALL'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📋</span>
              <span>Toutes ({meetings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PLANIFIEES')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'PLANIFIEES'
                  ? 'bg-blue-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📅</span>
              <span>À Venir ({stats.plannedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('GTT')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'GTT'
                  ? 'bg-indigo-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🔬</span>
              <span>GTT ({stats.gttCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('COORDINATION')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'COORDINATION'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🤝</span>
              <span>Coordination ({stats.coordCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PHOTOS')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'PHOTOS'
                  ? 'bg-amber-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>📸</span>
              <span>Photos ({stats.totalPhotos})</span>
            </button>
          </div>

          {/* Commutateur Mode Tableau / Cartes */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'TABLE'
                  ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vue Tableau fluide, compacte et rapide"
            >
              <span>📑</span>
              <span>Vue Tableau</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'CARDS'
                  ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vue Cartes détaillées"
            >
              <span>🗂️</span>
              <span>Vue Cartes</span>
            </button>
          </div>
        </div>

        {/* FILTRES & RECHERCHE */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Recherche mot-clé :</label>
              <input
                type="text"
                placeholder="Titre, participant, structure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Type de réunion :</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les types</option>
                <option value="GTT">GTT (Groupe Technique)</option>
                <option value="COORDINATION">Réunion de Coordination</option>
                <option value="COMITE_PILOTAGE">Comité de Pilotage</option>
                <option value="INSTITUTIONNELLE">Rencontre Institutionnelle</option>
                <option value="ATELIER">Atelier Technique</option>
                <option value="AUTRE">Autre séance</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Organisation :</label>
              <select
                value={selectedOrgType}
                onChange={(e) => setSelectedOrgType(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les initiateurs</option>
                <option value="INTERNAL">🏛️ Organisées par nous (SaniNova)</option>
                <option value="EXTERNAL">🏢 Organisées par autre structure</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Format de séance :</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les formats</option>
                <option value="PRESENTIEL">📍 Présentiel</option>
                <option value="EN_LIGNE">💻 En ligne (Visio)</option>
                <option value="HYBRIDE">🌐 Hybride (Mixte)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Jalon du projet :</label>
              <select
                value={selectedMilestone}
                onChange={(e) => setSelectedMilestone(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les jalons</option>
                <option value="B09">B09 - Promptitude eSIGL</option>
                <option value="B13">B13 - Quantification & Appro</option>
                <option value="TRANSVERSAL">Transversal / Coordination</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Statut :</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PLANIFIEE">Planifiée</option>
                <option value="EN_COURS">En cours</option>
                <option value="TERMINEE">Terminée (PV dispo)</option>
                <option value="REPORTEE">Reportée</option>
                <option value="ANNULEE">Annulée</option>
              </select>
            </div>
          </div>
        </div>

        {/* CONTENU PRINCIPAL : LISTE OU GALERIE PHOTOS */}
        {activeTab === 'PHOTOS' ? (
          /* VUE GALERIE PHOTOS */
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Galerie Photographique & Justificatifs des Séances
              </h2>
              <p className="text-xs text-slate-500">
                Photos des travaux en commission GTT, ateliers présentiels et captures de sessions de coordination en ligne.
              </p>
            </div>

            {stats.totalPhotos === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Aucune photo enregistrée pour le moment. Vous pouvez en ajouter lors de la création ou l’édition d’une séance.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {meetings.flatMap(m => (m.photos || []).map(p => ({ ...p, meetingTitle: m.title, meetingDate: m.session_date }))).map(photo => (
                  <div
                    key={photo.id}
                    onClick={() => setPreviewPhoto(photo)}
                    className="group relative bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:shadow-md transition"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-slate-200">
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          // fallback
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                    </div>
                    <div className="p-3 bg-white">
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">{photo.caption}</p>
                      <p className="text-[10px] text-teal-800 font-medium mt-0.5 line-clamp-1">{photo.meetingTitle}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">{photo.meetingDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* VUE LISTE DES SÉANCES */
          <div className="space-y-4">
            {/* Barre de contrôle du résumé des résultats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">
                  {filteredMeetings.length} séance{filteredMeetings.length > 1 ? 's' : ''} affichée{filteredMeetings.length > 1 ? 's' : ''}
                </span>
                <span>&bull;</span>
                <span className="text-teal-800 font-medium">
                  {activeTab === 'REALISEES' && 'Filtre : Séances Déjà Réalisées (PV disponibles)'}
                  {activeTab === 'PLANIFIEES' && 'Filtre : Séances Planifiées / À venir'}
                  {activeTab === 'ALL' && 'Filtre : Toutes les Séances'}
                  {activeTab === 'GTT' && 'Filtre : Groupes Techniques GTT'}
                  {activeTab === 'COORDINATION' && 'Filtre : Réunions de Coordination'}
                  {activeTab === 'INSTITUTIONNELLE' && 'Filtre : Rencontres Institutionnelles'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Mode d’affichage actif : <span className="font-bold text-slate-700">{viewMode === 'TABLE' ? '📑 Vue Tableau' : '🗂️ Vue Cartes'}</span>
              </div>
            </div>

            {filteredMeetings.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 space-y-3 shadow-xs">
                <span className="text-4xl">🔍</span>
                <p className="text-sm font-semibold text-slate-700">Aucune séance ne correspond aux critères de recherche sélectionnés.</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Vérifiez le filtre par statut ou réinitialisez les filtres pour retrouver toutes les séances enregistrées.
                </p>
                <button
                  type="button"
                  onClick={() => { setSelectedType('ALL'); setSelectedFormat('ALL'); setSelectedStatus('ALL'); setSelectedMilestone('ALL'); setSearchQuery(''); setActiveTab('ALL'); }}
                  className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold hover:bg-teal-900 transition shadow-xs"
                >
                  Afficher toutes les séances
                </button>
              </div>
            ) : viewMode === 'TABLE' ? (
              /* VUE TABLEAU FLUIDE & COMPACTE AVEC BOUTONS EXPLICITES VOIR, MODIFIER, SUPPRIMER */
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4 whitespace-nowrap">Date & Horaires</th>
                        <th className="py-3 px-4 min-w-[260px]">Objet & Type de Séance</th>
                        <th className="py-3 px-4 min-w-[180px]">Format & Lieu / Visio</th>
                        <th className="py-3 px-4 whitespace-nowrap">Organisateur</th>
                        <th className="py-3 px-4 whitespace-nowrap">Participants</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">Statut / PV</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap min-w-[270px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredMeetings.map(m => {
                        const typeMeta = MEETING_TYPE_LABELS[m.meeting_type] || MEETING_TYPE_LABELS.AUTRE;
                        const formatMeta = FORMAT_LABELS[m.format] || FORMAT_LABELS.PRESENTIEL;
                        const statusMeta = STATUS_LABELS[m.status] || STATUS_LABELS.PLANIFIEE;
                        const internalNames = (m.internal_participants_ids || [])
                          .map(id => users.find(u => u.id === id)?.full_name)
                          .filter(Boolean);
                        const totalParticipants = internalNames.length + (m.external_participants || []).length;

                        return (
                          <tr key={m.id} className="hover:bg-teal-50/20 transition group">
                            {/* Date & Heure */}
                            <td className="py-3 px-4 whitespace-nowrap align-top">
                              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                <span>📅</span>
                                <span>{m.session_date}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                🕒 {m.start_time} - {m.end_time}
                              </div>
                            </td>

                            {/* Objet & Type */}
                            <td className="py-3 px-4 align-top">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${typeMeta.badge}`}>
                                  {typeMeta.icon} {typeMeta.label}
                                </span>
                                {m.milestone && (
                                  <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                    Jalon {m.milestone}
                                  </span>
                                )}
                              </div>
                              <p className="font-bold text-slate-900 leading-snug">
                                {m.title}
                              </p>
                              {m.objectives && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                  &laquo; {m.objectives} &raquo;
                                </p>
                              )}
                              {m.decisions && m.decisions.length > 0 && (
                                <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  <span>✅</span>
                                  <span>{m.decisions.length} décision(s) actée(s)</span>
                                </span>
                              )}
                            </td>

                            {/* Format & Lieu / Visio */}
                            <td className="py-3 px-4 align-top">
                              <div className="mb-1">
                                <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${formatMeta.badge}`}>
                                  <span>{formatMeta.icon}</span>
                                  <span>{formatMeta.label}</span>
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-700 truncate max-w-xs font-medium">
                                {m.format === 'EN_LIGNE' ? (
                                  m.online_link ? (
                                    <a
                                      href={m.online_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-teal-800 hover:underline flex items-center space-x-1"
                                      title={m.online_link}
                                    >
                                      <span>🔗</span>
                                      <span className="truncate">Lien réunion en ligne</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 italic">Lien non défini</span>
                                  )
                                ) : (
                                  <span title={m.location}>📍 {m.location || 'Sur site'}</span>
                                )}
                              </div>
                            </td>

                            {/* Organisateur */}
                            <td className="py-3 px-4 whitespace-nowrap align-top font-medium text-slate-800">
                              {m.organization_type === 'EXTERNAL' || m.organizing_structure ? (
                                <div>
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                                    <span>🏢</span>
                                    <span>{m.organizing_structure || 'Autre structure'}</span>
                                  </span>
                                  <div className="text-[10px] text-slate-500 mt-1 flex items-center space-x-1">
                                    <span>👤</span>
                                    <span>Point focal : {m.organizer_name}</span>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200">
                                    <span>🏛️</span>
                                    <span>SaniNova</span>
                                  </span>
                                  <div className="text-[10px] text-slate-500 mt-1 flex items-center space-x-1">
                                    <span>👤</span>
                                    <span>{m.organizer_name}</span>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Participants */}
                            <td className="py-3 px-4 whitespace-nowrap align-top">
                              <div className="font-bold text-slate-800">
                                👥 {totalParticipants} participant{totalParticipants > 1 ? 's' : ''}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {internalNames.length} internes &bull; {(m.external_participants || []).length} partenaires
                              </div>
                            </td>

                            {/* Statut / Documents */}
                            <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                              <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusMeta.badge}`}>
                                {statusMeta.label}
                              </span>
                              <div className="flex flex-col items-center gap-0.5 mt-1">
                                {m.agenda_attachment_name && (
                                  <div className="text-[10px] text-teal-700 font-medium truncate max-w-[140px]" title={`Agenda : ${m.agenda_attachment_name}`}>
                                    📎 Agenda joint
                                  </div>
                                )}
                                {m.report_attachment_name && (
                                  <div className="text-[10px] text-sky-700 font-medium truncate max-w-[140px]" title={`Rapport : ${m.report_attachment_name}`}>
                                    📄 Rapport joint
                                  </div>
                                )}
                                {m.pv_attachment_name && (
                                  <div className="text-[10px] text-indigo-700 font-medium truncate max-w-[140px]" title={`PV : ${m.pv_attachment_name}`}>
                                    📜 PV scanné
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* ACTIONS : VOIR, MODIFIER, SUPPRIMER, PDF */}
                            <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                              <div className="flex items-center justify-center space-x-1.5">
                                {/* Bouton VOIR */}
                                <button
                                  type="button"
                                  onClick={() => setViewModalMeeting(m)}
                                  className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-300 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Voir le procès-verbal, la liste des participants et les décisions"
                                >
                                  <span>👁️</span>
                                  <span>Voir</span>
                                </button>

                                {/* Bouton MODIFIER */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(m)}
                                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Modifier les détails de cette séance"
                                >
                                  <span>✏️</span>
                                  <span>Modifier</span>
                                </button>

                                {/* Bouton SUPPRIMER */}
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(m.id)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-300 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Supprimer cette séance"
                                >
                                  <span>🗑️</span>
                                  <span>Supprimer</span>
                                </button>

                                {/* Bouton PDF */}
                                <button
                                  type="button"
                                  onClick={() => handleExportSingleMeetingPdf(m)}
                                  className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Télécharger le PV officiel en PDF"
                                >
                                  <span>📄</span>
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* VUE CARTES AVEC BOUTONS EXPLICITES VOIR, MODIFIER, SUPPRIMER */
              <div className="grid grid-cols-1 gap-4">
                {filteredMeetings.map(m => {
                  const typeMeta = MEETING_TYPE_LABELS[m.meeting_type] || MEETING_TYPE_LABELS.AUTRE;
                  const formatMeta = FORMAT_LABELS[m.format] || FORMAT_LABELS.PRESENTIEL;
                  const statusMeta = STATUS_LABELS[m.status] || STATUS_LABELS.PLANIFIEE;

                  const internalNames = (m.internal_participants_ids || [])
                    .map(id => users.find(u => u.id === id)?.full_name)
                    .filter(Boolean);

                  return (
                    <div
                      key={m.id}
                      className="bg-white rounded-xl border border-slate-200 hover:border-teal-600 transition shadow-xs hover:shadow-sm p-5 space-y-4"
                    >
                      {/* En-tête de la séance */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${typeMeta.badge}`}>
                              {typeMeta.icon} {typeMeta.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${formatMeta.badge}`}>
                              {formatMeta.icon} {formatMeta.label}
                            </span>
                            {m.milestone && (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                Jalon {m.milestone} {m.work_plan_code ? `(${m.work_plan_code})` : ''}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {m.title}
                          </h3>

                          {m.objectives && (
                            <p className="text-xs text-slate-600 italic">
                              &laquo; {m.objectives} &raquo;
                            </p>
                          )}
                        </div>

                        {/* Actions boutons explicites */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end md:self-start">
                          <button
                            type="button"
                            onClick={() => setViewModalMeeting(m)}
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-300 transition flex items-center space-x-1.5 shadow-2xs hover:shadow-xs"
                            title="Consulter le procès-verbal, les participants et les détails"
                          >
                            <span>👁️</span>
                            <span>Voir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition flex items-center space-x-1.5 shadow-2xs hover:shadow-xs"
                            title="Modifier cette séance"
                          >
                            <span>✏️</span>
                            <span>Modifier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(m.id)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-300 transition flex items-center space-x-1.5 shadow-2xs hover:shadow-xs"
                            title="Supprimer cette séance"
                          >
                            <span>🗑️</span>
                            <span>Supprimer</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSingleMeetingPdf(m)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                            title="Télécharger le PV officiel en PDF"
                          >
                            <span>📄</span>
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Grille des caractéristiques */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Date & Horaires :</span>
                          <span className="font-semibold text-slate-800">
                            📅 {m.session_date} &bull; {m.start_time} - {m.end_time}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Lieu / Visioconférence :</span>
                          {m.format === 'EN_LIGNE' ? (
                            m.online_link ? (
                              <a
                                href={m.online_link}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-teal-800 hover:underline flex items-center space-x-1 truncate"
                              >
                                <span>🔗 Lien Visio</span>
                                <span className="text-[10px] text-slate-400">(Ouvrir)</span>
                              </a>
                            ) : (
                              <span className="text-slate-500 italic">Lien non communiqué</span>
                            )
                          ) : (
                            <span className="font-semibold text-slate-800 truncate block">
                              📍 {m.location || 'Sur site'}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            {m.organization_type === 'EXTERNAL' || m.organizing_structure ? 'Structure organisatrice :' : 'Organisateur / Modérateur :'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {m.organization_type === 'EXTERNAL' || m.organizing_structure ? (
                              <span className="text-amber-900 font-bold block truncate" title={`Point focal : ${m.organizer_name}`}>
                                🏢 {m.organizing_structure || 'Autre structure'} <span className="text-[10px] text-slate-500 font-normal">({m.organizer_name})</span>
                              </span>
                            ) : (
                              <span>🏛️ SaniNova &bull; 👤 {m.organizer_name}</span>
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Participants Total :</span>
                          <span className="font-semibold text-slate-800">
                            👥 {internalNames.length} internes &bull; {(m.external_participants || []).length} partenaires
                          </span>
                        </div>
                      </div>

                      {/* Équipe et partenaires badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Présents :</span>
                        {internalNames.slice(0, 4).map((name, i) => (
                          <span key={i} className="text-[11px] bg-teal-50 text-teal-900 border border-teal-200 px-2 py-0.5 rounded-full font-medium">
                            {name}
                          </span>
                        ))}
                        {internalNames.length > 4 && (
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            +{internalNames.length - 4} autres
                          </span>
                        )}

                        {(m.external_participants || []).slice(0, 3).map((p) => (
                          <span key={p.id} className="text-[11px] bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                            {p.name} ({p.organization})
                          </span>
                        ))}
                        {(m.external_participants || []).length > 3 && (
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            +{(m.external_participants || []).length - 3} externes
                          </span>
                        )}
                      </div>

                      {/* Extrait des décisions et photos si disponibles */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                        <div className="flex flex-wrap items-center gap-3">
                          {m.decisions && m.decisions.length > 0 && (
                            <span className="flex items-center space-x-1 text-emerald-800 font-bold">
                              <span>✅</span>
                              <span>{m.decisions.length} décision(s) actée(s)</span>
                            </span>
                          )}
                          {m.agenda_attachment_name && (
                            <span className="flex items-center space-x-1 text-teal-800 font-semibold" title={m.agenda_attachment_name}>
                              <span>📎</span>
                              <span className="truncate max-w-[120px]">Agenda</span>
                            </span>
                          )}
                          {m.report_attachment_name && (
                            <span className="flex items-center space-x-1 text-sky-800 font-semibold" title={m.report_attachment_name}>
                              <span>📄</span>
                              <span className="truncate max-w-[120px]">Rapport</span>
                            </span>
                          )}
                          {m.pv_attachment_name && (
                            <span className="flex items-center space-x-1 text-indigo-800 font-bold" title={m.pv_attachment_name}>
                              <span>📜</span>
                              <span className="truncate max-w-[120px]">PV officiel</span>
                            </span>
                          )}
                        </div>

                        {m.photos && m.photos.length > 0 && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] font-semibold text-slate-600">{m.photos.length} photo(s) :</span>
                            <div className="flex -space-x-2">
                              {m.photos.slice(0, 3).map((p, idx) => (
                                <img
                                  key={idx}
                                  src={p.url}
                                  alt={p.caption}
                                  onClick={() => setPreviewPhoto(p)}
                                  className="w-6 h-6 rounded-full object-cover border-2 border-white cursor-pointer hover:scale-110 transition shadow-2xs"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL CRÉATION / MODIFICATION D'UNE SÉANCE */}
        {formModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden border border-slate-200">
              
              {/* Entête Modal */}
              <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">
                    {editingMeeting ? 'Modifier la Séance / Réunion' : 'Planifier / Enregistrer une Nouvelle Séance'}
                  </h3>
                  <p className="text-xs text-teal-200">
                    Renseignez les détails de la séance, les participants internes/externes, l’ordre du jour et les preuves.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Formulaire */}
              <form onSubmit={handleSaveMeeting} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
                
                {/* 1. INFORMATIONS GÉNÉRALES */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">
                    1. Informations Générales & Typologie
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Objet / Titre précis de la réunion *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: GTT — Rapprochement des Besoins et POA Semestre 1..."
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Type de réunion *</label>
                      <select
                        value={formData.meeting_type}
                        onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value as MeetingType })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold bg-white"
                      >
                        <option value="GTT">🔬 GTT (Groupe Technique)</option>
                        <option value="COORDINATION">🤝 Réunion de Coordination</option>
                        <option value="COMITE_PILOTAGE">🏛️ Comité de Pilotage</option>
                        <option value="INSTITUTIONNELLE">🏢 Rencontre Institutionnelle</option>
                        <option value="ATELIER">📋 Atelier Technique</option>
                        <option value="AUTRE">👥 Autre séance</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jalon associé</label>
                      <select
                        value={formData.milestone}
                        onChange={(e) => setFormData({ ...formData, milestone: e.target.value as MilestoneType })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                      >
                        <option value="B13">B13 - Quantification & Appro</option>
                        <option value="B09">B09 - Promptitude eSIGL</option>
                        <option value="TRANSVERSAL">Transversal / Coordination</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Activité liée du Work Plan</label>
                      <select
                        value={formData.work_plan_code || ''}
                        onChange={(e) => setFormData({ ...formData, work_plan_code: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                      >
                        <option value="">-- Activité liée (Optionnel) --</option>
                        {activities
                          .filter(a => !formData.milestone || a.milestone === formData.milestone)
                          .map(a => (
                            <option key={a.id} value={a.code}>
                              [{a.code}] {a.title.substring(0, 50)}...
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Statut de la séance *</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as MeetingStatus })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold bg-white"
                      >
                        <option value="PLANIFIEE">Planifiée</option>
                        <option value="EN_COURS">En cours</option>
                        <option value="TERMINEE">Terminée (PV disponible)</option>
                        <option value="REPORTEE">Reportée</option>
                        <option value="ANNULEE">Annulée</option>
                      </select>
                    </div>
                  </div>

                  {/* ORGANISATEUR : SÉANCE ORGANISÉE PAR NOUS VS PAR UNE AUTRE STRUCTURE */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
                        Initiative & Structure Organisatrice de la Séance *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label
                          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer select-none transition ${
                            (formData.organization_type || 'INTERNAL') === 'INTERNAL'
                              ? 'bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <input
                            type="radio"
                            name="organization_type"
                            value="INTERNAL"
                            checked={(formData.organization_type || 'INTERNAL') === 'INTERNAL'}
                            onChange={() => setFormData({ ...formData, organization_type: 'INTERNAL', organizing_structure: '' })}
                            className="text-teal-700 focus:ring-teal-600 h-4 w-4"
                          />
                          <div>
                            <span className="block text-xs font-bold">Séance organisée par nous</span>
                            <span className="text-[10px] text-slate-500 font-normal">Initiative SaniNova / Équipe Projet AFGHS</span>
                          </div>
                        </label>

                        <label
                          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer select-none transition ${
                            formData.organization_type === 'EXTERNAL'
                              ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <input
                            type="radio"
                            name="organization_type"
                            value="EXTERNAL"
                            checked={formData.organization_type === 'EXTERNAL'}
                            onChange={() => setFormData({ ...formData, organization_type: 'EXTERNAL' })}
                            className="text-amber-700 focus:ring-amber-600 h-4 w-4"
                          />
                          <div>
                            <span className="block text-xs font-bold">Organisée par une autre structure</span>
                            <span className="text-[10px] text-slate-500 font-normal">Nous participons en tant que partie prenante</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {formData.organization_type === 'EXTERNAL' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block font-semibold text-slate-700 text-xs mb-1">
                            Nom de la structure organisatrice *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.organizing_structure || ''}
                            onChange={(e) => setFormData({ ...formData, organizing_structure: e.target.value })}
                            placeholder="Saisir le nom de la structure..."
                            className="w-full text-xs border border-amber-300 rounded p-2 outline-none focus:border-amber-600 font-semibold bg-white"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 text-xs mb-1">
                            Point focal / Représentant SaniNova *
                          </label>
                          <select
                            value={formData.organizer_id}
                            onChange={(e) => {
                              const u = users.find(user => user.id === e.target.value);
                              setFormData({
                                ...formData,
                                organizer_id: e.target.value,
                                organizer_name: u?.full_name || currentUser.full_name,
                              });
                            }}
                            className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold bg-white"
                          >
                            {users.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.full_name} ({u.title})
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Membre de notre équipe qui pilote notre participation à cette réunion.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block font-semibold text-slate-700 text-xs mb-1">
                          Organisateur / Modérateur interne principal *
                        </label>
                        <select
                          value={formData.organizer_id}
                          onChange={(e) => {
                            const u = users.find(user => user.id === e.target.value);
                            setFormData({
                              ...formData,
                              organizer_id: e.target.value,
                              organizer_name: u?.full_name || currentUser.full_name,
                            });
                          }}
                          className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-semibold bg-white"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({u.title})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Membre de notre équipe en charge de la préparation, animation et rédaction du PV.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. MODALITÉ & HORAIRES : EN LIGNE VS PRÉSENTIEL */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                    2. Modalité de Déroulement (En Ligne ou Présentiel) & Horaires
                  </h4>

                  {/* Date & Horaires */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Date de la séance *</label>
                      <input
                        type="date"
                        required
                        value={formData.session_date}
                        onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Heure de début *</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Heure de fin *</label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                      />
                    </div>
                  </div>

                  {/* SÉLECTION DU MODE : EN PRÉSENTIEL OU EN LIGNE */}
                  <div className="pt-2">
                    <label className="block font-bold text-slate-800 text-xs mb-2 uppercase">
                      Modalité de déroulement : Choisir En Présentiel ou En Ligne *
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, format: 'PRESENTIEL' })}
                        className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 cursor-pointer ${
                          formData.format === 'PRESENTIEL'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-500/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-2xl">📍</span>
                        <div>
                          <span className="block text-xs font-bold">En Présentiel</span>
                          <span className="text-[10px] text-slate-500 block font-normal">Sur site / Salle physique</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, format: 'EN_LIGNE' })}
                        className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 cursor-pointer ${
                          formData.format === 'EN_LIGNE'
                            ? 'bg-sky-50 border-sky-600 text-sky-950 font-bold shadow-xs ring-2 ring-sky-500/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-2xl">💻</span>
                        <div>
                          <span className="block text-xs font-bold">En Ligne (Visio)</span>
                          <span className="text-[10px] text-slate-500 block font-normal">Google Meet, Teams, Zoom</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, format: 'HYBRIDE' })}
                        className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 cursor-pointer col-span-2 sm:col-span-1 ${
                          formData.format === 'HYBRIDE'
                            ? 'bg-purple-50 border-purple-600 text-purple-950 font-bold shadow-xs ring-2 ring-purple-500/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-2xl">🌐</span>
                        <div>
                          <span className="block text-xs font-bold">Hybride (Mixte)</span>
                          <span className="text-[10px] text-slate-500 block font-normal">Présentiel + Visioconférence</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* SI EN PRÉSENTIEL : SAISIR LE NOM DU LIEU */}
                  {formData.format !== 'EN_LIGNE' && (
                    <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-300 space-y-1.5 animate-fadeIn">
                      <div className="flex justify-between items-center">
                        <label className="block font-bold text-emerald-950 text-xs">
                          📍 Nom du Lieu / Salle de réunion (Présentiel) *
                        </label>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                          Mode Présentiel actif
                        </span>
                      </div>
                      <input
                        type="text"
                        required={formData.format === 'PRESENTIEL'}
                        placeholder="Lieu physique / Salle de réunion..."
                        value={formData.location || ''}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full text-xs border border-emerald-300 rounded p-2 outline-none focus:border-emerald-700 font-medium bg-white shadow-2xs"
                      />
                      <span className="text-[11px] text-emerald-800 block">
                        Renseignez l’adresse, le nom de la salle, du ministère, de la direction ou la ville d’accueil.
                      </span>
                    </div>
                  )}

                  {/* SI EN LIGNE : SAISIR LE LIEN DE VISIOCONFÉRENCE */}
                  {formData.format !== 'PRESENTIEL' && (
                    <div className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-300 space-y-1.5 animate-fadeIn">
                      <div className="flex justify-between items-center">
                        <label className="block font-bold text-sky-950 text-xs">
                          💻 Lien de Visioconférence (En Ligne) *
                        </label>
                        <span className="text-[10px] font-semibold text-sky-800 bg-sky-200/60 px-2 py-0.5 rounded">
                          Mode En Ligne actif
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          required={formData.format === 'EN_LIGNE'}
                          placeholder="Ex: https://meet.google.com/xyz-abc-def ou lien Microsoft Teams / Zoom..."
                          value={formData.online_link || ''}
                          onChange={(e) => setFormData({ ...formData, online_link: e.target.value })}
                          className="w-full text-xs border border-sky-300 rounded p-2 outline-none focus:border-sky-700 font-medium bg-white font-mono shadow-2xs"
                        />
                        {formData.online_link && (
                          <a
                            href={formData.online_link}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded font-bold transition shrink-0 flex items-center space-x-1 shadow-2xs"
                          >
                            <span>Tester</span>
                            <span>🔗</span>
                          </a>
                        )}
                      </div>
                      <span className="text-[11px] text-sky-800 block">
                        Collez le lien direct Google Meet, Teams ou Zoom pour permettre aux participants de se connecter.
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. PARTICIPANTS INTERNES ET EXTERNES */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">
                    3. Participants à la Séance
                  </h4>

                  {/* Membres internes */}
                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200 space-y-2">
                    <span className="font-bold text-teal-900 block">
                      A. Membres de l’Équipe SaniNova concernés :
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {users.map(u => {
                        const isChecked = (formData.internal_participants_ids || []).includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center space-x-2 p-2 rounded border cursor-pointer select-none transition ${
                              isChecked
                                ? 'bg-teal-800 text-white border-teal-800 font-bold shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const list = formData.internal_participants_ids || [];
                                const updated = list.includes(u.id)
                                  ? list.filter(id => id !== u.id)
                                  : [...list, u.id];
                                setFormData({ ...formData, internal_participants_ids: updated });
                              }}
                              className="rounded text-teal-800 focus:ring-teal-700"
                            />
                            <div className="truncate">
                              <span className="block text-xs">{u.full_name}</span>
                              <span className={`text-[10px] block truncate ${isChecked ? 'text-teal-200' : 'text-slate-400'}`}>
                                {u.title}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Parties prenantes externes */}
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-900 block">
                        B. Participants Externes / Partenaires ({formData.external_participants?.length || 0}) :
                      </span>
                      <span className="text-[10px] text-indigo-700">Ministère, SoBAPS, ABMeD, PTF, etc.</span>
                    </div>

                    {/* Formulaire ajout participant externe */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-lg border border-indigo-100">
                      <div>
                        <input
                          type="text"
                          placeholder="Nom & Prénom *"
                          value={newExtPart.name || ''}
                          onChange={(e) => setNewExtPart({ ...newExtPart, name: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-600 font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Organisation (ex: ABMeD, SoBAPS) *"
                          value={newExtPart.organization || ''}
                          onChange={(e) => setNewExtPart({ ...newExtPart, organization: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-600 font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Fonction (ex: Directeur, Point focal)"
                          value={newExtPart.role_title || ''}
                          onChange={(e) => setNewExtPart({ ...newExtPart, role_title: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-600"
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={handleAddExternalParticipant}
                          className="w-full py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold transition"
                        >
                          + Ajouter
                        </button>
                      </div>
                    </div>

                    {/* Liste des participants externes */}
                    {formData.external_participants && formData.external_participants.length > 0 && (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {formData.external_participants.map((p) => (
                          <div
                            key={p.id}
                            className="flex justify-between items-center p-2 rounded bg-white border border-indigo-100 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800">{p.name}</span>
                              <span className="text-indigo-800 font-semibold ml-2">[{p.organization}]</span>
                              {p.role_title && <span className="text-slate-500 ml-1.5">&bull; {p.role_title}</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveExternalParticipant(p.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold text-sm px-2"
                              title="Retirer"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. ORDRE DU JOUR & RAPPORT DE SÉANCE */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">
                    4. Ordre du Jour, Objectifs & Compte-Rendu / Rapport
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Objectifs */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        🎯 Objectifs poursuivis
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Ex: Valider le rapprochement des besoins, arrêter le calendrier des commandes..."
                        value={formData.objectives || ''}
                        onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    {/* Ordre du jour (Agenda) : Saisie manuelle OU Pièce jointe */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-semibold text-slate-700">
                          📋 Ordre du jour (Agenda)
                        </label>
                        {/* Sélecteur de mode */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, agenda_mode: 'TEXT' }))}
                            className={`px-2 py-0.5 rounded transition ${
                              formData.agenda_mode !== 'ATTACHMENT' ? 'bg-white text-teal-900 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            ✏️ Saisie texte
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, agenda_mode: 'ATTACHMENT' }))}
                            className={`px-2 py-0.5 rounded transition ${
                              formData.agenda_mode === 'ATTACHMENT' ? 'bg-white text-teal-900 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            📎 Pièce jointe
                          </button>
                        </div>
                      </div>

                      {/* Zone de texte de l'agenda */}
                      {formData.agenda_mode !== 'ATTACHMENT' && (
                        <textarea
                          rows={formData.agenda_attachment_name ? 2 : 4}
                          placeholder="1. Revue des stocks au 30 septembre&#10;2. Commandes vs livraisons&#10;3. Recommandations..."
                          value={formData.agenda || ''}
                          onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                          className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                        />
                      )}

                      {/* Zone d'attachement de fichier Agenda */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        {formData.agenda_attachment_name ? (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-base text-teal-700">📎</span>
                              <div className="truncate">
                                <span className="font-bold text-slate-800 truncate block">
                                  {formData.agenda_attachment_name}
                                </span>
                                {formData.agenda_attachment_size_kb && (
                                  <span className="text-[10px] text-slate-400">
                                    {formData.agenda_attachment_size_kb} Ko
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {formData.agenda_attachment_url && (
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(formData.agenda_attachment_url, formData.agenda_attachment_name)}
                                  className="px-2 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[10px] font-bold hover:bg-teal-100"
                                >
                                  📥 Voir
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  agenda_attachment_name: '',
                                  agenda_attachment_url: '',
                                  agenda_attachment_size_kb: undefined,
                                }))}
                                className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold hover:bg-rose-100"
                              >
                                ✕ Retirer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-white hover:border-teal-600 transition text-slate-600 hover:text-teal-800">
                            <span className="text-sm">📎</span>
                            <span className="text-xs font-semibold">
                              Joindre l’agenda en pièce jointe (PDF, Word, Image)
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                              onChange={handleAgendaFileUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compte-rendu synthétique de la séance */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      📝 Compte-rendu synthétique de la séance / Débats & Conclusions
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Synthèse des échanges, points de blocage résolus, consensus dégagés..."
                      value={formData.summary_report || ''}
                      onChange={(e) => setFormData({ ...formData, summary_report: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                    />
                  </div>

                  {/* PIECES JOINTES : RAPPORT DE SEANCE & PV OFFICIEL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* RAPPORT DE LA SÉANCE */}
                    <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-sky-950 text-xs flex items-center gap-1.5">
                          <span>📄</span>
                          <span>Rapport Complet de la Séance (Optionnel)</span>
                        </label>
                        <span className="text-[10px] text-sky-700 font-semibold">PDF, Word</span>
                      </div>

                      {formData.report_attachment_name ? (
                        <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-sky-300 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base text-sky-700">📑</span>
                            <div className="truncate">
                              <span className="font-bold text-sky-950 truncate block">
                                {formData.report_attachment_name}
                              </span>
                              {formData.report_attachment_size_kb && (
                                <span className="text-[10px] text-slate-400">
                                  {formData.report_attachment_size_kb} Ko
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {formData.report_attachment_url && (
                              <button
                                type="button"
                                onClick={() => downloadAttachment(formData.report_attachment_url, formData.report_attachment_name)}
                                className="px-2 py-1 bg-sky-100 text-sky-900 border border-sky-300 rounded text-[10px] font-bold hover:bg-sky-200"
                              >
                                📥 Voir
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                report_attachment_name: '',
                                report_attachment_url: '',
                                report_attachment_size_kb: undefined,
                              }))}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold hover:bg-rose-100"
                            >
                              ✕ Retirer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-2.5 bg-white border-2 border-dashed border-sky-300 rounded-lg cursor-pointer hover:bg-sky-100/50 transition text-sky-800">
                          <span className="text-sm">📁</span>
                          <span className="text-xs font-bold">
                            Joindre le fichier du Rapport (PDF / DOCX)
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            onChange={handleReportFileUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* PROCÈS-VERBAL (PV) OFFICIEL SIGNÉ */}
                    <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                          <span>📜</span>
                          <span>PV Officiel Signé / Scanné (Optionnel)</span>
                        </label>
                        <span className="text-[10px] text-indigo-700 font-semibold">Preuve formelle</span>
                      </div>

                      {formData.pv_attachment_name ? (
                        <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-indigo-300 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base text-indigo-700">📎</span>
                            <span className="font-bold text-indigo-950 truncate block">
                              {formData.pv_attachment_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {formData.pv_attachment_url && (
                              <button
                                type="button"
                                onClick={() => downloadAttachment(formData.pv_attachment_url, formData.pv_attachment_name)}
                                className="px-2 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded text-[10px] font-bold hover:bg-indigo-200"
                              >
                                📥 Voir
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                pv_attachment_name: '',
                                pv_attachment_url: '',
                              }))}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold hover:bg-rose-100"
                            >
                              ✕ Retirer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-2.5 bg-white border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer hover:bg-indigo-100/50 transition text-indigo-800">
                          <span className="text-sm">📁</span>
                          <span className="text-xs font-bold">
                            Joindre le PV signé scanné (PDF / Image)
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handlePvFileUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. DÉCISIONS & ACTIONS */}
                <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider border-b border-emerald-200 pb-1">
                    5. Décisions Prises, Recommandations & Actions à Mener
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-lg border border-emerald-200">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Description de la décision / recommandation *"
                        value={newDecision.description || ''}
                        onChange={(e) => setNewDecision({ ...newDecision, description: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-emerald-600 font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Responsable désigné"
                        value={newDecision.responsible || ''}
                        onChange={(e) => setNewDecision({ ...newDecision, responsible: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div className="flex space-x-1">
                      <input
                        type="date"
                        value={newDecision.deadline || ''}
                        onChange={(e) => setNewDecision({ ...newDecision, deadline: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddDecision}
                        className="px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {formData.decisions && formData.decisions.length > 0 && (
                    <div className="space-y-1.5">
                      {formData.decisions.map((d) => (
                        <div key={d.id} className="flex justify-between items-center p-2 rounded bg-white border border-emerald-100 text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{d.description}</span>
                            <span className="text-emerald-800 ml-2 font-medium">[Resp: {d.responsible}]</span>
                            {d.deadline && <span className="text-slate-500 ml-1.5">&bull; Échéance: {d.deadline}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDecision(d.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold text-sm px-2"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. PHOTOS & JUSTIFICATIFS DE LA SÉANCE */}
                <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider border-b border-amber-200 pb-1">
                    6. Photos & Justificatifs Visuels de la Séance
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-amber-200">
                    <div className="sm:col-span-2">
                      <input
                        type="url"
                        placeholder="URL de l'image (https://...) ou utilisez le bouton à droite"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-amber-600 font-mono"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Légende de la photo"
                        value={newPhotoCaption}
                        onChange={(e) => setNewPhotoCaption(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <label className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer hover:bg-slate-50 transition">
                        <span>📁 Charger un fichier image depuis le disque</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddPhoto}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition"
                      >
                        + Ajouter l’URL
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {formData.photos?.length || 0} photo(s) attachée(s)
                    </span>
                  </div>

                  {formData.photos && formData.photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      {formData.photos.map((p) => (
                        <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
                          <img src={p.url} alt={p.caption} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition p-2 flex flex-col justify-between text-white text-[10px]">
                            <span className="line-clamp-2">{p.caption}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(p.id)}
                              className="self-end px-2 py-0.5 bg-rose-600 rounded text-white font-bold"
                            >
                              Retirer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Boutons actions modal */}
                <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold shadow-sm transition"
                  >
                    {editingMeeting ? 'Enregistrer les Modifications' : 'Enregistrer la Séance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CONSULTATION DÉTAILLÉE DU PROCÈS-VERBAL (PV) */}
        {viewModalMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden border border-slate-200">
              
              {/* Header PV */}
              <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-5 text-white flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded">
                      Fiche Officielle de Séance
                    </span>
                    <span className="text-[10px] uppercase font-bold bg-teal-500/30 text-teal-200 px-2 py-0.5 rounded">
                      {MEETING_TYPE_LABELS[viewModalMeeting.meeting_type]?.label}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mt-1">
                    {viewModalMeeting.title}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleExportSingleMeetingPdf(viewModalMeeting)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-bold transition flex items-center space-x-1"
                  >
                    <span>📄</span>
                    <span>Télécharger PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModalMeeting(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Contenu PV */}
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs text-slate-800">
                
                {/* Cartouche */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Date & Horaires :</span>
                    <span className="font-bold text-slate-900">{viewModalMeeting.session_date}</span>
                    <span className="text-slate-500 block text-[11px]">{viewModalMeeting.start_time} - {viewModalMeeting.end_time}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Modalité & Format :</span>
                    <span className="font-bold text-slate-900">{FORMAT_LABELS[viewModalMeeting.format]?.label}</span>
                    <span className="text-slate-500 block text-[11px] truncate">
                      {viewModalMeeting.format === 'EN_LIGNE' ? 'Visioconférence' : (viewModalMeeting.location || 'Sur site')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Jalon Lié :</span>
                    <span className="font-bold text-slate-900">Jalon {viewModalMeeting.milestone || 'Transversal'}</span>
                    <span className="text-slate-500 block text-[11px]">{viewModalMeeting.work_plan_code || 'Activité transversale'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Initiative & Modérateur :</span>
                    {viewModalMeeting.organization_type === 'EXTERNAL' || viewModalMeeting.organizing_structure ? (
                      <>
                        <span className="font-bold text-amber-900 block truncate" title={viewModalMeeting.organizing_structure}>
                          🏢 {viewModalMeeting.organizing_structure || 'Autre structure'}
                        </span>
                        <span className="text-slate-500 block text-[11px] truncate">
                          Point focal : {viewModalMeeting.organizer_name}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-teal-900 block">🏛️ SaniNova</span>
                        <span className="text-slate-500 block text-[11px] truncate">
                          Modérateur : {viewModalMeeting.organizer_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Lien Visio si en ligne */}
                {viewModalMeeting.format !== 'PRESENTIEL' && viewModalMeeting.online_link && (
                  <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sky-900 block text-xs">Lien de la visioconférence :</span>
                      <span className="font-mono text-[11px] text-sky-700 truncate max-w-lg block">{viewModalMeeting.online_link}</span>
                    </div>
                    <a
                      href={viewModalMeeting.online_link}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold transition shrink-0"
                    >
                      Rejoindre la visio 🔗
                    </a>
                  </div>
                )}

                {/* Objectifs & Agenda */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-teal-900 uppercase text-xs border-b border-slate-100 pb-1">
                      🎯 Objectifs Poursuivis
                    </h4>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {viewModalMeeting.objectives || 'Non spécifiés.'}
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-teal-900 uppercase text-xs border-b border-slate-100 pb-1">
                      📋 Ordre du Jour (Agenda)
                    </h4>
                    {viewModalMeeting.agenda && (
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line mb-2">
                        {viewModalMeeting.agenda}
                      </p>
                    )}
                    {viewModalMeeting.agenda_attachment_name && (
                      <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-200 flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 text-teal-950 font-bold truncate">
                          <span>📎</span>
                          <span className="truncate">{viewModalMeeting.agenda_attachment_name}</span>
                          {viewModalMeeting.agenda_attachment_size_kb && (
                            <span className="text-[10px] text-teal-700 font-normal">
                              ({viewModalMeeting.agenda_attachment_size_kb} Ko)
                            </span>
                          )}
                        </div>
                        {viewModalMeeting.agenda_attachment_url && (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(viewModalMeeting.agenda_attachment_url, viewModalMeeting.agenda_attachment_name)}
                            className="px-2.5 py-1 bg-teal-800 text-white rounded text-xs font-bold hover:bg-teal-900 transition shrink-0"
                          >
                            📥 Télécharger
                          </button>
                        )}
                      </div>
                    )}
                    {!viewModalMeeting.agenda && !viewModalMeeting.agenda_attachment_name && (
                      <p className="text-slate-400 italic">Non spécifié.</p>
                    )}
                  </div>
                </div>

                {/* Compte-rendu détaillé & Documents */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-teal-900 uppercase text-xs border-b border-slate-100 pb-1">
                    📝 Compte-Rendu des Échanges & Documents Rattachés
                  </h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line text-xs">
                    {viewModalMeeting.summary_report || 'En cours de rédaction.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Rapport de séance */}
                    {viewModalMeeting.report_attachment_name && (
                      <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="text-[10px] font-bold text-sky-800 uppercase block">Rapport de Séance :</span>
                          <span className="font-bold text-sky-950 truncate block text-xs">
                            📄 {viewModalMeeting.report_attachment_name}
                          </span>
                        </div>
                        {viewModalMeeting.report_attachment_url && (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(viewModalMeeting.report_attachment_url, viewModalMeeting.report_attachment_name)}
                            className="px-2.5 py-1 bg-sky-700 text-white rounded text-xs font-bold hover:bg-sky-800 shrink-0"
                          >
                            📥 Télécharger
                          </button>
                        )}
                      </div>
                    )}

                    {/* PV officiel */}
                    {viewModalMeeting.pv_attachment_name && (
                      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="text-[10px] font-bold text-indigo-800 uppercase block">PV Officiel Signé :</span>
                          <span className="font-bold text-indigo-950 truncate block text-xs">
                            📜 {viewModalMeeting.pv_attachment_name}
                          </span>
                        </div>
                        {viewModalMeeting.pv_attachment_url && (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(viewModalMeeting.pv_attachment_url, viewModalMeeting.pv_attachment_name)}
                            className="px-2.5 py-1 bg-indigo-700 text-white rounded text-xs font-bold hover:bg-indigo-800 shrink-0"
                          >
                            📥 Télécharger
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Décisions & Actions */}
                {viewModalMeeting.decisions && viewModalMeeting.decisions.length > 0 && (
                  <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-3">
                    <h4 className="font-bold text-emerald-900 uppercase text-xs">
                      ✅ Décisions, Recommandations & Plan d’Action
                    </h4>
                    <div className="space-y-1.5">
                      {viewModalMeeting.decisions.map((d, idx) => (
                        <div key={d.id} className="p-2.5 rounded bg-white border border-emerald-100 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{idx + 1}. {d.description}</span>
                            <span className="text-emerald-800 ml-2 font-medium">[Resp: {d.responsible}]</span>
                            {d.deadline && <span className="text-slate-500 ml-2">&bull; Échéance: {d.deadline}</span>}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.status === 'FAIT' ? 'bg-emerald-100 text-emerald-800' : (d.status === 'EN_COURS' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')
                          }`}>
                            {d.status === 'FAIT' ? 'Réalisé' : (d.status === 'EN_COURS' ? 'En cours' : 'À faire')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Émargement Participants */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800 uppercase text-xs">
                    👥 Émargement des Participants
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold text-teal-900 block mb-1">Membres Équipe SaniNova :</span>
                      <ul className="space-y-1">
                        {(viewModalMeeting.internal_participants_ids || []).map(id => {
                          const u = users.find(user => user.id === id);
                          return (
                            <li key={id} className="flex items-center space-x-2 text-slate-700">
                              <span className="text-teal-700 font-bold">&bull;</span>
                              <span>{u ? u.full_name : id}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({u?.title})</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-indigo-900 block mb-1">Partenaires Extérieurs :</span>
                      {(viewModalMeeting.external_participants || []).length === 0 ? (
                        <span className="text-slate-400 italic">Aucun participant extérieur</span>
                      ) : (
                        <ul className="space-y-1">
                          {viewModalMeeting.external_participants.map(p => (
                            <li key={p.id} className="flex items-center space-x-2 text-slate-700">
                              <span className="text-indigo-700 font-bold">&bull;</span>
                              <span className="font-medium">{p.name}</span>
                              <span className="text-[10px] text-indigo-800 font-bold">[{p.organization}]</span>
                              {p.role_title && <span className="text-[10px] text-slate-400">- {p.role_title}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photos */}
                {viewModalMeeting.photos && viewModalMeeting.photos.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 uppercase text-xs">
                      📸 Photothèque de la Séance
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {viewModalMeeting.photos.map(p => (
                        <div
                          key={p.id}
                          onClick={() => setPreviewPhoto(p)}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-2xs aspect-video"
                        >
                          <img src={p.url} alt={p.caption} className="w-full h-full object-cover group-hover:scale-105 transition" />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-1.5 text-white text-[10px] truncate">
                            {p.caption}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[11px] text-slate-500">
                  Document officiel archivé sous le code réf : {viewModalMeeting.id}
                </span>
                <button
                  type="button"
                  onClick={() => setViewModalMeeting(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIRMATION SUPPRESSION */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 text-center">
              <span className="text-3xl block">⚠️</span>
              <h3 className="font-bold text-sm text-slate-900">Confirmer la suppression</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement cette séance et l’ensemble de ses décisions et procès-verbaux ?
              </p>
              <div className="flex justify-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteMeeting(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL LIGHTBOX PHOTO PLEIN ÉCRAN */}
        {previewPhoto && (
          <div
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs cursor-pointer"
          >
            <div className="max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 space-y-2">
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black flex items-center justify-center">
                <img src={previewPhoto.url} alt={previewPhoto.caption} className="max-h-[75vh] w-auto object-contain" />
              </div>
              <div className="p-3 text-white flex justify-between items-center text-xs">
                <span>{previewPhoto.caption}</span>
                <span className="text-slate-400 text-[10px]">Cliquez n’importe où pour fermer</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </ModuleGuard>
  );
}
