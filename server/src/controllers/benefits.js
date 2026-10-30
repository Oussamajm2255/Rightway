const { getGlobalBenefits, getProductBenefits, getStockValuation, getCommercialSales } = require('../models/benefit');

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

module.exports = { getBenefits, getSalesStats };
