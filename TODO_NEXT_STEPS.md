# Prochaines étapes - À reprendre après redémarrage

## Étape en cours : Configuration MySQL

L'utilisateur a choisi **MySQL (via WAMP)** comme base de données.

### Actions à effectuer :

1. **Modifier le schema Prisma** (`prisma/schema.prisma`)
   - Changer `provider = "postgresql"` en `provider = "mysql"`
   - Adapter les types si nécessaire

2. **Modifier le fichier .env** (`backend/.env`)
   - Changer DATABASE_URL pour MySQL :
   ```
   DATABASE_URL=mysql://root:@localhost:3306/phytalessence_dev
   ```

3. **Créer la base de données dans phpMyAdmin**
   - Nom : `phytalessence_dev`
   - Collation : `utf8mb4_unicode_ci`

4. **Exécuter les migrations Prisma**
   ```bash
   cd backend
   npm run prisma:generate
   npx prisma db push --schema=../prisma/schema.prisma
   ```

5. **Créer un compte admin**
   ```bash
   npm run prisma:seed
   ```

6. **Relancer les serveurs**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

## URLs
- Frontend : http://localhost:5173
- Backend API : http://localhost:3000

## État du projet
- ✅ Backend complet (Node.js/Express/TypeScript)
- ✅ Frontend complet (React/Vite/Tailwind)
- ✅ Tests passent (25/25)
- ⏳ Base de données à configurer (MySQL)
- ⏳ Compte admin à créer
