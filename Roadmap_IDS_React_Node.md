# 🚀 Roadmap et Cahier des Charges Technique : Application de Suivi IDS Incubateur (V3 - Multi-tenant & Assignation Dynamique)

Ce document détaille l'architecture complète, la modélisation de la base de données relationnelle et la spécification des interfaces pour la plateforme de suivi des incubés du Centre de Gestion Solidaire (IDS Incubateur).

---

## 1. Stack Technologique Cible

* **Frontend :** React.js + Vite (Port 5173), Tailwind CSS, Lucide React, Axios, React Hot Toast.
* **Backend :** Node.js + Express (Port 5000), Authentification JWT, Upload de fichiers Multer, Sequelize ORM.
* **Base de données :** MariaDB (Port 3306), relationnelle avec clés étrangères.

```
┌─────────────────────────────────────────────┐
│              NAVIGATEUR CLIENT              │
│         React.js + Vite (Port 5173)         │
└──────────────────┬──────────────────────────┘
                   │ HTTP / JSON (Axios + JWT)
┌──────────────────▼──────────────────────────┐
│         BACKEND API (Node.js + Express)      │
│              Port 5000                       │
│      JWT Auth │ Role RBAC │ Multer Upload    │
└──────────────────┬──────────────────────────┘
                   │ Sequelize ORM
┌──────────────────▼──────────────────────────┐
│         BASE DE DONNÉES MariaDB              │
│              Port 3306                       │
│   Users │ Incubes │ Materiels │ Finances...  │
└─────────────────────────────────────────────┘
```

---

## 2. Rôles et Contrôle d'Accès (RBAC)

Le système gère deux niveaux d'utilisateurs via le champ `role` de la table `users` :

### 2.1 Le Super Admin (`super_admin` / Directeur)
- **Tableau de Bord Global (`/dashboard`)** :
  - Métriques consolidées : Nombre total d'incubés, Chiffre d'Affaires cumulé sur les **4 trimestres (T1, T2, T3, T4)**, total des emplois créés (CDI, CDD, etc.).
  - Répartition graphique des projets par phase (Idéation, Lancement, Croissance, Maturité).
- **Gestion des Accès (`/utilisateurs`)** :
  - Créer, modifier, suspendre et supprimer les comptes des accompagnateurs (`admin`).
- **Vision Globale de l'Annuaire (`/incubes`)** :
  - Visualise la totalité des incubés, tous accompagnateurs confondus.
  - Lors de la création d'un incubé, peut l'assigner à l'un des accompagnateurs enregistrés via une liste déroulante.
- **Réassignation Dynamique (Transfert de Dossier)** :
  - Pouvoir exclusif de changer l'accompagnateur responsable d'un incubé (`PUT /api/incubes/:id/assigner`).
  - Composant de réassignation visible uniquement par le Super Admin sur la fiche de l'incubé.

### 2.2 L'Admin (`admin` / Accompagnateur - Formateur)
- **Accès Restreint** :
  - Redirection automatique si tentative d'accès à `/dashboard` ou `/utilisateurs`.
- **Gestion Multi-tenant de ses Incubés (`/incubes`)** :
  - Ne voit QUE les incubés dont `admin_id === req.user.id`.
  - Lors de l'ajout d'un nouvel incubé, le dossier lui est automatiquement assigné.
- **Suivi Opérationnel (6 Fiches)** :
  - Accède et met à jour les 6 onglets pour ses propres incubés.

---

## 3. Modélisation de la Base de Données

### 3.1 Table `users`
| Champ | Type | Contrainte | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PK, AI | Identifiant unique |
| `nom` | VARCHAR(100) | NOT NULL | Nom de famille |
| `prenom` | VARCHAR(100) | NOT NULL | Prénom |
| `email` | VARCHAR(150) | NOT NULL, UNIQUE | Email de connexion |
| `mot_de_passe` | VARCHAR(255) | NOT NULL | Hashé avec bcrypt (12 rounds) |
| `role` | ENUM | 'super_admin', 'admin' | Rôle de l'utilisateur |
| `actif` | BOOLEAN | DEFAULT true | État du compte |

### 3.2 Table `incubes` (Informations Générales)
| Champ | Type | Description |
| :--- | :--- | :--- |
| `id` | INT | PK, AI |
| `admin_id` | INT | **FK -> users.id** (Accompagnateur responsable) |
| `nom_incube` | VARCHAR(200) | Nom du porteur de projet |
| `pp_numero` | VARCHAR(50) | Numéro de dossier |
| `photo_path` | VARCHAR(500) | Chemin du fichier uploadé |
| `situation_familiale` | VARCHAR(100) | Célibataire, Marié, etc. |
| `accompagnateur` | VARCHAR(200) | Nom textuel de l'accompagnateur |
| `date_demarrage` | DATE | Date d'entrée à l'incubateur |
| `statut_juridique` | VARCHAR(100) | SARL, Auto-entrepreneur, Coopérative, etc. |
| `raison_sociale` | VARCHAR(200) | Nom de l'entreprise |
| `phase_projet` | VARCHAR(100) | Idéation, Lancement, Croissance, Maturité |

### 3.3 Tables de Suivi Reliées (`incube_id` -> `incubes.id`)
1. **`gestion_materiel`** :
   - `type_origine` : `'propre'` ou `'ids'`
   - `date_acquisition_reception`, `article`, `caracteristiques_serie`, `quantite`, `valeur_ou_etat`
2. **`suivi_engagement`** :
   - Saisie mensuelle (Mois 1 à 12, Année)
   - `moyenne_heures_presence`, `taux_presence_formation` (%), `initiatives`, `observations`
3. **`rh_emploi` & `rh_detail`** :
   - Synthèse des effectifs (permanents / temporaires)
   - Détail nominatif : `nom_complet`, `poste`, `nature_contrat`, `date_embauche`, `date_fin`, `salaire_mensuel`
4. **`plan_action`** :
   - `mois`, `objectifs`, `echeance`, `realisation`, `problemes_rencontres`, `commentaires`
5. **`analyse_financiere` (4 Trimestres automatisés)** :
   - Saisie mensuelle (mois 1 à 12)
   - Revenus : `ventes`, `autres_revenus`
   - Charges : `achats`, `charges_personnel`, `charges_cnss`, `salaire_porteur`, `loyer_coworking`, `eau_electricite`, `transport`, `telephone`, `taxes`, `tva`, `remboursement_credit`, `autres_charges`
   - Calculs dynamiques : Trimestre 1 (Jan-Mar), Trimestre 2 (Avr-Juin), Trimestre 3 (Juil-Sep), Trimestre 4 (Oct-Déc), et Total Annuel.

---

## 4. Architecture des Endpoints API

### Authentification & Utilisateurs
- `POST /api/auth/login` : Authentification et délivrance du token JWT.
- `GET /api/auth/me` : Profil de l'utilisateur connecté.
- `GET /api/users` : *(Super Admin)* Liste de tous les utilisateurs.
- `GET /api/users/admins` : *(Super Admin)* Liste des accompagnateurs pour les formulaires d'assignation.
- `POST /api/users` : *(Super Admin)* Création d'un nouvel administrateur.
- `PUT /api/users/:id` : *(Super Admin)* Modification du compte.
- `DELETE /api/users/:id` : *(Super Admin)* Suppression / suspension.

### Incubés & Suivi
- `GET /api/incubes` : Liste des incubés (filtrée automatiquement selon le rôle).
- `GET /api/incubes/stats` : Statistiques du dashboard (total incubés, total emplois créés, CA cumulé des 4 trimestres).
- `GET /api/incubes/:id` : Profil complet avec chargement de tous les onglets.
- `POST /api/incubes` : Création avec upload photo (attribution automatique ou manuelle de l'`admin_id`).
- `PUT /api/incubes/:id` : Mise à jour des informations générales.
- `PUT /api/incubes/:id/assigner` : *(Super Admin uniquement)* Réassignation de l'accompagnateur.
- `DELETE /api/incubes/:id` : Suppression du dossier incubé.

---

## 5. Guide d'Implémentation Frontend

1. **Routage et Sécurité :**
   - Implémentation d'un garde de route `SuperAdminRoute` pour sécuriser `/dashboard` et `/utilisateurs`.
2. **Système d'Onglets Ergonomique :**
   - Sur `/incube/:id`, chaque onglet fonctionne indépendamment pour faciliter la saisie sans rechargement lourd.
3. **Calculs Automatisés :**
   - Sur l'onglet Analyse Financière, la somme des ventes et des charges est immédiatement actualisée pour afficher les totaux des trimestres T1, T2, T3 et T4.
