const { getGlobalBenefits, getProductBenefits, getStockValuation, getCommercialSales } = require('../models/benefit');
const userModel = require('../models/user');
const pdfGenerator = require('../services/pdfGenerator');
const { signDownloadToken } = require('../utils/jwt');
const { quarterRangeError } = require('../utils/quarterRange');

const REPORT_TOKEN_SCOPE = 'report';
const REPORT_ROW_LIMIT = 100000;

// Never cost, benefit or margin: sorting on them would reveal their order
const SALES_STATS_SORTS = ['id', 'name', 'category', 'selling_price_ttc', 'total_sold', 'ca'];

async function getBenefits(req, res) {
  try {
    const {
      category, search, date_from, date_to,
      sort_by = 'benefit', sort_dir = 'desc',
      page = '1', limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const filters = {
      category: category || null,
      search: search || null,
      date_from: date_from || null,
      date_to: date_to || null,
      commercial_id: req.query.commercial_id || null,
    };

    // Run queries in parallel. Stock valuation is a live snapshot — it does
    // NOT take the date range (unlike the profit KPIs).
    const [global, productData, stockVal] = await Promise.all([
      getGlobalBenefits({ date_from: filters.date_from, date_to: filters.date_to, commercial_id: filters.commercial_id }),
      getProductBenefits({
        ...filters,
        sort_by, sort_dir,
        page: pageNum, limit: limitNum,
      }),
      getStockValuation(),
    ]);

    res.json({
      global: {
        ca_total: Number(global.ca_total),
        benefit_gross: Number(global.benefit_gross),
        prelevement_total: Number(global.prelevement_total),
        ecart_total: Number(global.ecart_total),
        stock_purchase_total: Number(global.stock_purchase_total),
        commission_total: Number(global.commission_total),
        benefit_net: Number(global.benefit_net),
        margin_avg: Number(global.margin_avg),
        profitable_count: global.profitable_count,
      },
      stock: {
        depot_ca: Number(stockVal.depot_ca),
        charge_ca: Number(stockVal.charge_ca),
        total_ca: Number(stockVal.depot_ca) + Number(stockVal.charge_ca),
      },
      products: productData.products.map((p) => ({
        id: p.id,
        barcode: p.barcode,
        name: p.name,
        category: p.category || null,
        purchase_price: Number(p.purchase_price),
        selling_price_ttc: Number(p.selling_price_ttc),
        total_sold: p.total_sold,
        ca: Number(p.ca),
        cost: Number(p.cost),
        benefit: Number(p.benefit),
        margin_pct: Number(p.margin_pct),
      })),
      total: productData.total,
      totals: productData.totals,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error('[benefits] getBenefits error:', err.message);
    res.status(500).json({ error: 'Erreur lors du chargement des bénéfices.' });
  }
}

/**
 * GET /api/benefits/sales-stats
 * Sales by product, by commercial and by product for one commercial.
 * Open to DIRECTEUR_COMMERCIAL: fields are listed one by one so that purchase
 * prices, costs, benefits, margins and stock valuation can never be returned.
 */
async function getSalesStats(req, res) {
  try {
    const {
      category, search, date_from, date_to, commercial_id,
      sort_by = 'ca', sort_dir = 'desc',
      page = '1', limit = '50',
    } = req.query;

    const rangeError = quarterRangeError(req.user.role, date_from, date_to);
    if (rangeError) return res.status(400).json({ error: rangeError });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const [productData, commercials] = await Promise.all([
      getProductBenefits({
        category: category || null,
        search: search || null,
        date_from: date_from || null,
        date_to: date_to || null,
        commercial_id: commercial_id || null,
        sort_by: SALES_STATS_SORTS.includes(sort_by) ? sort_by : 'ca',
        sort_dir,
        page: pageNum, limit: limitNum,
      }),
      getCommercialSales({ date_from: date_from || null, date_to: date_to || null }),
    ]);

    res.json({
      products: productData.products.map((p) => ({
        id: p.id,
        barcode: p.barcode,
        name: p.name,
        category: p.category || null,
        selling_price_ttc: Number(p.selling_price_ttc),
        total_sold: p.total_sold,
        ca: Number(p.ca),
      })),
      commercials: commercials.map((c) => ({
        id: c.id,
        full_name: c.full_name,
        livraisons: c.livraisons,
        total_sold: c.total_sold,
        ca: Number(c.ca),
      })),
      total: productData.total,
      totals: { total_sold: productData.totals.total_sold, ca: productData.totals.ca },
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error('[benefits] getSalesStats error:', err.message);
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques.' });
  }
}

/**
 * GET /api/benefits/report-token
 * Short-lived token so a report can open in a new tab.
 */
function getReportToken(req, res) {
  res.json({ token: signDownloadToken(req.user.id, REPORT_TOKEN_SCOPE) });
}

function reportFilters(query) {
  return {
    category: query.category || null,
    search: query.search || null,
    date_from: query.date_from || null,
    date_to: query.date_to || null,
    commercial_id: query.commercial_id || null,
  };
}

async function commercialNameOf(id) {
  if (!id) return null;
  const user = await userModel.findById(id);
  return user ? user.full_name : null;
}

function sendReport(res, doc, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}-${new Date().toISOString().slice(0, 10)}.pdf"`);
  doc.pipe(res);
  doc.end();
}

/**
 * GET /api/benefits/report/pdf — SUPER_ADMIN
 */
async function downloadBenefitsReport(req, res) {
  try {
    const filters = reportFilters(req.query);
    const [global, productData, stock, commercialName] = await Promise.all([
      getGlobalBenefits({ date_from: filters.date_from, date_to: filters.date_to, commercial_id: filters.commercial_id }),
      getProductBenefits({ ...filters, sort_by: 'ca', sort_dir: 'desc', page: 1, limit: REPORT_ROW_LIMIT }),
      getStockValuation(),
      commercialNameOf(filters.commercial_id),
    ]);

    const doc = pdfGenerator.generateBenefitsReport({
      ...filters,
      commercialName,
      generatedBy: req.user.full_name,
      global,
      stock,
      products: productData.products,
      totals: productData.totals,
    });
    sendReport(res, doc, 'Rapport-Benefices');
  } catch (err) {
    console.error('[benefits] downloadBenefitsReport error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport.' });
  }
}

/**
 * GET /api/benefits/sales-stats/report/pdf — SUPER_ADMIN, DIRECTEUR_COMMERCIAL
 * Same safe fields as getSalesStats: no cost, benefit, margin or stock valuation.
 */
async function downloadSalesReport(req, res) {
  try {
    const filters = reportFilters(req.query);
    const rangeError = quarterRangeError(req.user.role, filters.date_from, filters.date_to);
    if (rangeError) return res.status(400).json({ error: rangeError });

    const [productData, commercials, commercialName] = await Promise.all([
      getProductBenefits({ ...filters, sort_by: 'ca', sort_dir: 'desc', page: 1, limit: REPORT_ROW_LIMIT }),
      getCommercialSales({ date_from: filters.date_from, date_to: filters.date_to }),
      commercialNameOf(filters.commercial_id),
    ]);

    const doc = pdfGenerator.generateSalesReport({
      ...filters,
      commercialName,
      generatedBy: req.user.full_name,
      products: productData.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || null,
        selling_price_ttc: Number(p.selling_price_ttc),
        total_sold: p.total_sold,
        ca: Number(p.ca),
      })),
      commercials: commercials.map((c) => ({
        full_name: c.full_name,
        livraisons: c.livraisons,
        total_sold: c.total_sold,
        ca: Number(c.ca),
      })),
      totals: { total_sold: productData.totals.total_sold, ca: productData.totals.ca },
    });
    sendReport(res, doc, 'Rapport-Statistiques');
  } catch (err) {
    console.error('[benefits] downloadSalesReport error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport.' });
  }
}

module.exports = { getBenefits, getSalesStats, getReportToken, downloadBenefitsReport, downloadSalesReport, REPORT_TOKEN_SCOPE };
