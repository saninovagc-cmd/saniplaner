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
  const [activeTab, setActiveTab] = useState<'ALL' | 'GTT' | 'COORDINATION' | 'INSTITUTIONNELLE' | 'PHOTOS'>('ALL');

  // Filters
  const [selectedType, setSelectedType] = useState<string>('ALL');
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
    session_date: new Date().toISOString().substring(0, 10),
    start_time: '09:00',
    end_time: '12:00',
    milestone: 'B13',
    work_plan_code: '',
    organizer_id: currentUser.id,
    organizer_name: currentUser.full_name,
    objectives: '',
    agenda: '',
    status: 'PLANIFIEE',
    internal_participants_ids: [currentUser.id],
    external_participants: [],
    summary_report: '',
    decisions: [],
    pv_attachment_name: '',
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
      if (activeTab === 'GTT' && m.meeting_type !== 'GTT') return false;
      if (activeTab === 'COORDINATION' && m.meeting_type !== 'COORDINATION') return false;
      if (activeTab === 'INSTITUTIONNELLE' && m.meeting_type !== 'INSTITUTIONNELLE') return false;

      // Select filters
      if (selectedType !== 'ALL' && m.meeting_type !== selectedType) return false;
      if (selectedFormat !== 'ALL' && m.format !== selectedFormat) return false;
      if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false;
      if (selectedMilestone !== 'ALL' && m.milestone !== selectedMilestone) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(query);
        const matchesLocation = (m.location || '').toLowerCase().includes(query);
        const matchesOrganizer = m.organizer_name.toLowerCase().includes(query);
        const matchesAgenda = m.agenda.toLowerCase().includes(query);
        const matchesExt = m.external_participants.some(p => 
          p.name.toLowerCase().includes(query) || p.organization.toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesLocation && !matchesOrganizer && !matchesAgenda && !matchesExt) return false;
      }

      return true;
    });
  }, [meetings, activeTab, selectedType, selectedFormat, selectedStatus, selectedMilestone, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = meetings.length;
    const gttCount = meetings.filter(m => m.meeting_type === 'GTT').length;
    const coordCount = meetings.filter(m => m.meeting_type === 'COORDINATION').length;
    const presentielCount = meetings.filter(m => m.format === 'PRESENTIEL').length;
    const enLigneCount = meetings.filter(m => m.format === 'EN_LIGNE').length;
    const completedCount = meetings.filter(m => m.status === 'TERMINEE').length;
    const totalPhotos = meetings.reduce((sum, m) => sum + (m.photos ? m.photos.length : 0), 0);

    return { total, gttCount, coordCount, presentielCount, enLigneCount, completedCount, totalPhotos };
  }, [meetings]);

  // Open creation modal
  const handleOpenCreateModal = () => {
    setEditingMeeting(null);
    setFormData({
      title: '',
      meeting_type: 'GTT',
      format: 'PRESENTIEL',
      location: 'Salle de réunion DPMED, Cotonou',
      online_link: '',
      session_date: new Date().toISOString().substring(0, 10),
      start_time: '09:00',
      end_time: '12:30',
      milestone: 'B13',
      work_plan_code: 'B13.2',
      organizer_id: currentUser.id,
      organizer_name: currentUser.full_name,
      objectives: '',
      agenda: '',
      status: 'PLANIFIEE',
      internal_participants_ids: [currentUser.id],
      external_participants: [],
      summary_report: '',
      decisions: [],
      pv_attachment_name: '',
      photos: [],
    });
    setFormModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (meet: MeetingSession) => {
    setEditingMeeting(meet);
    setFormData({
      ...meet,
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
    if (!formData.title?.trim()) {
      alert('Veuillez renseigner le titre / objet de la séance.');
      return;
    }

    const organizerObj = users.find(u => u.id === formData.organizer_id) || currentUser;

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
      organizer_id: organizerObj.id,
      organizer_name: organizerObj.full_name,
      objectives: (formData.objectives || '').trim(),
      agenda: (formData.agenda || '').trim(),
      status: formData.status || 'PLANIFIEE',
      internal_participants_ids: formData.internal_participants_ids || [currentUser.id],
      external_participants: formData.external_participants || [],
      summary_report: (formData.summary_report || '').trim(),
      decisions: formData.decisions || [],
      pv_attachment_name: (formData.pv_attachment_name || '').trim(),
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

  // Handle file input for local photo loading (Base64)
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const photo: MeetingPhoto = {
          id: `pho-${Date.now()}`,
          url: reader.result,
          caption: newPhotoCaption.trim() || file.name,
          taken_at: formData.session_date || new Date().toISOString().substring(0, 10),
        };
        setFormData(prev => ({
          ...prev,
          photos: [...(prev.photos || []), photo],
        }));
        setNewPhotoCaption('');
      }
    };
    reader.readAsDataURL(file);
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
      Organisateur: m.organizer_name,
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
        ['Organisateur / Modérateur', m.organizer_name],
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
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Séances</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
            <span className="text-[10px] text-teal-800 font-medium">Toutes catégories</span>
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

          <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Présentiel</span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{stats.presentielCount}</div>
            <span className="text-[10px] text-emerald-700 font-medium">En salle / DPMED</span>
          </div>

          <div className="bg-white rounded-xl border border-sky-200 bg-sky-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-sky-800 uppercase">En Ligne (Visio)</span>
            <div className="text-2xl font-black text-sky-900 mt-1">{stats.enLigneCount}</div>
            <span className="text-[10px] text-sky-700 font-medium">Google Meet / Teams</span>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-800 uppercase">Clichés Photos</span>
            <div className="text-2xl font-black text-amber-900 mt-1">{stats.totalPhotos}</div>
            <span className="text-[10px] text-amber-700 font-medium">Justificatifs visuels</span>
          </div>
        </div>

        {/* ONGLET DE NAVIGATION SECONDAIRE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'ALL'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📋</span>
            <span>Toutes les Séances ({meetings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GTT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'GTT'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🔬</span>
            <span>GTT (Groupe Technique) ({stats.gttCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COORDINATION')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'COORDINATION'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🤝</span>
            <span>Coordination Équipe ({stats.coordCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INSTITUTIONNELLE')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'INSTITUTIONNELLE'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🏢</span>
            <span>Institutionnelles & DDS ({meetings.filter(m => m.meeting_type === 'INSTITUTIONNELLE').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PHOTOS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'PHOTOS'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📸</span>
            <span>Galerie Photos des Réunions ({stats.totalPhotos})</span>
          </button>
        </div>

        {/* FILTRES & RECHERCHE */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Recherche mot-clé :</label>
              <input
                type="text"
                placeholder="Titre, participant, lieu, agenda..."
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
            {filteredMeetings.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
                <span className="text-3xl">🔍</span>
                <p className="text-sm font-semibold">Aucune séance ne correspond aux critères de recherche sélectionnés.</p>
                <button
                  type="button"
                  onClick={() => { setSelectedType('ALL'); setSelectedFormat('ALL'); setSelectedStatus('ALL'); setSelectedMilestone('ALL'); setSearchQuery(''); }}
                  className="px-3.5 py-1.5 bg-teal-800 text-white rounded text-xs font-semibold hover:bg-teal-900 transition"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
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

                        {/* Actions boutons */}
                        <div className="flex items-center space-x-1.5 shrink-0 self-end md:self-start">
                          <button
                            type="button"
                            onClick={() => setViewModalMeeting(m)}
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-lg text-xs font-bold border border-teal-200 transition flex items-center space-x-1"
                          >
                            <span>👁️</span>
                            <span>PV & Détails</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSingleMeetingPdf(m)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            title="Télécharger le PV en PDF officiel"
                          >
                            📄 PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            title="Modifier cette séance"
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(m.id)}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition"
                            title="Supprimer cette séance"
                          >
                            🗑️
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
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Organisateur SaniNova :</span>
                          <span className="font-semibold text-slate-800">
                            👤 {m.organizer_name}
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
                        <div className="flex items-center space-x-3">
                          {m.decisions && m.decisions.length > 0 && (
                            <span className="flex items-center space-x-1 text-emerald-800 font-bold">
                              <span>✅</span>
                              <span>{m.decisions.length} décision(s) actée(s)</span>
                            </span>
                          )}
                          {m.pv_attachment_name && (
                            <span className="flex items-center space-x-1 text-indigo-800 font-bold">
                              <span>📎</span>
                              <span className="truncate max-w-xs">{m.pv_attachment_name}</span>
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

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Organisateur / Modérateur Principal *</label>
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
                  </div>
                </div>

                {/* 2. MODALITÉ & HORAIRES : EN LIGNE VS PRÉSENTIEL */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                    2. Modalité de Déroulement (En Ligne ou Présentiel) & Horaires
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Format de la séance *</label>
                      <select
                        value={formData.format}
                        onChange={(e) => setFormData({ ...formData, format: e.target.value as MeetingFormat })}
                        className="w-full text-xs border border-teal-300 rounded p-2 outline-none focus:border-teal-700 font-bold bg-white text-teal-950"
                      >
                        <option value="PRESENTIEL">📍 Présentiel (Sur site / Salle)</option>
                        <option value="EN_LIGNE">💻 En Ligne (Visioconférence)</option>
                        <option value="HYBRIDE">🌐 Hybride (Mixte présentiel + visio)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Date de la séance *</label>
                      <input
                        type="date"
                        required
                        value={formData.session_date}
                        onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Début</label>
                        <input
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                          className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Fin</label>
                        <input
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Conditions selon format */}
                  {formData.format !== 'EN_LIGNE' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Lieu physique / Salle de réunion (Présentiel) *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Salle de Conférence DPMED, Cotonou ou DDS Atacora, Natitingou..."
                        value={formData.location || ''}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white"
                      />
                    </div>
                  )}

                  {formData.format !== 'PRESENTIEL' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Lien de visioconférence (Google Meet, Microsoft Teams, Zoom) *
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          placeholder="Ex: https://meet.google.com/xyz-abc-def ou https://teams.microsoft.com/..."
                          value={formData.online_link || ''}
                          onChange={(e) => setFormData({ ...formData, online_link: e.target.value })}
                          className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-medium bg-white font-mono"
                        />
                        {formData.online_link && (
                          <a
                            href={formData.online_link}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-sky-100 text-sky-800 rounded font-bold hover:bg-sky-200 transition shrink-0"
                          >
                            Tester 🔗
                          </a>
                        )}
                      </div>
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
                      <span className="text-[10px] text-indigo-700">Ministère, SoBAPS, DPMED, PTF, etc.</span>
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
                          placeholder="Organisation (ex: DPMED, SoBAPS) *"
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
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">
                    4. Ordre du Jour, Objectifs & Compte-Rendu / Rapport
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Objectifs poursuivis</label>
                      <textarea
                        rows={3}
                        placeholder="Ex: Valider le rapprochement des besoins, arrêter le calendrier des commandes..."
                        value={formData.objectives || ''}
                        onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Ordre du jour (Agenda)</label>
                      <textarea
                        rows={3}
                        placeholder="1. Revue des stocks au 30 septembre&#10;2. Commandes vs livraisons&#10;3. Recommandations..."
                        value={formData.agenda || ''}
                        onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Compte-rendu synthétique de la séance / Débats & Conclusions
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Synthèse des échanges, points de blocage résolus, consensus dégagés..."
                      value={formData.summary_report || ''}
                      onChange={(e) => setFormData({ ...formData, summary_report: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nom du fichier PV officiel scanné / attaché (Optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: PV_Signe_GTT_Quantif_T1_2026_DPMED.pdf"
                      value={formData.pv_attachment_name || ''}
                      onChange={(e) => setFormData({ ...formData, pv_attachment_name: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded p-2 outline-none focus:border-teal-700 font-mono"
                    />
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Modérateur :</span>
                    <span className="font-bold text-slate-900">{viewModalMeeting.organizer_name}</span>
                    <span className="text-slate-500 block text-[11px]">SaniNova</span>
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
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {viewModalMeeting.agenda || 'Non spécifié.'}
                    </p>
                  </div>
                </div>

                {/* Compte-rendu détaillé */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-teal-900 uppercase text-xs border-b border-slate-100 pb-1">
                    📝 Compte-Rendu des Échanges & Synthèse
                  </h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line text-xs">
                    {viewModalMeeting.summary_report || 'En cours de rédaction.'}
                  </p>
                  {viewModalMeeting.pv_attachment_name && (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center space-x-2 text-indigo-900 font-medium">
                      <span>📎</span>
                      <span>Document officiel rattaché : <strong>{viewModalMeeting.pv_attachment_name}</strong></span>
                    </div>
                  )}
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
