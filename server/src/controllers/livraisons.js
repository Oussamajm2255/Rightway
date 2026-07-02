const livraisonModel = require('../models/livraison');
const avanceModel = require('../models/livraisonAvance');
const ecartModel = require('../models/livraisonEcart');
const reopenLogModel = require('../models/livraisonReopenLog');
const retourCreationLogModel = require('../models/livraisonRetourCreationLog');
const notificationModel = require('../models/notification');
const { COMMISSION_RATE } = require('../models/livraison');
const { verifyPassword } = require('../utils/password');
const pool = require('../db/pool');
const pdfGenerator = require('../services/pdfGenerator');

async function createLivraison(req, res) {
  try {
    const { commercial_id, items } = req.body;
    if (!commercial_id) return res.status(400).json({ error: 'Veuillez sélectionner un commercial.' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Veuillez ajouter au moins un produit.' });
    const { rows: comRows } = await pool.query('SELECT id, full_name, role, is_active FROM users WHERE id = $1', [commercial_id]);
    if (comRows.length === 0 || comRows[0].role !== 'COMMERCIAL' || !comRows[0].is_active) return res.status(400).json({ error: 'Commercial invalide ou inactif.' });
    for (const item of items) {
      if (!item.product_id || !item.qte_chargee || item.qte_chargee <= 0) return res.status(400).json({ error: 'Chaque produit doit avoir un ID et une quantité positive.' });
    }
    // Stock validation and price resolution now happen inside the model's
    // create() transaction with FOR UPDATE — no TOCTOU.
    const livraison = await livraisonModel.create({ commercial_id, admin_id: req.user.id, items });
    await notificationModel.create(commercial_id, `Nouveau bon de sortie ${livraison.reference} en attente de votre confirmation.`, livraison.id);
    const full = await livraisonModel.findById(livraison.id);
    res.status(201).json({ livraison: full });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('createLivraison error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function listLivraisons(req, res) {
  try {
    const { status, commercial_id, date_from, date_to, include_archived } = req.query;
    const filters = { status, date_from, date_to };
    if (include_archived === 'true') filters.include_archived = true;
    if (req.user.role === 'COMMERCIAL') filters.commercial_id = req.user.id;
    else if (req.user.role === 'ADMIN') filters.admin_id = req.user.id;
    if (req.user.role === 'SUPER_ADMIN' && commercial_id) filters.commercial_id = commercial_id;
    res.json({ livraisons: await livraisonModel.findAll(filters) });
  } catch (err) { console.error('listLivraisons error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function getLivraison(req, res) {
  try {
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (req.user.role === 'COMMERCIAL' && livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
    res.json({ livraison });
  } catch (err) { console.error('getLivraison error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function confirmSortie(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Votre mot de passe est requis pour confirmer.' });
    const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await verifyPassword(password, userRows[0].password_hash)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    const result = await livraisonModel.confirmSortie(req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });
    await notificationModel.create(result.livraison.admin_id, `Bon de sortie ${result.livraison.reference} confirmé par ${req.user.full_name}.`, result.livraison.id);
    res.json({ livraison: result.livraison, message: 'Bon de sortie confirmé.' });
  } catch (err) { console.error('confirmSortie error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function getSales(req, res) {
  try {
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.status !== 'EN_COURS') return res.status(400).json({ error: `Statut: ${livraison.status}.` });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Non assignée.' });
    const items = await livraisonModel.getSalesState(req.params.id);
    const ca_total = items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
    res.json({ items, ca_total: Number(ca_total.toFixed(3)) });
  } catch (err) { console.error('getSales error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function recordSale(req, res) {
  try {
    const { product_id, qte_vendue } = req.body;
    if (!product_id || qte_vendue === undefined || qte_vendue === null) return res.status(400).json({ error: 'Produit et quantité requis.' });
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.status !== 'EN_COURS') return res.status(400).json({ error: `Statut: ${livraison.status}.` });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Non assignée.' });
    const result = await livraisonModel.recordSales(req.params.id, product_id, qte_vendue);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { console.error('recordSale error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function syncOfflineSales(req, res) {
  try {
    const { sales } = req.body;
    if (!sales || !Array.isArray(sales) || sales.length === 0) return res.status(400).json({ error: 'Aucune vente.' });
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.status !== 'EN_COURS') return res.status(400).json({ error: `Statut: ${livraison.status}.` });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Non assignée.' });
    const result = await livraisonModel.syncSales(req.params.id, sales);
    if (result.error) return res.status(400).json({ error: result.error, item: result.item });
    res.json({ synced: result.results.length, ca_total: result.ca_total, message: `${result.results.length} vente(s) synchronisée(s).` });
  } catch (err) { console.error('syncOfflineSales error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function terminerLivraison(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });
    const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await verifyPassword(password, userRows[0].password_hash)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    const result = await livraisonModel.terminerLivraison(req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });
    await notificationModel.create(result.livraison.admin_id, `Livraison ${result.livraison.reference} de ${req.user.full_name} terminée. Retour en cours.`, result.livraison.id);
    const summary = result.livraison.items.map((item) => ({
      product_id: item.product_id, product_name: item.product_name, barcode: item.barcode,
      category: item.category,
      qte_chargee: item.qte_chargee, qte_vendue: item.qte_vendue, qte_retour: item.qte_chargee - item.qte_vendue,
      prix_ttc: item.prix_ttc, montant_vendu: Number((item.qte_vendue * Number(item.prix_ttc)).toFixed(3)),
    }));
    res.json({ livraison: result.livraison, summary, ca_total: result.ca_total, commission: result.commission, net_a_reverser: result.net_a_reverser, message: 'Livraison terminée.' });
  } catch (err) { console.error('terminerLivraison error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function confirmerRetour(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });
    const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await verifyPassword(password, userRows[0].password_hash)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    const result = await livraisonModel.confirmerRetour(req.params.id, req.user.id, req.user.role);
    if (result.error) return res.status(400).json({ error: result.error });
    const { livraison, bothConfirmed, ca_total, commission, net_a_reverser } = result;
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') await notificationModel.create(livraison.commercial_id, `L'Admin a confirmé le bon de retour ${livraison.reference}.`, livraison.id);
    else await notificationModel.create(livraison.admin_id, `Le Commercial ${req.user.full_name} a confirmé le bon de retour ${livraison.reference}.`, livraison.id);
    if (bothConfirmed) { await notificationModel.create(livraison.admin_id, `Livraison ${livraison.reference} clôturée.`, livraison.id); await notificationModel.create(livraison.commercial_id, `Livraison ${livraison.reference} clôturée.`, livraison.id); }
    res.json({ livraison, bothConfirmed, ca_total, commission, net_a_reverser, message: bothConfirmed ? 'Clôturée.' : 'Confirmation enregistrée. En attente de l\'autre partie.' });
  } catch (err) { console.error('confirmerRetour error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function downloadBonSortiePDF(req, res) {
  try {
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    const doc = pdfGenerator.generateBonDeSortie(livraison);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BonDeSortie_${livraison.reference}.pdf"`);
    doc.pipe(res); doc.end();
  } catch (err) { console.error('PDF error:', err); res.status(500).json({ error: 'Erreur PDF.' }); }
}

async function downloadBonRetourPDF(req, res) {
  try {
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    const doc = pdfGenerator.generateBonDeRetour(livraison);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BonDeRetour_${livraison.reference}.pdf"`);
    doc.pipe(res); doc.end();
  } catch (err) { console.error('PDF error:', err); res.status(500).json({ error: 'Erreur PDF.' }); }
}

async function downloadDossierPDF(req, res) {
  try {
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    const { rows: salesLog } = await pool.query(
      `SELECT ls.*, p.name AS product_name FROM livraison_sales_log ls JOIN products p ON ls.product_id = p.id WHERE ls.livraison_id = $1 ORDER BY ls.logged_at`,
      [req.params.id]
    );
    const doc = pdfGenerator.generateDossierComplet(livraison, salesLog);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Dossier_${livraison.reference}.pdf"`);
    doc.pipe(res); doc.end();
  } catch (err) { console.error('PDF error:', err); res.status(500).json({ error: 'Erreur PDF.' }); }
}

async function getDossier(req, res) {
  try {
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (req.user.role === 'COMMERCIAL' && livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
    const { rows: salesLog } = await pool.query(
      `SELECT ls.*, p.name AS product_name FROM livraison_sales_log ls JOIN products p ON ls.product_id = p.id WHERE ls.livraison_id = $1 ORDER BY ls.logged_at`,
      [req.params.id]
    );
    const ca_total = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
    const commission = Number((ca_total * COMMISSION_RATE).toFixed(3));
    const total_avances = (livraison.avances || [])
      .filter(a => a.status === 'ACCEPTE')
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const net_a_reverser = Number((ca_total - commission - total_avances).toFixed(3));
    const duration = livraison.closed_at ? Math.round((new Date(livraison.closed_at) - new Date(livraison.created_at)) / 3600000) : null;
    res.json({ dossier: { livraison, sales_log: salesLog, financials: { ca_total: Number(ca_total.toFixed(3)), commission, total_avances, net_a_reverser }, meta: { duration, is_locked: livraison.status === 'CLOTURE' } } });
  } catch (err) { console.error('getDossier error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function archiveLivraison(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });

    const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await verifyPassword(password, userRows[0].password_hash)) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    const archived = await livraisonModel.archiveLivraison(req.params.id);
    if (!archived) return res.status(404).json({ error: 'Livraison introuvable ou déjà archivée.' });

    res.json({ message: `Livraison ${archived.reference} archivée.`, archived });
  } catch (err) { console.error('archiveLivraison error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function demanderAnnulation(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });
    const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await verifyPassword(password, userRows[0].password_hash)) return res.status(401).json({ error: 'Mot de passe incorrect.' });

    const result = await livraisonModel.demanderAnnulation(req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });

    await notificationModel.create(result.livraison.admin_id, `Le commercial ${req.user.full_name} demande l'annulation de la livraison ${result.livraison.reference}.`, result.livraison.id);
    res.json({ livraison: result.livraison, message: `Demande d'annulation envoyée à l'admin.` });
  } catch (err) { console.error('demanderAnnulation error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function confirmerAnnulation(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });
    const { rows: userRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await verifyPassword(password, userRows[0].password_hash)) return res.status(401).json({ error: 'Mot de passe incorrect.' });

    const result = await livraisonModel.confirmerAnnulation(req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });

    await notificationModel.create(result.livraison.commercial_id, `L'admin ${req.user.full_name} a confirmé l'annulation de la livraison ${result.livraison.reference}.`, result.livraison.id);
    res.json({ livraison: result.livraison, message: 'Livraison annulée. Stock restauré.' });
  } catch (err) { console.error('confirmerAnnulation error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

// ============================================================
// REOPEN (Cloture → EN_COURS with admin confirmation)
// ============================================================

async function demanderReouverture(req, res) {
  try {
    const { reason } = req.body;

    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.status !== 'CLOTURE') return res.status(400).json({ error: 'Seules les livraisons clôturées peuvent être réouvertes.' });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Cette livraison ne vous est pas assignée.' });

    const log = await reopenLogModel.create(req.params.id, req.user.id, reason || null);

    await notificationModel.create(
      livraison.admin_id,
      `Le commercial ${req.user.full_name} demande la réouverture de la livraison ${livraison.reference}.${reason ? ' Motif : ' + reason : ''}`,
      livraison.id
    );

    res.status(201).json({ log, message: 'Demande de réouverture envoyée à l\'administrateur.' });
  } catch (err) {
    console.error('demanderReouverture error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function confirmerReouverture(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });

    const valid = await verifyPassword(req.user.id, password);
    if (!valid) return res.status(400).json({ error: 'Mot de passe incorrect.' });

    const result = await reopenLogModel.confirm(req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });

    const livraison = await livraisonModel.findById(req.params.id);
    await notificationModel.create(
      livraison.commercial_id,
      `L'admin ${req.user.full_name} a confirmé la réouverture de la livraison ${livraison.reference}.`,
      livraison.id
    );

    res.json({ livraison, message: 'Livraison réouverte avec succès.' });
  } catch (err) {
    console.error('confirmerReouverture error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ============================================================
// RETOUR CREATION (EN_COURS → CONFIRME with admin confirmation)
// ============================================================

async function demanderRetourCreation(req, res) {
  try {
    const { reason } = req.body;

    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.status !== 'EN_COURS') return res.status(400).json({ error: 'Seules les livraisons en cours peuvent être retournées à la création.' });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Cette livraison ne vous est pas assignée.' });

    // Update reason on the livraison row
    if (reason) {
      await pool.query('UPDATE livraisons SET return_reason = $2 WHERE id = $1', [req.params.id, reason]);
    }

    const log = await retourCreationLogModel.create(req.params.id, req.user.id, reason || null);

    await notificationModel.create(
      livraison.admin_id,
      `Le commercial ${req.user.full_name} demande le retour à la création de la livraison ${livraison.reference}.${reason ? ' Motif : ' + reason : ''}`,
      livraison.id
    );

    res.status(201).json({ log, message: 'Demande de retour à la création envoyée à l\'administrateur.' });
  } catch (err) {
    console.error('demanderRetourCreation error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function confirmerRetourCreation(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });

    const valid = await verifyPassword(req.user.id, password);
    if (!valid) return res.status(400).json({ error: 'Mot de passe incorrect.' });

    const result = await retourCreationLogModel.confirm(req.params.id, req.user.id);
    if (result.error) return res.status(400).json({ error: result.error });

    const livraison = await livraisonModel.findById(req.params.id);
    await notificationModel.create(
      livraison.commercial_id,
      `L'admin ${req.user.full_name} a confirmé le retour à la création de la livraison ${livraison.reference}.`,
      livraison.id
    );

    res.json({ message: 'Livraison retournée à la création avec succès.', livraison });
  } catch (err) {
    console.error('confirmerRetourCreation error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ============================================================
// AVANCES (advance payment declarations)
// ============================================================

async function declarerAvance(req, res) {
  try {
    const { amount, payment_method, image_base64 } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'Veuillez entrer un montant valide.' });

    const VALID_METHODS = ['WAFA_CASH', 'IZI_CASH', 'VERSEMENT', 'ESPECES'];
    if (payment_method && !VALID_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'Méthode de paiement invalide.' });
    }

    // Verify livraison is in an allowed status and assigned to this commercial
    // Avances are payment justifications — allowed from CONFIRME through CLOTURE
    const ALLOWED_STATUSES = ['CONFIRME', 'EN_COURS', 'EN_RETOUR', 'CLOTURE'];
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (!ALLOWED_STATUSES.includes(livraison.status)) return res.status(400).json({ error: 'Les avances ne peuvent être déclarées que sur une livraison confirmée, en cours, en retour ou clôturée.' });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Cette livraison ne vous est pas assignée.' });

    const avance = await avanceModel.create(req.params.id, req.user.id, Number(amount), payment_method || 'ESPECES', image_base64 || null);

    await notificationModel.create(livraison.admin_id, `Le commercial ${req.user.full_name} a déclaré une avance de ${Number(amount).toFixed(3)} DT pour la livraison ${livraison.reference}.`, livraison.id);

    res.status(201).json({ avance, message: 'Avance déclarée avec succès.' });
  } catch (err) { console.error('declarerAvance error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function getAvances(req, res) {
  try {
    const avances = await avanceModel.findByLivraison(req.params.id);
    res.json({ avances });
  } catch (err) { console.error('getAvances error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function accepterAvance(req, res) {
  try {
    const avance = await avanceModel.accepter(req.params.avanceId, req.user.id);
    if (!avance) return res.status(404).json({ error: 'Avance introuvable ou déjà traitée.' });

    const livraison = await livraisonModel.findById(req.params.id);
    await notificationModel.create(avance.commercial_id, `L'admin ${req.user.full_name} a accepté votre avance de ${Number(avance.amount).toFixed(3)} DT pour la livraison ${livraison.reference}.`, livraison.id);

    res.json({ avance, message: 'Avance acceptée.' });
  } catch (err) { console.error('accepterAvance error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function refuserAvance(req, res) {
  try {
    const { note } = req.body;
    const avance = await avanceModel.refuser(req.params.avanceId, req.user.id, note || null);
    if (!avance) return res.status(404).json({ error: 'Avance introuvable ou déjà traitée.' });

    const livraison = await livraisonModel.findById(req.params.id);
    await notificationModel.create(avance.commercial_id, `L'admin ${req.user.full_name} a refusé votre avance de ${Number(avance.amount).toFixed(3)} DT pour la livraison ${livraison.reference}.`, livraison.id);

    res.json({ avance, message: 'Avance refusée.' });
  } catch (err) { console.error('refuserAvance error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
}

async function modifierAvancePaiement(req, res) {
  try {
    const { payment_method } = req.body;
    const VALID_METHODS = ['WAFA_CASH', 'IZI_CASH', 'VERSEMENT', 'ESPECES'];
    if (!payment_method || !VALID_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'Méthode de paiement invalide.' });
    }
    const avance = await avanceModel.updatePaymentMethod(req.params.avanceId, payment_method);
    if (!avance) return res.status(404).json({ error: 'Avance introuvable.' });
    res.json({ avance, message: 'Mode de paiement mis à jour.' });
  } catch (err) {
    console.error('modifierAvancePaiement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function realtimeData(req, res) {
  try {
    const data = await livraisonModel.getRealtimeData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Livraison introuvable.' });
    res.json(data);
  } catch (err) {
    console.error('realtimeData error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ═══════════════════════════════════════════════
// ECARTS (discrepancy declarations)
// ═══════════════════════════════════════════════

async function declarerEcart(req, res) {
  try {
    const { amount, justification } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (!justification || !justification.trim()) return res.status(400).json({ error: 'La justification est obligatoire.' });

    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });

    const ecart = await ecartModel.create({
      livraison_id: req.params.id,
      amount: parseFloat(amount),
      justification: justification.trim(),
      declared_by: req.user.id,
    });

    // Notify the commercial
    await notificationModel.create(
      livraison.commercial_id,
      `Un ecart de ${Number(ecart.amount).toFixed(3)} DT a ete declare sur la livraison ${livraison.reference}. Veuillez le confirmer.`,
      livraison.id
    );

    const full = await ecartModel.findById(ecart.id);
    res.status(201).json({ ecart: full, message: 'Ecart declare avec succes.' });
  } catch (err) {
    console.error('declarerEcart error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function listEcarts(req, res) {
  try {
    const ecarts = await ecartModel.findByLivraison(req.params.id);
    res.json({ ecarts });
  } catch (err) {
    console.error('listEcarts error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function confirmerEcart(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });

    const ecart = await ecartModel.findById(req.params.ecartId);
    if (!ecart) return res.status(404).json({ error: 'Ecart introuvable.' });
    if (ecart.status !== 'PENDING') return res.status(400).json({ error: 'Cet ecart a deja ete traite.' });

    // Verify the commercial is assigned to this livraison
    const livraison = await livraisonModel.findById(ecart.livraison_id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Cet ecart ne vous concerne pas.' });

    // Verify password
    const { rows: [userRow] } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1', [req.user.id]
    );
    if (!userRow) return res.status(401).json({ error: 'Utilisateur introuvable.' });
    const valid = await verifyPassword(password, userRow.password_hash);
    if (!valid) return res.status(403).json({ error: 'Mot de passe incorrect.' });

    const confirmed = await ecartModel.confirm(req.params.ecartId, req.user.id);
    if (!confirmed) return res.status(400).json({ error: 'Impossible de confirmer cet ecart.' });

    res.json({ ecart: confirmed, message: 'Ecart confirme avec succes.' });
  } catch (err) {
    console.error('confirmerEcart error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function requestPaymentEcart(req, res) {
  try {
    const ecart = await ecartModel.findById(req.params.ecartId);
    if (!ecart) return res.status(404).json({ error: 'Ecart introuvable.' });
    if (ecart.status !== 'CONFIRMED') return res.status(400).json({ error: 'Cet ecart doit d\'abord etre confirme.' });

    const livraison = await livraisonModel.findById(ecart.livraison_id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Cet ecart ne vous concerne pas.' });

    const updated = await ecartModel.requestPayment(req.params.ecartId, req.user.id);
    if (!updated) return res.status(400).json({ error: 'Impossible de demander le paiement de cet ecart.' });

    // Notify the admin
    await notificationModel.create(
      livraison.admin_id,
      `Le commercial ${req.user.full_name} a marque l'ecart de ${Number(ecart.amount).toFixed(3)} DT comme paye sur la livraison ${livraison.reference}. Veuillez confirmer la reception.`,
      livraison.id
    );

    const full = await ecartModel.findById(req.params.ecartId);
    res.json({ ecart: full, message: 'Demande de paiement envoyee a l\'admin.' });
  } catch (err) {
    console.error('requestPaymentEcart error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function confirmPaymentEcart(req, res) {
  try {
    const ecart = await ecartModel.findById(req.params.ecartId);
    if (!ecart) return res.status(404).json({ error: 'Ecart introuvable.' });
    if (ecart.status !== 'PAYMENT_REQUESTED') return res.status(400).json({ error: 'Aucune demande de paiement en attente pour cet ecart.' });

    const livraison = await livraisonModel.findById(ecart.livraison_id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });

    const updated = await ecartModel.confirmPayment(req.params.ecartId, req.user.id);
    if (!updated) return res.status(400).json({ error: 'Impossible de confirmer le paiement de cet ecart.' });

    // Notify the commercial
    await notificationModel.create(
      livraison.commercial_id,
      `L'admin ${req.user.full_name} a confirme la reception du paiement de l'ecart de ${Number(ecart.amount).toFixed(3)} DT sur la livraison ${livraison.reference}.`,
      livraison.id
    );

    const full = await ecartModel.findById(req.params.ecartId);
    res.json({ ecart: full, message: 'Paiement de l\'ecart confirme avec succes.' });
  } catch (err) {
    console.error('confirmPaymentEcart error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { createLivraison, listLivraisons, getLivraison, confirmSortie, getSales, recordSale, syncOfflineSales, terminerLivraison, confirmerRetour, downloadBonSortiePDF, downloadBonRetourPDF, downloadDossierPDF, getDossier, archiveLivraison, demanderAnnulation, confirmerAnnulation, demanderReouverture, confirmerReouverture, demanderRetourCreation, confirmerRetourCreation, declarerAvance, getAvances, accepterAvance, refuserAvance, modifierAvancePaiement, realtimeData, declarerEcart, listEcarts, confirmerEcart, requestPaymentEcart, confirmPaymentEcart };
