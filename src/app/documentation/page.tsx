'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { DocumentItem } from '@/types';

function DocumentationInner() {
  const { documents, addDocument, currentUser } = useApp();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const ms = searchParams.get('milestone');
    if (ms) setSelectedMilestone(ms);
  }, [searchParams]);

  const [newDoc, setNewDoc] = useState<Partial<DocumentItem>>({
    title: '',
    file_name: '',
    file_type: 'PDF',
    file_size_kb: 1200,
    milestone: 'B09',
    department: 'National',
    category: 'PREUVE_VERIFICATION',
  });

  const handleDownload = (doc: DocumentItem) => {
    const content = `SANINOVA GLOBAL CONSULTING - PROJET AFGHS-PSI BENIN
============================================================
DOCUMENT OFFICIEL ET PREUVE DE VERIFICATION
============================================================
Titre : ${doc.title}
Nom du fichier : ${doc.file_name}
Format : ${doc.file_type}
Jalon : ${doc.milestone}
Département : ${doc.department}
Catégorie : ${doc.category}
Déposé par : ${doc.uploaded_by} le ${doc.upload_date}
Statut : Certifié conforme aux exigences de vérification du bailleur PSI/ABMS.
============================================================`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.file_name.replace(/\.[^/.]+$/, '')}_certifie.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMilestone = selectedMilestone === 'ALL' || doc.milestone === selectedMilestone;
    const matchesCat = selectedCategory === 'ALL' || doc.category === selectedCategory;
    return matchesSearch && matchesMilestone && matchesCat;
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title || !newDoc.file_name) return;

    const doc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: newDoc.title || '',
      file_name: newDoc.file_name || '',
      file_type: newDoc.file_type || 'PDF',
      file_size_kb: newDoc.file_size_kb || 1200,
      milestone: newDoc.milestone || 'B09',
      department: newDoc.department || 'National',
      category: newDoc.category || 'PREUVE_VERIFICATION',
      uploaded_by: currentUser.full_name,
      upload_date: new Date().toISOString().substring(0, 10),
    };
    addDocument(doc);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 8 : GED
            </span>
            <span className="text-xs text-slate-500 font-medium">Bibliothèque & Preuves de Vérification</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Documentation & Archivage Sécurisé</h1>
          <p className="text-xs text-slate-500">
            Classement méthodique par jalon (B09/B13), département, responsable, catégorie et période contractuelle.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold shadow-xs transition"
        >
          + Déposer une Pièce Justificative
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher par titre, nom de fichier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Jalon :</span>
          <select
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les jalons</option>
            <option value="B09">B09 - Promptitude eSIGL</option>
            <option value="B13">B13 - Quantification & Appro</option>
            <option value="TRANSVERSAL">Transversal</option>
          </select>

          <span className="text-xs text-slate-600 font-medium ml-2">Catégorie :</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Toutes catégories</option>
            <option value="PREUVE_VERIFICATION">Preuve de Vérification</option>
            <option value="RAPPORT_MISSION">Rapport de Mission</option>
            <option value="LISTE_PRESENCE">Liste de Présence</option>
            <option value="FICHIER_QAT">Fichier QAT</option>
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => {
          return (
            <div key={doc.id} className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 flex flex-col justify-between hover:border-slate-400 transition">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 uppercase font-mono border border-slate-200">
                    {doc.file_type}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 uppercase">
                    {doc.category.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-xs mt-2 line-clamp-2">{doc.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1 font-mono truncate">{doc.file_name}</p>
                <div className="mt-1 text-[10px] text-slate-400 font-mono">
                  {(doc.file_size_kb / 1024).toFixed(1)} MB &bull; Jalon : {doc.milestone}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                <div>
                  <span className="block text-slate-800 font-semibold">{doc.uploaded_by}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{doc.upload_date}</span>
                </div>

                <button
                  onClick={() => handleDownload(doc)}
                  className="px-2.5 py-1 text-slate-700 hover:text-teal-900 hover:bg-slate-100 rounded text-xs font-semibold border border-slate-200 transition"
                >
                  Télécharger
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* UPLOAD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">Déposer un Document ou Preuve</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-800 text-xs font-bold">
                Fermer
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Titre descriptif du document *</label>
                <input
                  type="text"
                  required
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="Ex: Bordereau de transmission A7 Atacora..."
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom du fichier *</label>
                <input
                  type="text"
                  required
                  value={newDoc.file_name}
                  onChange={(e) => setNewDoc({ ...newDoc, file_name: e.target.value })}
                  placeholder="Ex: Preuve_Transmission_A7_Octobre2026.pdf"
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jalon</label>
                  <select
                    value={newDoc.milestone}
                    onChange={(e) => setNewDoc({ ...newDoc, milestone: e.target.value as any })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="B09">B09 - eSIGL</option>
                    <option value="B13">B13 - Quantification</option>
                    <option value="TRANSVERSAL">Transversal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type de fichier</label>
                  <select
                    value={newDoc.file_type}
                    onChange={(e) => setNewDoc({ ...newDoc, file_type: e.target.value as any })}
                    className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                  >
                    <option value="PDF">PDF</option>
                    <option value="EXCEL">Excel (.xlsx)</option>
                    <option value="WORD">Word (.docx)</option>
                    <option value="IMAGE">Image (.png, .jpg)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catégorie documentaire</label>
                <select
                  value={newDoc.category}
                  onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as any })}
                  className="w-full border border-slate-200 rounded p-2 outline-none focus:border-teal-700"
                >
                  <option value="PREUVE_VERIFICATION">Preuve de Vérification</option>
                  <option value="RAPPORT_MISSION">Rapport de Mission</option>
                  <option value="LISTE_PRESENCE">Liste de Présence</option>
                  <option value="FICHIER_QAT">Fichier QAT</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded font-semibold"
                >
                  Déposer le document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-sans">Chargement de la Documentation...</div>}>
      <DocumentationInner />
    </Suspense>
  );
}
