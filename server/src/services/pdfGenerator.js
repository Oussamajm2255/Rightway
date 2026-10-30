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
// FINANCIAL SUMMARY STACK — shared by Bon de Retour + Dossier Complet
// ============================================================
// hideCommission is set for a COMMERCIAL viewer: they see only the gross
// CA (their sales total) — never the commission, Net à reverser, or Reste
// à payer (net − avances would reveal the commission by subtraction).
function buildFinancialStack({ isSalaire, hideCommission, ca, commission, net, totalAvances, resteAPayer }, cellStyle) {
  const style = cellStyle ? { style: cellStyle } : {};
  const stack = [
    { text: [{ text: 'Total CA: ', bold: true }, formatDT(ca)], ...style, margin: [0, 2] },
  ];

  if (!hideCommission) {
    if (isSalaire) {
      stack.push({ text: [{ text: 'Salaire mensuel — pas de commission', italics: true }], ...style, margin: [0, 2], color: '#6c757d' });
    } else {
      stack.push({ text: [{ text: `Commission (${Math.round(COMMISSION_RATE * 100)}%): ` }, formatDT(commission)], ...style, margin: [0, 2] });
    }
    stack.push({ text: [{ text: 'Net à reverser: ', bold: true }, formatDT(net)], ...style, margin: [0, 2] });
  }

  if (totalAvances > 0) {
    stack.push({ text: [{ text: 'Avances acceptées: ' }, formatDT(totalAvances)], ...style, margin: [4, 2, 0, 2], color: '#1a3c34' });
    if (!hideCommission) {
      stack.push({ text: [{ text: 'Reste à payer: ', bold: true }, formatDT(resteAPayer)], ...style, margin: [0, 2] });
    }
  }
  return stack;
}

// ============================================================
// BON DE RETOUR
// ============================================================
function generateBonDeRetour(livraison, { hideCommission = false } = {}) {
  const isSalaire = livraison.commercial_remuneration_type === 'SALAIRE';
  const ca = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
  const commission = isSalaire ? 0 : Number((ca * COMMISSION_RATE).toFixed(3));
  const net = Number((ca - commission).toFixed(3));
  const totalAvances = (livraison.avances || [])
    .filter(a => a.status === 'ACCEPTE')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const resteAPayer = Number((net - totalAvances).toFixed(3));

  const financialStack = buildFinancialStack(
    { isSalaire, hideCommission, ca, commission, net, totalAvances, resteAPayer },
    'tableCell'
  );

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
        { width: 'auto', stack: financialStack },
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
function generateDossierComplet(livraison, salesLog, { hideCommission = false } = {}) {
  const isSalaire = livraison.commercial_remuneration_type === 'SALAIRE';
  const ca = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
  const commission = isSalaire ? 0 : Number((ca * COMMISSION_RATE).toFixed(3));
  const net = Number((ca - commission).toFixed(3));
  const totalAvances = (livraison.avances || [])
    .filter(a => a.status === 'ACCEPTE')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const resteAPayer = Number((net - totalAvances).toFixed(3));
  const duration = livraison.closed_at
    ? Math.round((new Date(livraison.closed_at) - new Date(livraison.created_at)) / 3600000)
    : null;

  const financialStack = buildFinancialStack(
    { isSalaire, hideCommission, ca, commission, net, totalAvances, resteAPayer }
  );

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
      { width: 'auto', stack: financialStack },
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

// ============================================================
// REPORTS (Bénéfices / Statistiques)
// ============================================================
const REPORT_BRAND = '#0B3B2E';
const REPORT_TINT = '#F1F5F3';
const REPORT_MUTED = '#6c757d';

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function reportAmount(value) {
  const n = Number(value) || 0;
  const [int, dec] = Math.abs(n).toFixed(3).split('.');
  return `${n < 0 ? '-' : ''}${groupThousands(int)},${dec} DT`;
}

function reportInt(value) {
  return groupThousands(String(Number(value) || 0));
}

function reportPct(value) {
  return `${(Number(value) || 0).toFixed(1).replace('.', ',')} %`;
}

function reportDay(value) {
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function reportPeriod(date_from, date_to) {
  if (date_from && date_to) return `Du ${reportDay(date_from)} au ${reportDay(date_to)}`;
  if (date_from) return `Depuis le ${reportDay(date_from)}`;
  if (date_to) return `Jusqu'au ${reportDay(date_to)}`;
  return 'Toute la période';
}

function reportNow() {
  return new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Tunis', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function reportHeader(title, subtitle, width) {
  return [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: COMPANY.name, fontSize: 18, bold: true, color: REPORT_BRAND },
            { text: COMPANY.fullName, fontSize: 8, color: REPORT_MUTED, margin: [0, 4, 0, 0] },
            { text: `${COMPANY.mf}  |  ${COMPANY.address}`, fontSize: 7, color: REPORT_MUTED, margin: [0, 1, 0, 0] },
          ],
        },
        {
          width: 'auto',
          stack: [
            { text: title, fontSize: 14, bold: true, color: REPORT_BRAND, alignment: 'right' },
            { text: subtitle, fontSize: 8, color: REPORT_MUTED, alignment: 'right', margin: [0, 3, 0, 0] },
          ],
        },
      ],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 1.5, lineColor: REPORT_BRAND }], margin: [0, 8, 0, 10] },
  ];
}

function reportMeta(pairs) {
  const cells = pairs.flatMap(([label, value]) => [
    { text: label, fontSize: 8, bold: true, color: REPORT_MUTED },
    { text: value, fontSize: 8, color: '#222' },
  ]);
  const rows = [];
  for (let i = 0; i < cells.length; i += 4) {
    const row = cells.slice(i, i + 4);
    while (row.length < 4) row.push({ text: '' });
    rows.push(row);
  }
  return {
    table: { widths: ['auto', '*', 'auto', '*'], body: rows },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => REPORT_TINT,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 12],
  };
}

function reportKpis(tiles, perRow) {
  const cells = tiles.map(({ label, value }) => ({
    stack: [
      { text: label.toUpperCase(), fontSize: 6.5, bold: true, color: REPORT_MUTED },
      { text: value, fontSize: 11, bold: true, color: REPORT_BRAND, margin: [0, 3, 0, 0] },
    ],
  }));
  const rows = [];
  for (let i = 0; i < cells.length; i += perRow) {
    const row = cells.slice(i, i + perRow);
    while (row.length < perRow) row.push({ text: '' });
    rows.push(row);
  }
  return {
    unbreakable: true,
    table: { widths: Array(perRow).fill('*'), body: rows },
    layout: {
      hLineWidth: () => 4,
      vLineWidth: () => 4,
      hLineColor: () => '#FFFFFF',
      vLineColor: () => '#FFFFFF',
      fillColor: () => REPORT_TINT,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [-4, 0, -4, 8],
  };
}

function reportSection(title) {
  return { text: title, fontSize: 11, bold: true, color: REPORT_BRAND, margin: [0, 8, 0, 5] };
}

/**
 * columns: [{ title, width, right }]. The first row carries the section title,
 * so it repeats on every page and can never be left alone at the bottom of one.
 */
function reportTable(title, columns, rows, total) {
  const align = (col) => (col.right ? 'right' : 'left');
  const span = columns.length;
  const titleRow = [
    { text: title, colSpan: span, fontSize: 11, bold: true, color: REPORT_BRAND, margin: [-4, 4, 0, 3] },
    ...Array(span - 1).fill({}),
  ];
  const headerRow = columns.map((col) => ({ text: col.title, fontSize: 7.5, bold: true, color: '#FFFFFF', alignment: align(col) }));
  const bodyRows = rows.map((row) => row.map((value, i) => ({ text: value, fontSize: 8, color: '#222', alignment: align(columns[i]) })));
  const body = [titleRow, headerRow, ...bodyRows];

  if (total) {
    const cells = [
      { text: total.label, colSpan: total.span, fontSize: 8, bold: true, color: REPORT_BRAND },
      ...Array(total.span - 1).fill({}),
      ...total.values.map((value, i) => ({
        text: value, fontSize: 8, bold: true, color: REPORT_BRAND, alignment: align(columns[total.span + i]),
      })),
    ];
    body.push(cells);
  }

  const lastRow = body.length - 1;
  return {
    table: {
      headerRows: 2,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths: columns.map((col) => col.width),
      body,
    },
    layout: {
      hLineWidth: (i) => (i <= 2 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => '#E3E8E5',
      fillColor: (rowIndex) => {
        if (rowIndex === 0) return null;
        if (rowIndex === 1) return REPORT_BRAND;
        if (total && rowIndex === lastRow) return REPORT_TINT;
        return rowIndex % 2 === 1 ? '#FAFBFA' : null;
      },
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 3.5,
      paddingBottom: () => 3.5,
    },
    margin: [0, 6, 0, 8],
  };
}

function reportFooter(currentPage, pageCount) {
  return {
    columns: [
      { text: `${COMPANY.name} — Document confidentiel`, fontSize: 7, color: REPORT_MUTED },
      { text: `Page ${currentPage} / ${pageCount}`, fontSize: 7, color: REPORT_MUTED, alignment: 'right' },
    ],
    margin: [40, 12, 40, 0],
  };
}

function buildReport({ title, pageOrientation, content }) {
  return printer.createPdfKitDocument({
    info: { title, author: COMPANY.fullName },
    pageSize: 'A4',
    pageOrientation,
    pageMargins: [40, 36, 40, 42],
    footer: reportFooter,
    content,
  });
}

function reportFilterPairs({ date_from, date_to, category, search, commercialName, generatedBy }) {
  const pairs = [
    ['Période', reportPeriod(date_from, date_to)],
    ['Généré le', reportNow()],
    ['Généré par', generatedBy || '—'],
  ];
  if (commercialName) pairs.push(['Commercial', commercialName]);
  if (category) pairs.push(['Catégorie', category]);
  if (search) pairs.push(['Recherche', search]);
  return pairs;
}

function generateBenefitsReport(report) {
  const { global: g, stock, totals, commercialName } = report;
  const sold = report.products.filter((p) => Number(p.total_sold) > 0);
  const depot = Number(stock.depot_ca);
  const charge = Number(stock.charge_ca);
  const margin = Number(totals.ca) > 0 ? (Number(totals.benefit) / Number(totals.ca)) * 100 : 0;

  const tiles = [
    { label: "Chiffre d'affaires total", value: reportAmount(g.ca_total) },
    { label: 'Bénéfice brut', value: reportAmount(g.benefit_gross) },
    { label: 'Bénéfice net', value: reportAmount(g.benefit_net) },
    { label: 'Marge moyenne', value: reportPct(g.margin_avg) },
    { label: 'Commissions', value: reportAmount(g.commission_total) },
  ];
  if (!commercialName) {
    tiles.push(
      { label: 'Prélèvements', value: reportAmount(g.prelevement_total) },
      { label: 'Achats de stock', value: reportAmount(g.stock_purchase_total) },
    );
  }
  tiles.push(
    { label: 'Écarts', value: reportAmount(g.ecart_total) },
    { label: 'Produits rentables', value: reportInt(g.profitable_count) },
  );

  const columns = [
    { title: 'Code', width: 52 },
    { title: 'Produit', width: '*' },
    { title: 'Catégorie', width: 82 },
    { title: 'Prix achat', width: 62, right: true },
    { title: 'Prix vente', width: 62, right: true },
    { title: 'Qté', width: 34, right: true },
    { title: 'CA', width: 70, right: true },
    { title: 'Coût', width: 70, right: true },
    { title: 'Bénéfice', width: 70, right: true },
    { title: 'Marge', width: 42, right: true },
  ];
  const rows = sold.map((p) => [
    p.id, p.name, p.category || '—',
    reportAmount(p.purchase_price), reportAmount(p.selling_price_ttc),
    reportInt(p.total_sold), reportAmount(p.ca), reportAmount(p.cost), reportAmount(p.benefit), reportPct(p.margin_pct),
  ]);

  return buildReport({
    title: 'Rapport des bénéfices',
    pageOrientation: 'landscape',
    content: [
      ...reportHeader('RAPPORT DES BÉNÉFICES', 'Analyse de rentabilité par produit', 762),
      reportMeta(reportFilterPairs(report)),
      reportSection(commercialName ? `Performance de ${commercialName}` : 'Synthèse financière'),
      reportKpis(tiles, 5),
      reportSection('Stock actuel (valeur au prix de vente, à la date du rapport)'),
      reportKpis([
        { label: 'Dépôt', value: reportAmount(depot) },
        { label: 'Chargé dans les véhicules', value: reportAmount(charge) },
        { label: 'Total', value: reportAmount(depot + charge) },
      ], 3),
      reportTable(`Détail par produit (${sold.length} produit(s) vendu(s))`, columns, rows, {
        label: 'TOTAL',
        span: 5,
        values: [reportInt(totals.total_sold), reportAmount(totals.ca), reportAmount(totals.cost), reportAmount(totals.benefit), reportPct(margin)],
      }),
    ],
  });
}

function generateSalesReport(report) {
  const { totals, commercialName } = report;
  const sold = report.products.filter((p) => Number(p.total_sold) > 0);
  const share = (ca, whole) => reportPct(whole > 0 ? (ca / whole) * 100 : 0);

  const content = [
    ...reportHeader('RAPPORT DES VENTES', 'Statistiques par produit et par commercial', 515),
    reportMeta(reportFilterPairs(report)),
  ];

  const tiles = [
    { label: "Chiffre d'affaires", value: reportAmount(totals.ca) },
    { label: 'Quantité vendue', value: reportInt(totals.total_sold) },
    { label: 'Produits vendus', value: reportInt(sold.length) },
  ];
  content.push(reportSection(commercialName ? `Synthèse de ${commercialName}` : 'Synthèse'), reportKpis(tiles, 3));

  if (!commercialName) {
    const wholeCA = report.commercials.reduce((sum, c) => sum + c.ca, 0);
    content.push(reportTable('Chiffre d\'affaires par commercial', [
      { title: 'Commercial', width: '*' },
      { title: 'Livraisons clôturées', width: 86, right: true },
      { title: 'Qté vendue', width: 60, right: true },
      { title: 'CA', width: 90, right: true },
      { title: 'Part du CA', width: 56, right: true },
    ], report.commercials.map((c) => [
      c.full_name, reportInt(c.livraisons), reportInt(c.total_sold), reportAmount(c.ca), share(c.ca, wholeCA),
    ]), {
      label: 'TOTAL',
      span: 1,
      values: [
        reportInt(report.commercials.reduce((sum, c) => sum + c.livraisons, 0)),
        reportInt(report.commercials.reduce((sum, c) => sum + c.total_sold, 0)),
        reportAmount(wholeCA),
        '100,0 %',
      ],
    }));
  }

  content.push(reportTable(`${commercialName ? `Ventes de ${commercialName}` : "Chiffre d'affaires par produit"} (${sold.length} produit(s) vendu(s))`, [
    { title: 'Code', width: 54 },
    { title: 'Produit', width: '*' },
    { title: 'Catégorie', width: 86 },
    { title: 'Prix vente', width: 62, right: true },
    { title: 'Qté', width: 36, right: true },
    { title: 'CA', width: 72, right: true },
    { title: 'Part', width: 40, right: true },
  ], sold.map((p) => [
    p.id, p.name, p.category || '—', reportAmount(p.selling_price_ttc), reportInt(p.total_sold), reportAmount(p.ca), share(p.ca, totals.ca),
  ]), {
    label: 'TOTAL',
    span: 4,
    values: [reportInt(totals.total_sold), reportAmount(totals.ca), '100,0 %'],
  }));

  return buildReport({ title: 'Rapport des ventes', pageOrientation: 'portrait', content });
}

module.exports = { generateBonDeSortie, generateBonDeRetour, generateDossierComplet, generateBenefitsReport, generateSalesReport };
