const cron = require('node-cron');
const pool = require('./db/index');
const prelevementModel = require('./models/prelevement');

// We need a dummy "system user" or just pick the first SUPER_ADMIN to attribute the generation to
async function getSystemUserId() {
  const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1`);
  return rows.length > 0 ? rows[0].id : null;
}

// Check and generate salaries
async function checkAndGenerateSalaries(today) {
  const { rows: settings } = await pool.query('SELECT salary_generation_day FROM global_settings WHERE id = 1');
  if (settings.length === 0) return;
  const salaryDay = settings[0].salary_generation_day;
  
  if (today.getDate() !== salaryDay) return;

  const systemUserId = await getSystemUserId();
  if (!systemUserId) return;

  const monthStr = today.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const { rows: users } = await pool.query(`
    SELECT id, amount, reference 
    FROM prelevements 
    WHERE reference LIKE 'SAL-%' 
    AND EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM expense_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `);
  
  if (users.length > 0) return; // already generated this month

  const { rows: eligibleUsers } = await pool.query(`
    SELECT id, first_name, last_name, salary_amount 
    FROM users 
    WHERE is_active = true 
    AND remuneration_type = 'SALAIRE' 
    AND salary_amount > 0
  `);

  if (eligibleUsers.length === 0) return;

  // Get or create category
  let catRows = await pool.query(`SELECT id FROM prelevement_categories WHERE name ILIKE 'Charges du personnel' AND parent_id IS NULL`);
  let catId;
  if (catRows.rows.length > 0) {
    catId = catRows.rows[0].id;
  } else {
    const newCat = await prelevementModel.createCategory({ name: 'Charges du personnel', type: 'GENERAL' });
    catId = newCat.id;
  }

  for (const u of eligibleUsers) {
    const refPrefix = `SAL-${u.id}-${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}`;
    await prelevementModel.createPrelevement({
      category_id: catId,
      amount: u.salary_amount,
      description: `Salaire ${u.first_name} ${u.last_name} - ${monthStr}`,
      reference: refPrefix,
      expense_date: today.toISOString().split('T')[0],
      declared_by: systemUserId,
      status: 'EN_ATTENTE'
    });
  }
  console.log(`Cron: Generated salaries for ${eligibleUsers.length} users.`);
}

// Check and generate recurring expenses
async function checkAndGenerateRecurring(today) {
  const { rows: recurring } = await pool.query(`
    SELECT * FROM recurring_prelevements 
    WHERE is_active = true AND generation_day = $1
  `, [today.getDate()]);

  if (recurring.length === 0) return;

  const systemUserId = await getSystemUserId();
  if (!systemUserId) return;

  const monthStr = today.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  
  let createdCount = 0;
  for (const r of recurring) {
    const refPrefix = `REC-${r.id}-${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}`;
    
    const { rows: existingRows } = await pool.query(`
      SELECT id FROM prelevements WHERE reference = $1
    `, [refPrefix]);

    if (existingRows.length > 0) continue;

    await prelevementModel.createPrelevement({
      category_id: r.category_id,
      amount: r.amount,
      description: r.description ? `${r.description} - ${monthStr}` : `Charge fixe - ${monthStr}`,
      reference: refPrefix,
      expense_date: today.toISOString().split('T')[0],
      declared_by: systemUserId,
      status: 'EN_ATTENTE'
    });
    createdCount++;
  }
  if (createdCount > 0) console.log(`Cron: Generated ${createdCount} recurring expenses.`);
}

// Start cron job
function startCron() {
  // Run every day at 01:00 AM
  cron.schedule('0 1 * * *', async () => {
    console.log('Running daily cron job for prelevements...');
    const today = new Date();
    try {
      await checkAndGenerateSalaries(today);
      await checkAndGenerateRecurring(today);
    } catch (err) {
      console.error('Error in daily cron:', err);
    }
  });
  console.log('Cron job scheduled: daily at 01:00 AM');
}

module.exports = { startCron };
