const { getGlobalBenefits, getProductBenefits } = require('../models/benefit');

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
    };

    // Run both queries in parallel
    const [global, productData] = await Promise.all([
      getGlobalBenefits({ date_from: filters.date_from, date_to: filters.date_to }),
      getProductBenefits({
        ...filters,
        sort_by, sort_dir,
        page: pageNum, limit: limitNum,
      }),
    ]);

    res.json({
      global: {
        ca_total: Number(global.ca_total),
        benefit_gross: Number(global.benefit_gross),
        prelevement_total: Number(global.prelevement_total),
        ecart_total: Number(global.ecart_total),
        benefit_net: Number(global.benefit_net),
        margin_avg: Number(global.margin_avg),
        profitable_count: global.profitable_count,
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
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error('[benefits] getBenefits error:', err.message);
    res.status(500).json({ error: 'Erreur lors du chargement des bénéfices.' });
  }
}

module.exports = { getBenefits };
