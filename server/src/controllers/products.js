const { validationResult } = require('express-validator');
const productModel = require('../models/product');

/**
 * GET /api/products
 * Query: ?category=Biscuits&is_active=true&search=kak
 */
async function listProducts(req, res) {
  try {
    const { category, is_active, search } = req.query;
    const products = await productModel.findAll({ category, is_active, search });
    res.json({ products });
  } catch (err) {
    console.error('listProducts error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/products/categories
 */
async function listCategories(req, res) {
  try {
    const categories = await productModel.getCategories();
    res.json({ categories });
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/products/:id
 */
async function getProduct(req, res) {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    res.json({ product });
  } catch (err) {
    console.error('getProduct error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * POST /api/products
 */
async function createProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { barcode, name, category, purchase_price, selling_price_ttc } = req.body;

    // Check barcode uniqueness
    const existing = await productModel.findByBarcode(barcode);
    if (existing) {
      return res.status(409).json({ error: 'Un produit avec ce code-barres existe déjà.' });
    }

    const product = await productModel.create({
      barcode,
      name,
      category,
      purchase_price,
      selling_price_ttc,
    });

    res.status(201).json({ product });
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * PUT /api/products/:id
 */
async function updateProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const target = await productModel.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    // If barcode is being changed, check uniqueness
    if (req.body.barcode && req.body.barcode !== target.barcode) {
      const existing = await productModel.findByBarcode(req.body.barcode);
      if (existing) {
        return res.status(409).json({ error: 'Un produit avec ce code-barres existe déjà.' });
      }
    }

    const fields = {};
    if (req.body.barcode !== undefined) fields.barcode = req.body.barcode;
    if (req.body.name !== undefined) fields.name = req.body.name;
    if (req.body.category !== undefined) fields.category = req.body.category;
    if (req.body.purchase_price !== undefined) fields.purchase_price = req.body.purchase_price;
    if (req.body.selling_price_ttc !== undefined) fields.selling_price_ttc = req.body.selling_price_ttc;
    if (req.body.is_active !== undefined) fields.is_active = req.body.is_active;

    const updated = await productModel.update(id, fields);
    res.json({ product: updated });
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * DELETE /api/products/:id — archive (set is_active=false)
 */
async function archiveProduct(req, res) {
  try {
    const { id } = req.params;
    const target = await productModel.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    const archived = await productModel.archive(id);
    res.json({ product: archived, message: 'Produit archivé avec succès.' });
  } catch (err) {
    console.error('archiveProduct error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { listProducts, listCategories, getProduct, createProduct, updateProduct, archiveProduct };
