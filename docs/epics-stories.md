# Phytalessence CRM - Epics & Stories

## Statut Global

| Epic | Titre | Progression | Status |
|------|-------|-------------|--------|
| Epic 1 | Foundation & Database | 3/3 | COMPLETE |
| Epic 2 | Webhook & Product Matching | 3/3 | COMPLETE |
| Epic 3 | Snapss Integration | 3/3 | COMPLETE |
| Epic 4 | Back-office Admin | 7/7 | COMPLETE |
| Epic 5 | Users Management & Points | 3/3 | COMPLETE |
| Epic 6 | Reliability & Production | 2/3 | IN PROGRESS |

---

## Epic 1: Foundation & Database
**Status**: COMPLETE

### Story 1.1: Setup Projet
- **Description**: Configuration initiale du projet avec Express, TypeScript, Prisma
- **Acceptance Criteria**:
  - [x] Structure projet backend/frontend
  - [x] Configuration TypeScript
  - [x] Setup Prisma avec MySQL
  - [x] Scripts npm fonctionnels
- **Status**: DONE

### Story 1.2: Modeles Base de Donnees
- **Description**: Creation des modeles Prisma (Product, Transaction, Admin, Setting)
- **Acceptance Criteria**:
  - [x] Model Product avec name, sku, active
  - [x] Model Transaction avec tous les champs requis
  - [x] Model Admin avec roles
  - [x] Model Setting pour configuration
  - [x] Migrations executees
- **Status**: DONE

### Story 1.3: Authentification Admin
- **Description**: Systeme d'authentification JWT pour les admins
- **Acceptance Criteria**:
  - [x] Endpoint POST /auth/login
  - [x] Endpoint GET /auth/me
  - [x] Middleware d'authentification JWT
  - [x] Middleware de role (ADMIN/VIEWER)
  - [x] Hash bcrypt des passwords
- **Status**: DONE

---

## Epic 2: Webhook & Product Matching
**Status**: COMPLETE

### Story 2.1: Endpoint Webhook Snapss
- **Description**: Endpoint pour recevoir les tickets de caisse de Snapss
- **Acceptance Criteria**:
  - [x] GET /webhook/snapss (verification)
  - [x] POST /webhook/snapss (reception ticket)
  - [x] Validation Zod des donnees
  - [x] Reponse < 5 secondes
  - [x] Creation transaction en PENDING
- **Status**: DONE

### Story 2.2: Service Matching Produits
- **Description**: Algorithme de matching des produits du ticket avec le catalogue
- **Acceptance Criteria**:
  - [x] Strategie 1: Exact match (normalized)
  - [x] Strategie 2: Exact sans prefixe marque
  - [x] Strategie 3: Contains matching
  - [x] Strategie 4: Expansion abbreviations
  - [x] Strategie 5: Keywords significatifs
  - [x] Strategie 6: Fuzzy matching (40%+ threshold)
  - [x] Logs detailles pour debug
- **Status**: DONE

### Story 2.3: Calcul des Points
- **Description**: Service de calcul des points base sur montant eligible
- **Acceptance Criteria**:
  - [x] Ratio configurable (defaut: 1 pt/euro)
  - [x] Montant minimum configurable
  - [x] Methode d'arrondi configurable (floor/ceil/round)
  - [x] Tests unitaires
- **Status**: DONE

---

## Epic 3: Snapss Integration
**Status**: COMPLETE

### Story 3.1: Attribution Points via Snapss
- **Description**: Envoi des points gagnes vers l'API Snapss
- **Acceptance Criteria**:
  - [x] Appel POST action=add_points
  - [x] Gestion credentials API
  - [x] Gestion erreurs et logs
  - [x] Retry automatique avec backoff exponentiel
- **Status**: DONE

### Story 3.2: Notification Push
- **Description**: Envoi d'une notification a l'utilisateur via Snapss
- **Acceptance Criteria**:
  - [x] Appel POST action=send_notification
  - [x] Message formate avec points gagnes
  - [x] Gestion erreurs
- **Status**: DONE

### Story 3.3: Orchestration Flow
- **Description**: Service d'orchestration du traitement complet
- **Acceptance Criteria**:
  - [x] Traitement asynchrone (fire & forget)
  - [x] Sequence: match -> calculate -> send -> update
  - [x] Gestion statuts (SUCCESS/PARTIAL/FAILED)
  - [x] Logs de performance (duration)
- **Status**: DONE

---

## Epic 4: Back-office Admin
**Status**: COMPLETE

### Story 4.1: Setup Frontend & Layout
- **Description**: Configuration React avec layout admin
- **Acceptance Criteria**:
  - [x] React 19 + Vite + TypeScript
  - [x] Tailwind CSS + Shadcn/ui
  - [x] Layout avec sidebar navigation
  - [x] Theme dark/light toggle
  - [x] Routing protege par auth
- **Status**: DONE

### Story 4.2: Dashboard & KPIs
- **Description**: Page dashboard avec statistiques
- **Acceptance Criteria**:
  - [x] KPIs: transactions, points, taux matching
  - [x] Graphiques de performance
  - [x] Refresh automatique
- **Status**: DONE

### Story 4.3: Gestion Produits
- **Description**: CRUD complet des produits eligibles
- **Acceptance Criteria**:
  - [x] Liste paginee avec recherche
  - [x] Creation/Edition/Suppression
  - [x] Import CSV
  - [x] Toggle active/inactive
- **Status**: DONE

### Story 4.4: Historique Transactions
- **Description**: Consultation des transactions traitees
- **Acceptance Criteria**:
  - [x] Liste groupee par utilisateur
  - [x] Filtres (status, email, date)
  - [x] Detail avec produits matches
  - [x] Affichage image ticket
  - [x] Export CSV
  - [x] Retraitement possible
- **Status**: DONE

### Story 4.5: Vue Utilisateurs & Points
- **Description**: Liste des utilisateurs avec leur total de points
- **Acceptance Criteria**:
  - [x] Liste utilisateurs avec points cumules
  - [x] Recherche par email/nom
  - [x] Detail transactions par utilisateur
  - [x] Edition manuelle des points
  - [x] Pagination
- **Status**: DONE

### Story 4.6: Parametres & Configuration
- **Description**: Page de configuration systeme
- **Acceptance Criteria**:
  - [x] Gestion ratio points
  - [x] Configuration Snapss (credentials)
  - [x] Test connexion Snapss
  - [x] Montant minimum
- **Status**: DONE

### Story 4.7: Gestion Administrateurs
- **Description**: CRUD des comptes admin
- **Acceptance Criteria**:
  - [x] Liste admins
  - [x] Creation avec role
  - [x] Reset password
  - [x] Suppression (sauf dernier admin)
- **Status**: DONE

---

## Epic 5: Users Management & Points
**Status**: COMPLETE

### Story 5.1: API Users Backend
- **Description**: Endpoints pour gestion des utilisateurs et leurs points
- **Acceptance Criteria**:
  - [x] GET /users - Liste utilisateurs avec points
  - [x] GET /users/:email - Detail utilisateur
  - [x] POST /users/:email/points - Ajouter/retirer points manuellement
  - [x] Aggregation points par email
  - [x] Historique modifications points
- **Status**: DONE

### Story 5.2: Page Users Frontend
- **Description**: Interface de gestion des utilisateurs
- **Acceptance Criteria**:
  - [x] Tableau avec email, nom, telephone, points, nb transactions
  - [x] Recherche par email/nom
  - [x] Tri par colonnes
  - [x] Pagination
  - [x] Clic -> detail transactions
- **Status**: DONE

### Story 5.3: Edition Points Utilisateur
- **Description**: Fonctionnalite d'ajout/retrait manuel de points
- **Acceptance Criteria**:
  - [x] Modal d'edition depuis la page Users
  - [x] Champ: points a ajouter/retirer
  - [x] Champ: raison (obligatoire)
  - [x] Appel API Snapss pour synchro
  - [x] Notification utilisateur
  - [x] Log de l'action
- **Status**: DONE

---

## Epic 6: Reliability & Production
**Status**: IN PROGRESS

### Story 6.1: Retry Mechanism Snapss
- **Description**: Mecanisme de retry automatique pour les appels API Snapss
- **Acceptance Criteria**:
  - [x] Retry avec backoff exponentiel (3 tentatives)
  - [x] Delais: 1s, 2s, 4s
  - [x] Logs detailles des retries
  - [x] Gestion timeout
- **Status**: DONE

### Story 6.2: Tests End-to-End
- **Description**: Tests E2E du workflow complet
- **Acceptance Criteria**:
  - [ ] Test webhook -> matching -> points -> notification
  - [ ] Test authentification
  - [ ] Test CRUD operations
- **Status**: TODO

### Story 6.3: Configuration Deploiement
- **Description**: Scripts et configs pour mise en production
- **Acceptance Criteria**:
  - [ ] Script deploy.sh
  - [ ] Configuration Nginx
  - [ ] PM2 ecosystem.config.js
  - [ ] Documentation deploiement
- **Status**: TODO

---

## Changelog

| Date | Epic | Story | Action |
|------|------|-------|--------|
| 2026-01-19 | Epic 5 | 5.1-5.3 | Created - Users Management |
| 2026-01-19 | Epic 6 | 6.1 | Completed - Retry Snapss |
| 2026-01-19 | Epic 4 | 4.5 | Completed - Page Users |

---

## Notes Techniques

### Priorites Restantes
1. **Tests E2E** - Important avant production
2. **Scripts deploiement** - Pour mise en prod
3. **Monitoring** - Alertes et dashboards

### Points d'Attention
- Le retry Snapss utilise un backoff exponentiel (1s, 2s, 4s)
- L'edition de points passe par l'API Snapss pour maintenir la synchro
- Les logs sont structures avec Winston pour faciliter le debug
