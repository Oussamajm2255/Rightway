# Right Way — Full Stack Application Build Plan

## Architecture Overview

```
right-way/
├── client/                  # React (Vite) frontend
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Route pages by role
│   │   ├── hooks/           # Custom hooks (auth, api, offline)
│   │   ├── context/         # AuthContext, OfflineContext
│   │   ├── lib/             # API client, utils, constants
│   │   └── styles/          # Global CSS
│   └── ...
├── server/                  # Node.js + Express backend
│   ├── src/
│   │   ├── middleware/      # auth, validate, error handler
│   │   ├── routes/          # auth, users, products, livraisons, stock, reports
│   │   ├── controllers/     # Route logic
│   │   ├── models/          # Database queries (raw SQL via pg)
│   │   ├── services/        # PDF generation, seeding
│   │   └── utils/           # JWT, password hashing
│   └── ...
└── docs/                    # (not created per instructions)
```

**Dependencies**: React 18, React Router v6, Vite, Express, pg (node-postgres), jsonwebtoken, bcryptjs, jspdf (PDF), cors, helmet

---

## Task 1: Project Scaffolding & Configuration

- Initialize the monorepo root with `package.json` containing workspace scripts
- Scaffold `client/` via `npm create vite@latest client -- --template react`
- Scaffold `server/` manually: `package.json`, `src/index.js`, Express boilerplate
- Create `server/.env` with `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Create `client/.env` with `VITE_API_URL=http://localhost:3001/api`
- Install all dependencies for both client and server
- **Verify**: both `npm run dev` (server) and `npm run dev` (client) start without errors

---

## Task 2: Database Schema & Seed Script

- Create `server/src/db/schema.sql` with complete DDL (users, products, depot_stock, livraisons, livraison_items, livraison_sales_log, stock_movements)
- Create `server/src/db/seed.sql` with exact seed data for:
  - Super Admin: superadmin@rightway.tn / hashed RightWay@2026
  - Admin: admin@rightway.tn / hashed Admin@2026
  - 4 Commercials (Smir, Haithem, Naoufel, Ayoub) with vehicles
  - 12 Products (PROD-001 to PROD-012) with exact prices in 3 decimal DT
  - Depot stock entries matching initial_stock values
- Create `server/src/db/init.js` that reads and executes schema + seed
- Add npm script `npm run db:init` to initialize database
- Create `server/src/db/pool.js` — PostgreSQL connection pool
- **Verify**: run `db:init`, query each table to confirm data is correct

---

## Task 3: Backend — Authentication & Middleware

- `server/src/utils/password.js` — hashPassword, verifyPassword (bcryptjs)
- `server/src/utils/jwt.js` — signToken, verifyToken
- `server/src/middleware/auth.js`:
  - `authenticate` — verifies JWT from Authorization header; sets req.user
  - `authorize(...roles)` — checks req.user.role against allowed roles
- `server/src/routes/auth.js` + `server/src/controllers/auth.js`:
  - `POST /api/auth/login` — returns { token, user }
  - `GET /api/auth/me` — returns current user from token
- Create `AuthContext` + `AuthProvider` in client `src/context/AuthContext.jsx`
- Create `LoginPage.jsx` — clean login form in French
- Create route guards: `ProtectedRoute.jsx` (checks auth), `RoleGuard.jsx` (checks role)
- **Verify**: login as each seed user, confirm JWT is issued and roles are enforced

---

## Task 4: Backend — User Management (Super Admin)

- `server/src/routes/users.js` + `server/src/controllers/users.js`:
  - `GET /api/users` — list all users (filterable by role, active status)
  - `POST /api/users` — create Admin or Commercial (Super Admin only)
  - `PUT /api/users/:id` — edit user (name, email, phone, vehicle, isActive)
  - `DELETE /api/users/:id` — soft-deactivate (set is_active=false)
- `server/src/models/user.js` — all SQL user queries
- `server/src/validators/user.js` — email format, required fields, role check
- **Frontend pages**: `UsersPage.jsx` (list with search/filter), `UserForm.jsx` (create/edit modal)
- **Verify**: create a new Commercial, edit vehicle, deactivate; confirm constraints

---

## Task 5: Backend — Product Catalog (Super Admin)

- `server/src/routes/products.js` + `server/src/controllers/products.js`:
  - `GET /api/products` — list all (filter by category, active status)
  - `POST /api/products` — create with auto-generated ID (PROD-xxx)
  - `PUT /api/products/:id` — edit product
  - `DELETE /api/products/:id` — archive (is_active=false)
- `server/src/models/product.js`
- **Frontend pages**: `ProductsPage.jsx` (table with category filter), `ProductForm.jsx`
- **Verify**: add a product, edit price, archive; confirm 12 seed products display

---

## Task 6: Backend — Depot Stock Management (Admin)

- `server/src/routes/stock.js` + `server/src/controllers/stock.js`:
  - `GET /api/stock` — current stock levels with product info (sorted by category, name)
  - `GET /api/stock/alerts` — products below threshold (configurable, default 20)
  - `PUT /api/stock/adjust` — manual adjustment with reason (logged in stock_movements)
- `server/src/models/stock.js`
- **Frontend pages**: `StockPage.jsx` (table with red highlight for low stock, adjust modal)
- **Verify**: adjust stock manually, confirm movement record; confirm alerts work

---

## Task 7: Livraison Lifecycle — Create & Confirm Bon de Sortie

### 7a: Create Livraison (Admin)
- `POST /api/livraisons` — create with reference auto-generation (e.g. LIV-2026-0001)
  - Validate quantities ≤ current depot stock
  - Save with status `EN_ATTENTE_COMMERCIAL`
  - Do NOT deduct stock yet
- `server/src/models/livraison.js`
- **Frontend**: `CreateLivraisonPage.jsx` (Admin only)
  - Step 1: Select Commercial (card list with name, vehicle, plate)
  - Step 2: Select products (filtered to stock > 0, sorted category/name, show remaining stock)
  - Step 3: Enter quantities with real-time validation
  - Step 4: Preview Bon de Sortie with total value
  - Step 5: Password confirmation modal → creates livraison
- **Verify**: create a livraison, confirm status is EN_ATTENTE_COMMERCIAL, stock unchanged

### 7b: Commercial Confirms Bon de Sortie
- `PUT /api/livraisons/:id/confirm-sortie` — Commercial confirms with password
  - Verify password matches req.user
  - Atomic transaction: deduct stock, write stock_movements (SORTIE), change status CONFIRME → EN_COURS
- **Frontend**: Alert card on Commercial dashboard for pending livraisons
- Confirm with password modal
- **Verify**: confirm, check stock deducted, check movement records

---

## Task 8: Real-Time Sales Declaration (Commercial)

### Backend
- `POST /api/livraisons/:id/sales` — batch upsert sales (accepts array of {product_id, qte_vendue})
  - Validate 0 ≤ qte_vendue ≤ qte_chargee
  - Write to livraison_sales_log for each delta
  - Update livraison_items.qte_vendue
- `GET /api/livraisons/:id/sales` — get current sales state for a livraison

### Frontend — `SalesPage.jsx` (mobile-first)
- Product cards: name, barcode, unit price, loaded qty, sold qty, remaining, sold value
- Large +/- buttons per card
- "Valider" confirmation tap after each change
- Sticky header: "CA du jour: XXX.XXX DT" (live, computed client-side)
- Auto-save every 30 seconds + on each Valider tap
- Offline resilience:
  - Buffer sales in localStorage when offline
  - Show red banner "Mode hors-ligne" when disconnected
  - Show green "Synchronisé" when reconnected
  - Sync queue on reconnect
- "Terminer la livraison" large button at bottom
- **Verify**: make sales, confirm auto-save, test offline sync, test reconnect

---

## Task 9: End of Livraison & Bon de Retour

### 9a: Declare End (Commercial)
- `PUT /api/livraisons/:id/terminer` — Commercial confirms with password
  - Computes qte_retour = qte_chargee − qte_vendue per product
  - Changes status to `EN_RETOUR`
  - Records `end_declared_at`
  - Returns summary: per-product breakdown, total CA, commission (10%), net à reverser
- **Frontend**: Summary modal before password confirmation
- **Verify**: end a livraison, confirm summary math

### 9b: Bon de Retour — Dual Confirmation
- `PUT /api/livraisons/:id/confirmer-retour` — accepts password + role
  - If Admin: set retour_confirmed_by_admin_at
  - If Commercial: set retour_confirmed_by_commercial_at
  - If both confirmed: status → CLOTURE, atomic re-add stock (RETOUR movement), set closed_at
- **Frontend**:
  - Both Admin and Commercial see Bon de Retour card with full table
  - Yellow banner if one party hasn't confirmed
  - Password confirmation modals
- **Verify**: partial confirmation (one side), yellow banner; full confirmation, stock re-added, CLOTURE

---

## Task 10: PDF Generation

- Create `server/src/services/pdfGenerator.js` using jspdf:
  - `generateBonDeSortie(livraison)` — Right Way header, product table, dual confirmation, stamp
  - `generateBonDeRetour(livraison)` — same header, retour table, commission calculation, dual confirmation
  - `generateDossierComplet(livraison)` — full dossier: metadata, bon sortie, sales log, bon retour, financials
  - Shared PDF helper: Right Way company header (name, MF, address)
- Endpoints:
  - `GET /api/livraisons/:id/bon-sortie/pdf`
  - `GET /api/livraisons/:id/bon-retour/pdf`
  - `GET /api/livraisons/:id/dossier/pdf`
- **Verify**: generate each PDF type, confirm content matches spec

---

## Task 11: Livraison Dossier (Historique)

- `GET /api/livraisons/:id/dossier` — returns complete locked dossier JSON
- `GET /api/livraisons` — list all (filter by status, commercial, date range)
  - Admin: all livraisons for their depot
  - Commercial: only their own
  - Super Admin: all across depot
- **Frontend**: `HistoriquePage.jsx`
  - Table with filters (status, commercial, date range)
  - Click row → dossier detail view (read-only, all sections)
  - "Imprimer le dossier complet" button → PDF
- **Verify**: view closed dossier, confirm all sections present, print PDF

---

## Task 12: Dashboards

- **Super Admin Dashboard**: user count, product count, active livraisons, total CA, stock alerts
- **Admin Dashboard**: depot stock overview, active livraisons, pending confirmations, stock alerts
- **Commercial Dashboard**: pending Bon de Sortie alerts, active livraison card, recent history, commission summary
- `GET /api/dashboard/super-admin`, `/api/dashboard/admin`, `/api/dashboard/commercial`
- **Frontend**: `DashboardPage.jsx` with role-based content
- **Verify**: each role sees correct dashboard data

---

## Task 13: App Shell, Navigation & Responsive Layout

- `AppLayout.jsx` — sidebar (desktop) / bottom nav (mobile), header with "Right Way" logo text
- Role-based navigation:
  - Super Admin: Dashboard, Utilisateurs, Produits, Stock, Livraisons, Historique
  - Admin: Dashboard, Stock, Livraisons (create + list), Historique
  - Commercial: Dashboard, Mes Livraisons, Ventes, Historique
- Notification badge system for pending actions
- Mobile-first responsive design: sidebar collapses, cards stack, tables become scrollable
- French language throughout UI
- DT currency formatting utility: `formatDT(value)` → "10.000 DT"
- **Verify**: responsive on mobile (375px) and desktop (1440px)

---

## Task 14: Polish, Error Handling & Final Verification

- Global error boundary in React
- Server: centralized error handler middleware, request validation (express-validator)
- Toast notifications for all actions (success/error)
- Loading states (skeletons/spinners) for all data fetches
- Empty states for all lists
- Confirmation dialogs for destructive actions
- Rate limiting on auth endpoints
- Input sanitization
- Final end-to-end walkthrough of the entire livraison lifecycle with all 3 roles
- Test offline sync flow
- **Verify**: full lifecycle works end-to-end
