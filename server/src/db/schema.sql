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
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'COMMERCIAL')),
  phone VARCHAR(20),
  vehicle_name VARCHAR(100),
  vehicle_plate VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
