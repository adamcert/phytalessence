# Phytalessence CRM Fidélité - Architecture Document

## 1. Introduction

Ce document définit l'architecture technique complète du CRM Fidélité Phytalessence. Il sert de référence unique pour le développement, garantissant la cohérence entre le backend, le frontend et les intégrations externes.

### Starter Template

N/A - Projet greenfield

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-11 | 1.0 | Version initiale | Winston (Architect) |

---

## 2. High-Level Architecture

### Technical Summary

L'architecture adopte un pattern **monolith modulaire** déployé sur un serveur dédié SSH. Le backend Node.js/Express expose une API REST consommée par un front-end React SPA. PostgreSQL assure la persistance des données via Prisma ORM. Le système s'intègre avec Snapss via webhooks bidirectionnels : réception des tickets de caisse et envoi des attributions de points/notifications. Cette architecture simple et pragmatique répond aux besoins de performance (< 5s response time) et de volume (1000+ tickets/jour) tout en restant maintenable.

### Platform and Infrastructure

**Platform:** Serveur dédié Linux (SSH)
**Key Services:** Node.js runtime, PostgreSQL, Nginx (reverse proxy), PM2 (process manager)
**Deployment Region:** France (à confirmer)

### Repository Structure

**Structure:** Monorepo simple (npm workspaces non nécessaire pour ce scope)
**Organization:**
```
/
├── backend/     # API Express
├── frontend/    # React Admin SPA
├── prisma/      # Schéma DB partagé
└── docs/        # Documentation
```

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "External"
        SNAPSS_IN[Snapss Webhook<br/>Envoi tickets]
        SNAPSS_OUT[Snapss API<br/>Points & Notifications]
        ADMIN[Administrateur<br/>Browser]
    end

    subgraph "Server"
        NGINX[Nginx<br/>Reverse Proxy]

        subgraph "Backend"
            API[Express API<br/>Port 3000]
            WEBHOOK[Webhook Handler]
            PROCESSOR[Ticket Processor]
            SERVICES[Services Layer]
        end

        subgraph "Frontend"
            REACT[React SPA<br/>Static Files]
        end

        DB[(PostgreSQL)]
    end

    SNAPSS_IN -->|POST /api/webhook/snapss| NGINX
    ADMIN -->|HTTPS| NGINX
    NGINX -->|/api/*| API
    NGINX -->|/*| REACT
    API --> WEBHOOK
    WEBHOOK --> PROCESSOR
    PROCESSOR --> SERVICES
    SERVICES --> DB
    SERVICES -->|HTTP GET| SNAPSS_OUT
```

### Architectural Patterns

- **Monolith Modulaire:** Application unique avec séparation claire des responsabilités en modules (routes, services, middleware) - _Rationale:_ Simplicité de déploiement et debugging, suffisant pour le volume attendu

- **Service Layer Pattern:** Logique métier isolée dans des services dédiés (ProductMatchingService, SnapssService, etc.) - _Rationale:_ Testabilité, réutilisabilité, séparation des concerns

- **Repository Pattern via Prisma:** Accès données abstrait par l'ORM - _Rationale:_ Type-safety, migrations automatiques, requêtes optimisées

- **Async Processing:** Traitement webhook asynchrone après réponse immédiate - _Rationale:_ Respect du timeout Snapss (< 5s), meilleure UX

- **JWT Stateless Auth:** Authentification sans session côté serveur - _Rationale:_ Scalabilité, simplicité, standard de l'industrie

---

## 3. Tech Stack

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Backend Language | TypeScript | 5.x | Type-safety backend | Détection erreurs compile-time, meilleure DX |
| Backend Framework | Express | 4.x | API REST | Léger, mature, excellent écosystème |
| Frontend Language | TypeScript | 5.x | Type-safety frontend | Cohérence avec backend, autocomplétion |
| Frontend Framework | React | 18.x | SPA Admin | Composants réutilisables, large communauté |
| Build Tool | Vite | 5.x | Build frontend | HMR rapide, build optimisé |
| UI Components | Shadcn/ui | Latest | Composants UI | Accessibles, personnalisables, pas de vendor lock |
| CSS Framework | Tailwind CSS | 3.x | Styling | Utility-first, cohérent, rapide |
| Database | PostgreSQL | 15.x | Persistence | ACID, JSON support, robuste |
| ORM | Prisma | 5.x | Data access | Type-safe, migrations, excellent DX |
| Authentication | JWT + bcrypt | - | Auth admin | Standard, stateless, sécurisé |
| HTTP Client | Axios | 1.x | Appels Snapss | Interceptors, retry, timeout handling |
| Validation | Zod | 3.x | Schema validation | Type inference, runtime validation |
| Backend Testing | Jest | 29.x | Unit/Integration | Standard Node.js, bon coverage |
| Frontend Testing | Vitest | 1.x | Unit tests | Compatible Vite, rapide |
| Process Manager | PM2 | 5.x | Production runtime | Restart auto, logs, monitoring |
| Reverse Proxy | Nginx | Latest | HTTPS, routing | Performance, SSL termination |
| Logging | Winston | 3.x | Structured logs | Transports multiples, niveaux |

---

## 4. Data Models

### Product

**Purpose:** Représente un produit Phytalessence éligible au programme de fidélité.

```typescript
interface Product {
  id: number;
  name: string;           // Nom exact pour matching
  sku: string | null;     // Référence interne (optionnel)
  active: boolean;        // Éligible aux points
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Aucune relation directe (référencé dans Transaction.matchedProducts en JSON)

---

### Transaction

**Purpose:** Représente un ticket de caisse traité avec son statut et résultats.

```typescript
interface Transaction {
  id: number;
  ticketId: string;           // ID unique Snapss
  userEmail: string;          // Email utilisateur
  userName: string | null;    // Nom complet
  userPhone: string | null;   // Téléphone
  totalAmount: number;        // Montant total ticket
  ticketProducts: JsonValue;  // Produits du ticket (raw)
  matchedProducts: JsonValue; // Produits matchés
  eligibleAmount: number;     // Montant éligible
  pointsCalculated: number;   // Points calculés
  pointsAwarded: boolean;     // Points envoyés à Snapss
  notificationSent: boolean;  // Notification envoyée
  snapssResponse: JsonValue;  // Réponse API Snapss
  status: TransactionStatus;  // PENDING | SUCCESS | FAILED | PARTIAL
  errorMessage: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
```

**Relationships:**
- Aucune FK (userEmail est la clé de regroupement pour la vue utilisateurs)

---

### Admin

**Purpose:** Compte administrateur du back-office.

```typescript
interface Admin {
  id: number;
  email: string;          // Unique
  password: string;       // Hash bcrypt
  firstName: string | null;
  lastName: string | null;
  role: AdminRole;        // ADMIN | VIEWER
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type AdminRole = 'ADMIN' | 'VIEWER';
```

**Relationships:**
- Aucune

---

### Setting

**Purpose:** Configuration système clé-valeur.

```typescript
interface Setting {
  id: number;
  key: string;            // Unique (points_ratio, snapss_api_key, etc.)
  value: string;          // Valeur (JSON stringifié si complexe)
  description: string | null;
  updatedAt: Date;
}
```

**Keys prédéfinies:**
- `points_ratio`: Ratio euros/points (ex: "1", "1.5")
- `snapss_host`: URL base Snapss
- `snapss_api_key`: API Key
- `snapss_api_pass`: API Pass
- `snapss_api_key_dn`: API Key DN
- `snapss_api_pass_dn`: API Pass DN
- `snapss_template_id`: Template ID
- `snapss_collection_index`: Collection Index
- `notification_message_template`: Template message notification

---

## 5. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TransactionStatus {
  PENDING
  SUCCESS
  FAILED
  PARTIAL
}

enum AdminRole {
  ADMIN
  VIEWER
}

model Product {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(255)
  sku       String?  @db.VarChar(100)
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("products")
}

model Transaction {
  id               Int               @id @default(autoincrement())
  ticketId         String            @unique @map("ticket_id") @db.VarChar(100)
  userEmail        String            @map("user_email") @db.VarChar(255)
  userName         String?           @map("user_name") @db.VarChar(255)
  userPhone        String?           @map("user_phone") @db.VarChar(50)
  totalAmount      Decimal           @map("total_amount") @db.Decimal(10, 2)
  ticketProducts   Json              @map("ticket_products")
  matchedProducts  Json?             @map("matched_products")
  eligibleAmount   Decimal           @default(0) @map("eligible_amount") @db.Decimal(10, 2)
  pointsCalculated Int               @default(0) @map("points_calculated")
  pointsAwarded    Boolean           @default(false) @map("points_awarded")
  notificationSent Boolean           @default(false) @map("notification_sent")
  snapssResponse   Json?             @map("snapss_response")
  status           TransactionStatus @default(PENDING)
  errorMessage     String?           @map("error_message") @db.Text
  processedAt      DateTime?         @map("processed_at")
  createdAt        DateTime          @default(now()) @map("created_at")

  @@index([userEmail])
  @@index([status])
  @@index([createdAt])
  @@map("transactions")
}

model Admin {
  id          Int       @id @default(autoincrement())
  email       String    @unique @db.VarChar(255)
  password    String    @db.VarChar(255)
  firstName   String?   @map("first_name") @db.VarChar(100)
  lastName    String?   @map("last_name") @db.VarChar(100)
  role        AdminRole @default(VIEWER)
  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("admins")
}

model Setting {
  id          Int      @id @default(autoincrement())
  key         String   @unique @db.VarChar(100)
  value       String   @db.Text
  description String?  @db.VarChar(255)
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("settings")
}
```

---

## 6. API Specification

### Base URL

```
Production: https://{DOMAIN}/api
Development: http://localhost:3000/api
```

### Authentication

Toutes les routes `/api/*` sauf `/api/webhook/*` et `/api/auth/login` requièrent un header:
```
Authorization: Bearer {JWT_TOKEN}
```

### Endpoints

#### Auth

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/auth/login` | Connexion admin | No | - |
| GET | `/auth/me` | Profil connecté | Yes | Any |

**POST /auth/login**
```typescript
// Request
{ email: string; password: string }

// Response 200
{ token: string; admin: { id, email, firstName, lastName, role } }

// Response 401
{ error: { code: "INVALID_CREDENTIALS", message: "..." } }
```

---

#### Products

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/products` | Liste produits | Yes | Any |
| GET | `/products/:id` | Détail produit | Yes | Any |
| POST | `/products` | Créer produit | Yes | ADMIN |
| PUT | `/products/:id` | Modifier produit | Yes | ADMIN |
| DELETE | `/products/:id` | Supprimer produit | Yes | ADMIN |
| POST | `/products/import` | Import CSV | Yes | ADMIN |

**GET /products**
```typescript
// Query params
{ page?: number; limit?: number; search?: string; active?: boolean }

// Response 200
{
  data: Product[];
  pagination: { page, limit, total, totalPages }
}
```

**POST /products/import**
```typescript
// Request: multipart/form-data avec fichier CSV
// Colonnes attendues: name, sku (optionnel)

// Response 200
{ imported: number; skipped: number; errors: string[] }
```

---

#### Transactions

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/transactions` | Liste transactions | Yes | Any |
| GET | `/transactions/:id` | Détail transaction | Yes | Any |
| GET | `/transactions/export` | Export CSV | Yes | Any |

**GET /transactions**
```typescript
// Query params
{
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  email?: string;
  dateFrom?: string; // ISO date
  dateTo?: string;
}

// Response 200
{
  data: Transaction[];
  pagination: { page, limit, total, totalPages }
}
```

---

#### Users (Agrégation)

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/users` | Liste utilisateurs | Yes | Any |
| GET | `/users/:email/transactions` | Transactions d'un user | Yes | Any |

**GET /users**
```typescript
// Query params
{ page?: number; limit?: number; search?: string; sortBy?: 'points' | 'transactions' }

// Response 200
{
  data: Array<{
    email: string;
    name: string;
    phone: string;
    totalPoints: number;
    transactionCount: number;
    lastTransactionAt: Date;
  }>;
  pagination: { page, limit, total, totalPages }
}
```

---

#### Stats

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/stats/dashboard` | KPIs dashboard | Yes | Any |

**GET /stats/dashboard**
```typescript
// Response 200
{
  today: {
    transactions: number;
    pointsAwarded: number;
    matchingRate: number; // Pourcentage
  };
  total: {
    transactions: number;
    pointsAwarded: number;
    users: number;
  };
  last7Days: Array<{
    date: string;
    transactions: number;
    points: number;
  }>;
  recentTransactions: Transaction[]; // 5 dernières
}
```

---

#### Settings

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/settings` | Liste paramètres | Yes | ADMIN |
| PUT | `/settings` | Modifier paramètres | Yes | ADMIN |
| POST | `/settings/test-snapss` | Tester connexion Snapss | Yes | ADMIN |

**PUT /settings**
```typescript
// Request
{
  settings: Array<{ key: string; value: string }>
}

// Response 200
{ updated: number }
```

---

#### Admins

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/admins` | Liste admins | Yes | ADMIN |
| POST | `/admins` | Créer admin | Yes | ADMIN |
| PUT | `/admins/:id` | Modifier admin | Yes | ADMIN |
| DELETE | `/admins/:id` | Supprimer admin | Yes | ADMIN |
| POST | `/admins/:id/reset-password` | Reset password | Yes | ADMIN |

---

#### Webhook (Public)

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/webhook/snapss` | Réception ticket Snapss | No | - |

**POST /webhook/snapss**
```typescript
// Request: Format Snapss (voir PRD section 5)

// Response 200 (immédiat)
{
  received: true;
  transactionId: number;
}

// Response 400
{
  received: false;
  error: string;
}
```

---

## 7. External APIs

### Snapss API

**Purpose:** Attribution des points fidélité et envoi de notifications push aux utilisateurs.

**Base URL:** `https://2o9eiez52a.execute-api.eu-west-1.amazonaws.com`

**Authentication:** Query parameters (api_key, api_pass, api_key_dn, api_pass_dn)

**Rate Limits:** Non documenté - implémenter retry avec backoff

#### Endpoint: Add Points

```
GET /webhook-snapss
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
  &email={USER_EMAIL}
```

**Integration Notes:**
- Méthode GET avec tous les paramètres en query string
- Le paramètre `email` doit correspondre à l'email du wallet_object reçu
- Retry 1x après 2 secondes si timeout (> 10s)

#### Endpoint: Send Notification

```
GET /webhook-snapss
  ?api_key={API_KEY}
  &api_pass={API_PASS}
  &api_key_dn={API_KEY_DN}
  &api_pass_dn={API_PASS_DN}
  &template_id={TEMPLATE_ID}
  &collection_index={COLLECTION_INDEX}
  &crm=custom
  &action=send_notification
  &notification={URL_ENCODED_MESSAGE}
  &email={USER_EMAIL}
```

**Integration Notes:**
- Message doit être URL-encoded
- Template suggéré: "Félicitations ! Vous avez gagné {X} points sur votre achat Phytalessence."

---

## 8. Core Workflows

### Ticket Processing Flow

```mermaid
sequenceDiagram
    participant S as Snapss
    participant W as Webhook Handler
    participant DB as Database
    participant P as TicketProcessor
    participant M as ProductMatcher
    participant C as PointsCalculator
    participant API as Snapss API

    S->>W: POST /webhook/snapss
    W->>W: Validate payload
    W->>DB: Create Transaction (PENDING)
    W-->>S: 200 OK { received: true }

    Note over W,P: Async processing starts

    W->>P: process(transactionId)
    P->>DB: Get Transaction
    P->>M: match(ticketProducts)
    M->>DB: Get active Products
    M-->>P: matchedProducts, eligibleAmount
    P->>DB: Update matchedProducts

    P->>C: calculate(eligibleAmount)
    C->>DB: Get points_ratio Setting
    C-->>P: pointsCalculated
    P->>DB: Update pointsCalculated

    alt Points > 0
        P->>API: addPoints(email, points)
        API-->>P: success/failure
        P->>DB: Update pointsAwarded

        P->>API: sendNotification(email, message)
        API-->>P: success/failure
        P->>DB: Update notificationSent
    end

    P->>DB: Update status (SUCCESS/PARTIAL/FAILED)
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as Admin User
    participant F as Frontend
    participant A as API
    participant DB as Database

    U->>F: Enter credentials
    F->>A: POST /auth/login
    A->>DB: Find admin by email
    A->>A: Verify bcrypt hash
    A->>A: Generate JWT (24h)
    A->>DB: Update lastLoginAt
    A-->>F: { token, admin }
    F->>F: Store token in localStorage
    F-->>U: Redirect to Dashboard

    Note over F,A: Subsequent requests
    F->>A: GET /api/* + Authorization header
    A->>A: Verify JWT
    A->>A: Check role if needed
    A-->>F: Response
```

---

## 9. Component Architecture

### Backend Components

```
backend/src/
├── index.ts                 # Entry point, Express setup
├── config/
│   └── index.ts            # Environment config
├── middleware/
│   ├── auth.ts             # JWT verification
│   ├── role.ts             # Role-based access
│   ├── error.ts            # Global error handler
│   └── logger.ts           # Request logging
├── routes/
│   ├── index.ts            # Route aggregator
│   ├── auth.routes.ts
│   ├── products.routes.ts
│   ├── transactions.routes.ts
│   ├── users.routes.ts
│   ├── stats.routes.ts
│   ├── settings.routes.ts
│   ├── admins.routes.ts
│   └── webhook.routes.ts
├── services/
│   ├── auth.service.ts
│   ├── product.service.ts
│   ├── transaction.service.ts
│   ├── user.service.ts
│   ├── stats.service.ts
│   ├── settings.service.ts
│   ├── admin.service.ts
│   ├── product-matching.service.ts
│   ├── points-calculator.service.ts
│   ├── snapss.service.ts
│   └── ticket-processor.service.ts
├── validators/
│   ├── auth.validator.ts
│   ├── product.validator.ts
│   └── webhook.validator.ts
├── types/
│   └── index.ts            # Shared TypeScript types
└── utils/
    ├── jwt.ts
    ├── password.ts
    └── logger.ts
```

### Frontend Components

```
frontend/src/
├── main.tsx                 # Entry point
├── App.tsx                  # Root component + routing
├── components/
│   ├── ui/                  # Shadcn components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   ├── common/
│   │   ├── DataTable.tsx
│   │   ├── Pagination.tsx
│   │   ├── SearchInput.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ConfirmDialog.tsx
│   └── features/
│       ├── dashboard/
│       │   ├── KpiCard.tsx
│       │   └── TransactionChart.tsx
│       ├── products/
│       │   ├── ProductTable.tsx
│       │   ├── ProductForm.tsx
│       │   └── ImportCsvDialog.tsx
│       ├── transactions/
│       │   ├── TransactionTable.tsx
│       │   └── TransactionDetail.tsx
│       └── settings/
│           └── SettingsForm.tsx
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Products.tsx
│   ├── Transactions.tsx
│   ├── Users.tsx
│   ├── Settings.tsx
│   └── Admins.tsx
├── services/
│   ├── api.ts              # Axios instance
│   ├── auth.service.ts
│   ├── products.service.ts
│   ├── transactions.service.ts
│   ├── users.service.ts
│   ├── stats.service.ts
│   ├── settings.service.ts
│   └── admins.service.ts
├── hooks/
│   ├── useAuth.ts
│   └── usePagination.ts
├── stores/
│   └── auth.store.ts       # Zustand ou Context
├── types/
│   └── index.ts
└── lib/
    └── utils.ts
```

---

## 10. Project Structure

```
phytalessence-crm/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.ts
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── types/
│   │   ├── lib/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── prd.md
│   └── architecture.md
├── scripts/
│   ├── deploy.sh
│   └── backup-db.sh
├── .env.example
├── .gitignore
├── package.json              # Root scripts
└── README.md
```

---

## 11. Development Workflow

### Prerequisites

```bash
# Required
node >= 20.x
npm >= 10.x
postgresql >= 15.x

# Optional (for production)
nginx
pm2
```

### Initial Setup

```bash
# Clone repository
git clone {repo_url}
cd phytalessence-crm

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# Setup database
createdb phytalessence_dev
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
cd backend
npx prisma migrate dev
npx prisma db seed

# Start development
npm run dev
```

### Development Commands

```bash
# Start all (from root)
npm run dev

# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Run tests
cd backend && npm test
cd frontend && npm test

# Prisma commands
npx prisma studio      # GUI database browser
npx prisma migrate dev # Create migration
npx prisma generate    # Regenerate client
```

### Environment Variables

```bash
# Backend (.env)
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/phytalessence_dev
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=24h

# Frontend (.env)
VITE_API_URL=http://localhost:3000/api
```

---

## 12. Deployment Architecture

### Server Setup

```bash
# On server (Ubuntu/Debian)
sudo apt update
sudo apt install nginx postgresql nodejs npm

# Install PM2 globally
sudo npm install -g pm2

# Setup PostgreSQL
sudo -u postgres createuser phytalessence
sudo -u postgres createdb phytalessence_prod -O phytalessence
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/phytalessence
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (static)
    location / {
        root /var/www/phytalessence/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2 Ecosystem

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'phytalessence-api',
    script: './backend/dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

### Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Deploying Phytalessence CRM..."

# Pull latest code
git pull origin main

# Backend
cd backend
npm ci --production
npm run build
npx prisma migrate deploy

# Frontend
cd ../frontend
npm ci
npm run build

# Restart services
pm2 restart ecosystem.config.js

echo "✅ Deployment complete!"
```

### Environments

| Environment | Frontend URL | Backend URL | Purpose |
|-------------|--------------|-------------|---------|
| Development | http://localhost:5173 | http://localhost:3000/api | Local dev |
| Production | https://{domain} | https://{domain}/api | Live |

---

## 13. Security

### Backend Security

- **Input Validation:** Zod schemas sur tous les endpoints
- **SQL Injection:** Protégé par Prisma (requêtes paramétrées)
- **Rate Limiting:** express-rate-limit sur /api/auth (10 req/min)
- **CORS:** Restreint au domaine frontend en production
- **Helmet:** Headers sécurité HTTP

### Authentication Security

- **Password:** Bcrypt avec salt rounds = 12
- **JWT:** HS256, expiration 24h, secret >= 32 caractères
- **Token Storage:** localStorage (acceptable pour admin internal)

### Data Security (RGPD)

- Emails et téléphones stockés de manière standard (pas de données sensibles type santé)
- Logs anonymisés après 12 mois (masquer emails)
- Pas de partage de données avec tiers (sauf Snapss pour le flow normal)

---

## 14. Error Handling

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;           // Ex: "VALIDATION_ERROR"
    message: string;        // Message user-friendly
    details?: any;          // Détails techniques (dev only)
    timestamp: string;      // ISO date
    requestId?: string;     // Pour tracking
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Données invalides |
| INVALID_CREDENTIALS | 401 | Login échoué |
| UNAUTHORIZED | 401 | Token manquant/invalide |
| FORBIDDEN | 403 | Rôle insuffisant |
| NOT_FOUND | 404 | Ressource introuvable |
| CONFLICT | 409 | Doublon (ex: email admin) |
| INTERNAL_ERROR | 500 | Erreur serveur |
| SNAPSS_ERROR | 502 | Erreur API Snapss |

### Backend Error Handler

```typescript
// middleware/error.ts
export const errorHandler = (err, req, res, next) => {
  logger.error(err);

  const status = err.status || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Une erreur est survenue',
      timestamp: new Date().toISOString()
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.details = err.stack;
  }

  res.status(status).json(response);
};
```

---

## 15. Testing Strategy

### Backend Tests

```
backend/tests/
├── unit/
│   ├── services/
│   │   ├── product-matching.service.test.ts
│   │   ├── points-calculator.service.test.ts
│   │   └── snapss.service.test.ts
│   └── validators/
│       └── webhook.validator.test.ts
└── integration/
    ├── auth.test.ts
    ├── products.test.ts
    └── webhook.test.ts
```

### Coverage Target

- Services critiques (matching, calcul, Snapss): 90%
- Routes/Controllers: 70%
- Global: 70%

### Test Example

```typescript
// tests/unit/services/product-matching.service.test.ts
describe('ProductMatchingService', () => {
  describe('match', () => {
    it('should match products by exact name (case-insensitive)', async () => {
      // Arrange
      const ticketProducts = [
        { name: 'ARAGAN BIOTIC P2 DEFENS DPI G', quantity: 1, price: 17.9 }
      ];
      const dbProducts = [
        { id: 1, name: 'Aragan Biotic P2 Defens DPI G', active: true }
      ];

      // Act
      const result = await service.match(ticketProducts, dbProducts);

      // Assert
      expect(result.matched).toHaveLength(1);
      expect(result.eligibleAmount).toBe(17.9);
    });

    it('should return empty when no products match', async () => {
      const result = await service.match([{ name: 'Unknown', quantity: 1, price: 10 }], []);
      expect(result.matched).toHaveLength(0);
      expect(result.eligibleAmount).toBe(0);
    });
  });
});
```

---

## 16. Coding Standards

### Critical Rules

- **Type Safety:** Pas de `any` - utiliser `unknown` et type guards si nécessaire
- **Error Handling:** Toujours utiliser try/catch dans les services async
- **Validation:** Valider TOUTES les entrées utilisateur avec Zod
- **Logging:** Logger les erreurs avec contexte (userId, transactionId, etc.)
- **Secrets:** Jamais en dur - toujours via env variables
- **SQL:** Jamais de raw queries - utiliser Prisma

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (backend) | kebab-case | `product-matching.service.ts` |
| Files (frontend) | PascalCase components, kebab-case autres | `ProductTable.tsx`, `api.ts` |
| Classes/Interfaces | PascalCase | `ProductMatchingService` |
| Functions/Variables | camelCase | `calculatePoints()` |
| Constants | UPPER_SNAKE | `MAX_RETRY_ATTEMPTS` |
| Database tables | snake_case | `matched_products` |
| API endpoints | kebab-case | `/api/webhook/snapss` |

---

## 17. Monitoring & Logging

### Logging Strategy

```typescript
// Winston configuration
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ]
});
```

### Key Metrics to Monitor

- **Webhook:** Temps de réponse, taux d'erreur, volume/heure
- **Snapss API:** Temps de réponse, taux de succès/échec
- **Database:** Connexions actives, temps de requête
- **Server:** CPU, mémoire, disque

### PM2 Monitoring

```bash
pm2 monit           # Real-time monitoring
pm2 logs            # View logs
pm2 show app-name   # Detailed app info
```

---

## 18. Next Steps

### Pour commencer le développement

1. **PO:** Sharder ce document et le PRD en stories exécutables
2. **SM:** Créer les stories détaillées pour Epic 1
3. **Dev:** Commencer par Story 1.1 (Setup projet)

### Checklist pre-dev

- [ ] Serveur SSH accessible
- [ ] PostgreSQL installé
- [ ] Credentials Snapss fournis
- [ ] Liste des 93 produits fournie (CSV)
- [ ] Domaine custom configuré (optionnel pour démarrer)
