# Phytalessence CRM Fidélité - Product Requirements Document (PRD)

## 1. Goals and Background Context

### Goals

- Automatiser l'attribution de points de fidélité pour les achats en pharmacie partenaires
- Permettre la gestion centralisée des produits éligibles et du ratio de points
- Offrir une visibilité complète sur les transactions et points attribués via un back-office
- Intégrer de manière transparente avec l'écosystème Snapss existant

### Background Context

Phytalessence est une marque pharmaceutique distribuant ses produits via e-commerce et pharmacies partenaires. Actuellement, seuls les achats e-commerce sont tracés dans le programme de fidélité Snapss. Les achats en pharmacie, représentant une part significative des ventes, ne génèrent pas de points fidélité.

Ce CRM comble ce gap en recevant les tickets de caisse via webhook Snapss, identifiant les produits Phytalessence (93 références), et attribuant automatiquement les points correspondants aux utilisateurs.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-11 | 1.0 | Version initiale | John (PM) |

---

## 2. Requirements

### Functional Requirements (FR)

- **FR1:** Le système doit exposer un endpoint webhook sécurisé pour recevoir les données de ticket Snapss
- **FR2:** Le système doit extraire et parser les informations utilisateur (`wallet_object`) et produits (`ticket_data.products`)
- **FR3:** Le système doit comparer les noms de produits du ticket avec la base de données des 93 produits éligibles (matching par nom exact, case-insensitive)
- **FR4:** Le système doit calculer les points selon la formule configurable (défaut: 1€ = 1 point) uniquement sur les produits matchés
- **FR5:** Le système doit appeler le webhook Snapss pour attribuer les points à l'utilisateur
- **FR6:** Le système doit envoyer une notification push à l'utilisateur via webhook Snapss avec le détail des points gagnés
- **FR7:** Le back-office doit permettre la gestion CRUD des produits éligibles (ajout, modification, suppression)
- **FR8:** Le back-office doit permettre la modification du ratio de points (ex: 1€ = 1pt, 1€ = 2pts, etc.)
- **FR9:** Le back-office doit afficher l'historique des tickets traités avec statut et détails
- **FR10:** Le back-office doit afficher le total des points attribués par utilisateur et globalement
- **FR11:** Le système doit logger chaque transaction (ticket reçu, produits matchés, points calculés, réponse Snapss)
- **FR12:** Le back-office doit gérer les rôles utilisateurs (ADMIN, VIEWER)

### Non-Functional Requirements (NFR)

- **NFR1:** Le webhook doit répondre en moins de 5 secondes pour éviter les timeouts Snapss
- **NFR2:** Le système doit être disponible 99.5% du temps
- **NFR3:** Les données utilisateur (email, téléphone) doivent être stockées de manière sécurisée (RGPD)
- **NFR4:** Le back-office doit être protégé par authentification JWT
- **NFR5:** Le système doit pouvoir gérer 1000+ tickets/jour sans dégradation
- **NFR6:** Les logs doivent être conservés minimum 12 mois

---

## 3. User Interface Design Goals

### Overall UX Vision

Interface d'administration simple et efficace, orientée data. Dashboard clair avec KPIs principaux, navigation intuitive entre les sections (Produits, Transactions, Paramètres).

### Key Interaction Paradigms

- Tableaux paginés avec recherche/filtres pour les listes
- Formulaires simples pour la gestion des produits
- Graphiques pour visualiser les tendances de points

### Core Screens

1. **Login** - Authentification admin
2. **Dashboard** - KPIs (tickets traités aujourd'hui, points attribués, taux de matching)
3. **Produits** - Liste des 93 produits éligibles avec CRUD
4. **Transactions** - Historique des tickets avec détails (produits matchés, points, statut)
5. **Utilisateurs** - Liste des utilisateurs avec total points attribués
6. **Paramètres** - Configuration ratio points, credentials Snapss
7. **Administrateurs** - Gestion des comptes admin et rôles

### Accessibility

WCAG AA (standard)

### Branding

Sobre, professionnel - couleurs Phytalessence si charte graphique fournie

### Target Platforms

Web Responsive (desktop prioritaire pour admin)

---

## 4. Technical Assumptions

### Stack Technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Backend** | Node.js + Express | Excellent pour les webhooks, async, léger |
| **Base de données** | PostgreSQL | Robuste, requêtes complexes, ACID |
| **ORM** | Prisma | Type-safe, migrations simples |
| **Front-end Admin** | React + Vite + TypeScript | Rapide, moderne, type-safe |
| **UI Components** | Shadcn/ui + Tailwind CSS | Composants accessibles, personnalisables |
| **Auth** | JWT + bcrypt | Simple, sécurisé |
| **Hébergement** | Serveur dédié (SSH) | Fourni par le client, domaine custom à venir |

### Repository Structure

Monorepo avec structure:
```
/
├── backend/          # API Node.js/Express
├── frontend/         # React Admin
├── prisma/           # Schéma et migrations
└── docs/             # Documentation
```

### Service Architecture

Monolith modulaire - suffisant pour ce scope, facilite le déploiement et la maintenance.

### Testing Requirements

- Backend: Jest (unit + integration tests)
- Frontend: Vitest + React Testing Library
- Coverage minimum: 70% sur les services critiques

---

## 5. External Integrations

### Webhook Snapss Entrant (Réception tickets)

Format JSON reçu:
```json
{
  "nft_object": {
    "id": 181874,
    "collection_object": {
      "collection_name": "..."
    }
  },
  "wallet_object": {
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+33612345678"
  },
  "ticket_data": {
    "ticket_id": "202501864-Original",
    "total_amount": 17.9,
    "currency": "EUR",
    "authenticity_score": 9,
    "products": [
      {
        "name": "PRODUCT NAME",
        "quantity": 1,
        "price": 17.9
      }
    ]
  },
  "ticket_image": {
    "base64": "...",
    "mime_type": "image/jpeg"
  },
  "gate_object": {
    "title": "AI Ticket Validator",
    "action": {
      "update_attributes": [...]
    }
  }
}
```

### Webhook Snapss Sortant (Attribution points)

```
GET https://[SNAPSS_HOST]/webhook-snapss
  ?api_key={API_KEY}
  &api_pass={API_PASS}
  &api_key_dn={API_KEY_DN}
  &api_pass_dn={API_PASS_DN}
  &template_id={TEMPLATE_ID}
  &collection_index={COLLECTION_INDEX}
  &crm=custom
  &action=add_points
  &points={POINTS}
  &currency=EUR
  &range=1
```

### Webhook Snapss Sortant (Notification)

```
GET https://[SNAPSS_HOST]/webhook-snapss
  ?api_key={API_KEY}
  &api_pass={API_PASS}
  &api_key_dn={API_KEY_DN}
  &api_pass_dn={API_PASS_DN}
  &template_id={TEMPLATE_ID}
  &collection_index={COLLECTION_INDEX}
  &crm=custom
  &action=send_notification
  &notification={URL_ENCODED_MESSAGE}
```

---

## 6. Epic List

| Epic | Titre | Objectif |
|------|-------|----------|
| **Epic 1** | Foundation & Database | Setup projet, base de données, modèles, API de base, authentification admin |
| **Epic 2** | Webhook & Product Matching | Endpoint webhook Snapss, parsing ticket, matching produits, calcul points |
| **Epic 3** | Snapss Integration | Appels webhooks Snapss (attribution points + notifications), gestion erreurs |
| **Epic 4** | Back-office Admin | Dashboard, gestion produits, historique transactions, paramètres, rôles utilisateurs |

---

## Epic 1: Foundation & Database

**Objectif:** Établir les fondations du projet avec une base de données structurée, une API fonctionnelle et un système d'authentification admin sécurisé.

### Story 1.1: Setup Projet & Structure

**En tant que** développeur,
**Je veux** un projet Node.js/Express configuré avec Prisma et PostgreSQL,
**Afin de** disposer d'une base de code propre et déployable.

**Critères d'acceptation:**
1. Projet Node.js initialisé avec Express
2. Prisma configuré avec connexion PostgreSQL
3. Structure de dossiers organisée (`/src/routes`, `/src/services`, `/src/middleware`, `/prisma`)
4. Variables d'environnement via `.env` (DATABASE_URL, JWT_SECRET, PORT)
5. Script de démarrage (`npm run dev`, `npm run build`, `npm start`)
6. Endpoint health-check `GET /health` retournant `{ status: "ok" }`
7. Projet déployable sur le serveur SSH

### Story 1.2: Modèles de Base de Données

**En tant que** développeur,
**Je veux** les modèles Prisma pour produits, transactions, utilisateurs admin et paramètres,
**Afin de** stocker toutes les données nécessaires au CRM.

**Critères d'acceptation:**
1. Modèle `Product` : id, name, sku (optionnel), active (boolean), createdAt, updatedAt
2. Modèle `Transaction` : id, ticketId, userEmail, userName, userPhone, totalAmount, matchedProducts (JSON), pointsCalculated, pointsAwarded (boolean), notificationSent (boolean), snapssResponse (JSON), status (enum: PENDING, SUCCESS, FAILED), createdAt
3. Modèle `Admin` : id, email, password (hashed), role (enum: ADMIN, VIEWER), createdAt
4. Modèle `Setting` : id, key (unique), value, updatedAt
5. Migration initiale exécutée avec succès
6. Seed script pour créer un admin par défaut et le setting `points_ratio=1`

### Story 1.3: Authentification Admin

**En tant qu'** administrateur,
**Je veux** pouvoir me connecter de manière sécurisée,
**Afin d'** accéder au back-office.

**Critères d'acceptation:**
1. Endpoint `POST /api/auth/login` acceptant email + password
2. Vérification du mot de passe hashé (bcrypt)
3. Retour d'un JWT valide 24h contenant userId et role
4. Middleware `authMiddleware` vérifiant le JWT sur les routes protégées
5. Middleware `roleMiddleware` restreignant certaines actions aux ADMIN uniquement
6. Endpoint `GET /api/auth/me` retournant les infos de l'utilisateur connecté
7. Mots de passe jamais retournés dans les réponses API

---

## Epic 2: Webhook & Product Matching

**Objectif:** Recevoir les tickets de caisse Snapss, identifier les produits Phytalessence et calculer les points à attribuer.

### Story 2.1: Endpoint Webhook Réception

**En tant que** système Snapss,
**Je veux** envoyer les données de ticket à un endpoint webhook,
**Afin de** déclencher le processus d'attribution de points.

**Critères d'acceptation:**
1. Endpoint `POST /api/webhook/snapss` accessible publiquement
2. Parsing du body JSON selon le format Snapss (wallet_object, ticket_data, etc.)
3. Validation des champs requis (email, ticket_id, products)
4. Création d'une entrée `Transaction` avec status PENDING
5. Réponse immédiate `200 OK` avec `{ received: true, transactionId: X }`
6. Logging de chaque requête reçue (timestamp, ticketId, email)
7. Gestion des erreurs avec réponse 400 si payload invalide

### Story 2.2: Service de Matching Produits

**En tant que** système,
**Je veux** comparer les produits du ticket avec la base de données,
**Afin d'** identifier les produits Phytalessence éligibles.

**Critères d'acceptation:**
1. Service `ProductMatchingService.match(products[])`
2. Comparaison par nom exact (case-insensitive, trim des espaces)
3. Retour des produits matchés avec leur prix et quantité du ticket
4. Calcul du montant total éligible (somme des prix × quantités matchés)
5. Logging des produits matchés et non-matchés pour debug
6. Gestion du cas où aucun produit ne matche (0 points)

### Story 2.3: Calcul des Points

**En tant que** système,
**Je veux** calculer les points selon le ratio configuré,
**Afin d'** attribuer le bon nombre de points à l'utilisateur.

**Critères d'acceptation:**
1. Service `PointsCalculatorService.calculate(eligibleAmount)`
2. Récupération du ratio depuis `Setting` (clé: `points_ratio`)
3. Calcul: `points = Math.floor(eligibleAmount * ratio)`
4. Mise à jour de la `Transaction` avec `pointsCalculated`
5. Arrondi à l'entier inférieur (pas de points décimaux)
6. Support de ratios décimaux (ex: 1.5 points par euro)

---

## Epic 3: Snapss Integration

**Objectif:** Communiquer avec les webhooks Snapss pour attribuer les points et notifier l'utilisateur.

### Story 3.1: Attribution des Points via Snapss

**En tant que** système,
**Je veux** appeler le webhook Snapss pour ajouter les points,
**Afin que** l'utilisateur reçoive ses points fidélité.

**Critères d'acceptation:**
1. Service `SnapssService.addPoints(email, points)`
2. Appel HTTP GET vers l'endpoint Snapss avec paramètres (action=add_points, points=X)
3. Credentials Snapss stockés dans `Setting` (api_key, api_pass, etc.)
4. Mise à jour `Transaction.pointsAwarded = true` si succès
5. Stockage de la réponse Snapss dans `Transaction.snapssResponse`
6. Gestion des erreurs HTTP (retry 1x après 2s si timeout)
7. Status FAILED si échec après retry

### Story 3.2: Envoi Notification Push

**En tant qu'** utilisateur,
**Je veux** recevoir une notification avec mes points gagnés,
**Afin d'** être informé de ma récompense.

**Critères d'acceptation:**
1. Service `SnapssService.sendNotification(email, message)`
2. Message formaté: "Félicitations ! Vous avez gagné X points sur votre achat Phytalessence."
3. Appel HTTP GET vers endpoint Snapss (action=send_notification)
4. Notification envoyée uniquement si points > 0
5. Mise à jour `Transaction.notificationSent = true` si succès
6. Transaction marquée SUCCESS si points attribués ET notification envoyée

### Story 3.3: Orchestration du Flow Complet

**En tant que** système,
**Je veux** orchestrer le processus complet de traitement d'un ticket,
**Afin d'** assurer une exécution fiable et traçable.

**Critères d'acceptation:**
1. Service `TicketProcessorService.process(transactionId)` orchestrant le flow
2. Séquence: Matching → Calcul → Attribution → Notification
3. Traitement asynchrone (ne bloque pas la réponse webhook)
4. Mise à jour du status à chaque étape
5. Logging complet du flow avec durée d'exécution
6. Gestion des erreurs partielles (ex: points OK mais notif KO)

---

## Epic 4: Back-office Admin

**Objectif:** Fournir une interface d'administration complète pour gérer les produits, visualiser les transactions et configurer le système.

### Story 4.1: Setup Front-end & Layout

**En tant que** développeur,
**Je veux** une application React avec navigation et layout admin,
**Afin de** disposer d'une base pour les écrans du back-office.

**Critères d'acceptation:**
1. Projet React + Vite + TypeScript initialisé
2. Tailwind CSS + Shadcn/ui configurés
3. Layout avec sidebar navigation (Dashboard, Produits, Transactions, Utilisateurs, Paramètres)
4. Page de login fonctionnelle connectée à l'API
5. Protection des routes (redirect si non authentifié)
6. Stockage du JWT dans localStorage
7. Affichage du nom de l'utilisateur connecté + bouton déconnexion

### Story 4.2: Dashboard & KPIs

**En tant qu'** administrateur,
**Je veux** voir un dashboard avec les métriques clés,
**Afin d'** avoir une vue d'ensemble de l'activité.

**Critères d'acceptation:**
1. Endpoint `GET /api/stats/dashboard` retournant les KPIs
2. Cards affichant: Tickets aujourd'hui, Points attribués (jour/total), Taux de matching
3. Graphique des transactions des 7 derniers jours
4. Liste des 5 dernières transactions
5. Rafraîchissement des données au chargement de la page

### Story 4.3: Gestion des Produits

**En tant qu'** administrateur,
**Je veux** gérer la liste des produits éligibles,
**Afin de** contrôler quels produits génèrent des points.

**Critères d'acceptation:**
1. Endpoints CRUD: `GET/POST/PUT/DELETE /api/products`
2. Tableau paginé avec colonnes: Nom, SKU, Actif, Date ajout
3. Recherche par nom de produit
4. Formulaire d'ajout/édition de produit
5. Toggle actif/inactif sans supprimer
6. Import CSV pour ajout en masse (pour les 93 produits initiaux)
7. Confirmation avant suppression
8. Actions réservées au rôle ADMIN

### Story 4.4: Historique des Transactions

**En tant qu'** administrateur,
**Je veux** consulter l'historique des tickets traités,
**Afin de** suivre l'activité et diagnostiquer les problèmes.

**Critères d'acceptation:**
1. Endpoint `GET /api/transactions` avec pagination et filtres
2. Tableau: Date, Ticket ID, Email, Montant, Produits matchés, Points, Status
3. Filtres: par date, par status, par email
4. Vue détaillée d'une transaction (modal ou page)
5. Affichage des produits du ticket vs produits matchés
6. Affichage de la réponse Snapss brute (debug)
7. Export CSV des transactions filtrées

### Story 4.5: Vue Utilisateurs & Points

**En tant qu'** administrateur,
**Je veux** voir la liste des utilisateurs et leurs points,
**Afin de** suivre l'engagement du programme fidélité.

**Critères d'acceptation:**
1. Endpoint `GET /api/users` agrégeant les données par email
2. Tableau: Email, Nom, Téléphone, Total points attribués, Nb transactions
3. Recherche par email ou nom
4. Clic sur utilisateur → liste de ses transactions
5. Pagination et tri par total points

### Story 4.6: Paramètres & Configuration

**En tant qu'** administrateur,
**Je veux** configurer les paramètres du système,
**Afin d'** ajuster le fonctionnement sans modifier le code.

**Critères d'acceptation:**
1. Endpoints `GET/PUT /api/settings`
2. Formulaire de configuration avec:
   - Ratio de points (ex: 1, 1.5, 2)
   - Credentials Snapss (api_key, api_pass, etc.) - champs masqués
   - Template ID et Collection Index Snapss
3. Validation des credentials (test de connexion Snapss)
4. Historique des modifications de paramètres (audit log)
5. Actions réservées au rôle ADMIN

### Story 4.7: Gestion des Administrateurs

**En tant que** super admin,
**Je veux** gérer les comptes administrateurs,
**Afin de** contrôler les accès au back-office.

**Critères d'acceptation:**
1. Endpoints CRUD: `GET/POST/PUT/DELETE /api/admins`
2. Tableau: Email, Rôle, Date création
3. Création d'un admin avec email + mot de passe temporaire
4. Attribution du rôle (ADMIN ou VIEWER)
5. Réinitialisation de mot de passe
6. Impossibilité de supprimer son propre compte
7. Au moins un ADMIN doit toujours exister

---

## 7. Summary

| Epic | Stories | Valeur livrée |
|------|---------|---------------|
| **Epic 1** | 3 stories | Projet déployable avec DB et auth |
| **Epic 2** | 3 stories | Webhook recevant et matchant les produits |
| **Epic 3** | 3 stories | Boucle complète ticket → points → notification |
| **Epic 4** | 7 stories | Interface admin complète |
| **Total** | **16 stories** | CRM fidélité opérationnel |

---

## 8. Next Steps

### Architect Prompt

> Active l'agent Architect et crée l'architecture technique pour le CRM Fidélité Phytalessence en te basant sur le PRD `docs/prd.md`. Le projet utilise Node.js/Express, PostgreSQL/Prisma, React/Vite. Serveur dédié SSH. Définis la structure du projet, les APIs, le schéma de base de données et le flow de déploiement.

### UX Expert Prompt (Optionnel)

> Active l'agent UX Expert et crée les spécifications front-end pour le back-office admin du CRM Phytalessence en te basant sur le PRD `docs/prd.md`. Focus sur le dashboard, les tableaux de données et les formulaires de configuration.
