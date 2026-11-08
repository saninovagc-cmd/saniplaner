'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { B13Item } from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

const CATEGORY_META: Record<string, { label: string; icon: string; badge: string }> = {
  POA_MANAGEMENT: { label: 'Gestion des 9 POA', icon: '📋', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  QUANTIFICATION: { label: 'Rapport Quantification', icon: '📊', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  ILP_VALIDATION: { label: 'Validation Données ILP', icon: '🏛️', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  QAT_TRACKING: { label: 'Suivi QAT (Supply Plan)', icon: '💻', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  GTT_MEETING: { label: 'Réunions GTT', icon: '👥', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
  CPS_CAMPAIGN: { label: 'Campagne CPS Alibori', icon: '💊', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
  SUPPLY_PLAN: { label: 'Plan d’Approvisionnement', icon: '📦', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
  DISTRIBUTION: { label: 'Plan de Distribution', icon: '🚚', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
};

const STATUS_META: Record<string, { label: string; badge: string; icon: string }> = {
  PLANIFIE: { label: 'Planifié', badge: 'bg-slate-100 text-slate-700 border-slate-300', icon: '⏳' },
  EN_COURS: { label: 'En cours', badge: 'bg-blue-100 text-blue-800 border-blue-300', icon: '🔄' },
  TRANSMIS: { label: 'Transmis à PSI', badge: 'bg-purple-100 text-purple-800 border-purple-300', icon: '📤' },
  VALIDE: { label: 'Validé & Payé', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✅' },
};

export default function B13Page() {
  const { b13Items, updateB13Item, addB13Item, deleteB13Item, users, currentUser } = useApp();

  // Navigation par onglets pour fluidifier la compréhension
  const [activeTab, setActiveTab] = useState<'DELIVERABLES' | 'OPERATIONAL' | 'TIMELINE' | 'GUIDE'>('DELIVERABLES');
  const [showGuideBanner, setShowGuideBanner] = useState<boolean>(false);

  // Filtres
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales
  const [quickUpdateItem, setQuickUpdateItem] = useState<B13Item | null>(null);
  const [quickProgress, setQuickProgress] = useState<number>(0);
  const [quickStatus, setQuickStatus] = useState<B13Item['status']>('PLANIFIE');
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [quickEvidence, setQuickEvidence] = useState<string>('');

  const [editModalItem, setEditModalItem] = useState<B13Item | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [formCategory, setFormCategory] = useState<B13Item['category']>('ILP_VALIDATION');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSemester, setFormSemester] = useState<'S1_2026_2027' | 'S2_2026_2027'>('S1_2026_2027');
  const [formIsPredefined, setFormIsPredefined] = useState<boolean>(false);
  const [formLeadExpertId, setFormLeadExpertId] = useState<string>('usr-cs');
  const [formExecutionDate, setFormExecutionDate] = useState<string>('2026-11-30');
  const [formStatus, setFormStatus] = useState<B13Item['status']>('PLANIFIE');
  const [formProgress, setFormProgress] = useState<number>(0);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formEvidence, setFormEvidence] = useState<string>('');
  const [formDeliverableCode, setFormDeliverableCode] = useState<string>('');

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<B13Item | null>(null);

  // Séparation Unités Contractuelles (Paiement) vs Activités Opérationnelles
  const predefinedDeliverables = useMemo(() => {
    return b13Items.filter(i => i.is_predefined_deliverable);
  }, [b13Items]);

  const operationalItems = useMemo(() => {
    return b13Items.filter(i => !i.is_predefined_deliverable);
  }, [b13Items]);

  // Filtrage des activités opérationnelles
  const filteredOperational = useMemo(() => {
    return operationalItems.filter(item => {
      const matchesSemester = selectedSemester === 'ALL' || item.semester === selectedSemester;
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSemester && matchesCat && matchesSearch;
    });
  }, [operationalItems, selectedSemester, selectedCategory, searchQuery]);

  // Calculs KPI & Baromètre financier
  const stats = useMemo(() => {
    const s1Deliverables = predefinedDeliverables.filter(i => i.semester === 'S1_2026_2027');
    const s2Deliverables = predefinedDeliverables.filter(i => i.semester === 'S2_2026_2027');

    const s1Validated = s1Deliverables.filter(i => i.status === 'VALIDE' || i.status === 'TRANSMIS').length;
    const s2Validated = s2Deliverables.filter(i => i.status === 'VALIDE' || i.status === 'TRANSMIS').length;

    // Projection de paiement semestrielle : 2 unités = 100%, 1 unité = 50%, 0 unité = 0%
    const s1PayoutPct = s1Validated >= 2 ? 100 : s1Validated === 1 ? 50 : 0;
    const s2PayoutPct = s2Validated >= 2 ? 100 : s2Validated === 1 ? 50 : 0;

    // Moyenne d'avancement
    const totalItems = b13Items.length;
    const avgProgress = totalItems > 0
      ? Math.round(b13Items.reduce((acc, curr) => acc + (curr.progress_pct || 0), 0) / totalItems)
      : 0;

    // Échéance la plus proche
    const now = new Date();
    const sortedUpcoming = [...b13Items]
      .filter(i => i.status !== 'VALIDE')
      .sort((a, b) => new Date(a.execution_date).getTime() - new Date(b.execution_date).getTime());
    const nextItem = sortedUpcoming[0] || null;

    let daysToNext = null;
    if (nextItem) {
      const d = new Date(nextItem.execution_date);
      const diffMs = d.getTime() - now.getTime();
      daysToNext = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      s1Deliverables,
      s2Deliverables,
      s1Validated,
      s2Validated,
      s1PayoutPct,
      s2PayoutPct,
      avgProgress,
      nextItem,
      daysToNext,
      totalCount: totalItems,
      operationalCount: operationalItems.length,
    };
  }, [b13Items, predefinedDeliverables, operationalItems]);

  // Timeline : groupement chronologique par mois d'échéance
  const timelineGroups = useMemo(() => {
    const map = new Map<string, B13Item[]>();
    const sorted = [...b13Items].sort((a, b) => new Date(a.execution_date).getTime() - new Date(b.execution_date).getTime());
    sorted.forEach(item => {
      const date = new Date(item.execution_date);
      const monthYear = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const capitalMonth = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      if (!map.has(capitalMonth)) {
        map.set(capitalMonth, []);
      }
      map.get(capitalMonth)!.push(item);
    });
    return Array.from(map.entries());
  }, [b13Items]);

  // Ouverture modale mise à jour rapide
  const handleOpenQuickUpdate = (item: B13Item) => {
    setQuickUpdateItem(item);
    setQuickProgress(item.progress_pct);
    setQuickStatus(item.status);
    setQuickNotes(item.notes || '');
    setQuickEvidence(item.verification_evidence_url || '');
  };

  // Sauvegarde modale mise à jour rapide
  const handleSaveQuickUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUpdateItem) return;

    const now = new Date();
    const timestamp = `${now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    const updated: B13Item = {
      ...quickUpdateItem,
      progress_pct: Number(quickProgress),
      status: quickStatus,
      notes: quickNotes.trim() || undefined,
      verification_evidence_url: quickEvidence.trim() || undefined,
      last_updated_at: timestamp,
      last_updated_by: currentUser?.full_name || 'Équipe SaniNova',
    };

    updateB13Item(updated);
    setQuickUpdateItem(null);
  };

  // Ouverture modale d'édition complète
  const handleOpenEdit = (item: B13Item) => {
    setEditModalItem(item);
    setFormCategory(item.category);
    setFormTitle(item.title);
    setFormSemester(item.semester);
    setFormIsPredefined(item.is_predefined_deliverable);
    setFormLeadExpertId(item.lead_expert_id);
    setFormExecutionDate(item.execution_date);
    setFormStatus(item.status);
    setFormProgress(item.progress_pct);
    setFormNotes(item.notes || '');
    setFormEvidence(item.verification_evidence_url || '');
    setFormDeliverableCode(item.deliverable_code || '');
    setIsNewModalOpen(false);
  };

  // Ouverture modale de création
  const handleOpenCreate = () => {
    setEditModalItem(null);
    setFormCategory('ILP_VALIDATION');
    setFormTitle('');
    setFormSemester('S1_2026_2027');
    setFormIsPredefined(false);
    setFormLeadExpertId(users.find(u => u.role === 'senior_advisor')?.id || users[0]?.id || 'usr-cs');
    setFormExecutionDate('2026-12-15');
    setFormStatus('PLANIFIE');
    setFormProgress(0);
    setFormNotes('');
    setFormEvidence('');
    setFormDeliverableCode('');
    setIsNewModalOpen(true);
  };

  // Enregistrement création ou modification
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Veuillez renseigner le titre de l’activité.');
      return;
    }

    const now = new Date();
    const timestamp = `${now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    if (editModalItem) {
      const updated: B13Item = {
        ...editModalItem,
        category: formCategory,
        title: formTitle.trim(),
        semester: formSemester,
        is_predefined_deliverable: formIsPredefined,
        lead_expert_id: formLeadExpertId,
        execution_date: formExecutionDate,
        status: formStatus,
        progress_pct: Number(formProgress),
        notes: formNotes.trim() || undefined,
        verification_evidence_url: formEvidence.trim() || undefined,
        deliverable_code: formDeliverableCode.trim() || undefined,
        last_updated_at: timestamp,
        last_updated_by: currentUser?.full_name || 'Équipe SaniNova',
      };
      updateB13Item(updated);
      setEditModalItem(null);
    } else {
      const newItem: B13Item = {
        id: `b13-item-${Date.now()}`,
        category: formCategory,
        title: formTitle.trim(),
        semester: formSemester,
        is_predefined_deliverable: formIsPredefined,
        lead_expert_id: formLeadExpertId,
        execution_date: formExecutionDate,
        status: formStatus,
        progress_pct: Number(formProgress),
        notes: formNotes.trim() || undefined,
        verification_evidence_url: formEvidence.trim() || undefined,
        deliverable_code: formDeliverableCode.trim() || undefined,
        last_updated_at: timestamp,
        last_updated_by: currentUser?.full_name || 'Équipe SaniNova',
      };
      addB13Item(newItem);
      setIsNewModalOpen(false);
    }
  };

  // Suppression
  const handleConfirmDelete = () => {
    if (!deleteConfirmItem) return;
    deleteB13Item(deleteConfirmItem.id);
    setDeleteConfirmItem(null);
  };

  // Exports Excel & PDF
  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const data = b13Items.map(item => ({
        Type: item.is_predefined_deliverable ? 'LIVRABLE CONTRACTUEL (UNITÉ DE PAIEMENT)' : 'ACTIVITÉ OPÉRATIONNELLE',
        Catégorie: CATEGORY_META[item.category]?.label || item.category,
        Titre: item.title,
        Semestre: item.semester === 'S1_2026_2027' ? 'Semestre 1 (Oct 26 - Mar 27)' : 'Semestre 2 (Avr 27 - Sep 27)',
        Responsable: users.find(u => u.id === item.lead_expert_id)?.full_name || 'Non assigné',
        Échéance: item.execution_date,
        Avancement: `${item.progress_pct}%`,
        Statut: STATUS_META[item.status]?.label || item.status,
        Preuve_IOV: item.verification_evidence_url || 'Non renseignée',
        Dernière_Actualisation: item.last_updated_at || '—',
        Observations: item.notes || '',
      }));
      exportToExcel(data, 'SANINOVA_Suivi_B13_Quantification_Appro');
    } else {
      const headers = ['Type', 'Catégorie', 'Intitulé / Composante', 'Semestre', 'Responsable', 'Avance.', 'Statut', 'Échéance'];
      const rows = b13Items.map(item => [
        item.is_predefined_deliverable ? 'UNITÉ PAIEMENT' : 'OPÉRATIONNEL',
        CATEGORY_META[item.category]?.label || item.category,
        item.title.substring(0, 42) + (item.title.length > 42 ? '...' : ''),
        item.semester === 'S1_2026_2027' ? 'Semestre 1' : 'Semestre 2',
        users.find(u => u.id === item.lead_expert_id)?.full_name || '—',
        `${item.progress_pct}%`,
        STATUS_META[item.status]?.label || item.status,
        item.execution_date,
      ]);
      exportTableToPdf(
        'Suivi du Milestone B13 : Quantification et Approvisionnements',
        headers,
        rows,
        'SANINOVA_B13_Quantification_Appro',
        'Synthèse des 4 Unités Contractuelles de Paiement et des Activités Opérationnelles B13'
      );
    }
  };

  return (
    <ModuleGuard moduleId="b13">
      <div className="space-y-6 font-sans pb-12">
        {/* En-tête Principal */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                Milestone 07
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Suivi Spécifique B13
              </span>
              <span className="text-xs text-slate-400 font-medium">| AFGHS / PSI Fixed Amount Award</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1 tracking-tight flex items-center gap-2">
              <span>Quantification & Plans d’Approvisionnement (B13)</span>
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl">
              Pilotage simple et transparent : distinguez en 1 coup d’œil les <strong>4 Unités Contractuelles qui déclenchent les paiements</strong> du suivi technique continu (QAT, GTT, Ateliers ILP, 9 POA, Campagne CPS).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setShowGuideBanner(!showGuideBanner)}
              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <span>💡</span>
              <span>{showGuideBanner ? 'Masquer le Guide' : 'Comprendre le B13'}</span>
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
            >
              <span>📊</span>
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
            >
              <span>📄</span>
              <span>Synthèse PDF</span>
            </button>
          </div>
        </div>

        {/* GUIDE PÉDAGOGIQUE DÉPLIABLE : COMPRENDRE LE B13 SANS EFFORT */}
        {showGuideBanner && (
          <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-xl p-5 border border-teal-800/50 shadow-md space-y-4 animate-fadeIn">
            <div className="flex justify-between items-start border-b border-teal-800/40 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest block">
                  Guide Essentiel du Jalon B13
                </span>
                <h3 className="text-base font-bold text-white">
                  Comment fonctionne le Milestone B13 pour SaniNova ?
                </h3>
              </div>
              <button
                onClick={() => setShowGuideBanner(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-slate-800"
              >
                ✕ Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-teal-700/30">
                <div className="flex items-center gap-2 mb-1.5 text-teal-300 font-bold">
                  <span className="text-base">🎯</span>
                  <span>1. Objectif Global</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Assurer la disponibilité permanente des produits antipaludiques dans les 9 zones sanitaires, éviter les ruptures et appuyer la DPMED, le PNLP et la SoBAPS dans l’analyse des besoins et l’ajustement des commandes.
                </p>
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-teal-700/30">
                <div className="flex items-center gap-2 mb-1.5 text-emerald-300 font-bold">
                  <span className="text-base">💰</span>
                  <span>2. Règle des Paiements (Strictement 2 Unités / Semestre)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Seuls les <strong>4 Livrables Officiels</strong> (2 au Semestre 1 et 2 au Semestre 2) déclenchent les décaissements de PSI/AFGHS. Les réunions GTT, soumissions QAT ou ateliers ILP sont des activités techniques de préparation.
                </p>
              </div>

              <div className="bg-slate-800/90 p-3.5 rounded-lg border border-teal-700/30">
                <div className="flex items-center gap-2 mb-1.5 text-amber-300 font-bold">
                  <span className="text-base">⚖️</span>
                  <span>3. Date Faisant Foi Juridique</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Un livrable est considéré transmis à temps dès lors que SaniNova le dépose auprès de PSI avec <strong>accusé de réception (courriel ou courrier formel)</strong> avant l’échéance contractuelle.
                </p>
              </div>
            </div>

            {/* Schéma de flux simplifié */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 text-[11px]">
              <span className="font-bold text-teal-300 uppercase block mb-1.5">
                Le Cycle de Production d’un Livrable B13 :
              </span>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-slate-300 font-medium">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                  <span className="block text-slate-400 font-mono text-[10px]">Étape 1</span>
                  <span>Ateliers ILP & Drafts QAT</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                  <span className="block text-slate-400 font-mono text-[10px]">Étape 2</span>
                  <span>Concertation GTT & PNLP</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                  <span className="block text-slate-400 font-mono text-[10px]">Étape 3</span>
                  <span>Consolidation & Visa SaniNova</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-teal-700/60 text-teal-200">
                  <span className="block text-teal-400 font-mono text-[10px]">Étape 4 (Clé)</span>
                  <span>Dépôt formel PSI (Accusé)</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-emerald-700/60 text-emerald-200">
                  <span className="block text-emerald-400 font-mono text-[10px]">Étape 5</span>
                  <span>Validation & Paiement Débloqué</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BAROMÈTRE FINANCIER & INDICATEURS CLÉS (KPI CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* S1 Payout Status */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Semestre 1 (Oct 26 - Mar 27)
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                stats.s1PayoutPct === 100 ? 'bg-emerald-100 text-emerald-800' :
                stats.s1PayoutPct === 50 ? 'bg-amber-100 text-amber-800' :
                'bg-slate-100 text-slate-700'
              }`}>
                {stats.s1PayoutPct}% Paiement
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{stats.s1Validated} / 2</span>
              <span className="text-xs font-semibold text-slate-500">Unités validées</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.s1PayoutPct === 100 ? 'bg-emerald-600' : stats.s1PayoutPct === 50 ? 'bg-amber-500' : 'bg-slate-300'
                }`}
                style={{ width: `${(stats.s1Validated / 2) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-2 block">
              {stats.s1Validated === 2 ? '🎉 100% Décaissable sans réserve' : stats.s1Validated === 1 ? '⚠️ 1 unité restante sous 30j' : 'En préparation'}
            </span>
          </div>

          {/* S2 Payout Status */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Semestre 2 (Avr 27 - Sep 27)
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                stats.s2PayoutPct === 100 ? 'bg-emerald-100 text-emerald-800' :
                stats.s2PayoutPct === 50 ? 'bg-amber-100 text-amber-800' :
                'bg-slate-100 text-slate-700'
              }`}>
                {stats.s2PayoutPct}% Paiement
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{stats.s2Validated} / 2</span>
              <span className="text-xs font-semibold text-slate-500">Unités validées</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.s2PayoutPct === 100 ? 'bg-emerald-600' : stats.s2PayoutPct === 50 ? 'bg-amber-500' : 'bg-slate-300'
                }`}
                style={{ width: `${(stats.s2Validated / 2) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-2 block">
              {stats.s2Validated === 2 ? '🎉 100% Décaissable sans réserve' : stats.s2Validated === 1 ? '⚠️ 1 unité restante sous 30j' : 'Échéance mi-2027'}
            </span>
          </div>

          {/* Avancement Global */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Avancement Moyen B13
              </span>
              <span className="text-xs font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Global
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{stats.avgProgress}%</span>
              <span className="text-xs font-semibold text-slate-500">sur {stats.totalCount} activités</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-teal-700 rounded-full transition-all duration-500"
                style={{ width: `${stats.avgProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-2 block">
              4 Livrables Officiels + {stats.operationalCount} sous-activités
            </span>
          </div>

          {/* Prochaine Échéance */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Prochaine Échéance
              </span>
              <span className="text-xs font-bold text-slate-400">Compte à rebours</span>
            </div>
            {stats.nextItem ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${
                    stats.daysToNext !== null && stats.daysToNext < 15 ? 'text-rose-600' :
                    stats.daysToNext !== null && stats.daysToNext < 30 ? 'text-amber-600' : 'text-teal-800'
                  }`}>
                    {stats.daysToNext !== null ? (stats.daysToNext > 0 ? `J-${stats.daysToNext}` : 'Échu') : '—'}
                  </span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {stats.nextItem.execution_date}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-1 font-semibold" title={stats.nextItem.title}>
                  {stats.nextItem.title}
                </p>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Responsable : {users.find(u => u.id === stats.nextItem?.lead_expert_id)?.full_name || '—'}
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                ✅ Toutes les échéances actuelles sont clôturées.
              </div>
            )}
          </div>
        </div>

        {/* NAVIGATION PAR ONGLETS PRINCIPAUX */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/80 px-3 pt-2 gap-2">
            <button
              onClick={() => setActiveTab('DELIVERABLES')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t border-x ${
                activeTab === 'DELIVERABLES'
                  ? 'bg-white text-teal-900 border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <span>💰</span>
              <span>1. Les 4 Unités de Paiement (Livrables Officiels)</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-900 font-black">
                {predefinedDeliverables.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('OPERATIONAL')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t border-x ${
                activeTab === 'OPERATIONAL'
                  ? 'bg-white text-teal-900 border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <span>⚙️</span>
              <span>2. Activités Opérationnelles (QAT, GTT, ILP, POA, CPS)</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 font-black">
                {operationalItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t border-x ${
                activeTab === 'TIMELINE'
                  ? 'bg-white text-teal-900 border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <span>🗓️</span>
              <span>3. Chronogramme & Calendrier d’Échéances</span>
            </button>

            <button
              onClick={() => setActiveTab('GUIDE')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t border-x ${
                activeTab === 'GUIDE'
                  ? 'bg-white text-teal-900 border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <span>📖</span>
              <span>4. Barèmes & Règles Contractuelles</span>
            </button>
          </div>

          <div className="p-5">
            {/* ============================================================== */}
            {/* ONGLET 1 : LES 4 LIVRABLES PREDEFINIS CONTRACTUELS (PAIEMENT) */}
            {/* ============================================================== */}
            {activeTab === 'DELIVERABLES' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-teal-50/60 p-3.5 rounded-xl border border-teal-200">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <h3 className="text-xs font-black uppercase text-teal-950">
                        Unités Officielles Déclenchant le Paiement B13
                      </h3>
                      <p className="text-xs text-teal-900 mt-0.5">
                        Exactement <strong>2 unités par semestre</strong> (Total : 4 sur l’année). Cliquez sur <strong>⚡ Mettre à jour</strong> pour ajuster l’avancement, le statut ou joindre la preuve de dépôt.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-teal-900 bg-white px-2.5 py-1 rounded-lg border border-teal-300">
                      Cible Annuelle : 4 Unités
                    </span>
                  </div>
                </div>

                {/* S1 vs S2 Sections */}
                <div className="space-y-6">
                  {/* SEMESTRE 1 */}
                  <div>
                    <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-900 rounded-md border border-blue-200 uppercase">
                          Semestre 1 (Octobre 2026 – Mars 2027)
                        </span>
                        <span className="text-xs text-slate-500 font-medium">2 Unités de paiement requises</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        Validation S1 : <strong className="text-teal-800">{stats.s1Validated}/2</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stats.s1Deliverables.map(deliv => {
                        const lead = users.find(u => u.id === deliv.lead_expert_id);
                        const statusInfo = STATUS_META[deliv.status] || STATUS_META.PLANIFIE;
                        return (
                          <div
                            key={deliv.id}
                            className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-teal-500 transition shadow-2xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                                  {deliv.deliverable_code || 'UNITÉ OFFICIELLE S1'}
                                </span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusInfo.badge}`}>
                                  <span>{statusInfo.icon}</span>
                                  <span>{statusInfo.label}</span>
                                </span>
                              </div>

                              <h4 className="font-black text-sm text-slate-900 leading-snug">
                                {deliv.title}
                              </h4>

                              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                                {deliv.notes || 'Livrable contractuel prioritaire du semestre.'}
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Responsable</span>
                                  <span className="font-bold text-slate-800">{lead?.full_name || 'Non assigné'}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Échéance Dépôt</span>
                                  <span className="font-mono font-black text-slate-900">{deliv.execution_date}</span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-500 font-medium">Avancement technique :</span>
                                  <span className="font-black text-teal-800 font-mono">{deliv.progress_pct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      deliv.progress_pct === 100 ? 'bg-emerald-600' :
                                      deliv.progress_pct > 50 ? 'bg-teal-700' :
                                      deliv.progress_pct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                    }`}
                                    style={{ width: `${deliv.progress_pct}%` }}
                                  />
                                </div>
                              </div>

                              {deliv.last_updated_at && (
                                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                  <span>Dernière MàJ : {deliv.last_updated_at}</span>
                                  {deliv.last_updated_by && <span>par {deliv.last_updated_by}</span>}
                                </div>
                              )}

                              {deliv.verification_evidence_url && (
                                <div className="text-[11px] bg-emerald-50 text-emerald-900 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1.5 truncate">
                                  <span>📎 Preuve :</span>
                                  <span className="truncate font-mono">{deliv.verification_evidence_url}</span>
                                </div>
                              )}

                              {/* Boutons d'action directs */}
                              <div className="flex items-center justify-between pt-1 gap-2">
                                <button
                                  onClick={() => handleOpenQuickUpdate(deliv)}
                                  className="w-full py-1.5 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>⚡</span>
                                  <span>Mettre à jour l’avancement</span>
                                </button>
                                <Link
                                  href="/livrables"
                                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition border border-slate-300 whitespace-nowrap"
                                  title="Ouvrir le circuit officiel des livrables"
                                >
                                  Circuit &rarr;
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SEMESTRE 2 */}
                  <div>
                    <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-xs font-black bg-purple-100 text-purple-900 rounded-md border border-purple-200 uppercase">
                          Semestre 2 (Avril 2027 – Septembre 2027)
                        </span>
                        <span className="text-xs text-slate-500 font-medium">2 Unités de paiement requises</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        Validation S2 : <strong className="text-teal-800">{stats.s2Validated}/2</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stats.s2Deliverables.map(deliv => {
                        const lead = users.find(u => u.id === deliv.lead_expert_id);
                        const statusInfo = STATUS_META[deliv.status] || STATUS_META.PLANIFIE;
                        return (
                          <div
                            key={deliv.id}
                            className="bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-teal-500 transition shadow-2xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                                  {deliv.deliverable_code || 'UNITÉ OFFICIELLE S2'}
                                </span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusInfo.badge}`}>
                                  <span>{statusInfo.icon}</span>
                                  <span>{statusInfo.label}</span>
                                </span>
                              </div>

                              <h4 className="font-black text-sm text-slate-900 leading-snug">
                                {deliv.title}
                              </h4>

                              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                                {deliv.notes || 'Livrable contractuel prioritaire du second semestre.'}
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Responsable</span>
                                  <span className="font-bold text-slate-800">{lead?.full_name || 'Non assigné'}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Échéance Dépôt</span>
                                  <span className="font-mono font-black text-slate-900">{deliv.execution_date}</span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-500 font-medium">Avancement technique :</span>
                                  <span className="font-black text-teal-800 font-mono">{deliv.progress_pct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      deliv.progress_pct === 100 ? 'bg-emerald-600' :
                                      deliv.progress_pct > 50 ? 'bg-teal-700' :
                                      deliv.progress_pct > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                    }`}
                                    style={{ width: `${deliv.progress_pct}%` }}
                                  />
                                </div>
                              </div>

                              {deliv.last_updated_at && (
                                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                  <span>Dernière MàJ : {deliv.last_updated_at}</span>
                                  {deliv.last_updated_by && <span>par {deliv.last_updated_by}</span>}
                                </div>
                              )}

                              {/* Boutons d'action directs */}
                              <div className="flex items-center justify-between pt-1 gap-2">
                                <button
                                  onClick={() => handleOpenQuickUpdate(deliv)}
                                  className="w-full py-1.5 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>⚡</span>
                                  <span>Mettre à jour l’avancement</span>
                                </button>
                                <Link
                                  href="/livrables"
                                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition border border-slate-300 whitespace-nowrap"
                                  title="Ouvrir le circuit officiel des livrables"
                                >
                                  Circuit &rarr;
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ONGLET 2 : ACTIVITES OPERATIONNELLES (QAT, GTT, ILP, POA, CPS) */}
            {/* ============================================================== */}
            {activeTab === 'OPERATIONAL' && (
              <div className="space-y-4">
                {/* Barre de contrôle et filtres */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Recherche */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Rechercher une activité..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 bg-white outline-none focus:border-teal-700 w-48 md:w-60 shadow-2xs font-medium"
                      />
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">🔍</span>
                    </div>

                    {/* Semestre */}
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold outline-none focus:border-teal-700 shadow-2xs"
                    >
                      <option value="ALL">Tous les semestres</option>
                      <option value="S1_2026_2027">Semestre 1 (S1)</option>
                      <option value="S2_2026_2027">Semestre 2 (S2)</option>
                    </select>

                    {/* Catégorie */}
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold outline-none focus:border-teal-700 shadow-2xs"
                    >
                      <option value="ALL">Toutes les sous-activités</option>
                      <option value="ILP_VALIDATION">Validation Données ILP</option>
                      <option value="QAT_TRACKING">Suivi QAT (12 drafts + 4 trim)</option>
                      <option value="GTT_MEETING">Réunions GTT (4 réunions)</option>
                      <option value="POA_MANAGEMENT">Gestion des 9 POA</option>
                      <option value="CPS_CAMPAIGN">Campagne CPS Alibori</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">
                      {filteredOperational.length} sous-activité{filteredOperational.length > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={handleOpenCreate}
                      className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>➕</span>
                      <span>Ajouter une sous-activité</span>
                    </button>
                  </div>
                </div>

                {/* Grille des sous-activités opérationnelles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOperational.map((item) => {
                    const lead = users.find(u => u.id === item.lead_expert_id);
                    const catInfo = CATEGORY_META[item.category] || { label: item.category, icon: '📌', badge: 'bg-slate-100 text-slate-800' };
                    const statusInfo = STATUS_META[item.status] || STATUS_META.PLANIFIE;
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-400 transition shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1 mb-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${catInfo.badge}`}>
                              <span>{catInfo.icon}</span>
                              <span>{catInfo.label}</span>
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusInfo.badge}`}>
                              {statusInfo.label}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-xs mt-1 leading-snug">
                            {item.title}
                          </h4>

                          {item.notes && (
                            <p className="text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200 leading-relaxed">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-[11px] text-slate-600 font-medium">{lead?.full_name || 'Non assigné'}</span>
                            <span className="font-mono text-[11px] text-slate-500 font-bold">{item.execution_date}</span>
                          </div>

                          {/* Progress */}
                          <div>
                            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                              <span>Progression</span>
                              <span className="font-black text-teal-800 font-mono">{item.progress_pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                              <div
                                className="h-full bg-teal-700 rounded-full transition-all duration-300"
                                style={{ width: `${item.progress_pct}%` }}
                              />
                            </div>
                          </div>

                          {item.last_updated_at && (
                            <div className="text-[9px] text-slate-400 truncate">
                              MàJ : {item.last_updated_at}
                            </div>
                          )}

                          {/* Boutons d'action */}
                          <div className="flex items-center justify-between pt-1 gap-1 border-t border-slate-100">
                            <button
                              onClick={() => handleOpenQuickUpdate(item)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-bold transition flex items-center gap-1"
                              title="Mise à jour rapide de l'avancement"
                            >
                              <span>⚡</span>
                              <span>Avancement</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                                title="Modifier"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => setDeleteConfirmItem(item)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold transition"
                                title="Supprimer"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredOperational.length === 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                    <p className="font-semibold text-sm">Aucune activité opérationnelle trouvée avec ces critères.</p>
                    <button
                      onClick={() => { setSelectedSemester('ALL'); setSelectedCategory('ALL'); setSearchQuery(''); }}
                      className="mt-2 text-xs text-teal-800 font-bold hover:underline"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* ONGLET 3 : CHRONOGRAMME & CALENDRIER PAR MOIS                 */}
            {/* ============================================================== */}
            {activeTab === 'TIMELINE' && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Calendrier Prévisionnel des Échéances B13 (Mois par Mois)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Visualisez l’ensemble des jalons, livrables officiels et ateliers classés par date d’exécution.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {timelineGroups.map(([monthLabel, items]) => (
                    <div key={monthLabel} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-black text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                          <span>📅</span>
                          <span>{monthLabel}</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {items.length} activité{items.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {items.map(it => {
                          const lead = users.find(u => u.id === it.lead_expert_id);
                          const isContractual = it.is_predefined_deliverable;
                          const statusInfo = STATUS_META[it.status] || STATUS_META.PLANIFIE;
                          return (
                            <div key={it.id} className="p-3.5 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <span className={`text-xs px-2 py-1 rounded font-bold shrink-0 ${
                                  isContractual ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isContractual ? '🏆 UNITÉ OFFICIELLE' : 'OPÉRATIONNEL'}
                                </span>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-900">{it.title}</h4>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{it.notes}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0 self-end md:self-auto">
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Échéance</span>
                                  <span className="text-xs font-mono font-bold text-slate-900">{it.execution_date}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Responsable</span>
                                  <span className="text-xs font-semibold text-slate-800">{lead?.full_name?.split(' ')[0]}</span>
                                </div>
                                <div className="w-24">
                                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                    <span>Avance.</span>
                                    <span className="font-bold">{it.progress_pct}%</span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-teal-700 h-full rounded-full" style={{ width: `${it.progress_pct}%` }} />
                                  </div>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusInfo.badge}`}>
                                  {statusInfo.label}
                                </span>
                                <button
                                  onClick={() => handleOpenQuickUpdate(it)}
                                  className="px-2 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-bold"
                                >
                                  ⚡ MàJ
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ONGLET 4 : BAREMES, REGLES & LEXIQUE                          */}
            {/* ============================================================== */}
            {activeTab === 'GUIDE' && (
              <div className="space-y-6 max-w-4xl">
                {/* Barème de performance */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <span>⚖️</span>
                    <span>Barème de Performance & Déclenchement de Paiement (Milestone B13)</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Sous l’accord Fixed Amount Award (SAQMMA26CA0351), le Milestone B13 comporte 2 Unités contractuelles par semestre. Le paiement s’opère selon la grille officielle :
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-300">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-emerald-900 uppercase">Performance Excellente</span>
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">2 Unités</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                        100% du paiement prévu pour le semestre débloqué intégralement.
                      </p>
                    </div>

                    <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-300">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-amber-900 uppercase">Seuil Minimum</span>
                        <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">1 Unité</span>
                      </div>
                      <p className="text-[11px] text-amber-800 font-semibold mt-1">
                        Paiement partiel (50%) et obligation contractuelle de régularisation sous 30 jours.
                      </p>
                    </div>

                    <div className="bg-rose-50/80 p-3.5 rounded-xl border border-rose-300">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-rose-900 uppercase">Insuffisant</span>
                        <span className="font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">0 Unité</span>
                      </div>
                      <p className="text-[11px] text-rose-800 font-semibold mt-1">
                        Aucun paiement déclenché pour le milestone B13 pour ce semestre.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lexique des acronymes */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <span>📚</span>
                    <span>Lexique des Sigles et Abréviations B13</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block font-mono">QAT (Quantification Analytics Tool) :</strong>
                      <span className="text-slate-600 text-[11px]">Logiciel national d’élaboration des plans d’approvisionnement et de prévision des stocks.</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block font-mono">GTT (Groupe Technique de Travail) :</strong>
                      <span className="text-slate-600 text-[11px]">Comité trimestriel national réunissant DPMED, PNLP, SoBAPS et partenaires logistiques.</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block font-mono">ILP (Informations Logistiques Préparatoires) :</strong>
                      <span className="text-slate-600 text-[11px]">Données de consommation et de stocks nettoyées lors des ateliers semestriels Sud et Nord.</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block font-mono">POA (Plans Opérationnels Annuels) :</strong>
                      <span className="text-slate-600 text-[11px]">Feuilles de route logistiques des 9 zones sanitaires élaborées au S1 et actualisées au S2.</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block font-mono">CPS (Chimio-Prévention du Paludisme Saisonnier) :</strong>
                      <span className="text-slate-600 text-[11px]">Campagne de distribution préventive des intrants SPAQ aux enfants dans le département de l’Alibori.</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block font-mono">IOV (Indicateur Objectivement Vérifiable) :</strong>
                      <span className="text-slate-600 text-[11px]">Preuve formelle déposée (rapport signé, accusé de réception, tableau de quantification validé).</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* MODALE 1 : MISE A JOUR RAPIDE DE L'AVANCEMENT & STATUT         */}
        {/* ============================================================== */}
        {quickUpdateItem && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded uppercase font-mono">
                    {quickUpdateItem.is_predefined_deliverable ? 'Livrable Contractuel B13' : 'Sous-activité Opérationnelle'}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 mt-1">
                    ⚡ Mettre à jour l’avancement & le statut
                  </h3>
                </div>
                <button
                  onClick={() => setQuickUpdateItem(null)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none p-1 rounded"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block">{quickUpdateItem.title}</span>
                <span className="text-[11px] text-slate-500 font-mono">Échéance : {quickUpdateItem.execution_date}</span>
              </div>

              <form onSubmit={handleSaveQuickUpdate} className="space-y-4 text-xs">
                {/* Niveau d'avancement avec slider et boutons rapides */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-800">
                      Niveau d’avancement : <span className="text-teal-800 text-sm font-black font-mono">{quickProgress}%</span>
                    </label>
                    <div className="flex gap-1">
                      {[0, 25, 50, 75, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setQuickProgress(val);
                            if (val === 100) setQuickStatus('VALIDE');
                            else if (val > 0) setQuickStatus('EN_COURS');
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                            quickProgress === val ? 'bg-teal-800 text-white border-teal-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={quickProgress}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setQuickProgress(v);
                      if (v === 100) setQuickStatus('VALIDE');
                      else if (v > 0 && quickStatus === 'PLANIFIE') setQuickStatus('EN_COURS');
                    }}
                    className="w-full accent-teal-800 cursor-pointer"
                  />
                </div>

                {/* Statut d'avancement */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Statut de validation *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['PLANIFIE', 'EN_COURS', 'TRANSMIS', 'VALIDE'] as const).map(st => {
                      const meta = STATUS_META[st];
                      const isSelected = quickStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setQuickStatus(st)}
                          className={`p-2 rounded-lg border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                            isSelected
                              ? 'bg-teal-800 text-white border-teal-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>{meta.icon}</span>
                          <span className="text-[11px]">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes et observations */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Observations & Faits marquants (Optionnel)
                  </label>
                  <textarea
                    rows={2}
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    placeholder="Ex: Draft QAT soumis à la DPMED le 15/11. En attente de la séance de validation conjointe..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 font-medium"
                  />
                </div>

                {/* Preuve de vérification / Lien IOV */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Preuve de Vérification / Lien IOV (Accusé de réception, Drive, Fichier)
                  </label>
                  <input
                    type="text"
                    value={quickEvidence}
                    onChange={(e) => setQuickEvidence(e.target.value)}
                    placeholder="Ex: Accusé de réception PSI réf 2026/0492 ou https://drive.google.com/..."
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium font-mono text-[11px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuickUpdateItem(null)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <span>💾</span>
                    <span>Enregistrer la mise à jour</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODALE 2 : AJOUT / MODIFICATION COMPLETE D'UNE ACTIVITE B13    */}
        {/* ============================================================== */}
        {(isNewModalOpen || editModalItem) && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editModalItem ? '✏️ Modifier l’activité B13' : '➕ Ajouter une nouvelle activité B13'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Renseignez les informations de suivi technique ou contractuel du milestone.
                  </p>
                </div>
                <button
                  onClick={() => { setIsNewModalOpen(false); setEditModalItem(null); }}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none p-1 rounded"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
                {/* Catégorie & Semestre */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Catégorie B13 *</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as B13Item['category'])}
                      className="w-full border border-slate-300 rounded-lg p-2 font-semibold outline-none focus:border-teal-700"
                    >
                      <option value="POA_MANAGEMENT">📋 Gestion des 9 POA</option>
                      <option value="QUANTIFICATION">📊 Rapport Quantification</option>
                      <option value="ILP_VALIDATION">🏛️ Validation Données ILP</option>
                      <option value="QAT_TRACKING">💻 Suivi QAT (Supply Plan)</option>
                      <option value="GTT_MEETING">👥 Réunions GTT</option>
                      <option value="CPS_CAMPAIGN">💊 Campagne CPS Alibori</option>
                      <option value="SUPPLY_PLAN">📦 Plan d’Approvisionnement</option>
                      <option value="DISTRIBUTION">🚚 Plan de Distribution</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Semestre d’exécution *</label>
                    <select
                      value={formSemester}
                      onChange={(e) => setFormSemester(e.target.value as any)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-semibold outline-none focus:border-teal-700"
                    >
                      <option value="S1_2026_2027">Semestre 1 (Octobre 2026 – Mars 2027)</option>
                      <option value="S2_2026_2027">Semestre 2 (Avril 2027 – Septembre 2027)</option>
                    </select>
                  </div>
                </div>

                {/* Titre */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Intitulé de l’activité / Livrable *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Atelier Sud de validation des données logistiques ILP (Lokossa)"
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-teal-700 font-bold"
                  />
                </div>

                {/* Statut & Avancement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Responsable désigné (Lead) *</label>
                    <select
                      value={formLeadExpertId}
                      onChange={(e) => setFormLeadExpertId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-semibold outline-none focus:border-teal-700"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Date d’échéance prévue *</label>
                    <input
                      type="date"
                      required
                      value={formExecutionDate}
                      onChange={(e) => setFormExecutionDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold outline-none focus:border-teal-700"
                    >
                    </input>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Statut</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-bold outline-none focus:border-teal-700"
                    >
                      <option value="PLANIFIE">⏳ Planifié</option>
                      <option value="EN_COURS">🔄 En cours</option>
                      <option value="TRANSMIS">📤 Transmis à PSI</option>
                      <option value="VALIDE">✅ Validé & Payé</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Avancement : <span className="text-teal-800 font-mono font-bold">{formProgress}%</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formProgress}
                      onChange={(e) => setFormProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="w-full border border-slate-300 rounded-lg p-2 font-bold font-mono outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Notes, observations et livrables attendus</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Préciser les modalités, partenaires impliqués, livrables attendus..."
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-medium"
                  />
                </div>

                {/* Preuve IOV */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Lien de preuve / Réf document (IOV)</label>
                  <input
                    type="text"
                    value={formEvidence}
                    onChange={(e) => setFormEvidence(e.target.value)}
                    placeholder="Ex: Réf courrier PSI ou lien Drive"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-teal-700 font-mono text-[11px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setIsNewModalOpen(false); setEditModalItem(null); }}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg font-bold shadow-xs transition"
                  >
                    {editModalItem ? 'Enregistrer les modifications' : 'Créer l’activité'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODALE 3 : CONFIRMATION DE SUPPRESSION                         */}
        {/* ============================================================== */}
        {deleteConfirmItem && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirmer la suppression</h3>
                  <p className="text-xs text-slate-500">Cette action est irréversible.</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block">{deleteConfirmItem.title}</span>
                <span className="text-[11px] text-slate-500">Catégorie : {CATEGORY_META[deleteConfirmItem.category]?.label || deleteConfirmItem.category}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 transition text-xs"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition text-xs shadow-2xs"
                >
                  Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleGuard>
  );
}
