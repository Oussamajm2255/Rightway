-- ============================================================
-- Right Way — Database Schema
-- STE RIGHT WAY FOR TRADING | MF: 1826056/P/N/M/000
-- ============================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER', 'COMMERCIAL')),
  phone VARCHAR(20),
  vehicle_name VARCHAR(100),
  vehicle_plate VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  remuneration_type VARCHAR(20) DEFAULT 'COMMISSION' CHECK (remuneration_type IN ('COMMISSION', 'SALAIRE')),
  salary_amount NUMERIC(10,3) DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_settings (
  id SERIAL PRIMARY KEY,
  salary_generation_day INTEGER DEFAULT 1 CHECK (salary_generation_day BETWEEN 1 AND 28),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(20) PRIMARY KEY,
  barcode VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  purchase_price NUMERIC(10,3) NOT NULL,
  selling_price_ttc NUMERIC(10,3) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEPOT STOCK
-- Last line of defense: CHECK (quantity >= 0)
-- ============================================================
CREATE TABLE IF NOT EXISTS depot_stock (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(20) REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id)
);

-- ============================================================
-- LIVRAISONS
-- ============================================================
CREATE TABLE IF NOT EXISTS livraisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(30) UNIQUE NOT NULL,
  commercial_id UUID REFERENCES users(id),
  admin_id UUID REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'EN_ATTENTE_COMMERCIAL'
    CHECK (status IN (
      'EN_ATTENTE_COMMERCIAL',
      'CONFIRME',
      'EN_COURS',
      'EN_RETOUR',
      'EN_ATTENTE_ANNULATION',
      'ANNULE',
      'CLOTURE'
    )),
  confirmed_by_admin_at TIMESTAMPTZ,
  confirmed_by_commercial_at TIMESTAMPTZ,
  end_declared_at TIMESTAMPTZ,
  retour_confirmed_by_admin_at TIMESTAMPTZ,
  retour_confirmed_by_commercial_at TIMESTAMPTZ,
  annulation_requested_at TIMESTAMPTZ,
  annulation_confirmed_by_admin_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  returned_to_creation_at TIMESTAMPTZ,
  return_reason TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIVRAISON ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS livraison_items (
  id SERIAL PRIMARY KEY,
  livraison_id UUID REFERENCES livraisons(id) ON DELETE CASCADE,
  product_id VARCHAR(20) REFERENCES products(id),
  qte_chargee INTEGER NOT NULL,
  qte_vendue INTEGER NOT NULL DEFAULT 0,
  prix_ttc NUMERIC(10,3) NOT NULL
);

-- ============================================================
-- LIVRAISON SALES LOG (real-time tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS livraison_sales_log (
  id SERIAL PRIMARY KEY,
  livraison_id UUID REFERENCES livraisons(id) ON DELETE CASCADE,
  product_id VARCHAR(20) REFERENCES products(id),
  delta INTEGER NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK MOVEMENTS (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(20) REFERENCES products(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('SORTIE', 'RETOUR', 'AJUSTEMENT')),
  quantity INTEGER NOT NULL,
  livraison_id UUID REFERENCES livraisons(id),
  movement_date DATE,
  invoice_number VARCHAR(100),
  company_name VARCHAR(150),
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIVRAISON AVANCES (advance payments during delivery)
-- ============================================================
CREATE TABLE IF NOT EXISTS livraison_avances (
  id SERIAL PRIMARY KEY,
  livraison_id UUID REFERENCES livraisons(id) ON DELETE CASCADE,
  amount NUMERIC(10,3) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'ESPECES'
    CHECK (payment_method IN ('WAFA_CASH', 'IZI_CASH', 'VERSEMENT', 'ESPECES')),
  image_base64 TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
    CHECK (status IN ('EN_ATTENTE', 'ACCEPTE', 'REFUSE')),
  commercial_id UUID REFERENCES users(id),
  admin_id UUID REFERENCES users(id),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  livraison_id UUID REFERENCES livraisons(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_depot_stock_product ON depot_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_livraisons_status ON livraisons(status);
CREATE INDEX IF NOT EXISTS idx_livraisons_commercial ON livraisons(commercial_id);
CREATE INDEX IF NOT EXISTS idx_livraisons_admin ON livraisons(admin_id);
CREATE INDEX IF NOT EXISTS idx_livraison_items_livraison ON livraison_items(livraison_id);
CREATE INDEX IF NOT EXISTS idx_livraison_items_product ON livraison_items(livraison_id, product_id);
CREATE INDEX IF NOT EXISTS idx_livraison_sales_log_livraison ON livraison_sales_log(livraison_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_livraison_avances_livraison ON livraison_avances(livraison_id);
CREATE INDEX IF NOT EXISTS idx_livraison_avances_status ON livraison_avances(livraison_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
-- Performance indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_livraisons_closed_at ON livraisons(closed_at DESC) WHERE status = 'CLOTURE' AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ============================================================
-- PRELEVEMENT (Expense Management — SUPER_ADMIN only)
-- ============================================================

CREATE TABLE IF NOT EXISTS prelevement_categories (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  parent_id     INTEGER REFERENCES prelevement_categories(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique indexes: enforce (name, COALESCE(parent_id, 0)) uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_prelevement_cat_root_name
  ON prelevement_categories (name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prelevement_cat_child_name
  ON prelevement_categories (parent_id, name) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS prelevements (
  id              SERIAL PRIMARY KEY,
  category_id     INTEGER NOT NULL REFERENCES prelevement_categories(id),
  amount          NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  description     TEXT,
  reference       VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'EN_ATTENTE', 'REJETE')),
  declared_by     UUID NOT NULL REFERENCES users(id),
  declared_at     TIMESTAMPTZ DEFAULT NOW(),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prelevements_category ON prelevements(category_id);
CREATE INDEX IF NOT EXISTS idx_prelevements_date ON prelevements(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_prelevements_declared_by ON prelevements(declared_by);

-- ============================================================
-- LIVRAISON ECARTS (discrepancy declarations)
-- ============================================================
CREATE TABLE IF NOT EXISTS livraison_ecarts (
  id            SERIAL PRIMARY KEY,
  livraison_id  UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
  amount        NUMERIC(12,3) NOT NULL CHECK(amount > 0),
  justification TEXT NOT NULL,
  declared_by   UUID NOT NULL REFERENCES users(id),
  declared_at   TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by  UUID REFERENCES users(id),
  confirmed_at  TIMESTAMPTZ,
  payment_requested_by UUID REFERENCES users(id),
  payment_requested_at TIMESTAMPTZ,
  payment_confirmed_by UUID REFERENCES users(id),
  payment_confirmed_at TIMESTAMPTZ,
  status        VARCHAR(20) DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED','PAYMENT_REQUESTED','PAID')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecarts_livraison ON livraison_ecarts(livraison_id);
CREATE INDEX IF NOT EXISTS idx_ecarts_status ON livraison_ecarts(status);

-- ============================================================
-- LIVRAISON REOPEN LOG (audit trail for reopening closed livraisons)
-- ============================================================
CREATE TABLE IF NOT EXISTS livraison_reopen_log (
  id SERIAL PRIMARY KEY,
  livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reopen_log_livraison ON livraison_reopen_log(livraison_id);

-- ============================================================
-- LIVRAISON RETOUR CREATION LOG (audit trail for return-to-creation)
-- ============================================================
CREATE TABLE IF NOT EXISTS livraison_retour_creation_log (
  id SERIAL PRIMARY KEY,
  livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_retour_creation_log_livraison ON livraison_retour_creation_log(livraison_id);

-- ============================================================
-- PUSH NOTIFICATION SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
