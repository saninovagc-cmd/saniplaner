'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';

interface ReportTemplate {
  id: string;
  title: string;
  category: 'PERIODIQUE' | 'MILESTONE' | 'OPERATIONNEL' | 'PERFORMANCE';
  description: string;
  formats: ('PDF' | 'EXCEL')[];
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: 'rpt-mensuel',
    title: 'Rapport Mensuel d’Activités AFGHS',
    category: 'PERIODIQUE',
    description: 'Consolidation mensuelle de toutes les actions, avancées et résultats opérationnels.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-trimestriel',
    title: 'Rapport Trimestriel Consolidé (Q1)',
    category: 'PERIODIQUE',
    description: 'Bilan complet des engagements contractuels du premier trimestre (Oct - Déc 2026).',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-semestriel',
    title: 'Rapport Semestriel Officiel S1',
    category: 'PERIODIQUE',
    description: 'Rapport officiel destiné à PSI/ABMS avec jalons B09 et B13 semestriels.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-b09',
    title: 'Rapport Spécifique B09 — Promptitude eSIGL',
    category: 'MILESTONE',
    description: 'Relevé exhaustif des taux de promptitude des 9 zones sanitaires et respect du seuil 70%.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-b13',
    title: 'Rapport Spécifique B13 — Quantification & QAT',
    category: 'MILESTONE',
    description: 'Validation ILP, plans d’approvisionnement et suivi des 2 livrables semestriels.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-missions',
    title: 'Rapport Consolidé des Missions de Terrain',
    category: 'OPERATIONNEL',
    description: 'Synthèse des supervisions départementales, coaching et état des recommandations.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-formations',
    title: 'Rapport d’Évaluation des Formations',
    category: 'OPERATIONNEL',
    description: 'Analyse comparative des résultats aux tests pré et post-formation des acteurs de santé.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-perf-expert',
    title: 'Rapport de Performance par Membre de l’Équipe',
    category: 'PERFORMANCE',
    description: 'Volume d’activités conduites, taux d’avancement et livrables produits par profil.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-perf-dept',
    title: 'Rapport de Performance par Département',
    category: 'PERFORMANCE',
    description: 'Indicateurs comparatifs : Atacora, Donga, Mono, Plateau et Alibori.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-preuves',
    title: 'Dossier de Preuves de Vérification (Audit Ready)',
    category: 'OPERATIONNEL',
    description: 'Indexation intégrale de toutes les pièces justificatives déposées dans le Hub.',
    formats: ['PDF', 'EXCEL'],
  },
];

export default function ReportsPage() {
  const { activities, b09Metrics, b13Items, users } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredTemplates = TEMPLATES.filter(t => selectedCategory === 'ALL' || t.category === selectedCategory);

  const handleGenerateReport = (templateId: string, format: 'PDF' | 'EXCEL') => {
    if (templateId === 'rpt-b09') {
      if (format === 'EXCEL') {
        const data = b09Metrics.map(m => ({
          Département: m.department,
          Zone: m.zone_name,
          Attendus: m.expected_reports,
          'À Temps': m.submitted_on_time,
          Retard: m.submitted_late,
          Manquants: m.missing_reports,
          'Promptitude (%)': `${m.promptitude_rate}%`,
          'Cible >= 70%': m.target_met ? 'OUI' : 'NON',
          Relances: m.reminders_sent,
        }));
        exportToExcel(data, 'SANINOVA_Rapport_B09_eSIGL');
      } else {
        const headers = ['Département', 'Zone Sanitaire', 'Attendus', 'À Temps', 'Retard', 'Taux %', 'Conformité'];
        const rows = b09Metrics.map(m => [
          m.department,
          m.zone_name,
          m.expected_reports,
          m.submitted_on_time,
          m.submitted_late,
          `${m.promptitude_rate}%`,
          m.target_met ? 'CONFORME (>= 70%)' : 'SOUS SEUIL',
        ]);
        exportTableToPdf(
          'Rapport Officiel B09 — Promptitude du Rapportage eSIGL',
          headers,
          rows,
          'SANINOVA_Rapport_B09_eSIGL',
          'Période : Octobre 2026 | Date limite officielle : 20 Novembre 2026'
        );
      }
    } else if (templateId === 'rpt-b13') {
      if (format === 'EXCEL') {
        const data = b13Items.map(b => ({
          Titre: b.title,
          Semestre: b.semester,
          'Est Livrable Semestriel': b.is_predefined_deliverable ? 'OUI' : 'NON',
          Responsable: users.find(u => u.id === b.lead_expert_id)?.full_name || 'Non assigné',
          Avancement: `${b.progress_pct}%`,
          Statut: b.status,
        }));
        exportToExcel(data, 'SANINOVA_Rapport_B13_Quantification');
      } else {
        const headers = ['Composante B13', 'Semestre', 'Type', 'Responsable', 'Avancement', 'Statut'];
        const rows = b13Items.map(b => [
          b.title.substring(0, 45) + '...',
          b.semester,
          b.is_predefined_deliverable ? 'LIVRABLE OFFICIEL' : 'OPÉRATIONNEL',
          users.find(u => u.id === b.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === b.lead_expert_id)?.full_name.split(' ')[1] || ''),
          `${b.progress_pct}%`,
          b.status,
        ]);
        exportTableToPdf(
          'Rapport Officiel B13 — Quantification et Approvisionnements',
          headers,
          rows,
          'SANINOVA_Rapport_B13_Quantification',
          'Suivi des Livrables Semestriels et Plans QAT'
        );
      }
    } else if (templateId === 'rpt-perf-expert') {
      const data = users.map(u => {
        const userActs = activities.filter(a => a.lead_expert_id === u.id);
        const avgUserProg = userActs.length > 0 
          ? Math.round(userActs.reduce((s, a) => s + a.progress_pct, 0) / userActs.length) 
          : 0;

        return {
          Expert: u.full_name,
          Rôle: u.title,
          'Activités Attribuées': userActs.length,
          'Taux Avancement Moyen': `${avgUserProg}%`,
        };
      });

      if (format === 'EXCEL') {
        exportToExcel(data, 'SANINOVA_Performance_Par_Expert');
      } else {
        const headers = ['Membre de l’Équipe', 'Titre / Profil', 'Activités', 'Taux d’Avancement'];
        const rows = data.map(d => [d.Expert, d.Rôle, d['Activités Attribuées'], d['Taux Avancement Moyen']]);
        exportTableToPdf(
          'Rapport de Performance et Responsabilités',
          headers,
          rows,
          'SANINOVA_Performance_Par_Expert',
          'Revue des engagements de l’équipe AFGHS'
        );
      }
    } else {
      const data = activities.map(a => ({
        Code: a.code,
        Titre: a.title,
        Milestone: a.milestone,
        Responsable: users.find(u => u.id === a.lead_expert_id)?.full_name || '',
        Échéance: a.deadline,
        Avancement: `${a.progress_pct}%`,
        Statut: a.status,
      }));

      if (format === 'EXCEL') {
        exportToExcel(data, `SANINOVA_${templateId}`);
      } else {
        const headers = ['Code', 'Intitulé', 'Milestone', 'Responsable', 'Échéance', 'Statut'];
        const rows = activities.map(a => [
          a.code,
          a.title.substring(0, 40) + '...',
          a.milestone,
          users.find(u => u.id === a.lead_expert_id)?.full_name.split(' ')[0] + ' ' + (users.find(u => u.id === a.lead_expert_id)?.full_name.split(' ')[1] || ''),
          a.deadline,
          a.status,
        ]);
        exportTableToPdf(
          TEMPLATES.find(t => t.id === templateId)?.title || 'Rapport Consolidé',
          headers,
          rows,
          `SANINOVA_${templateId}`,
          'Généré depuis SaniNova Project Hub'
        );
      }
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Module 9 : Analyse & Exports
            </span>
            <span className="text-xs text-slate-500 font-medium">Moteur de Reporting Officiel</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Rapports & Analyses Consolidées</h1>
          <p className="text-xs text-slate-500">
            Génération immédiate des 10 rapports contractuels et opérationnels aux formats PDF et Excel.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded px-3 py-1.5 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Toutes catégories ({TEMPLATES.length})</option>
            <option value="PERIODIQUE">Périodiques (Mensuel, Trimestriel, Semestriel)</option>
            <option value="MILESTONE">Spécifiques Milestones (B09 & B13)</option>
            <option value="OPERATIONNEL">Opérationnels (Missions, Formations, Preuves)</option>
            <option value="PERFORMANCE">Performance (Experts & Départements)</option>
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          return (
            <div key={template.id} className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-slate-400 transition">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                    {template.category}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    PDF &bull; XLS
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mt-1">{template.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {template.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Générer :</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleGenerateReport(template.id, 'EXCEL')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold border border-slate-300 transition"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => handleGenerateReport(template.id, 'PDF')}
                    className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-semibold transition"
                  >
                    PDF
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
