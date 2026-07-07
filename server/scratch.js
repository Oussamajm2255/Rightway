const pool = require('./src/db/pool');

async function unarchiveAnnule() {
  try {
    const { rowCount, rows } = await pool.query(`
      UPDATE livraisons l
      SET is_archived = false
      FROM users u
      WHERE l.commercial_id = u.id 
        AND l.is_archived = true 
        AND l.status = 'ANNULE'
        AND u.full_name ILIKE '%Samir%'
      RETURNING l.reference
    `);
    
    if (rowCount === 0) {
      console.log('Aucune livraison annulée n\'a été trouvée pour Samir.');
    } else {
      console.log(`Désarchivage réussi pour ${rowCount} livraisons:`);
      console.table(rows);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

unarchiveAnnule();
