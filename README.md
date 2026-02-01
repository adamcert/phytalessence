# Phytalessence CRM Fidélité

Système CRM de fidélité pour Phytalessence - Attribution automatique de points pour les achats en pharmacie via intégration Snapss.

## Stack Technique

- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Frontend:** React + Vite + TypeScript + Tailwind + Shadcn/ui
- **Auth:** JWT + bcrypt

## Prérequis

- Node.js >= 20.x
- PostgreSQL >= 15.x
- npm >= 10.x

## Installation

```bash
# Cloner le repository
git clone <repo-url>
cd phytalessence-crm

# Copier le fichier d'environnement
cp .env.example backend/.env

# Éditer backend/.env avec vos paramètres
# - DATABASE_URL
# - JWT_SECRET

# Installer les dépendances
cd backend && npm install

# Générer le client Prisma
npm run prisma:generate

# Créer la base de données et exécuter les migrations
npm run prisma:migrate

# Seed les données initiales (admin + settings)
npm run prisma:seed
```

## Développement

```bash
# Démarrer le backend en mode dev
npm run dev

# Le serveur démarre sur http://localhost:3000
```

## Endpoints

- `GET /health` - Health check
- `GET /api/health` - Health check détaillé (avec statut DB)

## Credentials par défaut

Après le seed :
- **Email:** admin@phytalessence.com
- **Password:** admin123

⚠️ Changez ce mot de passe en production !

## Structure du projet

```
phytalessence-crm/
├── backend/           # API Express
│   ├── src/
│   │   ├── config/    # Configuration
│   │   ├── middleware/# Middlewares Express
│   │   ├── routes/    # Routes API
│   │   ├── services/  # Logique métier
│   │   ├── types/     # Types TypeScript
│   │   ├── utils/     # Utilitaires
│   │   └── index.ts   # Entry point
│   └── tests/         # Tests
├── frontend/          # React Admin (à venir)
├── prisma/            # Schéma et migrations
├── docs/              # Documentation
└── scripts/           # Scripts de déploiement
```

## Documentation

- [PRD](docs/prd.md) - Product Requirements Document
- [Architecture](docs/architecture.md) - Architecture technique
