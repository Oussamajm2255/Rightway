const PdfPrinter = require('pdfmake');
const { COMMISSION_RATE } = require('../models/livraison');

const COMPANY = {
  name: 'Right Way',
  fullName: 'STE RIGHT WAY FOR TRADING',
  mf: 'MF: 1826056/P/N/M/000',
  address: '29 Rue de Palestine, 1002 Tunis',
};

const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

function formatDT(value) {
  return Number(value).toFixed(3) + ' DT';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Shared company header for all PDFs */
function companyHeader() {
  return [
    { text: COMPANY.name, style: 'companyName', alignment: 'center' },
    { text: COMPANY.fullName, style: 'companySub', alignment: 'center' },
    { text: [COMPANY.mf, '  |  ', COMPANY.address], style: 'companyInfo', alignment: 'center' },
    { text: '', margin: [0, 5] },
  ];
}

/** Shared styles */
function getStyles() {
  return {
    companyName: { fontSize: 16, bold: true, color: '#1a3c34', margin: [0, 0, 0, 2] },
    companySub: { fontSize: 9, color: '#6c757d', margin: [0, 0, 0, 1] },
    companyInfo: { fontSize: 7, color: '#6c757d', margin: [0, 0, 0, 4] },
    docTitle: { fontSize: 13, bold: true, margin: [0, 10, 0, 6], alignment: 'center', color: '#1a3c34' },
    sectionTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 4], color: '#1a3c34' },
    tableHeader: { fontSize: 8, bold: true, fillColor: '#f8f9fa', color: '#333' },
    tableCell: { fontSize: 8, color: '#333' },
    tableCellRight: { fontSize: 8, color: '#333', alignment: 'right' },
    tableFooter: { fontSize: 8, bold: true, fillColor: '#f8f9fa' },
    metaText: { fontSize: 8, color: '#555', margin: [0, 1] },
    label: { fontSize: 8, bold: true, color: '#555' },
    value: { fontSize: 8, color: '#333' },
    confirmationBlock: { fontSize: 8, color: '#555', margin: [0, 4], italics: true },
    footer: { fontSize: 7, color: '#aaa', alignment: 'center', margin: [0, 10, 0, 0] },
  };
}

function pageFooter(currentPage, pageCount) {
  return { text: `Page ${currentPage} / ${pageCount}`, style: 'footer' };
}

/** Build a standard table from columns and rows */
function buildTable(headers, rows, colWidths) {
  return {
    table: {
      headerRows: 1,
      widths: colWidths || headers.map(() => '*'),
      body: [
        headers.map((h) => ({ text: h, style: 'tableHeader' })),
        ...rows,
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#ddd',
      vLineColor: () => '#ddd',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

// ============================================================
// BON DE SORTIE
// ============================================================
function generateBonDeSortie(livraison) {
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 30, 36, 30],
    styles: getStyles(),
    header: (currentPage) => currentPage > 1 ? { columns: companyHeader() } : null,
    footer: pageFooter,
    content: [
      ...companyHeader(),
      { text: 'BON DE SORTIE', style: 'docTitle' },

      // Meta
      { columns: [
        { width: '50%', stack: [
          { text: [{ text: 'Référence: ', style: 'label' }, { text: livraison.reference, style: 'value' }] },
          { text: [{ text: 'Date: ', style: 'label' }, { text: formatDate(livraison.created_at), style: 'value' }] },
        ]},
        { width: '50%', stack: [
          { text: [{ text: 'Commercial: ', style: 'label' }, { text: livraison.commercial_name, style: 'value' }] },
          { text: [{ text: 'Véhicule: ', style: 'label' }, { text: `${livraison.vehicle_name} — ${livraison.vehicle_plate}`, style: 'value' }] },
          { text: [{ text: 'Créé par: ', style: 'label' }, { text: livraison.admin_name, style: 'value' }] },
        ]},
      ], margin: [0, 0, 0, 8] },

      // Items table
      { text: 'Produits chargés', style: 'sectionTitle' },
      buildTable(
        ['Code', 'Code-barres', 'Catégorie', 'Produit', 'Qté', 'PU TTC'],
        livraison.items.map((item) => [
          { text: item.product_id, style: 'tableCell' },
          { text: item.barcode, style: 'tableCell' },
          { text: item.category || '', style: 'tableCell' },
          { text: item.product_name, style: 'tableCell' },
          { text: String(item.qte_chargee), style: 'tableCellRight' },
          { text: formatDT(item.prix_ttc), style: 'tableCellRight' },
        ]),
        ['auto', 'auto', 'auto', '*', 'auto', 'auto']
      ),

      { text: '', margin: [0, 15] },
      { text: 'Cachet de l\'entreprise', style: 'metaText', alignment: 'right' },
    ],
  };

  return printer.createPdfKitDocument(docDefinition);
}

// ============================================================
// BON DE RETOUR
// ============================================================
function generateBonDeRetour(livraison) {
  const ca = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
  const commission = Number((ca * COMMISSION_RATE).toFixed(3));
  const net = Number((ca - commission).toFixed(3));
  const totalAvances = (livraison.avances || [])
    .filter(a => a.status === 'ACCEPTE')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const resteAPayer = Number((net - totalAvances).toFixed(3));

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 30, 36, 30],
    styles: getStyles(),
    header: (currentPage) => currentPage > 1 ? { columns: companyHeader() } : null,
    footer: pageFooter,
    content: [
      ...companyHeader(),
      { text: 'BON DE RETOUR', style: 'docTitle' },

      { columns: [
        { width: '50%', stack: [
          { text: [{ text: 'Référence: ', style: 'label' }, { text: livraison.reference, style: 'value' }] },
          { text: [{ text: 'Date sortie: ', style: 'label' }, { text: formatDate(livraison.created_at), style: 'value' }] },
          { text: [{ text: 'Date retour: ', style: 'label' }, { text: formatDate(livraison.end_declared_at || livraison.closed_at), style: 'value' }] },
        ]},
        { width: '50%', stack: [
          { text: [{ text: 'Commercial: ', style: 'label' }, { text: livraison.commercial_name, style: 'value' }] },
          { text: [{ text: 'Véhicule: ', style: 'label' }, { text: `${livraison.vehicle_name} — ${livraison.vehicle_plate}`, style: 'value' }] },
        ]},
      ], margin: [0, 0, 0, 8] },

      { text: 'Détail du retour', style: 'sectionTitle' },
      buildTable(
        ['Code', 'Catégorie', 'Article', 'Qté Sortie', 'Qté Vendue', 'Qté Retour', 'PU TTC', 'Montant Vendu'],
        livraison.items.map((item) => {
          const retour = item.qte_chargee - item.qte_vendue;
          return [
            { text: item.product_id, style: 'tableCell' },
            { text: item.category || '', style: 'tableCell' },
            { text: item.product_name, style: 'tableCell' },
            { text: String(item.qte_chargee), style: 'tableCellRight' },
            { text: String(item.qte_vendue), style: 'tableCellRight' },
            { text: String(retour), style: 'tableCellRight' },
            { text: formatDT(item.prix_ttc), style: 'tableCellRight' },
            { text: formatDT(item.qte_vendue * Number(item.prix_ttc)), style: 'tableCellRight' },
          ];
        }),
        ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto']
      ),

      { text: '', margin: [0, 6] },

      // Financial summary
      { columns: [
        { width: '*', text: '' },
        { width: 'auto', stack: [
          { text: [{ text: 'Total CA: ', bold: true }, formatDT(ca)], style: 'tableCell', margin: [0, 2] },
          { text: [{ text: `Commission (${Math.round(COMMISSION_RATE * 100)}%): ` }, formatDT(commission)], style: 'tableCell', margin: [0, 2] },
          { text: [{ text: 'Net à reverser: ', bold: true }, formatDT(net)], style: 'tableCell', margin: [0, 2] },
          ...(totalAvances > 0 ? [
            { text: [{ text: 'Avances acceptées: ' }, formatDT(totalAvances)], style: 'tableCell', margin: [4, 2, 0, 2], color: '#1a3c34' },
            { text: [{ text: 'Reste à payer: ', bold: true }, formatDT(resteAPayer)], style: 'tableCell', margin: [0, 2] },
          ] : []),
        ]},
      ]},

      { text: '', margin: [0, 12] },

      // Confirmation block
      { text: 'Confirmations', style: 'sectionTitle' },
      { columns: [
        { width: '50%', stack: [
          { text: 'Confirmé par l\'Admin', style: 'confirmationBlock' },
          { text: livraison.retour_confirmed_by_admin_at ? `Le ${formatDate(livraison.retour_confirmed_by_admin_at)}` : 'En attente', style: 'metaText' },
        ]},
        { width: '50%', stack: [
          { text: 'Confirmé par le Commercial', style: 'confirmationBlock' },
          { text: livraison.retour_confirmed_by_commercial_at ? `Le ${formatDate(livraison.retour_confirmed_by_commercial_at)}` : 'En attente', style: 'metaText' },
        ]},
      ]},

      { text: '', margin: [0, 15] },
      { text: 'Cachet de l\'entreprise', style: 'metaText', alignment: 'right' },
    ],
  };

  return printer.createPdfKitDocument(docDefinition);
}

// ============================================================
// DOSSIER COMPLET
// ============================================================
function generateDossierComplet(livraison, salesLog) {
  const ca = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
  const commission = Number((ca * COMMISSION_RATE).toFixed(3));
  const net = Number((ca - commission).toFixed(3));
  const totalAvances = (livraison.avances || [])
    .filter(a => a.status === 'ACCEPTE')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const resteAPayer = Number((net - totalAvances).toFixed(3));
  const duration = livraison.closed_at
    ? Math.round((new Date(livraison.closed_at) - new Date(livraison.created_at)) / 3600000)
    : null;

  const content = [
    ...companyHeader(),
    { text: 'DOSSIER DE LIVRAISON', style: 'docTitle' },
    { text: `Référence: ${livraison.reference}`, style: 'docTitle', fontSize: 10, margin: [0, 0, 0, 8] },

    // Metadata
    { text: 'Informations générales', style: 'sectionTitle' },
    { columns: [
      { width: '50%', stack: [
        { text: [{ text: 'Commercial: ', style: 'label' }, livraison.commercial_name] },
        { text: [{ text: 'Véhicule: ', style: 'label' }, `${livraison.vehicle_name} — ${livraison.vehicle_plate}`] },
        { text: [{ text: 'Admin: ', style: 'label' }, livraison.admin_name] },
      ]},
      { width: '50%', stack: [
        { text: [{ text: 'Date sortie: ', style: 'label' }, formatDate(livraison.created_at)] },
        { text: [{ text: 'Date retour: ', style: 'label' }, formatDate(livraison.closed_at || livraison.end_declared_at)] },
        duration ? { text: [{ text: 'Durée: ', style: 'label' }, `${duration}h`] } : {},
      ]},
    ], margin: [0, 0, 0, 10] },

    // Bon de Sortie items
    { text: '1. Bon de Sortie — Produits chargés', style: 'sectionTitle' },
    buildTable(
      ['Code', 'Catégorie', 'Produit', 'Qté Chargée', 'PU TTC'],
      livraison.items.map((item) => [
        { text: item.product_id, style: 'tableCell' },
        { text: item.category || '', style: 'tableCell' },
        { text: item.product_name, style: 'tableCell' },
        { text: String(item.qte_chargee), style: 'tableCellRight' },
        { text: formatDT(item.prix_ttc), style: 'tableCellRight' },
      ]),
      ['auto', 'auto', '*', 'auto', 'auto']
    ),

    // Sales log
    salesLog && salesLog.length > 0 ? { text: '2. Journal des ventes', style: 'sectionTitle' } : {},
    salesLog && salesLog.length > 0 ? buildTable(
      ['Date/Heure', 'Produit', 'Delta', 'Cumul'],
      salesLog.map((log) => [
        { text: formatDate(log.logged_at), style: 'tableCell' },
        { text: log.product_name || log.product_id, style: 'tableCell' },
        { text: (log.delta > 0 ? '+' : '') + log.delta, style: 'tableCellRight' },
        { text: String(log.cumul || ''), style: 'tableCellRight' },
      ]),
      ['auto', '*', 'auto', 'auto']
    ) : {},

    { text: '', margin: [0, 6] },

    // Bon de Retour
    { text: '3. Bon de Retour', style: 'sectionTitle' },
    buildTable(
      ['Code', 'Catégorie', 'Article', 'Qté Sortie', 'Qté Vendue', 'Qté Retour', 'Montant Vendu'],
      livraison.items.map((item) => {
        const retour = item.qte_chargee - item.qte_vendue;
        return [
          { text: item.product_id, style: 'tableCell' },
          { text: item.category || '', style: 'tableCell' },
          { text: item.product_name, style: 'tableCell' },
          { text: String(item.qte_chargee), style: 'tableCellRight' },
          { text: String(item.qte_vendue), style: 'tableCellRight' },
          { text: String(retour), style: 'tableCellRight' },
          { text: formatDT(item.qte_vendue * Number(item.prix_ttc)), style: 'tableCellRight' },
        ];
      }),
      ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto']
    ),

    { text: '', margin: [0, 8] },

    // Financial summary
    { text: '4. Résumé financier', style: 'sectionTitle' },
    { columns: [
      { width: '*', text: '' },
      { width: 'auto', stack: [
        { text: [{ text: 'CA Total: ', bold: true }, formatDT(ca)], margin: [0, 2] },
        { text: [{ text: `Commission (${Math.round(COMMISSION_RATE * 100)}%): ` }, formatDT(commission)], margin: [0, 2] },
        { text: [{ text: 'Net à reverser: ', bold: true }, formatDT(net)], margin: [0, 2] },
        ...(totalAvances > 0 ? [
          { text: [{ text: 'Avances acceptées: ' }, formatDT(totalAvances)], margin: [6, 2, 0, 2], color: '#1a3c34' },
          { text: [{ text: 'Reste à payer: ', bold: true }, formatDT(resteAPayer)], margin: [0, 2] },
        ] : []),
      ]},
    ]},

    { text: '', margin: [0, 15] },
    { text: 'Dossier clôturé et verrouillé', style: 'metaText', alignment: 'center' },
  ];

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 30, 36, 30],
    styles: getStyles(),
    header: (currentPage) => currentPage > 1 ? { columns: companyHeader() } : null,
    footer: pageFooter,
    content,
  };

  return printer.createPdfKitDocument(docDefinition);
}

module.exports = { generateBonDeSortie, generateBonDeRetour, generateDossierComplet };
