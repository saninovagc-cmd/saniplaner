'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

interface ReportTemplate {
  id: string;
  title: string;
  category: 'PERIODIQUE' | 'MILESTONE' | 'OPERATIONNEL' | 'PERFORMANCE';
  description: string;
  formats: ('PDF' | 'EXCEL')[];
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: 'rpt-workplan-consolide',
    title: 'Rapport Consolidé du Plan de Travail (Périodique)',
    category: 'PERIODIQUE',
    description: 'Consolidation mensuelle, trimestrielle et semestrielle des activités du Work Plan, responsables, échéances et taux d’avancement.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-b09',
    title: 'Rapport Spécifique B09 — Promptitude eSIGL',
    category: 'MILESTONE',
    description: 'Relevé exhaustif des taux de promptitude des 9 zones sanitaires par période et respect du seuil 70%.',
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
    id: 'rpt-sous-activites-workplan',
    title: 'Rapport de Suivi des Sous-Activités par Activité du Work Plan',
    category: 'OPERATIONNEL',
    description: 'Cartographie détaillée de toutes les actions hebdomadaires rattachées à chaque grande activité du Work Plan.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-missions',
    title: 'Rapport Consolidé des Missions de Terrain',
    category: 'OPERATIONNEL',
    description: 'Synthèse des supervisions départementales, déploiements d’équipes, périodes et statut des comptes-rendus.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-formations',
    title: 'Rapport d’Évaluation des Formations',
    category: 'OPERATIONNEL',
    description: 'Sessions animées, zones couvertes, effectifs formés et évolution moyenne pré/post-test.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-perf-expert',
    title: 'Rapport de Performance par Membre de l’Équipe',
    category: 'PERFORMANCE',
    description: 'Volume d’activités conduites, taux d’avancement et engagements attribués par profil.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-perf-dept',
    title: 'Rapport de Performance par Département',
    category: 'PERFORMANCE',
    description: 'Indicateurs comparatifs (promptitude B09, missions et formations) : Atacora, Donga, Mono, Plateau et Alibori.',
    formats: ['PDF', 'EXCEL'],
  },
  {
    id: 'rpt-preuves',
    title: 'Dossier de Preuves de Vérification & Livrables (Audit Ready)',
    category: 'OPERATIONNEL',
    description: 'Indexation des livrables contractuels et des pièces justificatives déposées dans le Hub.',
    formats: ['PDF', 'EXCEL'],
  },
];

export default function ReportsPage() {
  const { activities, weeklyActivities, b09Metrics, b13Items, missions, trainings, documents, deliverables, users } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredTemplates = TEMPLATES.filter(t => selectedCategory === 'ALL' || t.category === selectedCategory);

  const handleGenerateReport = (templateId: string, format: 'PDF' | 'EXCEL') => {
    if (templateId === 'rpt-sous-activites-workplan') {
      if (format === 'EXCEL') {
        const data = weeklyActivities.map(w => {
          const parentAct = activities.find(a => a.code === w.work_plan_code);
          const expert = users.find(u => u.id === w.expert_id);
          return {
            Semaine: `Semaine ${w.week_number}`,
            Jalon: w.milestone,
            'Code Work Plan': w.work_plan_code || 'Non rattaché',
            'Grande Activité Work Plan': parentAct ? parentAct.title : '-',
            'Sous-activité spécifique': w.title,
            Responsable: expert ? expert.full_name : w.expert_id,
            'Jours d’exécution': w.day_of_week,
            Lieu: w.location,
            'Résultat attendu': w.expected_output || '-',
            Statut: w.status,
            'Avancement (%)': `${w.progress_pct}%`,
            'Rapport joint': w.report_name ? `OUI (${w.report_name})` : 'NON',
            Photos: (w.photos && w.photos.length > 0) ? `${w.photos.length} photo(s)` : 'AUCUNE',
            Observations: w.execution_notes || '-',
          };
        });
        exportToExcel(data, 'SANINOVA_Sous_Activites_Work_Plan');
      } else {
        const headers = ['Semaine', 'Jalon', 'Work Plan', 'Sous-Activité Menée', 'Responsable', 'Statut', 'Avanc.'];
        const rows = weeklyActivities.map(w => [
          `S${w.week_number}`,
          w.milestone,
          w.work_plan_code || '-',
          w.title.length > 35 ? w.title.substring(0, 35) + '...' : w.title,
          users.find(u => u.id === w.expert_id)?.full_name || 'Non assigné',
          w.status,
          `${w.progress_pct}%`,
        ]);
        exportTableToPdf(
          'Rapport de Suivi des Sous-Activités par Activité du Work Plan',
          headers,
          rows,
          'SANINOVA_Sous_Activites_Work_Plan',
          'Cartographie exhaustive des actions de terrain rattachées aux grandes activités officielles du Work Plan'
        );
      }
    } else if (templateId === 'rpt-b09') {
      if (format === 'EXCEL') {
        const data = b09Metrics.map(m => ({
          Période: `${String(m.period_month).padStart(2, '0')}/${m.period_year}`,
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
        const headers = ['Période', 'Département', 'Zone Sanitaire', 'Attendus', 'À Temps', 'Retard', 'Taux %', 'Conformité'];
        const rows = b09Metrics.map(m => [
          `${String(m.period_month).padStart(2, '0')}/${m.period_year}`,
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
          'Toutes périodes enregistrées | Seuil contractuel >= 70% (échéance le 20 du mois)'
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
          users.find(u => u.id === b.lead_expert_id)?.full_name || 'Non assigné',
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
    } else if (templateId === 'rpt-missions') {
      if (format === 'EXCEL') {
        const data = missions.map(m => ({
          Code: m.code || m.id,
          Titre: m.title,
          Départements: (m.departments && m.departments.length > 0 ? m.departments.join(', ') : m.department),
          Zones: (m.zones_sanitaires && m.zones_sanitaires.length > 0 ? m.zones_sanitaires.join(', ') : m.zone_sanitaire),
          'Date Départ': m.departure_date,
          'Date Retour': m.return_date,
          Responsable: users.find(u => u.id === m.lead_expert_id)?.full_name || 'Non assigné',
          'Statut Mission': m.status,
          'Statut Rapport': m.report_status || 'NON_REMPLI',
          'Avancement (%)': `${m.progress_pct ?? 0}%`,
        }));
        exportToExcel(data, 'SANINOVA_Rapport_Missions_Terrain');
      } else {
        const headers = ['Code', 'Mission', 'Départements', 'Période', 'Statut', 'Rapport'];
        const rows = missions.map(m => [
          m.code || '-',
          m.title.length > 38 ? m.title.substring(0, 38) + '...' : m.title,
          (m.departments && m.departments.length > 0 ? m.departments.join(', ') : m.department),
          `${m.departure_date} -> ${m.return_date}`,
          m.status,
          m.report_status || 'NON_REMPLI',
        ]);
        exportTableToPdf(
          'Rapport Consolidé des Missions de Terrain',
          headers,
          rows,
          'SANINOVA_Rapport_Missions_Terrain',
          'Synthèse des déploiements terrain et état des comptes-rendus'
        );
      }
    } else if (templateId === 'rpt-formations') {
      if (format === 'EXCEL') {
        const data = trainings.map(t => ({
          Code: t.code || t.id,
          Thématique: t.topic,
          Format: t.format,
          Département: t.department,
          'Zone Sanitaire': t.zone_sanitaire,
          'Date Début': t.start_date,
          'Date Fin': t.end_date,
          Participants: t.participants_count,
          'Moy. Pré-Test (%)': `${t.pre_test_avg}%`,
          'Moy. Post-Test (%)': `${t.post_test_avg}%`,
          Statut: t.status,
        }));
        exportToExcel(data, 'SANINOVA_Rapport_Formations');
      } else {
        const headers = ['Code', 'Thématique', 'Zone', 'Période', 'Effectif', 'Pré/Post', 'Statut'];
        const rows = trainings.map(t => [
          t.code || '-',
          t.topic.length > 36 ? t.topic.substring(0, 36) + '...' : t.topic,
          `${t.department} - ${t.zone_sanitaire}`,
          `${t.start_date} -> ${t.end_date}`,
          t.participants_count,
          `${t.pre_test_avg}% -> ${t.post_test_avg}%`,
          t.status,
        ]);
        exportTableToPdf(
          'Rapport d’Évaluation des Formations',
          headers,
          rows,
          'SANINOVA_Rapport_Formations',
          'Suivi des sessions, participants formés et progression pré/post-test'
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
    } else if (templateId === 'rpt-perf-dept') {
      const departments = ['Atacora', 'Donga', 'Mono', 'Plateau', 'Alibori'];
      const data = departments.map(dept => {
        const deptB09 = b09Metrics.filter(m => m.department === dept && ((m.submitted_on_time || 0) + (m.submitted_late || 0) > 0));
        const expSum = deptB09.reduce((s, m) => s + (m.expected_reports || 0), 0);
        const onTimeSum = deptB09.reduce((s, m) => s + (m.submitted_on_time || 0), 0);
        const avgB09 = expSum > 0 ? `${((onTimeSum / expSum) * 100).toFixed(1)}%` : 'N/A';
        const deptMissions = missions.filter(m => m.department === dept || (m.departments && m.departments.includes(dept))).length;
        const deptTrainings = trainings.filter(t => t.department === dept).length;
        return {
          Département: dept,
          'Zones B09 Suivies (actives)': deptB09.length,
          'Promptitude Moy. B09': avgB09,
          'Missions Terrain': deptMissions,
          Formations: deptTrainings,
        };
      });
      if (format === 'EXCEL') {
        exportToExcel(data, 'SANINOVA_Performance_Par_Departement');
      } else {
        const headers = ['Département', 'B09 Actives', 'Promptitude Moy.', 'Missions', 'Formations'];
        const rows = data.map(d => [
          d.Département,
          d['Zones B09 Suivies (actives)'],
          d['Promptitude Moy. B09'],
          d['Missions Terrain'],
          d.Formations,
        ]);
        exportTableToPdf(
          'Rapport de Performance par Département',
          headers,
          rows,
          'SANINOVA_Performance_Par_Departement',
          'Comparatif départemental (B09, Missions de terrain et Formations)'
        );
      }
    } else if (templateId === 'rpt-preuves') {
      const combined = [
        ...deliverables.map(d => ({
          Source: 'Livrable Contractuel',
          Référence: d.code,
          Titre: d.title,
          Jalon: d.milestone,
          Statut: d.validation_status,
          Fichier: d.final_file_name || '-',
          Date: d.actual_submission_date || d.due_date,
        })),
        ...documents.map(doc => ({
          Source: 'Document GED',
          Référence: doc.category,
          Titre: doc.title,
          Jalon: doc.milestone,
          Statut: doc.file_type,
          Fichier: doc.file_name,
          Date: doc.upload_date,
        })),
      ];
      if (format === 'EXCEL') {
        exportToExcel(combined, 'SANINOVA_Dossier_Preuves_Audit');
      } else {
        const headers = ['Source', 'Référence', 'Titre', 'Jalon', 'Statut / Type', 'Date'];
        const rows = combined.map(item => [
          item.Source,
          item.Référence,
          item.Titre.length > 38 ? item.Titre.substring(0, 38) + '...' : item.Titre,
          item.Jalon,
          item.Statut,
          item.Date,
        ]);
        exportTableToPdf(
          'Dossier de Preuves de Vérification & Livrables (Audit Ready)',
          headers,
          rows,
          'SANINOVA_Dossier_Preuves_Audit',
          'Inventaire consolidé des livrables et documents justificatifs du Hub'
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
        exportToExcel(data, 'SANINOVA_WorkPlan_Consolide');
      } else {
        const headers = ['Code', 'Intitulé', 'Milestone', 'Responsable', 'Échéance', 'Statut'];
        const rows = activities.map(a => [
          a.code,
          a.title.substring(0, 40) + '...',
          a.milestone,
          users.find(u => u.id === a.lead_expert_id)?.full_name || 'Non assigné',
          a.deadline,
          a.status,
        ]);
        exportTableToPdf(
          'Rapport Consolidé du Plan de Travail (Périodique)',
          headers,
          rows,
          'SANINOVA_WorkPlan_Consolide',
          'État consolidé des activités contractuelles du Work Plan AFGHS'
        );
      }
    }
  };

  return (
    <ModuleGuard moduleId="rapports">
      <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
              Analyse & Exports
            </span>
            <span className="text-xs text-slate-500 font-medium">Moteur de Reporting Officiel</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">Rapports & Analyses Consolidées</h1>
          <p className="text-xs text-slate-500">
            Génération immédiate des {TEMPLATES.length} rapports contractuels et opérationnels aux formats PDF et Excel.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded px-3 py-1.5 bg-slate-50 font-medium outline-none"
          >
            <option value="ALL">Toutes catégories ({TEMPLATES.length})</option>
            <option value="PERIODIQUE">Périodique (Work Plan)</option>
            <option value="MILESTONE">Spécifiques Milestones (B09 & B13)</option>
            <option value="OPERATIONNEL">Opérationnels (Sous-activités, Missions, Formations, Preuves)</option>
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
  </ModuleGuard>
  );
}
