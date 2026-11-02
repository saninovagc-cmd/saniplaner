# SANINOVA PROJECT HUB
## Plateforme intégrée de gestion et de pilotage du projet AFGHS-PSI Bénin

**Organisation :** SaniNova Global Consulting  
**Période du projet :** 1er octobre 2026 – 30 septembre 2027  
**Milestones couverts :** B09 (LMIS On-time Reporting Rate) & B13 (Quantification Reports and Distribution Plans)  
**Stack technique :** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, RLS), SheetJS / jsPDF.

---

## 1. Modules Fonctionnels Développés

1. **Tableau de Bord Général (`/`)** : Synthèse exécutive, KPIs clés, jauge de promptitude B09 ($\ge 70\%$, référence le 20 du mois), suivi des 2 livrables semestriels B13, alertes prioritaires et exports en un clic.
2. **Gestion du Work Plan (`/work-plan`)** : Plan de travail officiel avec vues **Tableau**, **Kanban** et **Gantt / Chronogramme**, modal de création/édition et affectation aux 8 experts.
3. **Suivi B09 eSIGL (`/b09`)** : Calcul automatique du taux de promptitude selon la formule officielle :
   $$\text{Taux de promptitude} = \left(\frac{\text{Nombre de rapports soumis à temps}}{\text{Nombre de rapports attendus}}\right) \times 100$$
   Détection des zones sous le seuil contractuel de 70%, relances des gestionnaires, et date limite nationale du 20.
4. **Suivi B13 Quantification (`/b13`)** : Distinction stricte entre les **2 livrables semestriels prédéfinis** (S1 & S2) et les composantes opérationnelles (Validation ILP, QAT, réunions GTT, 9 POA départementaux, campagne CPS Alibori).
5. **Missions de Terrain (`/missions`)** : Planification, structures sanitaires visitées, suivi photographique, synthèse de rapport et plan de suivi dynamique des recommandations.
6. **Formations & Renforcement (`/formations`)** : Suivi des sessions, émargements, comparaison des moyennes **Pré-test vs Post-test** (mesure de l'impact pédagogique).
7. **Livrables Contractuels PSI (`/livrables`)** : Circuit d'approbation à 6 étapes : *Préparation $\rightarrow$ Soumission interne $\rightarrow$ Vérification S&E $\rightarrow$ Validation Direction $\rightarrow$ Transmission PSI $\rightarrow$ Archivé*.
8. **Documentation & GED (`/documentation`)** : Classement sécurisé des pièces justificatives par jalon, catégorie et département avec téléchargement direct.
9. **Rapports & Exports (`/rapports`)** : Moteur de génération des 10 rapports officiels au format **Excel (.xlsx)** et **PDF paysage** avec en-têtes SaniNova.
10. **Administration & Sécurité (`/administration`)** : Annuaire des 8 experts + Direction, découpage territorial Bénin, paramétrage des seuils et **Journal d'Audit (Audit Trail)** en temps réel.

---

## 2. Démarrage de l'Application

### En local :
```bash
npm run dev
```
Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### Déploiement du schéma Supabase :
Le fichier [`supabase/schema.sql`](supabase/schema.sql) contient :
- La définition des tables et contraintes.
- Les politiques de sécurité RLS (Row Level Security).
- Les types ENUM (`user_role`, `activity_status`, `mission_status`, `deliverable_status`).
- Les données initiales de découpage territorial (Atacora, Donga, Mono, Plateau, Alibori, Cotonou).

---

## 3. Matrice des Rôles et Profils (RBAC)
Le sélecteur de profil en haut à droite du Header permet de tester immédiatement l'interface selon le point de vue de chaque expert :
- **Direction Générale** : Droits complets, validation finale des livrables PSI, supervision budgétaire & experts.
- **Conseiller Senior** : Coordination générale, relations PSI/ABMS, validation technique.
- **Spécialistes SIS (2)** : Suivi eSIGL, interopérabilité SAGE, promptitude A7.
- **Spécialiste FASP (1)** : Quantification, QAT, plans approvisionnements, GTT.
- **Spécialiste Suivi-Évaluation (1)** : Contrôle qualité des preuves, indicateurs.
- **Conseillers Régionaux RSCO (3)** : Coaching terrain, Atacora-Donga, Mono, Plateau, POA.
