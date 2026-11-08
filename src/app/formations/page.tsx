'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Training, 
  TrainingFormat, 
  TrainingStatus, 
  TrainedActor, 
  TrainingExternalTrainer, 
  TrainingPhoto,
  MilestoneType,
  ActorGender,
  ActorAttendance,
  ActorEvaluationResult 
} from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FORMAT_LABELS: Record<TrainingFormat, { label: string; badge: string; icon: string }> = {
  PRESENTIEL: { label: 'Présentiel', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: '📍' },
  EN_LIGNE: { label: 'En ligne (Visio)', badge: 'bg-sky-50 text-sky-800 border-sky-200', icon: '💻' },
  HYBRIDE: { label: 'Hybride (Mixte)', badge: 'bg-purple-50 text-purple-800 border-purple-200', icon: '🌐' },
  COACHING_SITE: { label: 'Coaching sur site', badge: 'bg-amber-50 text-amber-800 border-amber-200', icon: '🩺' },
};

const STATUS_LABELS: Record<TrainingStatus, { label: string; badge: string }> = {
  PLANIFIEE: { label: 'Planifiée', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  EN_COURS: { label: 'En cours', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  REALISEE: { label: 'Réalisée', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  EVALUEE: { label: 'Évaluée & Validée', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REPORTEE: { label: 'Reportée', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  ANNULEE: { label: 'Annulée', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export default function FormationsPage() {
  const { trainings, addTraining, updateTraining, deleteTraining, activities, users, currentUser } = useApp();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'EVALUEES' | 'ALL' | 'PLANIFIEES' | 'ACTEURS' | 'PHOTOS'>('EVALUEES');

  // View mode switcher: Table / Cards
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Filters
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalTab, setFormModalTab] = useState<'GENERAL' | 'PEDAGOGIE' | 'ACTEURS' | 'PHOTOS'>('GENERAL');
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [viewModalTraining, setViewModalTraining] = useState<Training | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<TrainingPhoto | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Training>>({
    code: '',
    topic: '',
    category: 'ESIGL_REPORTING',
    milestone: 'B09',
    work_plan_code: '',
    activity_id: '',
    activity_title: '',
    format: 'PRESENTIEL',
    department: 'Atacora',
    zone_sanitaire: '2KP',
    location: '',
    online_link: '',
    start_date: new Date().toISOString().substring(0, 10),
    end_date: new Date().toISOString().substring(0, 10),
    duration_days: 2,
    training_date: new Date().toISOString().substring(0, 10),
    trainer_ids: [currentUser.id],
    external_trainers: [],
    participants_count: 0,
    trained_actors: [],
    objectives: '',
    modules_covered: '',
    pre_test_avg: 0,
    post_test_avg: 0,
    passing_rate_pct: 0,
    budget_allocated_fcfa: 0,
    budget_spent_fcfa: 0,
    financial_partner: 'AFGHS / PSI Bénin',
    summary_report: '',
    report_file_name: '',
    attendance_sheet_file_name: '',
    photos: [],
    post_training_follow_up: '',
    next_supervision_date: '',
    status: 'PLANIFIEE',
  });

  // Sub-form: Add new trained actor inside modal
  const [newActor, setNewActor] = useState<Partial<TrainedActor>>({
    full_name: '',
    gender: 'M',
    profession: 'Gestionnaire de Dépôt',
    structure_fosa: '',
    department: 'Atacora',
    zone_sanitaire: '2KP',
    phone: '',
    email: '',
    attendance_status: 'PRESENT',
    pre_test_score: 50,
    post_test_score: 85,
    evaluation_result: 'REUSSI',
    certificate_issued: true,
    notes: '',
  });

  // Sub-form: Add external trainer
  const [newExtTrainer, setNewExtTrainer] = useState<Partial<TrainingExternalTrainer>>({
    name: '',
    organization: 'DDS',
    role_title: '',
    phone: '',
    email: '',
  });

  // Sub-form: Add photo
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');

  // Work plan activities filtered by milestone for the form
  const availableActivitiesForMilestone = useMemo(() => {
    if (!formData.milestone || formData.milestone === 'TRANSVERSAL') {
      return activities;
    }
    return activities.filter(a => a.milestone === formData.milestone || a.milestone === 'TRANSVERSAL');
  }, [activities, formData.milestone]);

  // List of all unique departments & zones
  const departmentOptions = ['Atacora', 'Donga', 'Mono', 'Plateau', 'Littoral', 'Zou', 'Alibori', 'Atlantique', 'Borgou', 'Collines', 'Couffo', 'Ouémé'];
  const zoneOptions = ['2KP', 'NBT', 'TMC', 'BASSILA', 'DCO', 'CBGH', 'LA', 'PAK', 'SAKIF', 'National (Cotonou)', 'Bohicon & Parakou'];

  // Filtered Trainings
  const filteredTrainings = useMemo(() => {
    return trainings.filter(t => {
      // Tab filter
      if (activeTab === 'EVALUEES' && t.status !== 'EVALUEE' && t.status !== 'REALISEE') return false;
      if (activeTab === 'PLANIFIEES' && t.status !== 'PLANIFIEE' && t.status !== 'EN_COURS') return false;

      // Select filters
      if (selectedMilestone !== 'ALL' && t.milestone !== selectedMilestone) return false;
      if (selectedActivity !== 'ALL' && t.work_plan_code !== selectedActivity && t.activity_id !== selectedActivity) return false;
      if (selectedDept !== 'ALL' && t.department !== selectedDept) return false;
      if (selectedZone !== 'ALL' && t.zone_sanitaire !== selectedZone) return false;
      if (selectedFormat !== 'ALL' && t.format !== selectedFormat) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTopic = t.topic.toLowerCase().includes(query);
        const matchesZone = t.zone_sanitaire.toLowerCase().includes(query);
        const matchesDept = t.department.toLowerCase().includes(query);
        const matchesLocation = (t.location || '').toLowerCase().includes(query);
        const matchesActivity = (t.activity_title || '').toLowerCase().includes(query);
        const matchesWorkPlanCode = (t.work_plan_code || '').toLowerCase().includes(query);
        const matchesActors = (t.trained_actors || []).some(a => 
          a.full_name.toLowerCase().includes(query) || 
          a.structure_fosa.toLowerCase().includes(query) ||
          a.profession.toLowerCase().includes(query)
        );
        if (!matchesTopic && !matchesZone && !matchesDept && !matchesLocation && !matchesActivity && !matchesWorkPlanCode && !matchesActors) {
          return false;
        }
      }

      return true;
    });
  }, [trainings, activeTab, selectedMilestone, selectedActivity, selectedDept, selectedZone, selectedFormat, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalSessions = trainings.length;
    const evaluatedSessions = trainings.filter(t => t.status === 'EVALUEE' || t.status === 'REALISEE').length;
    const plannedSessions = trainings.filter(t => t.status === 'PLANIFIEE' || t.status === 'EN_COURS').length;
    const b09Count = trainings.filter(t => t.milestone === 'B09').length;
    const b13Count = trainings.filter(t => t.milestone === 'B13').length;

    // All trained actors across all trainings
    const allActors = trainings.flatMap(t => t.trained_actors || []);
    const totalActorsCount = trainings.reduce((sum, t) => sum + (t.participants_count || (t.trained_actors ? t.trained_actors.length : 0)), 0);
    const nominalActorsCount = allActors.length;
    const menCount = allActors.filter(a => a.gender === 'M').length;
    const womenCount = allActors.filter(a => a.gender === 'F').length;

    // Averages on evaluated trainings
    const evaluatedList = trainings.filter(t => (t.status === 'EVALUEE' || t.status === 'REALISEE') && t.pre_test_avg > 0);
    const avgPreTest = evaluatedList.length > 0
      ? (evaluatedList.reduce((s, t) => s + t.pre_test_avg, 0) / evaluatedList.length).toFixed(1)
      : '0.0';
    const avgPostTest = evaluatedList.length > 0
      ? (evaluatedList.reduce((s, t) => s + t.post_test_avg, 0) / evaluatedList.length).toFixed(1)
      : '0.0';
    const avgGain = (Number(avgPostTest) - Number(avgPreTest)).toFixed(1);

    const totalPhotos = trainings.reduce((sum, t) => sum + (t.photos ? t.photos.length : 0), 0);

    return {
      totalSessions,
      evaluatedSessions,
      plannedSessions,
      b09Count,
      b13Count,
      totalActorsCount,
      nominalActorsCount,
      menCount,
      womenCount,
      avgPreTest,
      avgPostTest,
      avgGain,
      totalPhotos,
    };
  }, [trainings]);

  // All trained actors flat list for the dedicated tab
  const allTrainedActorsList = useMemo(() => {
    return trainings.flatMap(t => 
      (t.trained_actors || []).map(a => ({
        ...a,
        trainingId: t.id,
        trainingTopic: t.topic,
        trainingDate: t.training_date,
        trainingMilestone: t.milestone,
        trainingWorkPlanCode: t.work_plan_code,
      }))
    );
  }, [trainings]);

  // Open creation modal
  const handleOpenCreateModal = () => {
    setEditingTraining(null);
    setFormModalTab('GENERAL');
    setFormData({
      code: `FORM-${new Date().getFullYear()}-${trainings.length + 1}`,
      topic: '',
      category: 'ESIGL_REPORTING',
      milestone: 'B09',
      work_plan_code: 'B09.1',
      activity_id: '',
      activity_title: 'Appui technique à la promptitude et complétude du rapportage mensuel eSIGL',
      format: 'PRESENTIEL',
      department: 'Atacora',
      zone_sanitaire: '2KP',
      location: 'Salle de conférence de la zone sanitaire',
      online_link: '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date().toISOString().substring(0, 10),
      duration_days: 2,
      training_date: new Date().toISOString().substring(0, 10),
      trainer_ids: [currentUser.id],
      external_trainers: [],
      participants_count: 0,
      trained_actors: [],
      objectives: '',
      modules_covered: '',
      pre_test_avg: 0,
      post_test_avg: 0,
      passing_rate_pct: 0,
      budget_allocated_fcfa: 0,
      budget_spent_fcfa: 0,
      financial_partner: 'AFGHS / PSI Bénin',
      summary_report: '',
      report_file_name: '',
      attendance_sheet_file_name: '',
      photos: [],
      post_training_follow_up: '',
      next_supervision_date: '',
      status: 'PLANIFIEE',
    });
    setFormModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (t: Training) => {
    setEditingTraining(t);
    setFormModalTab('GENERAL');
    setFormData({
      ...t,
      trained_actors: t.trained_actors ? [...t.trained_actors] : [],
      external_trainers: t.external_trainers ? [...t.external_trainers] : [],
      photos: t.photos ? [...t.photos] : [],
    });
    setFormModalOpen(true);
  };

  // Recalculate automatic scores from trained actors
  const recalculateAverages = (actorsList: TrainedActor[]) => {
    if (!actorsList || actorsList.length === 0) {
      return { preAvg: 0, postAvg: 0, passingPct: 0 };
    }
    const withPre = actorsList.filter(a => typeof a.pre_test_score === 'number' && a.pre_test_score > 0);
    const withPost = actorsList.filter(a => typeof a.post_test_score === 'number' && a.post_test_score > 0);
    const passed = actorsList.filter(a => a.evaluation_result === 'REUSSI' || (a.post_test_score && a.post_test_score >= 70));

    const preAvg = withPre.length > 0 ? Number((withPre.reduce((s, a) => s + (a.pre_test_score || 0), 0) / withPre.length).toFixed(1)) : 0;
    const postAvg = withPost.length > 0 ? Number((withPost.reduce((s, a) => s + (a.post_test_score || 0), 0) / withPost.length).toFixed(1)) : 0;
    const passingPct = Math.round((passed.length / actorsList.length) * 100);

    return { preAvg, postAvg, passingPct };
  };

  // Add actor to current form
  const handleAddActorToForm = () => {
    if (!newActor.full_name?.trim()) {
      alert('Veuillez renseigner le nom et prénom de l’acteur formé.');
      return;
    }

    const created: TrainedActor = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      full_name: newActor.full_name.trim(),
      gender: newActor.gender || 'M',
      profession: newActor.profession || 'Agent de santé',
      structure_fosa: newActor.structure_fosa || 'FOSA locale',
      department: newActor.department || formData.department || 'Atacora',
      zone_sanitaire: newActor.zone_sanitaire || formData.zone_sanitaire || '2KP',
      phone: newActor.phone || '',
      email: newActor.email || '',
      attendance_status: newActor.attendance_status || 'PRESENT',
      pre_test_score: Number(newActor.pre_test_score) || 0,
      post_test_score: Number(newActor.post_test_score) || 0,
      evaluation_result: (Number(newActor.post_test_score) >= 70) ? 'REUSSI' : 'AJOURNE',
      certificate_issued: Boolean(newActor.certificate_issued),
      notes: newActor.notes || '',
    };

    const nextActors = [...(formData.trained_actors || []), created];
    const { preAvg, postAvg, passingPct } = recalculateAverages(nextActors);

    setFormData(prev => ({
      ...prev,
      trained_actors: nextActors,
      participants_count: nextActors.length,
      pre_test_avg: preAvg,
      post_test_avg: postAvg,
      passing_rate_pct: passingPct,
    }));

    // Reset sub-form
    setNewActor({
      full_name: '',
      gender: 'M',
      profession: 'Gestionnaire de Dépôt',
      structure_fosa: '',
      department: formData.department || 'Atacora',
      zone_sanitaire: formData.zone_sanitaire || '2KP',
      phone: '',
      email: '',
      attendance_status: 'PRESENT',
      pre_test_score: 50,
      post_test_score: 85,
      evaluation_result: 'REUSSI',
      certificate_issued: true,
      notes: '',
    });
  };

  // Remove actor from current form
  const handleRemoveActorFromForm = (id: string) => {
    const nextActors = (formData.trained_actors || []).filter(a => a.id !== id);
    const { preAvg, postAvg, passingPct } = recalculateAverages(nextActors);
    setFormData(prev => ({
      ...prev,
      trained_actors: nextActors,
      participants_count: nextActors.length,
      pre_test_avg: preAvg,
      post_test_avg: postAvg,
      passing_rate_pct: passingPct,
    }));
  };

  // Add external trainer
  const handleAddExtTrainerToForm = () => {
    if (!newExtTrainer.name?.trim()) return;
    const item: TrainingExternalTrainer = {
      id: `ext-tr-${Date.now()}`,
      name: newExtTrainer.name.trim(),
      organization: newExtTrainer.organization || 'Partenaire',
      role_title: newExtTrainer.role_title || 'Facilitateur',
      phone: newExtTrainer.phone || '',
      email: newExtTrainer.email || '',
    };
    setFormData(prev => ({
      ...prev,
      external_trainers: [...(prev.external_trainers || []), item],
    }));
    setNewExtTrainer({ name: '', organization: 'DDS', role_title: '', phone: '', email: '' });
  };

  // Remove external trainer
  const handleRemoveExtTrainerFromForm = (id: string) => {
    setFormData(prev => ({
      ...prev,
      external_trainers: (prev.external_trainers || []).filter(t => t.id !== id),
    }));
  };

  // Add photo
  const handleAddPhotoToForm = () => {
    if (!newPhotoUrl.trim()) return;
    const photo: TrainingPhoto = {
      id: `pho-${Date.now()}`,
      url: newPhotoUrl.trim(),
      caption: newPhotoCaption.trim() || 'Photo de la formation',
    };
    setFormData(prev => ({
      ...prev,
      photos: [...(prev.photos || []), photo],
    }));
    setNewPhotoUrl('');
    setNewPhotoCaption('');
  };

  // Remove photo
  const handleRemovePhotoFromForm = (id: string) => {
    setFormData(prev => ({
      ...prev,
      photos: (prev.photos || []).filter(p => p.id !== id),
    }));
  };

  // Save form (Create / Update)
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.topic?.trim()) {
      alert('Veuillez renseigner la thématique ou l’intitulé de la formation.');
      return;
    }

    if (formData.format === 'PRESENTIEL' && !formData.location?.trim()) {
      alert('Veuillez indiquer le lieu physique ou la salle de formation.');
      return;
    }

    if (formData.format === 'EN_LIGNE' && !formData.online_link?.trim()) {
      alert('Veuillez renseigner le lien de visioconférence (Google Meet, Teams, Zoom...).');
      return;
    }

    const actorsList = formData.trained_actors || [];
    const participantsCount = actorsList.length > 0 ? actorsList.length : (formData.participants_count || 0);
    const { preAvg, postAvg, passingPct } = recalculateAverages(actorsList);

    const trainingToSave: Training = {
      id: editingTraining ? editingTraining.id : `train-${Date.now()}`,
      code: formData.code || `FORM-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      topic: formData.topic.trim(),
      category: formData.category || 'ESIGL_REPORTING',
      milestone: formData.milestone || 'B09',
      work_plan_code: formData.work_plan_code || '',
      activity_id: formData.activity_id || '',
      activity_title: formData.activity_title || '',
      format: formData.format || 'PRESENTIEL',
      department: formData.department || 'Atacora',
      zone_sanitaire: formData.zone_sanitaire || '2KP',
      location: formData.location || '',
      online_link: formData.online_link || '',
      start_date: formData.start_date || new Date().toISOString().substring(0, 10),
      end_date: formData.end_date || formData.start_date || new Date().toISOString().substring(0, 10),
      duration_days: Number(formData.duration_days) || 1,
      training_date: formData.start_date || new Date().toISOString().substring(0, 10),
      trainer_ids: formData.trainer_ids && formData.trainer_ids.length > 0 ? formData.trainer_ids : [currentUser.id],
      external_trainers: formData.external_trainers || [],
      participants_count: participantsCount,
      trained_actors: actorsList,
      objectives: formData.objectives || '',
      modules_covered: formData.modules_covered || '',
      pre_test_avg: preAvg > 0 ? preAvg : (Number(formData.pre_test_avg) || 0),
      post_test_avg: postAvg > 0 ? postAvg : (Number(formData.post_test_avg) || 0),
      passing_rate_pct: passingPct > 0 ? passingPct : (Number(formData.passing_rate_pct) || 0),
      budget_allocated_fcfa: Number(formData.budget_allocated_fcfa) || 0,
      budget_spent_fcfa: Number(formData.budget_spent_fcfa) || 0,
      financial_partner: formData.financial_partner || 'AFGHS / PSI Bénin',
      summary_report: formData.summary_report || '',
      report_file_name: formData.report_file_name || '',
      attendance_sheet_file_name: formData.attendance_sheet_file_name || '',
      photos: formData.photos || [],
      post_training_follow_up: formData.post_training_follow_up || '',
      next_supervision_date: formData.next_supervision_date || '',
      status: formData.status || 'PLANIFIEE',
      updated_at: new Date().toISOString(),
      created_at: editingTraining?.created_at || new Date().toISOString(),
    };

    if (editingTraining) {
      updateTraining(trainingToSave);
    } else {
      addTraining(trainingToSave);
    }

    setFormModalOpen(false);
    setEditingTraining(null);
  };

  // Delete
  const handleDeleteTraining = (id: string) => {
    deleteTraining(id);
    setDeleteConfirmId(null);
    if (viewModalTraining?.id === id) setViewModalTraining(null);
  };

  // Export List Excel
  const handleExportListExcel = () => {
    const data = filteredTrainings.map(t => {
      const trainersList = t.trainer_ids
        .map(id => users.find(u => u.id === id)?.full_name)
        .filter(Boolean)
        .join(', ');
      const extTrainersList = (t.external_trainers || []).map(e => `${e.name} (${e.organization})`).join(', ');

      return {
        Code: t.code || t.id,
        Thème: t.topic,
        Jalon: t.milestone,
        'Activité Liée': `${t.work_plan_code || ''} - ${t.activity_title || ''}`,
        Format: FORMAT_LABELS[t.format]?.label || t.format,
        Département: t.department,
        'Zone Sanitaire': t.zone_sanitaire,
        Lieu: t.format === 'EN_LIGNE' ? t.online_link : t.location,
        'Date Début': t.start_date,
        'Date Fin': t.end_date,
        'Durée (Jours)': t.duration_days,
        Formateurs: trainersList + (extTrainersList ? ` | Co-facil: ${extTrainersList}` : ''),
        'Acteurs Formés': t.participants_count,
        'Moyenne Pré-test (%)': `${t.pre_test_avg}%`,
        'Moyenne Post-test (%)': `${t.post_test_avg}%`,
        'Gain Net': `+${(t.post_test_avg - t.pre_test_avg).toFixed(1)}%`,
        'Taux Réussite (%)': `${t.passing_rate_pct || 0}%`,
        'Budget Alloué (FCFA)': t.budget_allocated_fcfa || 0,
        'Dépenses (FCFA)': t.budget_spent_fcfa || 0,
        Partenaire: t.financial_partner || '',
        Statut: STATUS_LABELS[t.status]?.label || t.status,
      };
    });
    exportToExcel(data, `SANINOVA_Registre_Formations_${new Date().toISOString().substring(0, 10)}`);
  };

  // Export List PDF
  const handleExportListPdf = () => {
    const headers = ['Code & Jalon', 'Thème / Intitulé', 'Zone & Format', 'Période', 'Acteurs', 'Pré-test', 'Post-test', 'Statut'];
    const rows = filteredTrainings.map(t => [
      `${t.code || t.id}\nJalon ${t.milestone} ${t.work_plan_code ? `(${t.work_plan_code})` : ''}`,
      t.topic.length > 55 ? t.topic.substring(0, 52) + '...' : t.topic,
      `${t.department} - ${t.zone_sanitaire}\n${FORMAT_LABELS[t.format]?.label || t.format}`,
      `${t.start_date} au ${t.end_date}`,
      `${t.participants_count} apprenant(s)`,
      `${t.pre_test_avg}%`,
      `${t.post_test_avg}%\n(+${(t.post_test_avg - t.pre_test_avg).toFixed(1)}%)`,
      STATUS_LABELS[t.status]?.label || t.status,
    ]);

    exportTableToPdf(
      'Registre Officiel des Formations & Renforcement des Capacités',
      headers,
      rows,
      `SANINOVA_Formations_${new Date().toISOString().substring(0, 10)}`,
      `Total sessions : ${filteredTrainings.length} • Acteurs formés : ${stats.totalActorsCount} • Gain moyen post-test : +${stats.avgGain} points`
    );
  };

  // Export Single Training Official Sheet PDF
  const handleExportSingleTrainingPdf = (t: Training) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Band
    doc.setFillColor(13, 148, 136); // Teal 600
    doc.rect(0, 0, pageWidth, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SANINOVA — PROJET D’APPUI AU MINISTÈRE DE LA SANTÉ', 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('FICHE OFFICIELLE DE SESSION DE FORMATION & ATELIER DE RENFORCEMENT', 14, 19);

    // Title & Reference
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`RÉF : ${t.code || t.id} — JALON ${t.milestone} ${t.work_plan_code ? `(${t.work_plan_code})` : ''}`, 14, 34);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const splitTitle = doc.splitTextToSize(t.topic, pageWidth - 28);
    doc.text(splitTitle, 14, 40);

    let curY = 40 + splitTitle.length * 5 + 2;

    // Metadata Table
    const internalTrainersNames = t.trainer_ids
      .map(id => users.find(u => u.id === id)?.full_name)
      .filter(Boolean)
      .join(', ');
    const extTrainersNames = (t.external_trainers || []).map(e => `${e.name} (${e.organization})`).join(', ');

    const metaData = [
      ['Activité Liée Work Plan :', t.activity_title ? `${t.work_plan_code || ''} — ${t.activity_title}` : 'Activité transversale de renforcement'],
      ['Période & Durée :', `Du ${t.start_date} au ${t.end_date} (${t.duration_days} jour(s))`],
      ['Format & Emplacement :', `${FORMAT_LABELS[t.format]?.label || t.format} — ${t.format === 'EN_LIGNE' ? (t.online_link || 'Visio') : (t.location || 'Sur site')}`],
      ['Zone Géographique :', `Département : ${t.department} | Zone Sanitaire : ${t.zone_sanitaire}`],
      ['Formateur(s) SaniNova :', internalTrainersNames || 'Non spécifié'],
      ['Co-Facilitateur(s) :', extTrainersNames || 'Néant'],
      ['Bailleur & Budget :', `${t.financial_partner || 'Partenaire'} — Budget : ${(t.budget_allocated_fcfa || 0).toLocaleString('fr-FR')} FCFA (Dépensé : ${(t.budget_spent_fcfa || 0).toLocaleString('fr-FR')} FCFA)`],
      ['Statut de la session :', `${STATUS_LABELS[t.status]?.label || t.status}`],
    ];

    autoTable(doc, {
      startY: curY,
      head: [],
      body: metaData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, fillColor: [248, 250, 252] },
        1: { cellWidth: 'auto' },
      },
    });

    // @ts-expect-error autotable adds lastAutoTable
    curY = doc.lastAutoTable.finalY + 6;

    // Pedagogy & Evaluation summary
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BILAN PÉDAGOGIQUE & PERFORMANCE DE LA SESSION', 14, curY);

    const perfData = [
      [
        `Effectif : ${t.participants_count} acteur(s)`,
        `Score Pré-test : ${t.pre_test_avg}%`,
        `Score Post-test : ${t.post_test_avg}%`,
        `Gain Moyen : +${(t.post_test_avg - t.pre_test_avg).toFixed(1)} pts`,
        `Taux de Réussite : ${t.passing_rate_pct || 0}%`,
      ],
    ];

    autoTable(doc, {
      startY: curY + 2,
      head: [],
      body: perfData,
      theme: 'grid',
      styles: { fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: 3, fillColor: [240, 253, 250], textColor: [15, 118, 110] },
    });

    // @ts-expect-error autotable adds lastAutoTable
    curY = doc.lastAutoTable.finalY + 6;

    // Objectives snippet
    if (t.objectives) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Objectifs pédagogiques :', 14, curY);
      doc.setFont('helvetica', 'normal');
      const splitObj = doc.splitTextToSize(t.objectives, pageWidth - 28);
      doc.text(splitObj, 14, curY + 4);
      curY = curY + 4 + splitObj.length * 4 + 4;
    }

    // Table of Trained Actors
    const actors = t.trained_actors || [];
    if (actors.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`LISTE ÉMARGÉE DES ACTEURS FORMÉS (${actors.length} PARTICIPANTS)`, 14, curY);

      const actorsHeaders = ['N°', 'Nom & Prénoms', 'Genre', 'Profession / Cadre', 'FOSA / Structure', 'Zone', 'Pré', 'Post', 'Résultat'];
      const actorsRows = actors.map((a, i) => [
        String(i + 1),
        a.full_name,
        a.gender,
        a.profession,
        a.structure_fosa,
        a.zone_sanitaire,
        `${a.pre_test_score || 0}%`,
        `${a.post_test_score || 0}%`,
        a.evaluation_result === 'REUSSI' ? 'Admis' : (a.evaluation_result === 'AJOURNE' ? 'Ajourné' : 'Non éval.'),
      ]);

      autoTable(doc, {
        startY: curY + 2,
        head: [actorsHeaders],
        body: actorsRows,
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 32 },
          4: { cellWidth: 30 },
          5: { cellWidth: 18 },
          6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 12, halign: 'center' },
          8: { cellWidth: 16, halign: 'center' },
        },
      });

      // @ts-expect-error autotable adds lastAutoTable
      curY = doc.lastAutoTable.finalY + 8;
    }

    // Signatures
    if (curY > 240) {
      doc.addPage();
      curY = 20;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Le Formateur Principal / Lead SIS', 20, curY);
    doc.text('Le Directeur de Projet SaniNova', pageWidth - 80, curY);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text('(Signature & Date)', 20, curY + 4);
    doc.text('(Visa hiérarchique)', pageWidth - 80, curY + 4);

    doc.save(`Fiche_Formation_${t.code || t.id}_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  return (
    <ModuleGuard moduleId="formations">
      <div className="space-y-6 font-sans">
        
        {/* EN-TÊTE DU MODULE */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs border border-white/20">
                Module 6 &bull; Capacités & Formations
              </span>
              <span className="text-xs text-teal-200 font-medium">
                Liaisons Jalons B09 / B13 &bull; Work Plan &bull; Répertoire des Acteurs
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Formations & Renforcement des Capacités des Acteurs
            </h1>
            <p className="text-xs text-teal-100/90 max-w-2xl leading-relaxed">
              Planification des sessions, suivi des acteurs formés (gestionnaires de stock, FOSA, cadres DDS), liaisons directes avec le Work Plan, évaluation pédagogique pré/post-test et archivage des livrables.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportListExcel}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition flex items-center space-x-1.5 shadow-xs"
              title="Exporter toutes les formations filtrées vers Excel"
            >
              <span>📊</span>
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportListPdf}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition flex items-center space-x-1.5 shadow-xs"
              title="Générer le registre consolidé en PDF"
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
              <span>Nouvelle Formation</span>
            </button>
          </div>
        </div>

        {/* CARTES DE STATISTIQUES (KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center space-x-1">
              <span>✅</span>
              <span>Évaluées & Terminées</span>
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{stats.evaluatedSessions}</div>
            <span className="text-[10px] text-emerald-700 font-medium">Sessions avec bilan</span>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-blue-800 uppercase flex items-center space-x-1">
              <span>📅</span>
              <span>Planifiées / À venir</span>
            </span>
            <div className="text-2xl font-black text-blue-900 mt-1">{stats.plannedSessions}</div>
            <span className="text-[10px] text-blue-700 font-medium">En préparation</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Acteurs Formés</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalActorsCount}</div>
            <span className="text-[10px] text-teal-800 font-medium">
              {stats.menCount > 0 ? `${stats.menCount}H / ${stats.womenCount}F` : 'Effectif global'}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-indigo-200 bg-indigo-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-indigo-800 uppercase">Jalons B09 & B13</span>
            <div className="text-xl font-black text-indigo-900 mt-1">
              {stats.b09Count} <span className="text-xs text-slate-400 font-medium">B09</span> / {stats.b13Count} <span className="text-xs text-slate-400 font-medium">B13</span>
            </div>
            <span className="text-[10px] text-indigo-700 font-medium">Promptitude & Quantif</span>
          </div>

          <div className="bg-white rounded-xl border border-teal-200 bg-teal-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-teal-800 uppercase">Gain Post-test</span>
            <div className="text-2xl font-black text-teal-900 mt-1">+{stats.avgGain} pts</div>
            <span className="text-[10px] text-teal-700 font-medium">{stats.avgPreTest}% ➔ {stats.avgPostTest}%</span>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-800 uppercase">Clichés & Preuves</span>
            <div className="text-2xl font-black text-amber-900 mt-1">{stats.totalPhotos}</div>
            <span className="text-[10px] text-amber-700 font-medium">Photos et émargements</span>
          </div>
        </div>

        {/* ONGLET DE NAVIGATION & COMMUTATEUR DE VUE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 items-center">
            <button
              type="button"
              onClick={() => setActiveTab('EVALUEES')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'EVALUEES'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>✅</span>
              <span>Formations Déjà Réalisées & Évaluées ({stats.evaluatedSessions})</span>
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
              <span>Toutes les Sessions ({trainings.length})</span>
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
              <span>Sessions Planifiées ({stats.plannedSessions})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ACTEURS')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'ACTEURS'
                  ? 'bg-indigo-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>👥</span>
              <span>Répertoire des Acteurs Formés ({stats.nominalActorsCount})</span>
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
              <span>Photos des Ateliers ({stats.totalPhotos})</span>
            </button>
          </div>

          {/* Commutateur de Mode (Tableau / Cartes) */}
          {activeTab !== 'ACTEURS' && activeTab !== 'PHOTOS' && (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vue Tableau fluide et rapide"
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
          )}
        </div>

        {/* FILTRES & RECHERCHE AVANCÉE */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Recherche mot-clé :</label>
              <input
                type="text"
                placeholder="Thème, acteur, FOSA, zone, lieu, formateur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Jalon du projet :</label>
              <select
                value={selectedMilestone}
                onChange={(e) => {
                  setSelectedMilestone(e.target.value);
                  setSelectedActivity('ALL');
                }}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les jalons</option>
                <option value="B09">B09 - Promptitude eSIGL</option>
                <option value="B13">B13 - Quantification & Appro</option>
                <option value="TRANSVERSAL">Transversal</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Activité Liée :</label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Toutes les activités</option>
                {activities
                  .filter(a => selectedMilestone === 'ALL' || a.milestone === selectedMilestone)
                  .map(a => (
                    <option key={a.id} value={a.code}>
                      {a.code} - {a.title.substring(0, 35)}...
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Département :</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les départements</option>
                {departmentOptions.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Format de session :</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium bg-white"
              >
                <option value="ALL">Tous les formats</option>
                <option value="PRESENTIEL">📍 Présentiel</option>
                <option value="EN_LIGNE">💻 En ligne (Visio)</option>
                <option value="HYBRIDE">🌐 Hybride (Mixte)</option>
                <option value="COACHING_SITE">🩺 Coaching sur site</option>
              </select>
            </div>
          </div>
        </div>

        {/* CONTENU PRINCIPAL SELON L'ONGLET ACTIF */}
        {activeTab === 'PHOTOS' ? (
          /* VUE GALERIE PHOTOS */
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Galerie Photographique & Justificatifs des Ateliers de Formation
              </h2>
              <p className="text-xs text-slate-500">
                Prises de vue des sessions en salle, travaux pratiques sur simulateur eSIGL/QAT et remises d’attestations.
              </p>
            </div>

            {stats.totalPhotos === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Aucune photo enregistrée pour le moment. Vous pouvez en associer lors de la création ou l’édition d’une formation.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {trainings.flatMap(t => (t.photos || []).map(p => ({ ...p, trainingTopic: t.topic, trainingDate: t.training_date, trainingZone: t.zone_sanitaire }))).map(photo => (
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
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                    </div>
                    <div className="p-3 bg-white">
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">{photo.caption}</p>
                      <p className="text-[10px] text-teal-800 font-medium mt-0.5 line-clamp-1">{photo.trainingTopic}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">{photo.trainingDate} &bull; {photo.trainingZone}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'ACTEURS' ? (
          /* VUE RÉPERTOIRE DES ACTEURS FORMÉS */
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Répertoire Consolidé des Acteurs Formés ({allTrainedActorsList.length} acteurs)
                </h2>
                <p className="text-xs text-slate-500">
                  Gestionnaires de dépôt, chefs de poste, pharmaciens et cadres départementaux formés sur eSIGL et QAT.
                </p>
              </div>
              <div className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                👥 Hommes : <span className="font-bold text-slate-900">{stats.menCount}</span> | Femmes : <span className="font-bold text-slate-900">{stats.womenCount}</span>
              </div>
            </div>

            {allTrainedActorsList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Aucun acteur individuel enregistré dans les sessions de formation. Vous pouvez en ajouter directement dans chaque fiche de formation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Nom & Prénoms</th>
                      <th className="py-2.5 px-3">Genre</th>
                      <th className="py-2.5 px-3">Profession / Fonction</th>
                      <th className="py-2.5 px-3">Structure / FOSA</th>
                      <th className="py-2.5 px-3">Zone & Dépt</th>
                      <th className="py-2.5 px-3">Formation Associée</th>
                      <th className="py-2.5 px-3 text-center">Pré-test</th>
                      <th className="py-2.5 px-3 text-center">Post-test</th>
                      <th className="py-2.5 px-3 text-center">Résultat</th>
                      <th className="py-2.5 px-3 text-center">Attestation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allTrainedActorsList.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {a.full_name}
                          {a.phone && <span className="block text-[10px] text-slate-400 font-normal">{a.phone}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.gender === 'F' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {a.gender}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {a.profession}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-semibold">
                          {a.structure_fosa}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {a.zone_sanitaire} ({a.department})
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 max-w-xs">
                          <span className="font-bold text-teal-800 block truncate">{a.trainingTopic}</span>
                          <span className="text-[10px] text-slate-400">Jalon {a.trainingMilestone} &bull; {a.trainingDate}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {a.pre_test_score || 0}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800">
                          {a.post_test_score || 0}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.evaluation_result === 'REUSSI' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {a.evaluation_result === 'REUSSI' ? 'Admis' : 'Ajourné'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {a.certificate_issued ? (
                            <span className="text-emerald-700 text-xs font-bold" title="Attestation délivrée">🏅 Délivrée</span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">En attente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* VUE LISTE DES SESSIONS DE FORMATION (TABLEAU OU CARTES) */
          <div className="space-y-4">
            {/* Barre de contrôle du résumé des résultats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">
                  {filteredTrainings.length} session{filteredTrainings.length > 1 ? 's' : ''} affichée{filteredTrainings.length > 1 ? 's' : ''}
                </span>
                <span>&bull;</span>
                <span className="text-teal-800 font-medium">
                  {activeTab === 'EVALUEES' && 'Filtre : Sessions Réalisées & Évaluées'}
                  {activeTab === 'ALL' && 'Filtre : Toutes les Sessions'}
                  {activeTab === 'PLANIFIEES' && 'Filtre : Sessions Planifiées / À venir'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Mode d’affichage : <span className="font-bold text-slate-700">{viewMode === 'TABLE' ? '📑 Vue Tableau' : '🗂️ Vue Cartes'}</span>
              </div>
            </div>

            {filteredTrainings.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 space-y-3 shadow-xs">
                <span className="text-4xl">🔍</span>
                <p className="text-sm font-semibold text-slate-700">Aucune formation ne correspond aux critères de recherche sélectionnés.</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Vérifiez le filtre par jalon, activité ou département, ou réinitialisez les critères.
                </p>
                <button
                  type="button"
                  onClick={() => { setSelectedMilestone('ALL'); setSelectedActivity('ALL'); setSelectedDept('ALL'); setSelectedZone('ALL'); setSelectedFormat('ALL'); setSelectedStatus('ALL'); setSearchQuery(''); setActiveTab('ALL'); }}
                  className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold hover:bg-teal-900 transition shadow-xs"
                >
                  Afficher toutes les formations
                </button>
              </div>
            ) : viewMode === 'TABLE' ? (
              /* VUE TABLEAU FLUIDE AVEC LES 3 BOUTONS EXPLICITES : VOIR, MODIFIER, SUPPRIMER */
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4 whitespace-nowrap">Dates & Jalon</th>
                        <th className="py-3 px-4 min-w-[260px]">Thématique & Activité Liée</th>
                        <th className="py-3 px-4 min-w-[170px]">Format & Lieu / Visio</th>
                        <th className="py-3 px-4 whitespace-nowrap">Formateur(s)</th>
                        <th className="py-3 px-4 whitespace-nowrap text-center">Acteurs Formés</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">Performance</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">Statut</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap min-w-[270px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTrainings.map(t => {
                        const formatMeta = FORMAT_LABELS[t.format] || FORMAT_LABELS.PRESENTIEL;
                        const statusMeta = STATUS_LABELS[t.status] || STATUS_LABELS.PLANIFIEE;
                        const trainersList = t.trainer_ids
                          .map(id => users.find(u => u.id === id)?.full_name)
                          .filter(Boolean);
                        const actorsCount = t.trained_actors?.length || t.participants_count;
                        const hasEval = t.status === 'EVALUEE' || t.status === 'REALISEE';

                        return (
                          <tr key={t.id} className="hover:bg-teal-50/20 transition group">
                            {/* Dates & Jalon */}
                            <td className="py-3 px-4 whitespace-nowrap align-top">
                              <div className="flex items-center space-x-1.5 mb-1">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                  t.milestone === 'B09' ? 'badge-b09' : (t.milestone === 'B13' ? 'badge-b13' : 'bg-slate-100 text-slate-800')
                                }`}>
                                  Jalon {t.milestone}
                                </span>
                                {t.work_plan_code && (
                                  <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                    {t.work_plan_code}
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-slate-900 flex items-center space-x-1">
                                <span>📅</span>
                                <span>{t.start_date}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {t.duration_days} jour(s) &bull; fin {t.end_date}
                              </div>
                            </td>

                            {/* Thématique & Activité */}
                            <td className="py-3 px-4 align-top">
                              <p className="font-bold text-slate-900 leading-snug">
                                {t.topic}
                              </p>
                              {t.activity_title && (
                                <p className="text-[11px] text-teal-800 font-semibold mt-1">
                                  🔗 {t.work_plan_code ? `[${t.work_plan_code}] ` : ''}{t.activity_title}
                                </p>
                              )}
                              {t.objectives && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                  &laquo; {t.objectives} &raquo;
                                </p>
                              )}
                            </td>

                            {/* Format & Lieu */}
                            <td className="py-3 px-4 align-top">
                              <div className="mb-1">
                                <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${formatMeta.badge}`}>
                                  <span>{formatMeta.icon}</span>
                                  <span>{formatMeta.label}</span>
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-700 truncate max-w-xs font-medium">
                                {t.format === 'EN_LIGNE' ? (
                                  t.online_link ? (
                                    <a
                                      href={t.online_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-teal-800 hover:underline flex items-center space-x-1"
                                    >
                                      <span>🔗</span>
                                      <span className="truncate">Lien visio</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 italic">Lien non défini</span>
                                  )
                                ) : (
                                  <span>📍 {t.location || `${t.department} - ${t.zone_sanitaire}`}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {t.department} &bull; {t.zone_sanitaire}
                              </div>
                            </td>

                            {/* Formateurs */}
                            <td className="py-3 px-4 whitespace-nowrap align-top font-medium text-slate-800">
                              <div className="space-y-0.5">
                                {trainersList.slice(0, 2).map((tr, i) => (
                                  <div key={i} className="text-[11px] flex items-center space-x-1 text-slate-800">
                                    <span>👤</span>
                                    <span>{tr}</span>
                                  </div>
                                ))}
                                {(t.external_trainers || []).length > 0 && (
                                  <div className="text-[10px] text-indigo-700 font-bold">
                                    +{(t.external_trainers || []).length} facilitateur(s) externe(s)
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Acteurs formés */}
                            <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                              <div className="font-bold text-slate-900 text-sm">
                                {actorsCount}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                acteur(s) formé(s)
                              </div>
                              {t.trained_actors && t.trained_actors.length > 0 && (
                                <span className="inline-block mt-0.5 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                                  {t.trained_actors.filter(a => a.gender === 'F').length}F / {t.trained_actors.filter(a => a.gender === 'M').length}H
                                </span>
                              )}
                            </td>

                            {/* Performance Pré / Post */}
                            <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                              {hasEval && t.post_test_avg > 0 ? (
                                <div>
                                  <div className="font-bold text-emerald-800 text-xs">
                                    {t.pre_test_avg}% ➔ {t.post_test_avg}%
                                  </div>
                                  <div className="text-[10px] text-emerald-700 font-bold">
                                    +{ (t.post_test_avg - t.pre_test_avg).toFixed(1) } pts
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">À évaluer</span>
                              )}
                            </td>

                            {/* Statut */}
                            <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                              <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusMeta.badge}`}>
                                {statusMeta.label}
                              </span>
                            </td>

                            {/* ACTIONS EXPLICITES : VOIR, MODIFIER, SUPPRIMER, PDF */}
                            <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                              <div className="flex items-center justify-center space-x-1.5">
                                {/* Bouton VOIR */}
                                <button
                                  type="button"
                                  onClick={() => setViewModalTraining(t)}
                                  className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-300 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Consulter la fiche détaillée, liste des acteurs formés et livrables"
                                >
                                  <span>👁️</span>
                                  <span>Voir</span>
                                </button>

                                {/* Bouton MODIFIER */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(t)}
                                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Modifier les informations, ajouter des acteurs ou saisir les scores"
                                >
                                  <span>✏️</span>
                                  <span>Modifier</span>
                                </button>

                                {/* Bouton SUPPRIMER */}
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(t.id)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-300 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Supprimer cette session"
                                >
                                  <span>🗑️</span>
                                  <span>Supprimer</span>
                                </button>

                                {/* Bouton PDF */}
                                <button
                                  type="button"
                                  onClick={() => handleExportSingleTrainingPdf(t)}
                                  className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition inline-flex items-center space-x-1 shadow-2xs hover:shadow-xs"
                                  title="Télécharger la fiche officielle et liste émargée en PDF"
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
              /* VUE CARTES AVEC LES BOUTONS EXPLICITES : VOIR, MODIFIER, SUPPRIMER */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTrainings.map(t => {
                  const formatMeta = FORMAT_LABELS[t.format] || FORMAT_LABELS.PRESENTIEL;
                  const statusMeta = STATUS_LABELS[t.status] || STATUS_LABELS.PLANIFIEE;
                  const trainersList = t.trainer_ids
                    .map(id => users.find(u => u.id === id)?.full_name)
                    .filter(Boolean)
                    .join(', ');
                  const hasEvaluation = t.status === 'EVALUEE' || t.status === 'REALISEE';

                  return (
                    <div
                      key={t.id}
                      className="bg-white rounded-xl border border-slate-200 hover:border-teal-600 transition shadow-xs hover:shadow-sm p-5 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        {/* Badges d'en-tête */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.milestone === 'B09' ? 'badge-b09' : (t.milestone === 'B13' ? 'badge-b13' : 'bg-slate-100 text-slate-800')
                            }`}>
                              Jalon {t.milestone}
                            </span>
                            {t.work_plan_code && (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                {t.work_plan_code}
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badge}`}>
                            {statusMeta.label}
                          </span>
                        </div>

                        {/* Titre & Activité */}
                        <h3 className="font-bold text-slate-900 text-sm leading-snug">
                          {t.topic}
                        </h3>

                        {t.activity_title && (
                          <p className="text-[11px] text-teal-800 font-semibold mt-1">
                            🔗 {t.work_plan_code ? `[${t.work_plan_code}] ` : ''}{t.activity_title}
                          </p>
                        )}

                        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${formatMeta.badge}`}>
                            {formatMeta.icon} {formatMeta.label}
                          </span>
                          <span>&bull;</span>
                          <span>{t.department} - {t.zone_sanitaire}</span>
                        </div>

                        <p className="text-xs text-slate-600 mt-2">
                          <span className="font-semibold text-slate-700">Formateurs :</span> {trainersList || 'Équipe SaniNova'}
                        </p>
                      </div>

                      {/* Évaluation pré/post test */}
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                          <span>📅 {t.start_date} ({t.duration_days} j)</span>
                          <span className="font-semibold text-slate-800 font-sans">
                            👥 {t.participants_count || (t.trained_actors ? t.trained_actors.length : 0)} participants
                          </span>
                        </div>

                        {hasEvaluation && t.post_test_avg > 0 ? (
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-600">Score Pré-test :</span>
                              <span className="text-slate-800">{t.pre_test_avg}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-slate-500 h-1.5 rounded-full" style={{ width: `${t.pre_test_avg}%` }} />
                            </div>

                            <div className="flex justify-between text-xs font-semibold pt-1">
                              <span className="text-emerald-800">Score Post-test :</span>
                              <span className="text-emerald-800 font-bold">
                                {t.post_test_avg}% (+{(t.post_test_avg - t.pre_test_avg).toFixed(1)} pts)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${t.post_test_avg}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-2.5 bg-slate-50 rounded-lg text-slate-400 text-xs italic border border-slate-200">
                            Session planifiée — Évaluation à venir.
                          </div>
                        )}

                        {/* Boutons explicites d'action */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setViewModalTraining(t)}
                            className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold border border-teal-300 transition flex items-center space-x-1 shadow-2xs"
                          >
                            <span>👁️</span>
                            <span>Voir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(t)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition flex items-center space-x-1 shadow-2xs"
                          >
                            <span>✏️</span>
                            <span>Modifier</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(t.id)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-300 transition flex items-center space-x-1 shadow-2xs"
                          >
                            <span>🗑️</span>
                            <span>Supprimer</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSingleTrainingPdf(t)}
                            className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition flex items-center space-x-1 shadow-2xs"
                            title="Télécharger la fiche PDF"
                          >
                            <span>📄</span>
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL CRÉATION / MODIFICATION D'UNE FORMATION */}
        {formModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden border border-slate-200">
              
              {/* Entête Modal */}
              <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">
                    {editingTraining ? '✏️ Modifier la Session de Formation' : '➕ Planifier / Enregistrer une Formation'}
                  </h3>
                  <p className="text-xs text-teal-200">
                    Liaison Jalon & Activité Work Plan, suivi des acteurs formés, formateurs et évaluation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg transition"
                >
                  ✕
                </button>
              </div>

              {/* Onglets internes du formulaire */}
              <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setFormModalTab('GENERAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    formModalTab === 'GENERAL' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>📌</span>
                  <span>1. Cadrage & Liaisons</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormModalTab('ACTEURS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    formModalTab === 'ACTEURS' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>👥</span>
                  <span>2. Acteurs Formés ({formData.trained_actors?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormModalTab('PEDAGOGIE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    formModalTab === 'PEDAGOGIE' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🎯</span>
                  <span>3. Objectifs & Rapport</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormModalTab('PHOTOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    formModalTab === 'PHOTOS' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>📸</span>
                  <span>4. Photos & Justificatifs ({formData.photos?.length || 0})</span>
                </button>
              </div>

              {/* Formulaire Principal */}
              <form onSubmit={handleSaveForm} className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
                
                {/* ONGLET 1 : CADRAGE & LIAISONS */}
                {formModalTab === 'GENERAL' && (
                  <div className="space-y-4">
                    {/* Thématique */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Thématique / Intitulé de la formation *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Formation des gestionnaires de dépôt sur la saisie des rapports périodiques eSIGL"
                        value={formData.topic || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    {/* Code & Statut */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Code Session :
                        </label>
                        <input
                          type="text"
                          value={formData.code || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                          placeholder="FORM-2026-001"
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Jalon du Projet (Milestone) *
                        </label>
                        <select
                          value={formData.milestone || 'B09'}
                          onChange={(e) => {
                            const newM = e.target.value as MilestoneType;
                            setFormData(prev => ({ 
                              ...prev, 
                              milestone: newM,
                              work_plan_code: '',
                              activity_id: '',
                              activity_title: '',
                            }));
                          }}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-semibold bg-white"
                        >
                          <option value="B09">B09 - Promptitude eSIGL (&ge; 70%)</option>
                          <option value="B13">B13 - Quantification & Approvisionnements</option>
                          <option value="TRANSVERSAL">Transversal / Coordination</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Statut de la session :
                        </label>
                        <select
                          value={formData.status || 'PLANIFIEE'}
                          onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as TrainingStatus }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-semibold bg-white"
                        >
                          <option value="PLANIFIEE">Planifiée</option>
                          <option value="EN_COURS">En cours</option>
                          <option value="REALISEE">Réalisée</option>
                          <option value="EVALUEE">Évaluée & Validée</option>
                          <option value="REPORTEE">Reportée</option>
                          <option value="ANNULEE">Annulée</option>
                        </select>
                      </div>
                    </div>

                    {/* LIAISON DIRECTE AVEC L'ACTIVITÉ DU WORK PLAN */}
                    <div className="bg-teal-50/60 p-4 rounded-xl border border-teal-200 space-y-2">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-teal-900">
                        <span>🔗</span>
                        <span>Liaison avec l’Activité du Work Plan SaniNova :</span>
                      </div>
                      <select
                        value={formData.activity_id || ''}
                        onChange={(e) => {
                          const actId = e.target.value;
                          const found = activities.find(a => a.id === actId);
                          setFormData(prev => ({
                            ...prev,
                            activity_id: actId,
                            work_plan_code: found ? found.code : '',
                            activity_title: found ? found.title : '',
                          }));
                        }}
                        className="w-full text-xs border border-teal-300 rounded-lg p-2.5 font-medium bg-white outline-none focus:border-teal-700"
                      >
                        <option value="">Sélectionner une activité du Work Plan liée au jalon {formData.milestone}...</option>
                        {availableActivitiesForMilestone.map(a => (
                          <option key={a.id} value={a.id}>
                            [{a.code}] {a.title}
                          </option>
                        ))}
                      </select>
                      {formData.activity_title && (
                        <p className="text-[11px] text-teal-800 italic">
                          Activité retenue : <span className="font-bold">{formData.work_plan_code}</span> &bull; {formData.activity_title}
                        </p>
                      )}
                    </div>

                    {/* FORMAT DE FORMATION & LIEU / VISIO */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Format de la séance *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['PRESENTIEL', 'EN_LIGNE', 'HYBRIDE', 'COACHING_SITE'] as TrainingFormat[]).map(fmt => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, format: fmt }))}
                            className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                              formData.format === fmt
                                ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xl">{FORMAT_LABELS[fmt].icon}</span>
                            <span className="text-xs font-bold">{FORMAT_LABELS[fmt].label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Champs conditionnels selon format */}
                      {formData.format === 'EN_LIGNE' ? (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Lien de la visioconférence (Google Meet, Teams...) *
                          </label>
                          <input
                            type="url"
                            required
                            placeholder="https://meet.google.com/xxx-yyyy-zzz"
                            value={formData.online_link || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, online_link: e.target.value }))}
                            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Département :</label>
                            <select
                              value={formData.department || 'Atacora'}
                              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                            >
                              {departmentOptions.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Zone Sanitaire :</label>
                            <input
                              type="text"
                              value={formData.zone_sanitaire || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, zone_sanitaire: e.target.value }))}
                              placeholder="Ex: 2KP, Bassila, DCO..."
                              className="w-full text-xs border border-slate-300 rounded-lg p-2"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                              Lieu physique / Salle de formation * :
                            </label>
                            <input
                              type="text"
                              required={formData.format === 'PRESENTIEL'}
                              placeholder="Ex: Salle de conférence HZ Kouandé..."
                              value={formData.location || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                              className="w-full text-xs border border-slate-300 rounded-lg p-2"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DATES & DURÉE */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date de début :</label>
                        <input
                          type="date"
                          value={formData.start_date || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value, training_date: e.target.value }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date de fin :</label>
                        <input
                          type="date"
                          value={formData.end_date || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Durée (jours) :</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={formData.duration_days || 1}
                          onChange={(e) => setFormData(prev => ({ ...prev, duration_days: Number(e.target.value) }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2"
                        />
                      </div>
                    </div>

                    {/* FORMATEURS SaniNova (Internes) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Formateurs internes SaniNova (Équipe technique) :
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-36 overflow-y-auto">
                        {users.map(u => {
                          const isSelected = (formData.trainer_ids || []).includes(u.id);
                          return (
                            <label key={u.id} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData(prev => ({
                                    ...prev,
                                    trainer_ids: checked
                                      ? [...(prev.trainer_ids || []), u.id]
                                      : (prev.trainer_ids || []).filter(id => id !== u.id),
                                  }));
                                }}
                                className="rounded text-teal-800"
                              />
                              <span className="font-medium">{u.full_name}</span>
                              <span className="text-[10px] text-slate-400">({u.title})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* CO-FACILITATEURS PARTENAIRES (Externes) */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Facilitateurs / Co-formateurs externes (ABMeD, DDS, SoBAPS, AFGHS/PSI...) :
                      </label>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Nom & Prénom"
                          value={newExtTrainer.name || ''}
                          onChange={(e) => setNewExtTrainer(prev => ({ ...prev, name: e.target.value }))}
                          className="text-xs border border-slate-300 rounded-lg p-2 w-44"
                        />
                        <input
                          type="text"
                          placeholder="Structure (ex: DDS Atacora)"
                          value={newExtTrainer.organization || ''}
                          onChange={(e) => setNewExtTrainer(prev => ({ ...prev, organization: e.target.value }))}
                          className="text-xs border border-slate-300 rounded-lg p-2 w-36"
                        />
                        <input
                          type="text"
                          placeholder="Fonction"
                          value={newExtTrainer.role_title || ''}
                          onChange={(e) => setNewExtTrainer(prev => ({ ...prev, role_title: e.target.value }))}
                          className="text-xs border border-slate-300 rounded-lg p-2 w-32"
                        />
                        <button
                          type="button"
                          onClick={handleAddExtTrainerToForm}
                          className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition"
                        >
                          + Ajouter
                        </button>
                      </div>

                      {(formData.external_trainers || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {formData.external_trainers?.map(ext => (
                            <span key={ext.id} className="text-xs bg-indigo-50 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center space-x-1">
                              <span>👤 {ext.name} ({ext.organization})</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtTrainerFromForm(ext.id)}
                                className="text-rose-600 hover:text-rose-800 font-bold ml-1"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* BUDGET & BAILLEUR */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Budget Alloué (FCFA) :</label>
                        <input
                          type="number"
                          value={formData.budget_allocated_fcfa || 0}
                          onChange={(e) => setFormData(prev => ({ ...prev, budget_allocated_fcfa: Number(e.target.value) }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Dépenses Réalisées (FCFA) :</label>
                        <input
                          type="number"
                          value={formData.budget_spent_fcfa || 0}
                          onChange={(e) => setFormData(prev => ({ ...prev, budget_spent_fcfa: Number(e.target.value) }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Partenaire Financier :</label>
                        <input
                          type="text"
                          value={formData.financial_partner || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, financial_partner: e.target.value }))}
                          placeholder="AFGHS / PSI Bénin"
                          className="w-full text-xs border border-slate-300 rounded-lg p-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : ACTEURS FORMÉS (APPRENANTS NOMINATIFS) */}
                {formModalTab === 'ACTEURS' && (
                  <div className="space-y-4">
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-indigo-900 uppercase">
                          Ajouter un Acteur Formé (Participant) :
                        </h4>
                        <span className="text-[11px] text-indigo-700">
                          {formData.trained_actors?.length || 0} acteur(s) enregistré(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Nom & Prénoms * :</label>
                          <input
                            type="text"
                            placeholder="Ex: Bio SOULE"
                            value={newActor.full_name || ''}
                            onChange={(e) => setNewActor(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Genre :</label>
                          <select
                            value={newActor.gender || 'M'}
                            onChange={(e) => setNewActor(prev => ({ ...prev, gender: e.target.value as ActorGender }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white font-bold"
                          >
                            <option value="M">Masculin (M)</option>
                            <option value="F">Féminin (F)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Profession / Cadre :</label>
                          <input
                            type="text"
                            placeholder="Gestionnaire de Dépôt"
                            value={newActor.profession || ''}
                            onChange={(e) => setNewActor(prev => ({ ...prev, profession: e.target.value }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Structure / FOSA :</label>
                          <input
                            type="text"
                            placeholder="Ex: CS Kouandé ou Dépôt 2KP"
                            value={newActor.structure_fosa || ''}
                            onChange={(e) => setNewActor(prev => ({ ...prev, structure_fosa: e.target.value }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Zone Sanitaire :</label>
                          <input
                            type="text"
                            placeholder="2KP"
                            value={newActor.zone_sanitaire || formData.zone_sanitaire || ''}
                            onChange={(e) => setNewActor(prev => ({ ...prev, zone_sanitaire: e.target.value }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Téléphone :</label>
                          <input
                            type="text"
                            placeholder="+229 97 00 00 00"
                            value={newActor.phone || ''}
                            onChange={(e) => setNewActor(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Score Pré-test (%) :</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newActor.pre_test_score || 0}
                            onChange={(e) => setNewActor(prev => ({ ...prev, pre_test_score: Number(e.target.value) }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Score Post-test (%) :</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={newActor.post_test_score || 0}
                            onChange={(e) => setNewActor(prev => ({ ...prev, post_test_score: Number(e.target.value) }))}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white font-mono"
                          />
                        </div>

                        <div className="flex items-center space-x-2 pt-4">
                          <label className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                            <input
                              type="checkbox"
                              checked={Boolean(newActor.certificate_issued)}
                              onChange={(e) => setNewActor(prev => ({ ...prev, certificate_issued: e.target.checked }))}
                              className="rounded text-teal-800"
                            />
                            <span>Attestation</span>
                          </label>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleAddActorToForm}
                            className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold transition shadow-xs"
                          >
                            + Ajouter l’Acteur
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table des acteurs déjà ajoutés */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 p-2.5 font-bold text-xs text-slate-700 flex justify-between items-center">
                        <span>Tableau des apprenants de la session :</span>
                        <div className="text-[11px] font-mono space-x-2">
                          <span>Moy. Pré : <span className="font-bold">{formData.pre_test_avg}%</span></span>
                          <span>&bull;</span>
                          <span>Moy. Post : <span className="font-bold text-emerald-800">{formData.post_test_avg}%</span></span>
                          <span>&bull;</span>
                          <span>Réussite : <span className="font-bold text-emerald-800">{formData.passing_rate_pct}%</span></span>
                        </div>
                      </div>

                      {(!formData.trained_actors || formData.trained_actors.length === 0) ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          Aucun acteur ajouté pour l’instant. Saisissez les participants ci-dessus.
                        </div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase sticky top-0">
                              <tr>
                                <th className="p-2">Nom</th>
                                <th className="p-2">Genre</th>
                                <th className="p-2">Fonction</th>
                                <th className="p-2">FOSA</th>
                                <th className="p-2 text-center">Pré</th>
                                <th className="p-2 text-center">Post</th>
                                <th className="p-2 text-center">Statut</th>
                                <th className="p-2 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {formData.trained_actors.map((actor, idx) => (
                                <tr key={actor.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2 font-bold text-slate-900">{actor.full_name}</td>
                                  <td className="p-2 text-center font-bold text-[10px]">{actor.gender}</td>
                                  <td className="p-2 text-slate-600">{actor.profession}</td>
                                  <td className="p-2 text-slate-700">{actor.structure_fosa}</td>
                                  <td className="p-2 text-center font-mono">{actor.pre_test_score}%</td>
                                  <td className="p-2 text-center font-mono font-bold text-emerald-800">{actor.post_test_score}%</td>
                                  <td className="p-2 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      actor.post_test_score && actor.post_test_score >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {actor.post_test_score && actor.post_test_score >= 70 ? 'Admis' : 'Ajourné'}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveActorFromForm(actor.id)}
                                      className="text-rose-600 hover:text-rose-800 font-bold text-xs"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ONGLET 3 : PÉDAGOGIE, OBJECTIFS & RECOMMANDATIONS */}
                {formModalTab === 'PEDAGOGIE' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Objectifs pédagogiques & compétences visées :
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Ex: Former 25 gestionnaires de stock à la complétude et à la promptitude eSIGL..."
                        value={formData.objectives || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, objectives: e.target.value }))}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Modules abordés & Programme pédagogique :
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Ex: Module 1 : Navigation eSIGL&#10;Module 2 : Calcul des consommations moyennes mensuelles..."
                        value={formData.modules_covered || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, modules_covered: e.target.value }))}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Synthèse du rapport de formation :
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Compte-rendu succinct du déroulement, faits marquants et résultats..."
                        value={formData.summary_report || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, summary_report: e.target.value }))}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Nom du fichier Rapport PDF joint :
                        </label>
                        <input
                          type="text"
                          placeholder="Rapport_Formation_Kouande_Octobre2026.pdf"
                          value={formData.report_file_name || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, report_file_name: e.target.value }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Nom de la feuille d'émargement signée :
                        </label>
                        <input
                          type="text"
                          placeholder="Feuille_Emargement_Signee_Formation.pdf"
                          value={formData.attendance_sheet_file_name || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, attendance_sheet_file_name: e.target.value }))}
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Recommandations & Suivi post-formation :
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Plan de suivi sur site, rappels RSCO..."
                          value={formData.post_training_follow_up || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, post_training_follow_up: e.target.value }))}
                          className="w-full text-xs border border-slate-300 rounded p-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Date de la prochaine supervision formative :
                        </label>
                        <input
                          type="date"
                          value={formData.next_supervision_date || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, next_supervision_date: e.target.value }))}
                          className="w-full text-xs border border-slate-300 rounded p-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET 4 : PHOTOS & JUSTIFICATIFS */}
                {formModalTab === 'PHOTOS' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                      <h4 className="text-xs font-bold text-amber-900 uppercase">
                        Ajouter un cliché photo / Justificatif visuel de l'atelier :
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            type="url"
                            placeholder="https://... (URL de la photo ou data:image/png;base64,...)"
                            value={newPhotoUrl}
                            onChange={(e) => setNewPhotoUrl(e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Légende de la photo"
                            value={newPhotoCaption}
                            onChange={(e) => setNewPhotoCaption(e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPhotoToForm}
                        className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold transition shadow-xs"
                      >
                        + Ajouter cette photo
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(formData.photos || []).map(p => (
                        <div key={p.id} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                          <img src={p.url} alt={p.caption} className="w-full h-32 object-cover" />
                          <div className="p-2 bg-white text-[11px] font-medium text-slate-800 line-clamp-1">
                            {p.caption}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhotoFromForm(p.id)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold opacity-90 hover:opacity-100 shadow"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Boutons validation */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition"
                  >
                    Annuler
                  </button>

                  <div className="flex items-center space-x-2">
                    {formModalTab !== 'GENERAL' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (formModalTab === 'PHOTOS') setFormModalTab('PEDAGOGIE');
                          else if (formModalTab === 'PEDAGOGIE') setFormModalTab('ACTEURS');
                          else if (formModalTab === 'ACTEURS') setFormModalTab('GENERAL');
                        }}
                        className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition"
                      >
                        &larr; Étape précédente
                      </button>
                    )}

                    {formModalTab !== 'PHOTOS' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (formModalTab === 'GENERAL') setFormModalTab('ACTEURS');
                          else if (formModalTab === 'ACTEURS') setFormModalTab('PEDAGOGIE');
                          else if (formModalTab === 'PEDAGOGIE') setFormModalTab('PHOTOS');
                        }}
                        className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold hover:bg-teal-900 transition shadow-xs"
                      >
                        Suivant &rarr;
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-sm"
                      >
                        💾 Enregistrer la Formation
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CONSULTATION : VOIR LA FICHE DÉTAILLÉE DE FORMATION */}
        {viewModalTraining && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden border border-slate-200">
              
              {/* Entête Fiche */}
              <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-6 text-white flex justify-between items-start">
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white/20 border border-white/20">
                      Réf: {viewModalTraining.code || viewModalTraining.id}
                    </span>
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded border border-white/20">
                      Jalon {viewModalTraining.milestone}
                    </span>
                    {viewModalTraining.work_plan_code && (
                      <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded border border-white/20">
                        Work Plan: {viewModalTraining.work_plan_code}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-900">
                      {STATUS_LABELS[viewModalTraining.status]?.label || viewModalTraining.status}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold leading-snug">
                    {viewModalTraining.topic}
                  </h2>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExportSingleTrainingPdf(viewModalTraining)}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                  >
                    <span>📄</span>
                    <span>Exporter PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModalTraining(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Contenu Fiche */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
                
                {/* Bandeau Caractéristiques */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Période & Durée :</span>
                    <span className="font-semibold text-slate-800">
                      📅 Du {viewModalTraining.start_date} au {viewModalTraining.end_date} ({viewModalTraining.duration_days} j)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Format & Lieu :</span>
                    <span className="font-semibold text-slate-800">
                      {FORMAT_LABELS[viewModalTraining.format]?.icon} {FORMAT_LABELS[viewModalTraining.format]?.label} &bull; {viewModalTraining.format === 'EN_LIGNE' ? 'Visioconférence' : (viewModalTraining.location || 'Sur site')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Zone Sanitaire :</span>
                    <span className="font-semibold text-slate-800">
                      📍 {viewModalTraining.zone_sanitaire} ({viewModalTraining.department})
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Acteurs Formés :</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      👥 {viewModalTraining.participants_count || (viewModalTraining.trained_actors ? viewModalTraining.trained_actors.length : 0)} personnes
                    </span>
                  </div>
                </div>

                {/* Formateurs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Formateurs SaniNova :</span>
                    <div className="font-semibold text-slate-800">
                      {viewModalTraining.trainer_ids
                        .map(id => users.find(u => u.id === id)?.full_name)
                        .filter(Boolean)
                        .join(', ') || 'Équipe SaniNova'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Co-Facilitateurs Partenaires :</span>
                    <div className="font-semibold text-slate-800">
                      {(viewModalTraining.external_trainers || []).map(e => `${e.name} (${e.organization})`).join(', ') || 'Néant'}
                    </div>
                  </div>
                </div>

                {/* Performance Pré / Post Test */}
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span>📊 Évaluation de l’Impact Pédagogique :</span>
                    <span>Taux de Réussite : {viewModalTraining.passing_rate_pct || 0}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Pré-test Initial</span>
                      <span className="text-lg font-black text-slate-700">{viewModalTraining.pre_test_avg}%</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Post-test Final</span>
                      <span className="text-lg font-black text-emerald-800">{viewModalTraining.post_test_avg}%</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Gain Pédagogique Net</span>
                      <span className="text-lg font-black text-teal-800">
                        +{(viewModalTraining.post_test_avg - viewModalTraining.pre_test_avg).toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                </div>

                {/* Objectifs & Synthèse */}
                {viewModalTraining.objectives && (
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 uppercase text-[11px]">Objectifs de la formation :</h4>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {viewModalTraining.objectives}
                    </p>
                  </div>
                )}

                {/* Table nominative des acteurs formés */}
                {viewModalTraining.trained_actors && viewModalTraining.trained_actors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                        Liste Émargée des Acteurs Formés ({viewModalTraining.trained_actors.length}) :
                      </h4>
                      <span className="text-[10px] text-slate-400">Notes sur 100</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase sticky top-0">
                          <tr>
                            <th className="p-2">Nom & Prénoms</th>
                            <th className="p-2 text-center">Genre</th>
                            <th className="p-2">Fonction</th>
                            <th className="p-2">Structure / FOSA</th>
                            <th className="p-2 text-center">Pré</th>
                            <th className="p-2 text-center">Post</th>
                            <th className="p-2 text-center">Résultat</th>
                            <th className="p-2 text-center">Attestation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewModalTraining.trained_actors.map((a, i) => (
                            <tr key={a.id || i} className="hover:bg-slate-50">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">{a.full_name}</td>
                              <td className="p-2 text-center font-bold text-[10px]">{a.gender}</td>
                              <td className="p-2 text-slate-600">{a.profession}</td>
                              <td className="p-2 text-slate-700">{a.structure_fosa}</td>
                              <td className="p-2 text-center font-mono">{a.pre_test_score}%</td>
                              <td className="p-2 text-center font-mono font-bold text-emerald-800">{a.post_test_score}%</td>
                              <td className="p-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  a.evaluation_result === 'REUSSI' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {a.evaluation_result === 'REUSSI' ? 'Admis' : 'Ajourné'}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                {a.certificate_issued ? '🏅 Oui' : 'En cours'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Fichiers & Preuves */}
                {(viewModalTraining.report_file_name || viewModalTraining.attendance_sheet_file_name) && (
                  <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {viewModalTraining.report_file_name && (
                      <div className="flex items-center space-x-1 text-indigo-800 font-bold">
                        <span>📎 Rapport :</span>
                        <span className="font-mono">{viewModalTraining.report_file_name}</span>
                      </div>
                    )}
                    {viewModalTraining.attendance_sheet_file_name && (
                      <div className="flex items-center space-x-1 text-emerald-800 font-bold">
                        <span>📝 Émargement signé :</span>
                        <span className="font-mono">{viewModalTraining.attendance_sheet_file_name}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Photos */}
                {viewModalTraining.photos && viewModalTraining.photos.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[11px]">Photos de la session :</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {viewModalTraining.photos.map((p, i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-slate-200">
                          <img src={p.url} alt={p.caption} className="w-full h-24 object-cover" />
                          <p className="p-1.5 text-[10px] text-slate-600 truncate">{p.caption}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pied modal */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewModalTraining;
                    setViewModalTraining(null);
                    handleOpenEditModal(toEdit);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition"
                >
                  ✏️ Modifier cette formation
                </button>
                <button
                  type="button"
                  onClick={() => setViewModalTraining(null)}
                  className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold hover:bg-teal-900 transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIRMATION DE SUPPRESSION */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl font-bold mx-auto">
                🗑️
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">Confirmer la suppression</h3>
                <p className="text-xs text-slate-500">
                  Êtes-vous sûr de vouloir supprimer définitivement cette session de formation ainsi que les enregistrements de ses acteurs formés ? Cette action est irréversible.
                </p>
              </div>
              <div className="flex justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTraining(deleteConfirmId)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition shadow-sm"
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL APERÇU PHOTO ZOOM */}
        {previewPhoto && (
          <div
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl border border-slate-800"
            >
              <div className="relative bg-black flex items-center justify-center max-h-[70vh]">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.caption}
                  className="max-h-[70vh] w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-sm font-bold hover:bg-black/90 transition"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 bg-white flex justify-between items-center">
                <p className="text-xs font-bold text-slate-900">{previewPhoto.caption}</p>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ModuleGuard>
  );
}