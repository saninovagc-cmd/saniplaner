'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  MOCK_BUDGET_METRICS, 
  MOCK_BUDGET_SUMMARY, 
  MOCK_QUARTERLY_BUDGETS, 
  MOCK_PAYMENT_SCHEDULE, 
  MOCK_GHSD_TIERS 
} from '@/lib/mock-data';
import { 
  BudgetExpenditure, 
  BudgetRubriqueCode, 
  ExpensePaymentMethod, 
  ExpenseStatus 
} from '@/types';
import { exportToExcel, exportTableToPdf } from '@/lib/export-utils';
import ModuleGuard from '@/components/ModuleGuard';

const RUBRIQUES_CONFIG: {
  code: BudgetRubriqueCode;
  name: string;
  short: string;
  color: string;
  dot: string;
  budgetTotal: number;
}[] = [
  {
    code: 'I',
    name: 'I. Honoraires de l’équipe technique (A)',
    short: 'I. Honoraires Équipe (A)',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-600',
    budgetTotal: 154287936,
  },
  {
    code: 'IV',
    name: 'IV. Voyages et transport',
    short: 'IV. Voyages & Transport',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-600',
    budgetTotal: 51210000,
  },
  {
    code: 'VI',
    name: 'VI. Autres coûts directs (ateliers, formations, supervisions)',
    short: 'VI. Autres Coûts Directs',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    budgetTotal: 182045800,
  },
  {
    code: 'VII',
    name: 'VII. Équipement',
    short: 'VII. Équipement',
    color: 'bg-purple-50 text-purple-800 border-purple-200',
    dot: 'bg-purple-600',
    budgetTotal: 2100000,
  },
  {
    code: 'VIII',
    name: 'VIII. Sous-traitants (Softworks eSIGL / Cloud)',
    short: 'VIII. Sous-traitance IT/Cloud',
    color: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
    budgetTotal: 17314990,
  },
];

export default function BudgetPage() {
  const { 
    users, 
    activities, 
    timesheets, 
    expenditures, 
    addExpenditure, 
    updateExpenditure, 
    deleteExpenditure, 
    importExpendituresBatch,
    currentUser 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'depenses' | 'synthese' | 'echeancier' | 'performance' | 'equipe' | 'activites'>('depenses');
  const [filterMilestone, setFilterMilestone] = useState<'TOUS' | 'B09' | 'B13' | 'TRANSVERSAL'>('TOUS');

  // Filtres du journal de dépenses
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRubrique, setFilterRubrique] = useState<string>('TOUTES');
  const [filterExpMilestone, setFilterExpMilestone] = useState<string>('TOUS');
  const [filterQuarter, setFilterQuarter] = useState<string>('TOUS');
  const [filterStatus, setFilterStatus] = useState<string>('TOUS');

  // Modal d'enregistrement d'une dépense
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BudgetExpenditure | null>(null);

  // Modal d'importation en lot
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');

  // Modal d'aperçu du justificatif
  const [receiptModalExpense, setReceiptModalExpense] = useState<BudgetExpenditure | null>(null);

  // Form State
  const [formDate, setFormDate] = useState('');
  const [formQuarter, setFormQuarter] = useState<'T1' | 'T2' | 'T3' | 'T4'>('T1');
  const [formPeriodMonth, setFormPeriodMonth] = useState<number>(11);
  const [formCategoryCode, setFormCategoryCode] = useState<BudgetRubriqueCode>('VI');
  const [formMilestone, setFormMilestone] = useState<'B09' | 'B13' | 'TRANSVERSAL'>('B09');
  const [formActivityId, setFormActivityId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formBeneficiary, setFormBeneficiary] = useState('');
  const [formInvoiceRef, setFormInvoiceRef] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<ExpensePaymentMethod>('VIREMENT');
  const [formReceiptFileName, setFormReceiptFileName] = useState('');
  const [formStatus, setFormStatus] = useState<ExpenseStatus>('JUSTIFIE');
  const [formNotes, setFormNotes] = useState('');

  // Format monétaire FCFA
  const fmt = (num?: number) => {
    if (num === undefined || num === null) return '0 FCFA';
    return `${Math.round(num).toLocaleString('fr-FR')} FCFA`;
  };

  // Calculs financiers réels basés sur les dépenses enregistrées
  const totalSpent = useMemo(() => {
    return expenditures.reduce((sum, e) => sum + (e.amount_fcfa || 0), 0);
  }, [expenditures]);

  const spentB09 = useMemo(() => {
    return expenditures
      .filter(e => e.milestone === 'B09' || e.milestone === 'TRANSVERSAL')
      .reduce((sum, e) => sum + (e.milestone === 'TRANSVERSAL' ? (e.amount_fcfa * 0.429) : e.amount_fcfa), 0);
  }, [expenditures]);

  const spentB13 = useMemo(() => {
    return expenditures
      .filter(e => e.milestone === 'B13' || e.milestone === 'TRANSVERSAL')
      .reduce((sum, e) => sum + (e.milestone === 'TRANSVERSAL' ? (e.amount_fcfa * 0.571) : e.amount_fcfa), 0);
  }, [expenditures]);

  const remainingBalance = MOCK_BUDGET_METRICS.total_award_fcfa - totalSpent;
  const globalExecRate = Number(((totalSpent / MOCK_BUDGET_METRICS.total_award_fcfa) * 100).toFixed(1));
  const b09ExecRate = Number(((spentB09 / MOCK_BUDGET_METRICS.b09_total_fcfa) * 100).toFixed(1));
  const b13ExecRate = Number(((spentB13 / MOCK_BUDGET_METRICS.b13_total_fcfa) * 100).toFixed(1));

  // Ventilation des dépenses réelles par rubrique
  const spentByRubrique = useMemo(() => {
    const map: Record<BudgetRubriqueCode, number> = { 'I': 0, 'IV': 0, 'VI': 0, 'VII': 0, 'VIII': 0 };
    expenditures.forEach(e => {
      if (map[e.category_code] !== undefined) {
        map[e.category_code] += e.amount_fcfa || 0;
      }
    });
    return map;
  }, [expenditures]);

  // Filtrage des dépenses du journal
  const filteredExpenditures = useMemo(() => {
    return expenditures.filter(e => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        e.description.toLowerCase().includes(q) ||
        e.beneficiary.toLowerCase().includes(q) ||
        (e.invoice_ref && e.invoice_ref.toLowerCase().includes(q)) ||
        e.expense_code.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q));

      const matchesRubrique = filterRubrique === 'TOUTES' || e.category_code === filterRubrique;
      const matchesMilestone = filterExpMilestone === 'TOUS' || e.milestone === filterExpMilestone;
      const matchesQuarter = filterQuarter === 'TOUS' || e.quarter === filterQuarter;
      const matchesStatus = filterStatus === 'TOUS' || e.status === filterStatus;

      return matchesSearch && matchesRubrique && matchesMilestone && matchesQuarter && matchesStatus;
    });
  }, [expenditures, searchQuery, filterRubrique, filterExpMilestone, filterQuarter, filterStatus]);

  const filteredTotalSpent = useMemo(() => {
    return filteredExpenditures.reduce((sum, e) => sum + (e.amount_fcfa || 0), 0);
  }, [filteredExpenditures]);

  // Filtrage des activités
  const filteredActivities = activities.filter(a => {
    if (filterMilestone === 'TOUS') return true;
    if (filterMilestone === 'TRANSVERSAL') return a.milestone === 'TRANSVERSAL';
    return a.milestone === filterMilestone;
  });

  // Gestion de l'ouverture du modal de création/édition
  const openNewExpenseModal = () => {
    setEditingExpense(null);
    setFormDate('');
    setFormQuarter('T1');
    setFormPeriodMonth(new Date().getMonth() + 1);
    setFormCategoryCode('VI');
    setFormMilestone('B09');
    setFormActivityId('');
    setFormDescription('');
    setFormAmount('');
    setFormBeneficiary('');
    setFormInvoiceRef('');
    setFormPaymentMethod('VIREMENT');
    setFormReceiptFileName('');
    setFormStatus('JUSTIFIE');
    setFormNotes('');
    setExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: BudgetExpenditure) => {
    setEditingExpense(exp);
    setFormDate(exp.date);
    setFormQuarter(exp.quarter);
    setFormPeriodMonth(exp.period_month);
    setFormCategoryCode(exp.category_code);
    setFormMilestone(exp.milestone);
    setFormActivityId(exp.activity_id || '');
    setFormDescription(exp.description);
    setFormAmount(String(exp.amount_fcfa));
    setFormBeneficiary(exp.beneficiary);
    setFormInvoiceRef(exp.invoice_ref || '');
    setFormPaymentMethod(exp.payment_method);
    setFormReceiptFileName(exp.receipt_file_name || '');
    setFormStatus(exp.status);
    setFormNotes(exp.notes || '');
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount.replace(/\s+/g, ''));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Veuillez saisir un montant valide en FCFA supérieur à 0.');
      return;
    }
    if (!formDescription.trim()) {
      alert('Veuillez renseigner le libellé / objet de la dépense.');
      return;
    }
    if (!formBeneficiary.trim()) {
      alert('Veuillez indiquer le bénéficiaire ou fournisseur.');
      return;
    }

    const matchedRubrique = RUBRIQUES_CONFIG.find(r => r.code === formCategoryCode);
    const matchedActivity = activities.find(a => a.id === formActivityId);

    if (editingExpense) {
      const updated: BudgetExpenditure = {
        ...editingExpense,
        date: formDate,
        quarter: formQuarter,
        period_month: formPeriodMonth,
        category_code: formCategoryCode,
        category_name: matchedRubrique?.name || editingExpense.category_name,
        milestone: formMilestone,
        activity_id: formActivityId || undefined,
        activity_code: matchedActivity?.code || undefined,
        description: formDescription.trim(),
        amount_fcfa: amountNum,
        beneficiary: formBeneficiary.trim(),
        invoice_ref: formInvoiceRef.trim() || undefined,
        payment_method: formPaymentMethod,
        receipt_file_name: formReceiptFileName.trim() || undefined,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      };
      updateExpenditure(updated);
    } else {
      const newRef = `DEP-2026-${String(expenditures.length + 1).padStart(3, '0')}`;
      const newExp: BudgetExpenditure = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        expense_code: newRef,
        date: formDate,
        quarter: formQuarter,
        period_month: formPeriodMonth,
        category_code: formCategoryCode,
        category_name: matchedRubrique?.name || 'Dépenses Directes',
        milestone: formMilestone,
        activity_id: formActivityId || undefined,
        activity_code: matchedActivity?.code || undefined,
        description: formDescription.trim(),
        amount_fcfa: amountNum,
        beneficiary: formBeneficiary.trim(),
        invoice_ref: formInvoiceRef.trim() || undefined,
        payment_method: formPaymentMethod,
        receipt_file_name: formReceiptFileName.trim() || `justificatif_${newRef.toLowerCase()}.pdf`,
        status: formStatus,
        recorded_by_id: currentUser?.id,
        recorded_by_name: currentUser?.full_name ? `${currentUser.full_name} (Comptabilité)` : 'Afia Sandrine KOUSSAHOUE (Comptable)',
        created_at: new Date().toISOString(),
        notes: formNotes.trim() || undefined,
      };
      addExpenditure(newExp);
    }

    setExpenseModalOpen(false);
  };

  const handleDeleteExpense = (exp: BudgetExpenditure) => {
    if (confirm(`Confirmez-vous la suppression de la dépense ${exp.expense_code} (${fmt(exp.amount_fcfa)}) ?`)) {
      deleteExpenditure(exp.id);
    }
  };

  // Traitement de l'import CSV / Texte
  const handleImportCsv = () => {
    if (!importCsvText.trim()) {
      alert('Veuillez coller du texte ou utiliser le jeu de test.');
      return;
    }

    const lines = importCsvText.trim().split('\n');
    const newItems: BudgetExpenditure[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(';').map(p => p.trim());
      if (parts.length >= 5) {
        // Format attendu: Date; Rubrique(I,IV,VI,VII,VIII); Milestone(B09,B13,TRANSVERSAL); Montant; Bénéficiaire; Facture; Libellé
        const [d, code, ms, amtStr, ben, fac, desc] = parts;
        const amt = parseFloat(amtStr.replace(/\s+/g, ''));
        const rubCode = (['I', 'IV', 'VI', 'VII', 'VIII'].includes(code) ? code : 'VI') as BudgetRubriqueCode;
        const rubConfig = RUBRIQUES_CONFIG.find(r => r.code === rubCode);
        const milestoneVal = (['B09', 'B13', 'TRANSVERSAL'].includes(ms) ? ms : 'B09') as 'B09' | 'B13' | 'TRANSVERSAL';

        if (!isNaN(amt) && amt > 0) {
          const expRef = `DEP-2026-${String(expenditures.length + idx + 1).padStart(3, '0')}`;
          newItems.push({
            id: `exp-imp-${Date.now()}-${idx}`,
            expense_code: expRef,
            date: d || new Date().toISOString().split('T')[0],
            quarter: 'T1',
            period_month: 11,
            category_code: rubCode,
            category_name: rubConfig?.name || 'Charge Directe',
            milestone: milestoneVal,
            description: desc || `Dépense importée ${rubCode} - ${ben}`,
            amount_fcfa: amt,
            beneficiary: ben || 'Fournisseur SaniNova',
            invoice_ref: fac || `FAC-IMP-${idx + 1}`,
            payment_method: 'VIREMENT',
            receipt_file_name: `piece_jointe_${expRef.toLowerCase()}.pdf`,
            status: 'JUSTIFIE',
            recorded_by_name: currentUser?.full_name ? `${currentUser.full_name} (Comptabilité)` : 'Afia Sandrine KOUSSAHOUE (Comptable)',
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    if (newItems.length > 0) {
      importExpendituresBatch(newItems);
      setImportModalOpen(false);
      setImportCsvText('');
      alert(`${newItems.length} dépenses ont été importées avec succès dans le journal comptable.`);
    } else {
      alert('Format non reconnu. Assurez-vous d’utiliser des séparateurs point-virgule (;) selon le modèle.');
    }
  };

  const loadSampleImportTemplate = () => {
    setImportCsvText(`2026-11-04; IV; B09; 1250000; Total Énergies Parakou; FAC-TOT-409; Carburant supervisions terrain Atacora
2026-11-05; VI; B09; 2800000; Auberge de Grand-Popo; FAC-AGP-2026-19; Hébergement et pause-café atelier promptitude Mono
2026-11-06; VI; B13; 1400000; Papeterie Centrale Cotonou; FAC-PAP-881; Fournitures de bureau et chemises dossiers quantification`);
  };

  // Exports
  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      if (activeTab === 'depenses') {
        const rows = filteredExpenditures.map(e => ({
          'Réf Dépense': e.expense_code,
          'Date': e.date,
          'Trimestre': e.quarter,
          'Rubrique': e.category_code,
          'Intitulé Rubrique': e.category_name,
          'Milestone': e.milestone,
          'Activité': e.activity_code || '',
          'Libellé / Objet': e.description,
          'Bénéficiaire / Fournisseur': e.beneficiary,
          'N° Pièce / Facture': e.invoice_ref || '',
          'Montant (FCFA)': e.amount_fcfa,
          'Mode Règlement': e.payment_method,
          'Statut': e.status,
          'Justificatif': e.receipt_file_name || '',
          'Saisi par': e.recorded_by_name,
        }));
        exportToExcel(rows, 'Journal_Comptable_Depenses_Saninova');
      } else if (activeTab === 'synthese') {
        const rows = MOCK_BUDGET_SUMMARY.map(s => {
          const spent = spentByRubrique[s.code as BudgetRubriqueCode] || 0;
          const balance = s.total_fcfa - spent;
          const pctExec = Number(((spent / s.total_fcfa) * 100).toFixed(1));
          return {
            'Rubrique Budgétaire': s.rubrique,
            'Code': s.code,
            'Part Allouée (%)': `${s.pct_total}%`,
            'Budget Alloué (FCFA)': s.total_fcfa,
            'Dépenses Réalisées (FCFA)': spent,
            'Solde Disponible (FCFA)': balance,
            'Taux Consommé (%)': `${pctExec}%`
          };
        });
        exportToExcel(rows, 'Budget_Saninova_PSI_Recapitulatif_Consommation');
      } else if (activeTab === 'echeancier') {
        const rows = MOCK_PAYMENT_SCHEDULE.map(p => ({
          'Milestone': p.milestone,
          'Intitulé': p.milestone_title,
          'Trimestre': p.quarter,
          'Date Limite': p.submission_deadline,
          'Montant Max (FCFA)': p.max_payment_fcfa,
          'Montant USD': p.max_payment_usd,
          'Statut': p.status,
          'Preuve Requise': p.evidence_required
        }));
        exportToExcel(rows, 'Echeancier_Paiements_PSI');
      } else {
        const rows = filteredActivities.map(a => ({
          'Code': a.code,
          'Milestone': a.milestone,
          'Activité': a.title,
          'LOE (Jours)': a.loe_days || 0,
          'Honoraires A (FCFA)': a.budget_a_fcfa || 0,
          'Coûts Directs B (FCFA)': a.budget_b_fcfa || 0,
          'Budget Total (FCFA)': a.budget_total_fcfa || 0,
          'Statut': a.status
        }));
        exportToExcel(rows, 'Saninova_Budget_Activites');
      }
    } else {
      if (activeTab === 'depenses') {
        const headers = ['Réf', 'Date', 'Rubrique', 'Milestone', 'Libellé & Bénéficiaire', 'N° Pièce', 'Mode', 'Montant (FCFA)', 'Statut'];
        const rows = filteredExpenditures.map(e => [
          e.expense_code,
          e.date,
          e.category_code,
          e.milestone,
          `${e.description} (${e.beneficiary})`,
          e.invoice_ref || '—',
          e.payment_method,
          fmt(e.amount_fcfa),
          e.status
        ]);
        rows.push([
          'TOTAL CUMULÉ',
          '',
          '',
          '',
          `${filteredExpenditures.length} dépenses comptabilisées`,
          '',
          '',
          fmt(filteredTotalSpent),
          ''
        ]);
        exportTableToPdf(
          'Journal Officiel des Dépenses - Projet AFGHS-PSI Bénin',
          headers,
          rows,
          'Journal_Depenses_Saninova',
          `Montant total décaissé : ${fmt(filteredTotalSpent)} | Date d'édition : ${new Date().toLocaleDateString('fr-FR')}`
        );
      } else if (activeTab === 'synthese') {
        const headers = ['Rubrique Budgétaire', 'Part', 'Budget Alloué', 'Dépensé Réel', 'Solde Restant', 'Conso. (%)'];
        const rows = MOCK_BUDGET_SUMMARY.map(s => {
          const spent = spentByRubrique[s.code as BudgetRubriqueCode] || 0;
          const balance = s.total_fcfa - spent;
          const pct = Number(((spent / s.total_fcfa) * 100).toFixed(1));
          return [
            s.rubrique,
            `${s.pct_total}%`,
            fmt(s.total_fcfa),
            fmt(spent),
            fmt(balance),
            `${pct}%`
          ];
        });
        rows.push([
          'TOTAL GÉNÉRAL CONTRACTUEL',
          '100.0%',
          fmt(MOCK_BUDGET_METRICS.total_award_fcfa),
          fmt(totalSpent),
          fmt(remainingBalance),
          `${globalExecRate}%`
        ]);
        exportTableToPdf(
          'Budget Contractuel Saninova - Suivi de la Consommation',
          headers,
          rows,
          'Saninova_Budget_Synthese',
          'Fixed Amount Award SAQMMA26CA0351 | Période : 01/10/2026 - 30/09/2027'
        );
      } else {
        const headers = ['Code', 'Milestone', 'Intitulé Activité', 'LOE (Jours)', 'Honoraires A', 'Coûts Directs B', 'Total Direct A+B'];
        const rows = filteredActivities.map(a => [
          a.code,
          a.milestone,
          a.title,
          `${a.loe_days || 0} j`,
          fmt(a.budget_a_fcfa || 0),
          fmt(a.budget_b_fcfa || 0),
          fmt(a.budget_total_fcfa || 0)
        ]);
        exportTableToPdf(
          'Plan et Budget par Activité (Chemonics Gantt)',
          headers,
          rows,
          'Saninova_Budget_Activites',
          'Ventilation des 19 activités budgétées sur B09 et B13'
        );
      }
    }
  };

  return (
    <ModuleGuard moduleId="budget">
      <div className="space-y-6 font-sans">
        {/* Header Banner */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
                Contrat Fixed Amount Award
              </span>
              <span className="text-xs text-slate-500 font-medium">Réf. SAQMMA26CA0351 &bull; PSI / AFGHS Bénin</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                Module Comptabilité Active
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 uppercase tracking-tight">
              Budget & Finances &bull; Exécution Comptable
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Enregistrement progressif des dépenses réelles par la comptable, imputation par ligne budgétaire (I, IV, VI, VII, VIII) et rapprochement en temps réel avec les plafonds contractuels.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => handleExport('excel')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition flex items-center space-x-1.5"
            >
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded shadow-xs transition flex items-center space-x-1.5"
            >
              <span>Export Synthèse PDF</span>
            </button>
          </div>
        </div>

        {/* Dynamic Financial KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Budget Total Alloué</div>
            <div className="text-xl font-bold text-slate-900 mt-1.5">{fmt(MOCK_BUDGET_METRICS.total_award_fcfa)}</div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
              <span>B09 : 42,9%</span>
              <span>B13 : 57,1%</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Total Dépensé (Réel)</div>
            <div className="text-xl font-bold text-emerald-700 mt-1.5">{fmt(totalSpent)}</div>
            <div className="mt-2 text-[11px] text-emerald-800 border-t border-emerald-100 pt-2 flex justify-between">
              <span>Taux consommé : <strong>{globalExecRate}%</strong></span>
              <span>{expenditures.length} écritures</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Solde Restant Disponible</div>
            <div className="text-xl font-bold text-blue-700 mt-1.5">{fmt(remainingBalance)}</div>
            <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
              Plafond d'engagement disponible
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dépenses Milestone B09</div>
            <div className="text-xl font-bold text-teal-700 mt-1.5">{fmt(spentB09)}</div>
            <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
              <span>Plafond : {fmt(MOCK_BUDGET_METRICS.b09_total_fcfa)}</span>
              <span className="font-semibold text-teal-800">{b09ExecRate}%</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dépenses Milestone B13</div>
            <div className="text-xl font-bold text-indigo-700 mt-1.5">{fmt(spentB13)}</div>
            <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
              <span>Plafond : {fmt(MOCK_BUDGET_METRICS.b13_total_fcfa)}</span>
              <span className="font-semibold text-indigo-800">{b13ExecRate}%</span>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-slate-200 flex space-x-3 sm:space-x-5 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            onClick={() => setActiveTab('depenses')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center space-x-2 ${
              activeTab === 'depenses'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>1. Saisie & Suivi des Dépenses Réelles</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 font-bold">
              {expenditures.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('synthese')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
              activeTab === 'synthese'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Récapitulatif par Rubrique (Budget vs Réalisé)
          </button>
          <button
            onClick={() => setActiveTab('echeancier')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
              activeTab === 'echeancier'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Échéancier Paiements PSI (T1–T4)
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
              activeTab === 'performance'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            4. Barèmes GHSD & Risques
          </button>
          <button
            onClick={() => setActiveTab('equipe')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
              activeTab === 'equipe'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            5. Équipe & Effort LOE (264j)
          </button>
          <button
            onClick={() => setActiveTab('activites')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
              activeTab === 'activites'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            6. Budget des 19 Activités
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: SAISIE & JOURNAL DES DÉPENSES EFFECTUÉES */}
        {/* ========================================================= */}
        {activeTab === 'depenses' && (
          <div className="space-y-6">
            {/* Visual Gauges per Category */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Consommation en Temps Réel par Ligne Budgétaire
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Niveau d'engagement et de décaissement actuel par rapport aux plafonds alloués
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Total Décaissé : <strong className="text-slate-900">{fmt(totalSpent)}</strong> / {fmt(MOCK_BUDGET_METRICS.total_award_fcfa)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {RUBRIQUES_CONFIG.map(r => {
                  const spent = spentByRubrique[r.code] || 0;
                  const balance = r.budgetTotal - spent;
                  const pct = Math.min(100, Number(((spent / r.budgetTotal) * 100).toFixed(1)));
                  return (
                    <div key={r.code} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${r.color}`}>
                          {r.code}
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-900">{pct}%</span>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-800 truncate" title={r.name}>
                          {r.short}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {fmt(spent)}
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-teal-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>Reste :</span>
                        <span className="font-mono font-medium text-slate-700">{fmt(balance)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Bar & Filters */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={openNewExpenseModal}
                    className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Enregistrer une Dépense</span>
                  </button>

                  <button
                    onClick={() => setImportModalOpen(true)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Charger un Relevé (Excel/CSV)</span>
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Affichage de <strong className="text-slate-900">{filteredExpenditures.length}</strong> dépense(s) &bull; Cumul : <strong className="text-teal-800 font-mono">{fmt(filteredTotalSpent)}</strong>
                </div>
              </div>

              {/* Multi-criteria filter row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Recherche libellé, facture, bénéficiaire..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500"
                  />
                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <select
                  value={filterRubrique}
                  onChange={(e) => setFilterRubrique(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none focus:border-teal-500 font-medium"
                >
                  <option value="TOUTES">Toutes les Rubriques</option>
                  {RUBRIQUES_CONFIG.map(r => (
                    <option key={r.code} value={r.code}>{r.name}</option>
                  ))}
                </select>

                <select
                  value={filterExpMilestone}
                  onChange={(e) => setFilterExpMilestone(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none focus:border-teal-500 font-medium"
                >
                  <option value="TOUS">Tous les Milestones</option>
                  <option value="B09">B09 - Promptitude eSIGL</option>
                  <option value="B13">B13 - Quantification</option>
                  <option value="TRANSVERSAL">Coûts Transversaux</option>
                </select>

                <select
                  value={filterQuarter}
                  onChange={(e) => setFilterQuarter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none focus:border-teal-500 font-medium"
                >
                  <option value="TOUS">Tous les Trimestres</option>
                  <option value="T1">Trimestre 1 (Oct - Déc 2026)</option>
                  <option value="T2">Trimestre 2 (Jan - Mar 2027)</option>
                  <option value="T3">Trimestre 3 (Avr - Jun 2027)</option>
                  <option value="T4">Trimestre 4 (Jul - Sep 2027)</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none focus:border-teal-500 font-medium"
                >
                  <option value="TOUS">Tous les Statuts</option>
                  <option value="ENGAGE">ENGAGÉ</option>
                  <option value="PAYE">PAYÉ</option>
                  <option value="JUSTIFIE">JUSTIFIÉ (Conforme)</option>
                  <option value="CLOTURE">CLÔTURÉ</option>
                </select>
              </div>
            </div>

            {/* Expenditures Ledger Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[900px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Réf & Date</th>
                      <th className="py-3 px-3">Rubrique</th>
                      <th className="py-3 px-3">Milestone</th>
                      <th className="py-3 px-3.5">Libellé & Bénéficiaire</th>
                      <th className="py-3 px-3">N° Facture / Pièce</th>
                      <th className="py-3 px-3">Mode</th>
                      <th className="py-3 px-3.5 text-right">Montant (FCFA)</th>
                      <th className="py-3 px-3 text-center">Statut</th>
                      <th className="py-3 px-3 text-center">Justificatif</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenditures.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                          Aucune dépense ne correspond aux critères de recherche.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenditures.map((exp) => {
                        const rubConfig = RUBRIQUES_CONFIG.find(r => r.code === exp.category_code);
                        return (
                          <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3.5">
                              <div className="font-mono font-bold text-slate-900">{exp.expense_code}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{exp.date} &bull; {exp.quarter}</div>
                            </td>

                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${rubConfig?.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {exp.category_code}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                exp.milestone === 'B09' 
                                  ? 'bg-teal-100 text-teal-800' 
                                  : exp.milestone === 'B13' 
                                  ? 'bg-indigo-100 text-indigo-800' 
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {exp.milestone}
                              </span>
                              {exp.activity_code && (
                                <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                                  {exp.activity_code}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3.5 max-w-[260px]">
                              <div className="font-semibold text-slate-900 line-clamp-2" title={exp.description}>
                                {exp.description}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                Bénéficiaire : <span className="text-slate-700 font-medium">{exp.beneficiary}</span>
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                              {exp.invoice_ref || '—'}
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                {exp.payment_method}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                              {fmt(exp.amount_fcfa)}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                exp.status === 'JUSTIFIE' 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : exp.status === 'PAYE' 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                  : exp.status === 'ENGAGE' 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {exp.status}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center">
                              {exp.receipt_file_name ? (
                                <button
                                  onClick={() => setReceiptModalExpense(exp)}
                                  className="inline-flex items-center space-x-1 text-teal-700 hover:text-teal-900 hover:underline text-[11px] font-medium cursor-pointer"
                                  title="Consulter la pièce justificative"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="truncate max-w-[80px]">Reçu</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => openEditExpenseModal(exp)}
                                  className="p-1 rounded text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition"
                                  title="Modifier cette dépense"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(exp)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                  title="Supprimer cette dépense"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Total Row */}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={6} className="py-3.5 px-3.5 uppercase tracking-wide">
                        TOTAL DES DÉPENSES SÉLECTIONNÉES ({filteredExpenditures.length})
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono text-teal-800 text-sm">
                        {fmt(filteredTotalSpent)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SYNTHÈSE BUDGÉTAIRE ET CONSOMMATION PAR RUBRIQUE */}
        {/* ========================================================= */}
        {activeTab === 'synthese' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Tableau Récapitulatif : Budget Alloué vs Dépenses Réalisées
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Rapprochement direct entre les plafonds contractuels (Fixed Amount Award) et les décaissements effectifs enregistrés au journal comptable.
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                  Total Award : 406 958 726 FCFA
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[760px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Rubrique Budgétaire</th>
                      <th className="py-3 px-3 text-center">Part</th>
                      <th className="py-3 px-4 text-right">Budget Alloué (FCFA)</th>
                      <th className="py-3 px-4 text-right">Dépenses Réalisées</th>
                      <th className="py-3 px-4 text-right">Solde Disponible</th>
                      <th className="py-3 px-4 text-center">Taux Consommé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_BUDGET_SUMMARY.map((row) => {
                      const spent = spentByRubrique[row.code as BudgetRubriqueCode] || 0;
                      const balance = row.total_fcfa - spent;
                      const pct = Math.min(100, Number(((spent / row.total_fcfa) * 100).toFixed(1)));
                      return (
                        <tr key={row.code} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {row.rubrique}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold">
                              {row.pct_total}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{fmt(row.total_fcfa)}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">{fmt(spent)}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700">{fmt(balance)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="font-mono font-bold text-xs">{pct}%</span>
                              <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-1.5 rounded-full ${pct > 80 ? 'bg-amber-500' : 'bg-teal-600'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="py-3.5 px-4 uppercase tracking-wide">TOTAL GÉNÉRAL CONTRACTUEL</td>
                      <td className="py-3.5 px-3 text-center font-mono">100.0%</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-900">{fmt(MOCK_BUDGET_METRICS.total_award_fcfa)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-800 text-sm">{fmt(totalSpent)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-blue-800 text-sm">{fmt(remainingBalance)}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-900 font-extrabold">{globalExecRate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quarterly Summary breakdown */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Ventilation Contractuelle par Trimestre (A + B)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[700px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Trimestre</th>
                      <th className="py-3 px-4">Période</th>
                      <th className="py-3 px-4 text-right">B09 Honoraires (A)</th>
                      <th className="py-3 px-4 text-right">B09 Coûts (B)</th>
                      <th className="py-3 px-4 text-right">B13 Honoraires (A)</th>
                      <th className="py-3 px-4 text-right">B13 Coûts (B)</th>
                      <th className="py-3 px-4 text-right">Total Dépenses Trimestre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_QUARTERLY_BUDGETS.map((q) => (
                      <tr key={q.quarter} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">{q.quarter}</td>
                        <td className="py-3 px-4 text-slate-600">{q.period_label}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b09_fees)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b09_activities)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b13_fees)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(q.b13_activities)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(q.total_quarter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ÉCHÉANCIER PAIEMENTS PSI */}
        {/* ========================================================= */}
        {activeTab === 'echeancier' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Échéancier des Paiements par Milestone (PSI / GHSD)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tranches de paiement déclenchées uniquement sur validation des preuves matérielles et atteinte des seuils.
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                  Taux de conversion : 1 USD = 565 FCFA
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[700px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Milestone</th>
                      <th className="py-3 px-4">Période</th>
                      <th className="py-3 px-4">Date Limite Soumission</th>
                      <th className="py-3 px-4 text-right">Plafond FCFA</th>
                      <th className="py-3 px-4 text-right">Montant USD</th>
                      <th className="py-3 px-4 text-center">Statut Tranche</th>
                      <th className="py-3 px-4">Preuve & Livrable Requis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_PAYMENT_SCHEDULE.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.milestone === 'B09' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {p.milestone}
                          </span>
                          <span className="block text-[11px] text-slate-600 mt-1 font-medium">{p.milestone_title}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{p.quarter}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{p.submission_deadline}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(p.max_payment_fcfa)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">${p.max_payment_usd?.toLocaleString('en-US')}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            p.status === 'EN_COURS' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed max-w-xs">{p.evidence_required}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: BARÈMES GHSD & RISQUES */}
        {/* ========================================================= */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Barèmes de Paiement selon la Performance (GHSD Milestone Tiers)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Simulation des déductions financières appliquées par PSI / AFGHS en cas de non-atteinte des seuils cibles de promptitude ou de livrables.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[650px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Milestone</th>
                      <th className="py-3 px-4">Niveau d'Atteinte</th>
                      <th className="py-3 px-4">Condition Déclencheur</th>
                      <th className="py-3 px-4 text-center">% Paiement</th>
                      <th className="py-3 px-4 text-right">Paiement Annuel (FCFA)</th>
                      <th className="py-3 px-4 text-right">Impact Financier (Écart)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_GHSD_TIERS.map((tier, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">{tier.milestone}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            tier.level === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                            tier.level === 'Satisfaisant' ? 'bg-teal-100 text-teal-800' :
                            tier.level === 'Minimal' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {tier.level}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{tier.threshold_condition}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">{tier.payment_pct}%</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(tier.annual_payout_fcfa)}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {tier.variance_fcfa === 0 ? (
                            <span className="text-emerald-700 font-medium">0 FCFA (100% payé)</span>
                          ) : (
                            <span className="text-rose-700 font-bold">{fmt(tier.variance_fcfa)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: ÉQUIPE & EFFORT LOE */}
        {/* ========================================================= */}
        {activeTab === 'equipe' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Ventilation des Honoraires de l'Équipe Projet (Rubrique I)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Niveau d'effort officiel de 264 jours par an par collaborateur à temps plein (100% LOE).
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded font-bold">
                  Total Rubrique I : 154 287 936 FCFA
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[700px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Expert / Membre Équipe</th>
                      <th className="py-3 px-4">Fonction & Titre</th>
                      <th className="py-3 px-4 text-right">Taux Journalier</th>
                      <th className="py-3 px-4 text-center">LOE B09</th>
                      <th className="py-3 px-4 text-center">LOE B13</th>
                      <th className="py-3 px-4 text-center">LOE Total</th>
                      <th className="py-3 px-4 text-right">Total Honoraires (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{u.full_name}</td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate">{u.title}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">{fmt(u.daily_rate)}/j</td>
                        <td className="py-3 px-4 text-center font-mono">{u.loe_b09} j</td>
                        <td className="py-3 px-4 text-center font-mono">{u.loe_b13} j</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{u.loe_total} j</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(u.total_fees_fcfa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: BUDGET DES 19 ACTIVITÉS */}
        {/* ========================================================= */}
        {activeTab === 'activites' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Budget Détaillé des 19 Activités du Work Plan
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Séparation stricte des honoraires de réalisation (A) et des coûts directs d'activités (B).
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Filtrer par Jalon :</span>
                  <select
                    value={filterMilestone}
                    onChange={(e) => setFilterMilestone(e.target.value as any)}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 outline-none focus:border-teal-500"
                  >
                    <option value="TOUS">Toutes les activités ({activities.length})</option>
                    <option value="B09">Milestone B09 (Promptitude)</option>
                    <option value="B13">Milestone B13 (Quantification)</option>
                    <option value="TRANSVERSAL">Transversal (B09/B13)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-[750px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Milestone</th>
                      <th className="py-3 px-4">Intitulé Activité</th>
                      <th className="py-3 px-4 text-center">LOE</th>
                      <th className="py-3 px-4 text-right">Honoraires (A)</th>
                      <th className="py-3 px-4 text-right">Coûts Directs (B)</th>
                      <th className="py-3 px-4 text-right">Total Budget (A+B)</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActivities.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{act.code}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.milestone === 'B09' 
                              ? 'bg-teal-100 text-teal-800' 
                              : act.milestone === 'B13' 
                              ? 'bg-indigo-100 text-indigo-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {act.milestone}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{act.title}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{act.expected_result}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                          {act.loe_days ? `${act.loe_days} j` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(act.budget_a_fcfa || 0)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{fmt(act.budget_b_fcfa || 0)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmt(act.budget_total_fcfa || 0)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            act.status === 'TERMINEE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : act.status === 'EN_COURS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {act.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: FORMULAIRE SAISIE / ÉDITION D'UNE DÉPENSE */}
        {/* ========================================================= */}
        {expenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 bg-gradient-to-r from-teal-800 to-teal-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm tracking-wide">
                    {editingExpense ? `Modifier la Dépense : ${editingExpense.expense_code}` : 'Enregistrer une Nouvelle Dépense au Budget'}
                  </h3>
                  <p className="text-xs text-teal-200 mt-0.5">
                    Imputation comptable &bull; Projet AFGHS-PSI Bénin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-700/60 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Date de la Dépense *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Trimestre *
                    </label>
                    <select
                      value={formQuarter}
                      onChange={(e) => setFormQuarter(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-medium"
                    >
                      <option value="T1">T1 (Oct - Déc 2026)</option>
                      <option value="T2">T2 (Jan - Mar 2027)</option>
                      <option value="T3">T3 (Avr - Jun 2027)</option>
                      <option value="T4">T4 (Jul - Sep 2027)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Mois de Rapportage
                    </label>
                    <select
                      value={formPeriodMonth}
                      onChange={(e) => setFormPeriodMonth(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-medium"
                    >
                      <option value={10}>Octobre 2026 (Mois 1)</option>
                      <option value={11}>Novembre 2026 (Mois 2)</option>
                      <option value={12}>Décembre 2026 (Mois 3)</option>
                      <option value={1}>Janvier 2027 (Mois 4)</option>
                      <option value={2}>Février 2027 (Mois 5)</option>
                      <option value={3}>Mars 2027 (Mois 6)</option>
                      <option value={4}>Avril 2027 (Mois 7)</option>
                      <option value={5}>Mai 2027 (Mois 8)</option>
                      <option value={6}>Juin 2027 (Mois 9)</option>
                      <option value={7}>Juillet 2027 (Mois 10)</option>
                      <option value={8}>Août 2027 (Mois 11)</option>
                      <option value={9}>Septembre 2027 (Mois 12)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Ligne / Rubrique Budgétaire *
                    </label>
                    <select
                      value={formCategoryCode}
                      onChange={(e) => {
                        const newCat = e.target.value as BudgetRubriqueCode;
                        setFormCategoryCode(newCat);
                        if (newCat === 'I') {
                          if (!users.some(u => u.full_name === formBeneficiary) && !formBeneficiary.includes('Équipe Projet SaniNova')) {
                            setFormBeneficiary("Équipe Projet SaniNova (Personnel & Experts)");
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-medium"
                    >
                      {RUBRIQUES_CONFIG.map(r => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Milestone / Affectation *
                    </label>
                    <select
                      value={formMilestone}
                      onChange={(e) => setFormMilestone(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-medium"
                    >
                      <option value="B09">Milestone B09 — Promptitude eSIGL</option>
                      <option value="B13">Milestone B13 — Quantification</option>
                      <option value="TRANSVERSAL">Coûts Partagés Transversaux (B09/B13)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Activité Liée du Work Plan (Optionnel)
                    </label>
                    {formCategoryCode === 'I' && (
                      <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        19 activités budgétées en Honoraires (A)
                      </span>
                    )}
                  </div>
                  <select
                    value={formActivityId}
                    onChange={(e) => setFormActivityId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-medium"
                  >
                    <option value="">
                      {formCategoryCode === 'I' 
                        ? '-- Imputation Globale Mensuelle / Timesheets (Sans rattachement unique) --' 
                        : '-- Aucune activité spécifique (Frais généraux de rubrique) --'}
                    </option>
                    {activities.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code} : {a.title.substring(0, 55)}... {formCategoryCode === 'I' ? `[Budget Honoraires A : ${fmt(a.budget_a_fcfa)}]` : `[Coûts Directs B : ${fmt(a.budget_b_fcfa)}]`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {formCategoryCode === 'I'
                      ? ' Règle comptable : Pour la paie mensuelle, vous pouvez laisser sur l’option globale (timesheets consolidés), ou cibler l’activité spécifique sur laquelle l’expert est intervenu.'
                      : 'Rattachez cette dépense à l’une des 19 activités opérationnelles pour le calcul automatique de consommation par activité.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Libellé / Objet Précis de la Dépense *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Montant Engagé / Décaissé (FCFA) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      step="1"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        {formCategoryCode === 'I' ? 'Bénéficiaire (Équipe Projet) *' : 'Bénéficiaire / Fournisseur *'}
                      </label>
                      {formCategoryCode === 'I' && (
                        <span className="text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded border border-teal-200">
                          Liste Déroulante de l'Équipe
                        </span>
                      )}
                    </div>
                    {formCategoryCode === 'I' ? (
                      <select
                        required
                        value={formBeneficiary}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormBeneficiary(val);
                          if (!formDescription || formDescription.startsWith('Paiement des honoraires')) {
                            setFormDescription(`Paiement des honoraires mensuels - ${val}`);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs border border-teal-400 bg-teal-50/40 rounded-lg outline-none focus:border-teal-600 font-semibold text-slate-900"
                      >
                        <option value="">-- Sélectionner un membre de l'équipe --</option>
                        <option value="Équipe Projet SaniNova (Personnel & Experts)">Équipe Projet SaniNova (Paiement groupé de l'équipe)</option>
                        <optgroup label="Experts et Collaborateurs du Projet">
                          {users.map(u => (
                            <option key={u.id} value={u.full_name}>
                              {u.full_name} &bull; {u.title.split('—')[0].trim()}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={formBeneficiary}
                        onChange={(e) => setFormBeneficiary(e.target.value)}
                        placeholder=""
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 text-slate-900"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      N° Facture / Reçu / Pièce
                    </label>
                    <input
                      type="text"
                      value={formInvoiceRef}
                      onChange={(e) => setFormInvoiceRef(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Mode de Règlement
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-medium"
                    >
                      <option value="VIREMENT">Virement Bancaire</option>
                      <option value="CHEQUE">Chèque Bancaire</option>
                      <option value="ESPECES">Espèces / Petite Caisse</option>
                      <option value="MOBILE_MONEY">Mobile Money (MoMo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Statut de la Dépense
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-bold"
                    >
                      <option value="JUSTIFIE">JUSTIFIÉ (Conforme)</option>
                      <option value="PAYE">PAYÉ</option>
                      <option value="ENGAGE">ENGAGÉ (Bon de commande)</option>
                      <option value="CLOTURE">CLÔTURÉ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Pièce Justificative (Nom du fichier ou reçu scanné)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formReceiptFileName}
                      onChange={(e) => setFormReceiptFileName(e.target.value)}
                      placeholder=""
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition">
                      <span>Parcourir...</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormReceiptFileName(file.name);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Notes & Observations Comptables
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 text-slate-900 resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setExpenseModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    {editingExpense ? 'Mettre à Jour la Dépense' : 'Enregistrer la Dépense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: CHARGEMENT EN LOT / RELEVÉ (EXCEL / CSV) */}
        {/* ========================================================= */}
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                    Chargement en Lot de Dépenses Comptables
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Importation rapide de plusieurs lignes de décaissement par la comptable
                  </p>
                </div>
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 space-y-1 font-sans">
                <span className="font-bold block">Format CSV attendu (séparateur point-virgule ;) :</span>
                <code className="text-[11px] font-mono block bg-white p-2 rounded border border-teal-300 text-teal-800">
                  Date; Rubrique(I,IV,VI,VII,VIII); Milestone(B09,B13,TRANSVERSAL); Montant; Bénéficiaire; Facture; Libellé
                </code>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    Données à Importer :
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleImportTemplate}
                    className="text-[11px] text-teal-700 hover:underline font-semibold"
                  >
                    Insérer un exemple de test &rarr;
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={importCsvText}
                  onChange={(e) => setImportCsvText(e.target.value)}
                  placeholder=""
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg outline-none focus:border-teal-500 resize-none text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-sm transition"
                >
                  Valider et Charger les Dépenses
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 3: APERÇU FICHE JUSTIFICATIVE / REÇU */}
        {/* ========================================================= */}
        {receiptModalExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                    SN
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-tight">
                      Fiche Justificative de Paiement
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Réf. {receiptModalExpense.expense_code} &bull; AFGHS-PSI Bénin
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReceiptModalExpense(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Objet de la dépense :</span>
                  <span className="font-semibold text-slate-900 text-right max-w-xs">{receiptModalExpense.description}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Montant décaissé :</span>
                  <span className="font-bold font-mono text-teal-800 text-sm">{fmt(receiptModalExpense.amount_fcfa)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Bénéficiaire :</span>
                  <span className="font-medium text-slate-900">{receiptModalExpense.beneficiary}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Ligne budgétaire :</span>
                  <span className="font-mono font-bold text-slate-800">{receiptModalExpense.category_name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">N° Facture / Quittance :</span>
                  <span className="font-mono text-slate-800">{receiptModalExpense.invoice_ref || 'Non renseigné'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Mode de paiement :</span>
                  <span className="font-mono text-slate-800">{receiptModalExpense.payment_method}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Pièce justificative attachée :</span>
                  <span className="font-mono text-teal-700 font-semibold">{receiptModalExpense.receipt_file_name}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Enregistré par :</span>
                  <span className="font-medium text-slate-700">{receiptModalExpense.recorded_by_name}</span>
                </div>
              </div>

              {receiptModalExpense.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                  <span className="font-bold block uppercase text-[10px]">Observation comptable :</span>
                  <p className="mt-0.5">{receiptModalExpense.notes}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center space-x-1">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Certifié conforme au référentiel FAA PSI</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReceiptModalExpense(null)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 transition"
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