'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { DocumentItem } from '@/types';
import { 
  FolderArchive, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  FileCheck,
  X
} from 'lucide-react';

export default function DocumentationPage() {
  const { documents, addDocument, currentUser } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  const [newDoc, setNewDoc] = useState<Partial<DocumentItem>>({
    title: '',
    file_name: '',
    file_type: 'PDF',
    file_size_kb: 1200,
    milestone: 'B09',
    department: 'National',
    category: 'PREUVE_VERIFICATION',
  });

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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              Module 8 : GED
            </span>
            <span className="text-xs text-slate-500">Bibliothèque & Preuves de Vérification</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Documentation & Archivage Sécurisé</h1>
          <p className="text-xs text-slate-500">
            Classement méthodique par jalon (B09/B13), département, expert, catégorie et période contractuelle.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Upload className="w-4 h-4" />
          <span>Déposer une Pièce Justificative</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par titre, nom de fichier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Tous les jalons</option>
            <option value="B09">B09 - Promptitude eSIGL</option>
            <option value="B13">B13 - Quantification & Appro</option>
            <option value="TRANSVERSAL">Transversal</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium outline-none"
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
          const isPdf = doc.file_type === 'PDF';
          const isExcel = doc.file_type === 'EXCEL';

          return (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between hover:border-teal-500 transition">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-1.5">
                    {isPdf ? (
                      <span className="p-2 rounded-lg bg-red-50 text-red-600">
                        <FileText className="w-5 h-5" />
                      </span>
                    ) : isExcel ? (
                      <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                        <FileSpreadsheet className="w-5 h-5" />
                      </span>
                    ) : (
                      <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <ImageIcon className="w-5 h-5" />
                      </span>
                    )}
                    <div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        doc.milestone === 'B09' ? 'badge-b09' : 'badge-b13'
                      }`}>
                        {doc.milestone}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {(doc.file_size_kb / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                    {doc.category.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-xs mt-2 line-clamp-2">{doc.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1 font-mono truncate">{doc.file_name}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                <div>
                  <span className="block text-slate-700 font-medium">{doc.uploaded_by}</span>
                  <span className="text-[10px] text-slate-400">{doc.upload_date}</span>
                </div>

                <button
                  onClick={() => alert(`Téléchargement sécurisé du fichier : ${doc.file_name}`)}
                  className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* UPLOAD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-sm text-slate-800">Déposer un Document ou Preuve</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
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
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jalon</label>
                  <select
                    value={newDoc.milestone}
                    onChange={(e) => setNewDoc({ ...newDoc, milestone: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                    className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                  className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-600"
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
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold"
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
