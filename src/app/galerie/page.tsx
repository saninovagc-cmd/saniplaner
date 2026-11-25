'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { GalleryItem, GalleryPhotoItem, MilestoneType } from '@/types';
import ModuleGuard from '@/components/ModuleGuard';

// Helper pour compresser une image sans déformer le ratio (qualité haute fidélité)
function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8
): Promise<{ dataUrl: string; sizeKb: number; originalSizeKb: number }> {
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Conserver rigoureusement le ratio d'aspect sans déformation
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas non disponible'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl, sizeKb, originalSizeKb });
      };
      img.onerror = () => reject(new Error('Impossible de charger l\'image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsDataURL(file);
  });
}

// Téléchargement propre d'une photo
function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.svg')
    ? fileName
    : `${fileName}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const DEPARTMENTS = ['Tous', 'Atacora', 'Donga', 'Mono', 'Plateau', 'National / Cotonou'];

interface PhotoDraft {
  id: string;
  dataUrl: string;
  caption: string;
  fileName: string;
  sizeKb: number;
  originalSizeKb: number;
}

export default function GaleriePage() {
  const {
    galleryItems,
    addGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
    addPhotoToGalleryItem,
    deletePhotoFromGalleryItem,
    activities,
    users,
    currentUser,
  } = useApp();

  const isPartner = currentUser?.role === 'partenaire';

  // Navigation & Filtres
  const [viewMode, setViewMode] = useState<'ALBUMS' | 'MOSAIC'>('ALBUMS');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Modal d'ajout rapide de photo à un album existant
  const [addPhotoTargetItem, setAddPhotoTargetItem] = useState<GalleryItem | null>(null);
  const [quickPhotoDraft, setQuickPhotoDraft] = useState<PhotoDraft | null>(null);
  const [quickCaption, setQuickCaption] = useState('');
  const [isCompressingQuick, setIsCompressingQuick] = useState(false);

  // Visionneuse Plein Écran (Lightbox)
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    item: GalleryItem | null;
    photoIndex: number;
  }>({
    isOpen: false,
    item: null,
    photoIndex: 0,
  });

  // État formulaire Création Album
  const [formTitle, setFormTitle] = useState('');
  const [formMilestone, setFormMilestone] = useState<MilestoneType>('B09');
  const [formActivityId, setFormActivityId] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().substring(0, 10));
  const [formPhotos, setFormPhotos] = useState<PhotoDraft[]>([]);
  const [isCompressingForm, setIsCompressingForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  // Liste filtrée des activités selon le jalon sélectionné dans le formulaire
  const formFilteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (formMilestone === 'B09') return a.code.startsWith('B09') || a.milestone === 'B09';
      if (formMilestone === 'B13') return a.code.startsWith('B13') || a.milestone === 'B13';
      return a.code.startsWith('TR') || a.milestone === 'TRANSVERSAL';
    });
  }, [activities, formMilestone]);

  // Initialisation par défaut de l'activité du jalon
  useEffect(() => {
    if (formFilteredActivities.length > 0 && !formActivityId) {
      setFormActivityId(formFilteredActivities[0].id);
    }
  }, [formFilteredActivities, formActivityId]);

  // Réinitialiser le formulaire
  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormMilestone('B09');
    setFormActivityId('');
    setFormLocation('');
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormPhotos([]);
    setIsCreateModalOpen(true);
  };

  // Traitement sélection photos multiples pour le formulaire
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 7 - formPhotos.length;
    if (remainingSlots <= 0) {
      alert('Vous avez déjà atteint le maximum de 07 photos pour cet enregistrement.');
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setIsCompressingForm(true);

    try {
      const processed: PhotoDraft[] = [];
      for (const file of filesToProcess) {
        const { dataUrl, sizeKb, originalSizeKb } = await compressImage(file, 1280, 1280, 0.8);
        processed.push({
          id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dataUrl,
          caption: '',
          fileName: file.name,
          sizeKb,
          originalSizeKb,
        });
      }
      setFormPhotos((prev) => [...prev, ...processed]);
    } catch (err) {
      console.error('Erreur compression image:', err);
      alert('Une erreur est survenue lors du traitement et de la compression de la photo.');
    } finally {
      setIsCompressingForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Suppression d'une photo du formulaire
  const handleRemoveFormPhoto = (id: string) => {
    setFormPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Mise à jour de la légende d'une photo dans le formulaire
  const handleUpdateFormPhotoCaption = (id: string, caption: string) => {
    setFormPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  // Enregistrement du formulaire
  const handleSubmitAlbum = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('Veuillez saisir le titre de la mission ou de l\'activité.');
      return;
    }

    if (formPhotos.length === 0) {
      alert('Veuillez ajouter au moins une photo avant d\'enregistrer.');
      return;
    }

    const selectedActObj = activities.find((a) => a.id === formActivityId);
    const activityCode = selectedActObj?.code || (formMilestone === 'B09' ? 'B09.1' : formMilestone === 'B13' ? 'B13.1' : 'TR-01');
    const activityTitle = selectedActObj?.title || `Activité associée au Jalon ${formMilestone}`;

    const newAlbum: GalleryItem = {
      id: `gal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: formTitle.trim(),
      milestone: formMilestone,
      activity_id: formActivityId,
      activity_code: activityCode,
      activity_title: activityTitle,
      location: formLocation.trim() || 'Zone d\'intervention',
      date: formDate,
      author_id: currentUser.id,
      author_name: currentUser.full_name,
      author_role: currentUser.title || currentUser.role,
      photos: formPhotos.map((p, idx) => ({
        id: `p-${Date.now()}-${idx}`,
        url: p.dataUrl,
        caption: p.caption.trim() || `Cliché ${idx + 1} - ${formTitle.trim()}`,
        file_name: p.fileName,
        size_kb: p.sizeKb,
        uploaded_at: new Date().toISOString(),
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addGalleryItem(newAlbum);
    setIsCreateModalOpen(false);
  };

  // Gestion ajout rapide d'une photo à une mission existante
  const handleOpenQuickAddPhoto = (item: GalleryItem) => {
    if (item.photos.length >= 7) {
      alert('Cette mission a déjà atteint la limite maximale de 07 photos.');
      return;
    }
    setAddPhotoTargetItem(item);
    setQuickPhotoDraft(null);
    setQuickCaption('');
  };

  const handleQuickFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingQuick(true);
    try {
      const { dataUrl, sizeKb, originalSizeKb } = await compressImage(file, 1280, 1280, 0.8);
      setQuickPhotoDraft({
        id: `quick-${Date.now()}`,
        dataUrl,
        caption: '',
        fileName: file.name,
        sizeKb,
        originalSizeKb,
      });
    } catch (err) {
      console.error(err);
      alert('Erreur lors du traitement de la photo.');
    } finally {
      setIsCompressingQuick(false);
      if (quickFileInputRef.current) quickFileInputRef.current.value = '';
    }
  };

  const handleSaveQuickPhoto = () => {
    if (!addPhotoTargetItem || !quickPhotoDraft) return;

    const newPhoto: GalleryPhotoItem = {
      id: `p-${Date.now()}`,
      url: quickPhotoDraft.dataUrl,
      caption: quickCaption.trim() || `Cliché de terrain - ${addPhotoTargetItem.title}`,
      file_name: quickPhotoDraft.fileName,
      size_kb: quickPhotoDraft.sizeKb,
      uploaded_at: new Date().toISOString(),
    };

    addPhotoToGalleryItem(addPhotoTargetItem.id, newPhoto);
    setAddPhotoTargetItem(null);
    setQuickPhotoDraft(null);
    setQuickCaption('');
  };

  // Suppression d'un album complet
  const handleDeleteAlbum = () => {
    if (deleteConfirmId) {
      deleteGalleryItem(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  // Gestion Lightbox
  const openLightbox = (item: GalleryItem, photoIndex = 0) => {
    setLightboxState({
      isOpen: true,
      item,
      photoIndex,
    });
  };

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  const nextLightboxPhoto = () => {
    if (!lightboxState.item) return;
    const total = lightboxState.item.photos.length;
    setLightboxState((prev) => ({
      ...prev,
      photoIndex: (prev.photoIndex + 1) % total,
    }));
  };

  const prevLightboxPhoto = () => {
    if (!lightboxState.item) return;
    const total = lightboxState.item.photos.length;
    setLightboxState((prev) => ({
      ...prev,
      photoIndex: (prev.photoIndex - 1 + total) % total,
    }));
  };

  // Écoute clavier pour la Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxState.isOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextLightboxPhoto();
      if (e.key === 'ArrowLeft') prevLightboxPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxState.isOpen, lightboxState.item]);

  // Filtrage des éléments de la galerie
  const filteredGalleryItems = useMemo(() => {
    return galleryItems.filter((item) => {
      // Filtre Jalon
      if (selectedMilestone !== 'ALL' && item.milestone !== selectedMilestone) {
        return false;
      }

      // Filtre Activité
      if (selectedActivity !== 'ALL' && item.activity_id !== selectedActivity && item.activity_code !== selectedActivity) {
        return false;
      }

      // Filtre Département / Lieu
      if (selectedDept !== 'ALL') {
        const itemLoc = item.location.toLowerCase();
        if (selectedDept === 'National / Cotonou') {
          if (!itemLoc.includes('cotonou') && !itemLoc.includes('national')) return false;
        } else if (!itemLoc.includes(selectedDept.toLowerCase())) {
          return false;
        }
      }

      // Filtre Auteur
      if (selectedAuthor !== 'ALL') {
        if (selectedAuthor === 'MINE' && item.author_id !== currentUser.id) return false;
        if (selectedAuthor !== 'MINE' && item.author_id !== selectedAuthor) return false;
      }

      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesLocation = item.location.toLowerCase().includes(q);
        const matchesAuthor = item.author_name.toLowerCase().includes(q);
        const matchesActivity = item.activity_title.toLowerCase().includes(q) || (item.activity_code && item.activity_code.toLowerCase().includes(q));
        const matchesCaptions = item.photos.some((p) => p.caption.toLowerCase().includes(q));

        if (!matchesTitle && !matchesLocation && !matchesAuthor && !matchesActivity && !matchesCaptions) {
          return false;
        }
      }

      return true;
    });
  }, [galleryItems, selectedMilestone, selectedActivity, selectedDept, selectedAuthor, searchQuery, currentUser]);

  // Liste à plat de toutes les photos pour la vue mosaïque
  const allPhotosMosaic = useMemo(() => {
    const list: { photo: GalleryPhotoItem; item: GalleryItem; index: number }[] = [];
    filteredGalleryItems.forEach((item) => {
      item.photos.forEach((photo, idx) => {
        list.push({ photo, item, index: idx });
      });
    });
    return list;
  }, [filteredGalleryItems]);

  // Statistiques globales
  const totalPhotosCount = useMemo(() => {
    return galleryItems.reduce((acc, it) => acc + it.photos.length, 0);
  }, [galleryItems]);

  const b09PhotosCount = useMemo(() => {
    return galleryItems.filter((g) => g.milestone === 'B09').reduce((acc, it) => acc + it.photos.length, 0);
  }, [galleryItems]);

  const b13PhotosCount = useMemo(() => {
    return galleryItems.filter((g) => g.milestone === 'B13').reduce((acc, it) => acc + it.photos.length, 0);
  }, [galleryItems]);

  // Télécharger toutes les photos d'un album
  const handleDownloadAllFromAlbum = (item: GalleryItem) => {
    item.photos.forEach((photo, idx) => {
      setTimeout(() => {
        const cleanName = `${item.milestone}_${item.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}_photo_${idx + 1}.jpg`;
        triggerDownload(photo.url, cleanName);
      }, idx * 250);
    });
  };

  return (
    <ModuleGuard moduleId="galerie">
      <div className="space-y-6 pb-12 font-sans text-slate-800">
        {/* BANNIÈRE ENTÊTE */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-full bg-white/5 skew-x-12 pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Documentation Visuelle Certifiée
                </span>
                <span className="text-teal-300 text-xs font-mono">
                  {galleryItems.length} Album(s) &bull; {totalPhotosCount} Photo(s)
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                Galerie Photos de Terrain & Missions
              </h1>
              <p className="text-teal-100/80 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Documentation photographique des ateliers, supervisions formatives et activités des jalons contractuels (B09 eSIGL, B13 Quantification & Transversal).
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              {!isPartner ? (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-2 active:scale-95"
                >
                  <span className="text-base font-black">+</span>
                  <span>Charger des Photos</span>
                </button>
              ) : (
                <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/40">
                  👁️ Mode Consultation Seule (PSI / ABMS)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CARTES STATISTIQUES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Photos</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalPhotosCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Clichés compressés & archivés</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Photos Jalon B09</span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{b09PhotosCount}</div>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">eSIGL & Supervisions 356 FOSA</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-200 bg-blue-50/20 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Photos Jalon B13</span>
            <div className="text-2xl font-black text-blue-900 mt-1">{b13PhotosCount}</div>
            <p className="text-[11px] text-blue-700/80 mt-0.5">Quantification & Outil QAT</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-teal-200 bg-teal-50/20 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Missions Documentées</span>
            <div className="text-2xl font-black text-teal-900 mt-1">{galleryItems.length}</div>
            <p className="text-[11px] text-teal-700/80 mt-0.5">Albums avec légendes détaillées</p>
          </div>
        </div>

        {/* BARRE D'ACTIONS, RECHERCHE & FILTRES */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Recherche libre */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par mission, activité, lieu, légende ou agent..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sélecteur de mode de vue : Albums vs Mosaïque */}
            <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl shrink-0 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('ALBUMS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'ALBUMS'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📁</span>
                <span>Vue par Mission ({filteredGalleryItems.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('MOSAIC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'MOSAIC'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🖼️</span>
                <span>Mosaïque Photos ({allPhotosMosaic.length})</span>
              </button>
            </div>
          </div>

          {/* Filtres sélecteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
            {/* Jalon */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Jalon Contractuel
              </label>
              <select
                value={selectedMilestone}
                onChange={(e) => {
                  setSelectedMilestone(e.target.value);
                  setSelectedActivity('ALL');
                }}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
              >
                <option value="ALL">Tous les jalons (B09, B13, Transversal)</option>
                <option value="B09">Jalon B09 — Complétude eSIGL</option>
                <option value="B13">Jalon B13 — Quantification QAT</option>
                <option value="TRANSVERSAL">Jalon Transversal</option>
              </select>
            </div>

            {/* Activité */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Activité du Jalon
              </label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600 truncate"
              >
                <option value="ALL">Toutes les activités</option>
                {activities
                  .filter((a) => selectedMilestone === 'ALL' || a.milestone === selectedMilestone)
                  .map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.code} - {act.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* Département / Lieu */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Lieu / Département
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d === 'Tous' ? 'Tous les départements & lieux' : d}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent / Auteur */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Agent Photographe
              </label>
              <select
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
              >
                <option value="ALL">Tous les membres de l&apos;équipe</option>
                <option value="MINE">Mes missions uniquement</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.title || u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* AFFICHAGE CONTENU : VUE ALBUMS */}
        {viewMode === 'ALBUMS' && (
          <div className="space-y-6">
            {filteredGalleryItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-2xs space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto">
                  📷
                </div>
                <h3 className="text-base font-bold text-slate-800">Aucun album photo trouvé</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Aucun album photo ne correspond aux critères de filtre sélectionnés. Essayez de réinitialiser vos filtres ou de charger de nouvelles photos.
                </p>
                {!isPartner && (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="mt-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition"
                  >
                    + Charger des photos pour une mission
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredGalleryItems.map((item) => {
                  const isMine = item.author_id === currentUser.id;
                  const canManage = isMine || currentUser.role === 'direction';
                  const canAddMore = item.photos.length < 7;

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col hover:shadow-md transition-shadow group"
                    >
                      {/* APERÇU PHOTO PRINCIPALE */}
                      <div className="relative aspect-16/10 bg-slate-900 overflow-hidden cursor-pointer">
                        {item.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photos[0].url}
                            alt={item.photos[0].caption}
                            onClick={() => openLightbox(item, 0)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            Aucune photo
                          </div>
                        )}

                        {/* BADGES SUPERPOSÉS */}
                        <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm ${
                              item.milestone === 'B09'
                                ? 'bg-emerald-600 text-white'
                                : item.milestone === 'B13'
                                ? 'bg-blue-600 text-white'
                                : 'bg-purple-600 text-white'
                            }`}
                          >
                            Jalon {item.milestone}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                            {item.activity_code || item.milestone}
                          </span>
                        </div>

                        <div className="absolute top-2.5 right-2.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-black/60 text-white backdrop-blur-xs flex items-center space-x-1">
                            <span>📷</span>
                            <span>{item.photos.length}/7</span>
                          </span>
                        </div>

                        {/* LÉGENDE DE LA PREMIÈRE PHOTO AU BAS DE L'IMAGE */}
                        {item.photos[0]?.caption && (
                          <div
                            onClick={() => openLightbox(item, 0)}
                            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-3 pt-6 text-white text-[11px] font-medium line-clamp-1"
                          >
                            {item.photos[0].caption}
                          </div>
                        )}
                      </div>

                      {/* MINIATURES SECONDAIRES DE L'ALBUM */}
                      <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto">
                        {item.photos.map((p, idx) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => openLightbox(item, idx)}
                            className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 border-transparent hover:border-teal-600 focus:outline-none transition group/thumb"
                            title={p.caption || `Photo ${idx + 1}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={p.caption}
                              className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                            />
                            <span className="absolute bottom-0 right-0 px-1 text-[8px] font-bold bg-black/70 text-white rounded-tl">
                              {idx + 1}
                            </span>
                          </button>
                        ))}

                        {/* Bouton ajouter une photo à la suite si < 7 */}
                        {!isPartner && canAddMore && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickAddPhoto(item)}
                            className="w-12 h-12 rounded-lg border-2 border-dashed border-teal-300 hover:border-teal-600 bg-teal-50 hover:bg-teal-100 text-teal-800 flex flex-col items-center justify-center shrink-0 transition"
                            title="Ajouter une photo supplémentaire à cette mission (Max 7)"
                          >
                            <span className="text-sm font-black">+</span>
                            <span className="text-[8px] font-bold">Ajout</span>
                          </button>
                        )}
                      </div>

                      {/* CONTENU & INFORMATIONS */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <h4
                            onClick={() => openLightbox(item, 0)}
                            className="text-sm font-bold text-slate-900 group-hover:text-teal-800 transition cursor-pointer line-clamp-2"
                            title={item.title}
                          >
                            {item.title}
                          </h4>

                          <p className="text-[11px] text-teal-900 font-semibold flex items-center space-x-1">
                            <span>🎯</span>
                            <span className="truncate">{item.activity_title}</span>
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                            <span className="flex items-center space-x-1">
                              <span>📍</span>
                              <span className="font-semibold text-slate-700">{item.location}</span>
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center space-x-1">
                              <span>📅</span>
                              <span>{item.date}</span>
                            </span>
                          </div>
                        </div>

                        {/* PIED DE CARTE : AUTEUR & ACTIONS */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="text-[11px] text-slate-600 flex items-center space-x-1.5 truncate mr-2">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[9px] font-black shrink-0">
                              {item.author_name.substring(0, 2).toUpperCase()}
                            </span>
                            <span className="truncate font-medium">{item.author_name}</span>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {/* Bouton Télécharger tout l'album */}
                            <button
                              type="button"
                              onClick={() => handleDownloadAllFromAlbum(item)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                              title="Télécharger toutes les photos de cet album"
                            >
                              📥 Tout
                            </button>

                            {/* Bouton Voir */}
                            <button
                              type="button"
                              onClick={() => openLightbox(item, 0)}
                              className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition"
                            >
                              👁️ Voir
                            </button>

                            {/* Bouton Supprimer */}
                            {!isPartner && canManage && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="px-1.5 py-1 rounded hover:bg-rose-50 text-rose-600 text-xs transition"
                                title="Supprimer cet album"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AFFICHAGE CONTENU : VUE MOSAÏQUE */}
        {viewMode === 'MOSAIC' && (
          <div className="space-y-4">
            {allPhotosMosaic.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-2xs">
                <p className="text-xs text-slate-500">Aucune photo individuelle ne correspond à vos filtres.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {allPhotosMosaic.map(({ photo, item, index }) => (
                  <div
                    key={photo.id}
                    onClick={() => openLightbox(item, index)}
                    className="group relative bg-slate-900 rounded-xl overflow-hidden aspect-4/3 cursor-pointer shadow-2xs hover:shadow-md transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* OVERLAY INFOS SURVOL */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            item.milestone === 'B09'
                              ? 'bg-emerald-600 text-white'
                              : item.milestone === 'B13'
                              ? 'bg-blue-600 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          {item.milestone}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerDownload(photo.url, `${item.milestone}_${item.title.substring(0, 15)}_photo_${index + 1}.jpg`);
                          }}
                          className="w-6 h-6 rounded bg-black/60 hover:bg-black text-white text-[10px] flex items-center justify-center transition"
                          title="Télécharger cette photo"
                        >
                          📥
                        </button>
                      </div>

                      <div>
                        <p className="text-[10px] font-medium text-white line-clamp-2 leading-tight">
                          {photo.caption || item.title}
                        </p>
                        <p className="text-[9px] text-teal-200 mt-1 truncate">
                          📍 {item.location}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1 : FORMULAIRE DE CRÉATION D'UN ALBUM / NOUVELLE MISSION */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Entête Modal */}
              <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                    Nouveau Dossier Photographique
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">
                    Charger des Photos d&apos;Activité ou Mission
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {/* Corps Formulaire */}
              <form onSubmit={handleSubmitAlbum} className="p-5 sm:p-6 overflow-y-auto space-y-4">
                {/* 1. Titre de la mission ou activité */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Titre de la Mission ou Activité <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Supervision formelle de l'inventaire eSIGL et coaching des gestionnaires"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>

                {/* 2. Jalon & Activité associée */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Choisir le Jalon <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={formMilestone}
                      onChange={(e) => {
                        const newMs = e.target.value as MilestoneType;
                        setFormMilestone(newMs);
                        setFormActivityId('');
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
                    >
                      <option value="B09">Jalon B09 — Complétude eSIGL</option>
                      <option value="B13">Jalon B13 — Quantification QAT</option>
                      <option value="TRANSVERSAL">Jalon Transversal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Activité du Jalon <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={formActivityId}
                      onChange={(e) => setFormActivityId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600 truncate"
                    >
                      {formFilteredActivities.map((act) => (
                        <option key={act.id} value={act.id}>
                          {act.code} - {act.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Lieu & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Mettre le Lieu <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="Ex: Zone Sanitaire Lokossa-Athiémé (Mono)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Date de Réalisation / Prise de vue <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                {/* 4. CHARGEMENT DES PHOTOS (MAXIMUM 07 PHOTOS) */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Photos de la mission / activité
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Chaque photo est automatiquement optimisée en taille sans altérer sa netteté.
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        formPhotos.length >= 7
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-teal-50 text-teal-900 border border-teal-200'
                      }`}
                    >
                      {formPhotos.length} / 07 Photos
                    </span>
                  </div>

                  {/* Bouton de sélection de fichier */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {formPhotos.length < 7 ? (
                    <button
                      type="button"
                      disabled={isCompressingForm}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/50 hover:bg-teal-50 rounded-xl text-center transition flex flex-col items-center justify-center space-y-1.5 group cursor-pointer"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">
                        {isCompressingForm ? '⏳' : '📷'}
                      </span>
                      <span className="text-xs font-bold text-teal-900">
                        {isCompressingForm
                          ? 'Compression et optimisation haute fidélité en cours...'
                          : '+ Choisir une ou plusieurs photos depuis votre galerie / appareil'}
                      </span>
                      <span className="text-[10px] text-teal-700/80">
                        Reste {7 - formPhotos.length} emplacement(s) disponible(s) &bull; Formats JPG, PNG, WEBP acceptés
                      </span>
                    </button>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl text-center">
                      Maximum de 07 photos atteint pour cet enregistrement.
                    </div>
                  )}

                  {/* LISTE DES PHOTOS AJOUTÉES AVEC LÉGENDE */}
                  {formPhotos.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {formPhotos.map((p, idx) => (
                        <div
                          key={p.id}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                        >
                          {/* Miniature */}
                          <div className="relative w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.dataUrl} alt="Preview" className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[8px] font-black bg-black/70 text-white rounded-tl">
                              #{idx + 1}
                            </span>
                          </div>

                          {/* Saisie de la légende */}
                          <div className="flex-1 w-full space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                Légende de la photo #{idx + 1}
                              </span>
                              <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Optimisée : {p.sizeKb} Ko {p.originalSizeKb > 0 && `(Original : ${p.originalSizeKb} Ko)`}
                              </span>
                            </div>
                            <input
                              type="text"
                              required
                              value={p.caption}
                              onChange={(e) => handleUpdateFormPhotoCaption(p.id, e.target.value)}
                              placeholder="Décrivez précisément ce cliché (ex: Séance d'audit des stocks avec le major FOSA)..."
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-600"
                            />
                          </div>

                          {/* Bouton retirer */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFormPhoto(p.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition shrink-0"
                            title="Retirer cette photo"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pied du formulaire */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isCompressingForm || formPhotos.length === 0}
                    className="px-5 py-2 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5"
                  >
                    <span>💾</span>
                    <span>Sauvegarder l&apos;Album ({formPhotos.length} photo{formPhotos.length > 1 ? 's' : ''})</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2 : AJOUT RAPIDE D'UNE PHOTO À UNE MISSION EXISTANTE */}
        {addPhotoTargetItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                    Ajout Photo Supplémentaire
                  </span>
                  <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                    {addPhotoTargetItem.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddPhotoTargetItem(null)}
                  className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <input
                  ref={quickFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQuickFileSelect}
                  className="hidden"
                />

                {!quickPhotoDraft ? (
                  <button
                    type="button"
                    disabled={isCompressingQuick}
                    onClick={() => quickFileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 rounded-xl text-center transition flex flex-col items-center justify-center space-y-2 cursor-pointer"
                  >
                    <span className="text-3xl">{isCompressingQuick ? '⏳' : '📷'}</span>
                    <span className="text-xs font-bold text-teal-900">
                      {isCompressingQuick
                        ? 'Optimisation et compression en cours...'
                        : 'Choisir une photo depuis votre galerie'}
                    </span>
                    <span className="text-[10px] text-teal-700">
                      Photo {addPhotoTargetItem.photos.length + 1} sur un maximum de 7
                    </span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={quickPhotoDraft.dataUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setQuickPhotoDraft(null)}
                        className="absolute top-2 right-2 px-2 py-1 bg-black/70 hover:bg-black text-white text-[10px] font-bold rounded-lg transition"
                      >
                        Changer de photo
                      </button>
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-emerald-300 text-[10px] font-mono rounded">
                        Taille optimisée : {quickPhotoDraft.sizeKb} Ko
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                        Légende de la photo <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={quickCaption}
                        onChange={(e) => setQuickCaption(e.target.value)}
                        placeholder="Précisez la légende du cliché..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-600"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setAddPhotoTargetItem(null)}
                    className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={!quickPhotoDraft}
                    onClick={handleSaveQuickPhoto}
                    className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                  >
                    Ajouter à l&apos;album
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3 : VISIONNEUSE PLEIN ÉCRAN (LIGHTBOX) */}
        {lightboxState.isOpen && lightboxState.item && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-xs transition flex items-center space-x-1.5"
            >
              <span>✕</span>
              <span>Fermer</span>
            </button>

            {/* Navigation Précédent */}
            {lightboxState.item.photos.length > 1 && (
              <button
                type="button"
                onClick={prevLightboxPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center backdrop-blur-xs transition"
                title="Photo précédente (Flèche gauche)"
              >
                ◀
              </button>
            )}

            {/* Navigation Suivant */}
            {lightboxState.item.photos.length > 1 && (
              <button
                type="button"
                onClick={nextLightboxPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center backdrop-blur-xs transition"
                title="Photo suivante (Flèche droite)"
              >
                ▶
              </button>
            )}

            {/* Conteneur principal Photo + Légende */}
            <div className="max-w-5xl w-full h-full max-h-[92vh] flex flex-col justify-between p-4 sm:p-6 text-white">
              {/* Entête supérieure de la Lightbox */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2 truncate mr-12">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      lightboxState.item.milestone === 'B09'
                        ? 'bg-emerald-600'
                        : lightboxState.item.milestone === 'B13'
                        ? 'bg-blue-600'
                        : 'bg-purple-600'
                    }`}
                  >
                    Jalon {lightboxState.item.milestone}
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {lightboxState.item.title}
                  </span>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-xs font-mono font-bold text-teal-300">
                    Photo {lightboxState.photoIndex + 1} / {lightboxState.item.photos.length}
                  </span>
                </div>
              </div>

              {/* IMAGE CENTRÉE EN GRAND FORMAT */}
              <div className="flex-1 flex items-center justify-center my-3 relative overflow-hidden select-none">
                {lightboxState.item.photos[lightboxState.photoIndex] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightboxState.item.photos[lightboxState.photoIndex].url}
                    alt={lightboxState.item.photos[lightboxState.photoIndex].caption}
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-2xl transition"
                  />
                ) : null}
              </div>

              {/* PIED DE LA LIGHTBOX AVEC LÉGENDE DÉTAILLÉE & BOUTON TÉLÉCHARGER */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-bold text-white leading-snug">
                    {lightboxState.item.photos[lightboxState.photoIndex]?.caption || lightboxState.item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    <span>📍 {lightboxState.item.location}</span>
                    <span>&bull;</span>
                    <span>🎯 {lightboxState.item.activity_title}</span>
                    <span>&bull;</span>
                    <span>📅 {lightboxState.item.date}</span>
                    <span>&bull;</span>
                    <span>👤 {lightboxState.item.author_name}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Bouton Télécharger la photo courante */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentPhoto = lightboxState.item!.photos[lightboxState.photoIndex];
                      const cleanName = `${lightboxState.item!.milestone}_${lightboxState.item!.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25)}_photo_${lightboxState.photoIndex + 1}.jpg`;
                      triggerDownload(currentPhoto.url, cleanName);
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5"
                  >
                    <span>📥</span>
                    <span>Télécharger la photo</span>
                  </button>

                  {/* Suppression de cette photo si habilité */}
                  {!isPartner &&
                    (lightboxState.item.author_id === currentUser.id || currentUser.role === 'direction') &&
                    lightboxState.item.photos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const photoId = lightboxState.item!.photos[lightboxState.photoIndex].id;
                          deletePhotoFromGalleryItem(lightboxState.item!.id, photoId);
                          prevLightboxPhoto();
                        }}
                        className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-400/30 text-xs font-bold rounded-xl transition"
                        title="Supprimer cette photo de l'album"
                      >
                        🗑️
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4 : CONFIRMATION SUPPRESSION ALBUM */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl mx-auto">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-slate-900">Confirmer la suppression</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer cet album ainsi que toutes ses photos ? Cette opération est irréversible.
              </p>
              <div className="flex justify-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAlbum}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md"
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
