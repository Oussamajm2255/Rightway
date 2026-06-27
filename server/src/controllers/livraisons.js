const livraisonModel = require('../models/livraison');
const avanceModel = require('../models/livraisonAvance');
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
      const { rows: stockRows } = await pool.query('SELECT quantity FROM depot_stock WHERE product_id = $1', [item.product_id]);
      const available = stockRows.length > 0 ? stockRows[0].quantity : 0;
      if (item.qte_chargee > available) {
        const { rows: prodRows } = await pool.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
        const pname = prodRows.length > 0 ? prodRows[0].name : item.product_id;
        return res.status(400).json({ error: `Stock insuffisant pour "${pname}". Disponible: ${available}, Demandé: ${item.qte_chargee}.` });
      }
      const { rows: priceRows } = await pool.query('SELECT selling_price_ttc FROM products WHERE id = $1', [item.product_id]);
      if (priceRows.length === 0) return res.status(400).json({ error: `Produit ${item.product_id} introuvable.` });
      item.prix_ttc = priceRows[0].selling_price_ttc;
    }
    const livraison = await livraisonModel.create({ commercial_id, admin_id: req.user.id, items });
    await notificationModel.create(commercial_id, `Nouveau bon de sortie ${livraison.reference} en attente de votre confirmation.`, livraison.id);
    const full = await livraisonModel.findById(livraison.id);
    res.status(201).json({ livraison: full });
  } catch (err) { console.error('createLivraison error:', err); res.status(500).json({ error: 'Erreur interne du serveur' }); }
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
    const results = await livraisonModel.syncSales(req.params.id, sales);
    const { rows: caRows } = await pool.query('SELECT SUM(qte_vendue * prix_ttc)::NUMERIC(10,3) AS ca_total FROM livraison_items WHERE livraison_id = $1', [req.params.id]);
    res.json({ synced: results.length, ca_total: Number(caRows[0].ca_total || 0), message: `${results.length} vente(s) synchronisée(s).` });
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
    const net_a_reverser = Number((ca_total - commission).toFixed(3));
    const duration = livraison.closed_at ? Math.round((new Date(livraison.closed_at) - new Date(livraison.created_at)) / 3600000) : null;
    res.json({ dossier: { livraison, sales_log: salesLog, financials: { ca_total: Number(ca_total.toFixed(3)), commission, net_a_reverser }, meta: { duration, is_locked: livraison.status === 'CLOTURE' } } });
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
// AVANCES (advance payment declarations)
// ============================================================

async function declarerAvance(req, res) {
  try {
    const { amount, image_base64 } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'Veuillez entrer un montant valide.' });

    // Verify livraison is EN_COURS and assigned to this commercial
    const livraison = await livraisonModel.findById(req.params.id);
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable.' });
    if (livraison.status !== 'EN_COURS') return res.status(400).json({ error: 'Les avances ne peuvent être déclarées que sur une livraison en cours.' });
    if (livraison.commercial_id !== req.user.id) return res.status(403).json({ error: 'Cette livraison ne vous est pas assignée.' });

    const avance = await avanceModel.create(req.params.id, req.user.id, Number(amount), image_base64 || null);

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

module.exports = { createLivraison, listLivraisons, getLivraison, confirmSortie, getSales, recordSale, syncOfflineSales, terminerLivraison, confirmerRetour, downloadBonSortiePDF, downloadBonRetourPDF, downloadDossierPDF, getDossier, archiveLivraison, demanderAnnulation, confirmerAnnulation, declarerAvance, getAvances, accepterAvance, refuserAvance, realtimeData };
