/**
 * Idempotent startup migrations — safe to run on every deploy.
 * Uses ADD COLUMN IF NOT EXISTS so existing columns are never affected.
 */
const pool = require('./pool');

const migrations = [
  // Brute-force protection (H-5)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`,

  // Prelevement (expense management — SUPER_ADMIN only)
  `CREATE TABLE IF NOT EXISTS prelevement_categories (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    parent_id     INTEGER REFERENCES prelevement_categories(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, COALESCE(parent_id, 0))
  )`,
  `CREATE TABLE IF NOT EXISTS prelevements (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES prelevement_categories(id),
    amount          NUMERIC(12,2) NOT NULL CHECK(amount > 0),
    description     TEXT,
    reference       VARCHAR(100),
    declared_by     INTEGER NOT NULL REFERENCES users(id),
    declared_at     TIMESTAMPTZ DEFAULT NOW(),
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}

/**
 * Seed default prelevement categories — idempotent via ON CONFLICT DO NOTHING.
 * Only runs after the prelevement_categories table is created.
 */
async function seedPrelevementCategories() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Main categories (parent_id IS NULL)
    const mainCats = [
      'Transport & Déplacement',
      'Fournitures & Consommables',
      'Ressources Humaines',
      'Services & Charges Fixes',
      'Marketing & Communication',
      'Maintenance & Équipement',
      'Frais Financiers',
      'Impôts & Taxes',
      'Divers & Imprévus',
    ];

    for (const name of mainCats) {
      await client.query(
        `INSERT INTO prelevement_categories (name, parent_id) VALUES ($1, NULL)
         ON CONFLICT (name, COALESCE(parent_id, 0)) DO NOTHING`,
        [name]
      );
    }

    // Child categories — look up parent IDs by name
    const children = [
      ['Transport & Déplacement', 'Carburant'],
      ['Transport & Déplacement', 'Entretien véhicule'],
      ['Transport & Déplacement', 'Parking & Péage'],
      ['Transport & Déplacement', 'Assurance véhicule'],
      ['Transport & Déplacement', 'Location véhicule'],
      ['Transport & Déplacement', 'Transport public / Taxi'],
      ['Fournitures & Consommables', 'Papeterie & Bureau'],
      ['Fournitures & Consommables', 'Produits d\'entretien'],
      ['Fournitures & Consommables', 'Emballage & Conditionnement'],
      ['Fournitures & Consommables', 'Eau minérale & Boissons'],
      ['Fournitures & Consommables', 'Petit matériel'],
      ['Ressources Humaines', 'Salaires & Rémunérations'],
      ['Ressources Humaines', 'Primes & Gratifications'],
      ['Ressources Humaines', 'Formation & Séminaires'],
      ['Ressources Humaines', 'Charges sociales'],
      ['Ressources Humaines', 'Indemnités de déplacement'],
      ['Ressources Humaines', 'Tenue de travail'],
      ['Services & Charges Fixes', 'Loyer & Charges locatives'],
      ['Services & Charges Fixes', 'Électricité'],
      ['Services & Charges Fixes', 'Eau'],
      ['Services & Charges Fixes', 'Internet & Téléphonie'],
      ['Services & Charges Fixes', 'Abonnements logiciels'],
      ['Services & Charges Fixes', 'Assurances (hors véhicule)'],
      ['Services & Charges Fixes', 'Sécurité & Gardiennage'],
      ['Marketing & Communication', 'Publicité en ligne'],
      ['Marketing & Communication', 'Publicité imprimée'],
      ['Marketing & Communication', 'Événements & Salons'],
      ['Marketing & Communication', 'Goodies & Cadeaux clients'],
      ['Marketing & Communication', 'Site web & Référencement'],
      ['Marketing & Communication', 'Réseaux sociaux & Community mgmt'],
      ['Maintenance & Équipement', 'Réparations'],
      ['Maintenance & Équipement', 'Achat équipement'],
      ['Maintenance & Équipement', 'Pièces de rechange'],
      ['Maintenance & Équipement', 'Maintenance informatique'],
      ['Frais Financiers', 'Frais bancaires'],
      ['Frais Financiers', 'Intérêts d\'emprunt'],
      ['Frais Financiers', 'Commissions'],
      ['Frais Financiers', 'Change & Conversion'],
      ['Impôts & Taxes', 'TVA à payer'],
      ['Impôts & Taxes', 'Impôt sur les sociétés'],
      ['Impôts & Taxes', 'Taxe professionnelle'],
      ['Impôts & Taxes', 'Droits de douane'],
      ['Divers & Imprévus', 'Dépenses diverses'],
      ['Divers & Imprévus', 'Cadeaux & Hospitalité'],
      ['Divers & Imprévus', 'Pertes & Vols'],
      ['Divers & Imprévus', 'Dons & Sponsoring'],
    ];

    for (const [parentName, childName] of children) {
      await client.query(
        `INSERT INTO prelevement_categories (name, parent_id)
         SELECT $1, id FROM prelevement_categories WHERE name = $2 AND parent_id IS NULL
         ON CONFLICT (name, COALESCE(parent_id, 0)) DO NOTHING`,
        [childName, parentName]
      );
    }

    await client.query('COMMIT');
    console.log('[seed] Prelevement categories seeded');
  } catch (err) {
    await client.query('ROLLBACK');
    // Don't crash — seeding is best-effort
    console.error('[seed] Prelevement categories seed error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runMigrations, seedPrelevementCategories };
