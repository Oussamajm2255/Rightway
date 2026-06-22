# Right Way — Application Documentation

## Overview

**Right Way** is a full-stack web application for **STE RIGHT WAY FOR TRADING** (MF: 1826056/P/N/M/000, 29 Rue de Palestine, 1002 Tunis). It manages product distribution from a central depot to commercial delivery routes through a complete **livraison lifecycle**: Bon de Sortie (dispatch) → real-time sales → Bon de Retour (return) → dossier closure.

- **Language**: French (all UI strings, error messages, PDFs)
- **Currency**: Dinars Tunisiens (DT), always displayed with 3 decimal places (`formatDT()`)
- **Roles**: SUPER_ADMIN, ADMIN (Depot Manager), COMMERCIAL

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite + React Router v6 | Plain JS, no TypeScript |
| Backend | Node.js + Express | CommonJS (`require`/`module.exports`) |
| Database | PostgreSQL | Raw SQL via `pg` (no ORM) |
| Auth | JWT + bcryptjs (12 rounds) | 8h expiry, 5-min refresh window |
| PDF | pdfmake | Tables, company header on every page |
| Validation | express-validator (server) | Inline validation (client) |
| UI | Custom CSS only | No component libraries |
| Rate limiting | express-rate-limit | 20 req/15min on `/login` |

---

## Project Structure

```
c:\All my projects\Right way pro\
├── package.json                    # Root monorepo scripts
├── .gitignore
├── client/
│   ├── package.json                # React 18, Vite, react-router-dom
│   ├── vite.config.js              # Port 5173, proxy /api → :3001
│   ├── index.html                  # lang="fr"
│   ├── .env                        # VITE_API_URL
│   └── src/
│       ├── main.jsx                # Entry: BrowserRouter → App
│       ├── App.jsx                 # Routes wrapped in ErrorBoundary→AuthProvider→ToastProvider
│       ├── components/
│       │   ├── AppLayout.jsx       # Topbar + sidebar + bottom-nav + notification bell
│       │   ├── AppLayout.css
│       │   ├── ProtectedRoute.jsx  # Redirects to /login if no token
│       │   ├── RoleGuard.jsx       # Shows "Accès refusé" if role mismatch
│       │   ├── SessionExpiryModal.jsx  # "Session expire dans 5 min" at 7h55
│       │   ├── SessionExpiryModal.css
│       │   ├── ErrorBoundary.jsx   # Global error catch with French recovery UI
│       │   └── ErrorBoundary.css
│       ├── context/
│       │   ├── AuthContext.jsx     # login/logout/refresh, token in localStorage, expiry timer
│       │   └── ToastContext.jsx    # success/error/info toasts, 4s auto-dismiss
│       ├── lib/
│       │   ├── api.js              # apiGet/apiPost/apiPut/apiDelete with Bearer token
│       │   └── utils.js            # formatDT(), formatDate(), formatDateTime(), formatTime()
│       ├── pages/
│       │   ├── LoginPage.jsx       # "Connexion" form, Right Way header, company footer
│       │   ├── LoginPage.css
│       │   ├── DashboardPage.jsx   # Role-based: stat cards, alerts, quick actions
│       │   ├── DashboardPage.css
│       │   ├── UsersPage.jsx       # SUPER_ADMIN: CRUD + deactivate (password modal)
│       │   ├── UsersPage.css
│       │   ├── ProductsPage.jsx    # SUPER_ADMIN: CRUD + archive, auto PROD-xxx ID
│       │   ├── ProductsPage.css
│       │   ├── StockPage.jsx       # ADMIN/SUPER_ADMIN: table + adjust modal (password)
│       │   ├── StockPage.css
│       │   ├── CreateLivraisonPage.jsx  # ADMIN: 4-step wizard
│       │   ├── CreateLivraisonPage.css
│       │   ├── LivraisonsListPage.jsx   # All roles: filterable table
│       │   ├── LivraisonDetailPage.jsx  # All roles: detail + actions
│       │   ├── LivraisonsPage.css
│       │   ├── SalesPage.jsx       # COMMERCIAL: mobile-first +/- cards, offline sync
│       │   ├── SalesPage.css
│       │   ├── HistoriquePage.jsx  # All roles: dossier detail + print PDF
│       │   └── HistoriquePage.css
│       └── styles/
│           └── index.css           # CSS variables, reset, global utilities
├── server/
│   ├── package.json                # Express, pg, bcryptjs, jsonwebtoken, pdfmake, etc.
│   ├── .env                        # DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN=8h, PORT=3001
│   └── src/
│       ├── index.js                # Express app: helmet, CORS, mount all routes
│       ├── db/
│       │   ├── pool.js             # pg.Pool from DATABASE_URL
│       │   ├── schema.sql          # 8 tables + indexes + CHECK constraints
│       │   ├── seed.js             # 6 users, 12 products, 12 stock entries
│       │   └── init.js             # Runs schema.sql then seed.js then verification
│       ├── utils/
│       │   ├── password.js         # hashPassword, verifyPassword (bcryptjs 12 rounds)
│       │   └── jwt.js              # signToken(8h), verifyToken, canRefreshToken(5min window)
│       ├── middleware/
│       │   └── auth.js             # authenticate (JWT + active check), authorize(...roles)
│       ├── validators/
│       │   ├── user.js             # createUserRules, updateUserRules
│       │   └── product.js          # createProductRules, updateProductRules
│       ├── models/
│       │   ├── user.js             # findAll, findById, findByEmail, create, update, deactivate
│       │   ├── product.js          # findAll, findById, findByBarcode, getNextId, create, update, archive, getCategories
│       │   ├── stock.js            # getStockLevels, getStockAlerts, adjustStock (atomic upsert + movement)
│       │   ├── livraison.js        # generateReference(LIV-YYYYMMDD-NNN), create, findById, findAll, confirmSortie(atomic), getSalesState, recordSales, syncSales, terminerLivraison(atomic), confirmerRetour(atomic dual)
│       │   └── notification.js     # create, findByUser, markRead, markAllRead, countUnread
│       ├── controllers/
│       │   ├── auth.js             # login, me, refresh
│       │   ├── users.js            # listUsers, getUser, createUser, updateUser, deactivateUser, listCommercials
│       │   ├── products.js         # listProducts, listCategories, getProduct, createProduct, updateProduct, archiveProduct
│       │   ├── stock.js            # listStock, getAlerts, adjustStock
│       │   ├── livraisons.js       # createLivraison, listLivraisons, getLivraison, confirmSortie, getSales, recordSale, syncOfflineSales, terminerLivraison, confirmerRetour, downloadBonSortiePDF, downloadBonRetourPDF, downloadDossierPDF, getDossier
│       │   └── dashboard.js        # superAdminDashboard, adminDashboard, commercialDashboard
│       ├── routes/
│       │   ├── auth.js             # POST /login (rate-limited), GET /me, POST /refresh
│       │   ├── users.js            # CRUD under /api/users, SUPER_ADMIN only
│       │   ├── products.js         # CRUD under /api/products, SUPER_ADMIN for write
│       │   ├── stock.js            # GET /, GET /alerts, PUT /adjust under /api/stock
│       │   ├── livraisons.js       # Full livraison lifecycle under /api/livraisons
│       │   ├── dashboard.js        # GET /super-admin, /admin, /commercial under /api/dashboard
│       │   └── notifications.js    # GET /, PUT /:id/read, PUT /mark-all-read
│       └── services/
│           └── pdfGenerator.js     # pdfmake: Bon de Sortie, Bon de Retour, Dossier Complet
```

---

## Database Schema (8 tables)

### users
- `id` UUID PK (gen_random_uuid)
- `full_name`, `email` UNIQUE, `password_hash`, `role` CHECK (SUPER_ADMIN/ADMIN/COMMERCIAL)
- `phone`, `vehicle_name`, `vehicle_plate`, `is_active` DEFAULT true
- `last_login_at`, `created_at`

### products
- `id` VARCHAR(20) PK (PROD-001 through PROD-012 seeded)
- `barcode` UNIQUE, `name`, `category`
- `purchase_price` NUMERIC(10,3), `selling_price_ttc` NUMERIC(10,3)
- `is_active` DEFAULT true, `created_at`

### depot_stock
- `id` SERIAL PK, `product_id` FK → products
- `quantity` INTEGER **CHECK (quantity >= 0)** — DB-level guard
- `last_updated`

### livraisons
- `id` UUID PK, `reference` VARCHAR(30) UNIQUE (format: LIV-YYYYMMDD-NNN)
- `commercial_id` FK, `admin_id` FK
- `status` CHECK: EN_ATTENTE_COMMERCIAL → CONFIRME → EN_COURS → EN_RETOUR → CLOTURE
- Timestamps: `confirmed_by_admin_at`, `confirmed_by_commercial_at`, `end_declared_at`, `retour_confirmed_by_admin_at`, `retour_confirmed_by_commercial_at`, `closed_at`, `created_at`

### livraison_items
- `id` SERIAL PK, `livraison_id` FK, `product_id` FK
- `qte_chargee`, `qte_vendue` DEFAULT 0, `prix_ttc` NUMERIC(10,3)

### livraison_sales_log
- `id` SERIAL PK, `livraison_id` FK, `product_id` FK, `delta` INTEGER, `logged_at`

### stock_movements (audit trail)
- `id` SERIAL PK, `product_id` FK, `type` CHECK (SORTIE/RETOUR/AJUSTEMENT), `quantity`, `livraison_id` FK nullable, `reason` TEXT, `created_by` FK, `created_at`

### notifications
- `id` SERIAL PK, `user_id` FK, `message` TEXT, `livraison_id` FK nullable, `is_read` DEFAULT false, `created_at`

---

## Seed Data

### Users (6)
| Email | Password | Role | Phone | Vehicle |
|---|---|---|---|---|
| superadmin@rightway.tn | RightWay@2026 | SUPER_ADMIN | — | — |
| admin@rightway.tn | Admin@2026 | ADMIN | — | — |
| smir@rightway.tn | Commercial@2026 | COMMERCIAL | +216 22 111 222 | Isuzu NPR — 215 TUN 1234 |
| haithem@rightway.tn | Commercial@2026 | COMMERCIAL | +216 55 333 444 | Renault Master — 216 TUN 5678 |
| naoufel@rightway.tn | Commercial@2026 | COMMERCIAL | +216 98 555 666 | Peugeot Boxer — 217 TUN 9012 |
| ayoub@rightway.tn | Commercial@2026 | COMMERCIAL | +216 23 777 888 | Fiat Ducato — 218 TUN 3456 |

### Products (12)
All prices in DT with 3 decimal places. Stock quantities: 508, 295, 286, 50, 298, 248, 30, 30, 300, 205, 69, 50.

---

## API Endpoints (complete reference)

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /login | Public | Returns {token, user}. Rate-limited 20/15min |
| GET | /me | Bearer | Returns current user from token |
| POST | /refresh | Public | Refreshes token within 5min of expiry |

### Users (`/api/users`) — SUPER_ADMIN only
| Method | Path | Description |
|---|---|---|
| GET | / | List with ?role=&is_active=&search= |
| GET | /commercials | Active commercials (for dropdowns) |
| GET | /:id | Single user |
| POST | / | Create ADMIN or COMMERCIAL (not SUPER_ADMIN) |
| PUT | /:id | Update fields |
| PUT | /:id/deactivate | Soft-deactivate with password confirmation |

### Products (`/api/products`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | / | Any auth | List with ?category=&is_active=&search= |
| GET | /categories | Any auth | Distinct categories |
| GET | /:id | Any auth | Single product |
| POST | / | SUPER_ADMIN | Create (auto PROD-xxx ID) |
| PUT | /:id | SUPER_ADMIN | Update |
| DELETE | /:id | SUPER_ADMIN | Archive (is_active=false) |

### Stock (`/api/stock`) — SUPER_ADMIN + ADMIN
| Method | Path | Description |
|---|---|---|
| GET | / | Stock levels with product info, ?category= |
| GET | /alerts | Products below threshold (?threshold=20) |
| PUT | /adjust | Adjust stock with password + reason |

### Livraisons (`/api/livraisons`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | / | ADMIN | Create. NOT deduct stock |
| GET | / | Any | List (role-filtered) |
| GET | /:id | Any | Detail with items |
| PUT | /:id/confirm-sortie | COMMERCIAL | ATOMIC: deduct stock → EN_COURS |
| GET | /:id/sales | COMMERCIAL | Current sales state + CA |
| POST | /:id/sales | COMMERCIAL | Record single sale |
| POST | /:id/sales/sync | COMMERCIAL | Sync offline queue |
| PUT | /:id/terminer | COMMERCIAL | End livraison → EN_RETOUR |
| PUT | /:id/confirmer-retour | All | Dual confirmation → CLOTURE |
| GET | /:id/dossier | Any | Complete dossier JSON |
| GET | /:id/bon-sortie/pdf | Any auth | PDF download |
| GET | /:id/bon-retour/pdf | Any auth | PDF download |
| GET | /:id/dossier/pdf | Any auth | PDF download |

### Dashboard (`/api/dashboard`)
| Method | Path | Description |
|---|---|---|
| GET | /super-admin | Users count, products count, active livraisons, total CA, stock alerts |
| GET | /admin | Stock overview, active/pending livraisons, alerts, unread notifications |
| GET | /commercial | Pending bons, active livraison, recent history, CA/commission, unread notifications |

### Notifications (`/api/notifications`)
| Method | Path | Description |
|---|---|---|
| GET | / | List with ?unread=true |
| PUT | /:id/read | Mark single as read |
| PUT | /mark-all-read | Mark all as read |

---

## Business Rules (critical — must never be violated)

### Stock Deduction Timing
Stock is deducted from `depot_stock` ONLY when the Commercial confirms the Bon de Sortie (`PUT /confirm-sortie`). Never when Admin creates the livraison. Never before. Never after.

### Atomic Transactions (PostgreSQL BEGIN/COMMIT/ROLLBACK)
Three operations MUST use full transactions:
1. **confirmSortie**: Deduct stock + write SORTIE movements + set EN_COURS + notify Admin
2. **terminerLivraison**: Set EN_RETOUR + end_declared_at
3. **confirmerRetour** (when both confirmed): Re-add returned stock + write RETOUR movements + set CLOTURE + notify both

### Financial Calculations
All monetary computations happen server-side using PostgreSQL `NUMERIC(10,3)`. The frontend only displays values received from the server. The `formatDT()` utility formats as `XXX.XXX DT`. Commission is 10% of CA Total, net à reverser = CA − commission. Never compute money in JavaScript on the frontend.

### Reference Format
Livraison references: `LIV-YYYYMMDD-NNN` where NNN is a daily sequential counter resetting each day. Example: `LIV-20260618-001`.

### Password Confirmation Modals
Every irreversible action must show a human-readable French summary modal BEFORE the password field. Actions requiring this: confirm Bon de Sortie, end livraison, confirm Bon de Retour, manual stock adjustment, delete/deactivate user.

### Notification Wiring
Every status change writes a notification for the relevant user(s):
- Admin creates livraison → notify Commercial
- Commercial confirms Bon de Sortie → notify Admin
- Commercial ends livraison → notify Admin
- Admin confirms Bon de Retour → notify Commercial
- Commercial confirms Bon de Retour → notify Admin
- Livraison CLOTURE → notify both

### DB-Level Stock Constraint
`depot_stock.quantity` has `CHECK (quantity >= 0)`. This is the last line of defense — application logic must prevent violations, but the DB constraint catches any bugs.

### Session Expiry
JWT tokens expire after 8 hours. At 7 hours 55 minutes, a modal appears: "Votre session expire dans 5 minutes. Souhaitez-vous la prolonger ?" with a "Prolonger la session" button that calls `POST /api/auth/refresh`.

### Offline Sales Queue
Sales are buffered in `localStorage` under key `rightway_offline_queue` when offline. On reconnect, synced via `POST /sales/sync`. Red banner "Mode hors-ligne — vos données sont sauvegardées localement" when offline, green "Synchronisé ✓" when synced.

---

## PDF Documents (all generated server-side with pdfmake)

### Company Header (on every page)
```
Right Way
STE RIGHT WAY FOR TRADING
MF: 1826056/P/N/M/000 | 29 Rue de Palestine, 1002 Tunis
```

### Bon de Sortie
- Company header, title "BON DE SORTIE"
- Reference, date, commercial, vehicle, admin meta
- Product table: Code, Code-barres, Produit, Catégorie, Qté, PU TTC, Total
- Dual confirmation block (Admin + Commercial with timestamps)
- "Cachet de l'entreprise" placeholder

### Bon de Retour
- Same header, title "BON DE RETOUR"
- Retour table: Code, Article, Qté Sortie, Qté Vendue, Qté Retour, PU TTC, Montant Vendu
- Financial summary: Total CA, Commission (10%), Net à reverser
- Dual confirmation block
- Stamp placeholder

### Dossier Complet
- 4 sections: (1) Info générales + durée, (2) Bon de Sortie items, (3) Journal des ventes (chronological from livraison_sales_log), (4) Bon de Retour + financial summary
- "Dossier clôturé et verrouillé" footer

---

## Frontend Routes

| Path | Roles | Page |
|---|---|---|
| /login | Public | LoginPage |
| / | All | DashboardPage (role-based content) |
| /users | SUPER_ADMIN | UsersPage |
| /products | SUPER_ADMIN | ProductsPage |
| /stock | SUPER_ADMIN, ADMIN | StockPage |
| /livraisons/nouvelle | SUPER_ADMIN, ADMIN | CreateLivraisonPage (4-step wizard) |
| /livraisons/:id | All | LivraisonDetailPage |
| /livraisons | All | LivraisonsListPage |
| /ventes/:id | COMMERCIAL | SalesPage (mobile-first, offline) |
| /historique | All | HistoriquePage (dossier viewer + PDF) |

---

## Key Design Patterns

### Server: Model-Controller-Route (no ORM)
Each entity follows `models/X.js` (SQL queries) → `controllers/X.js` (business logic) → `routes/X.js` (HTTP wiring). All SQL is raw via `pool.query()` with parameterized queries.

### Client: Composable Auth Guards
`ProtectedRoute` wraps pages requiring authentication. `RoleGuard` wraps pages requiring specific roles. Both are composable:
```jsx
<ProtectedRoute>
  <RoleGuard roles={['SUPER_ADMIN']}>
    <UsersPage />
  </RoleGuard>
</ProtectedRoute>
```

### Module Exports (critical)
All server files use CommonJS `module.exports` at the **very end** of the file, after all function definitions. Functions defined after `module.exports = { ... }` will not be exported. This has been a recurring bug pattern.

### localStorage Keys
| Key | Purpose |
|---|---|
| `rightway_token` | JWT token |
| `rightway_user` | User object JSON |
| `rightway_expires_at` | Timestamp for session expiry check |
| `rightway_offline_queue` | Offline sales buffer |

---

## Running the Application

```bash
# 1. Start PostgreSQL and create database
psql -U postgres -c "CREATE DATABASE rightway;"

# 2. Configure server/.env DATABASE_URL if needed

# 3. Initialize database (schema + seed)
cd server && npm run db:init

# 4. Start server (port 3001)
npm run dev

# 5. Start client (port 5173)
cd ../client && npm run dev

# Login: superadmin@rightway.tn / RightWay@2026
```

---

## Build Output
- Server: plain Node.js, no build step
- Client: `vite build` → `dist/` (65 modules, ~241 KB JS gzipped to ~69 KB, ~28 KB CSS gzipped to ~5.5 KB)
