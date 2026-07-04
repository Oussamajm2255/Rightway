require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function deleteLivraisonHard(reference) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Chercher la livraison
    const { rows: livRows } = await client.query('SELECT * FROM livraisons WHERE reference = $1 FOR UPDATE', [reference]);
    if (livRows.length === 0) {
      console.log(`Livraison ${reference} introuvable.`);
      await client.query('ROLLBACK');
      return;
    }
    const livraison = livRows[0];
    const { id, status } = livraison;
    console.log(`Livraison trouvée. Statut: ${status}, ID: ${id}`);

    // 2. Récupérer les items
    const { rows: items } = await client.query('SELECT * FROM livraison_items WHERE livraison_id = $1', [id]);

    // 3. Restaurer le stock selon le statut
    // EN_ATTENTE_COMMERCIAL: rien n'a été déduit
    // EN_COURS, EN_RETOUR, EN_ATTENTE_ANNULATION: tout a été déduit (qte_chargee)
    // CLOTURE: la partie non vendue a été retournée, reste la qte_vendue à restaurer
    // ANNULE: tout le stock a déjà été restauré par l'annulation
    let restoredCount = 0;
    for (const item of items) {
      let qtyToRestore = 0;

      if (['EN_COURS', 'EN_RETOUR', 'EN_ATTENTE_ANNULATION'].includes(status)) {
        qtyToRestore = item.qte_chargee;
      } else if (status === 'CLOTURE') {
        qtyToRestore = item.qte_vendue;
      }

      if (qtyToRestore > 0) {
        await client.query(
          `UPDATE depot_stock SET quantity = quantity + $1, last_updated = NOW() WHERE product_id = $2`,
          [qtyToRestore, item.product_id]
        );
        console.log(`Stock restauré pour ${item.product_id}: +${qtyToRestore}`);
        restoredCount++;
      }
    }
    if (restoredCount === 0) console.log('Aucun stock à restaurer pour ce statut.');

    // 4. Supprimer toutes les dépendances
    console.log('Suppression des dépendances...');
    const tables = [
      'livraison_sales_log',
      'stock_movements',
      'livraison_avances',
      'livraison_ecarts'
    ];

    for (const table of tables) {
      const { rowCount } = await client.query(`DELETE FROM ${table} WHERE livraison_id = $1`, [id]);
      if (rowCount > 0) console.log(` - Supprimé ${rowCount} ligne(s) de ${table}`);
    }

    // Notifications (basées sur la référence ou livraison_id)
    const { rowCount: notifCount } = await client.query(`DELETE FROM notifications WHERE livraison_id = $1 OR message LIKE $2`, [id, `%${reference}%`]);
    if (notifCount > 0) console.log(` - Supprimé ${notifCount} notification(s)`);

    // 5. Supprimer les items et la livraison
    await client.query('DELETE FROM livraison_items WHERE livraison_id = $1', [id]);
    await client.query('DELETE FROM livraisons WHERE id = $1', [id]);
    
    console.log(`Livraison ${reference} supprimée définitivement avec succès.`);
    await client.query('COMMIT');
  } catch (err) {
    console.error('Erreur lors de la suppression:', err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    pool.end();
  }
}

const ref = process.argv[2] || 'LIV-20260630-006';
deleteLivraisonHard(ref);
