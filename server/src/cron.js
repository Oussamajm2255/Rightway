const cron = require('node-cron');
const pool = require('./db/pool');
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
    SELECT id, full_name, role, salary_amount
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
      description: `Salaire ${u.full_name} - ${monthStr}`,
      reference: refPrefix,
      expense_date: today.toISOString().split('T')[0],
      declared_by: systemUserId,
      status: 'EN_ATTENTE',
      // Attributes the charge back to the commercial for Performances
      // Commerciaux — only when the salaried user actually is one.
      commercial_id: u.role === 'COMMERCIAL' ? u.id : null,
    });
  }
  console.log(`Cron: Generated salaries for ${eligibleUsers.length} users.`);
}

// ISO weekday: 1=Monday..7=Sunday (JS getDay() is 0=Sunday..6=Saturday)
function isoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

// ISO week number — used to dedupe weekly-cycle generation so a charge
// fixe fires exactly once per calendar week, not once per matching weekday.
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Check and generate recurring expenses — each row picks its own cycle
// (WEEKLY / MONTHLY / YEARLY). Matching happens in JS because a monthly
// charge can now fire on SEVERAL days (generation_days array), including
// day 31, which falls back to the month's last day on shorter months.
async function checkAndGenerateRecurring(today) {
  const dayOfMonth = today.getDate();
  const weekday = isoWeekday(today);
  const month = today.getMonth() + 1;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const isLastDayOfMonth = dayOfMonth === daysInMonth;
  const yyyymm = `${today.getFullYear()}${String(month).padStart(2, '0')}`;

  const { rows: recurring } = await pool.query(`
    SELECT * FROM recurring_prelevements WHERE is_active = true
  `);
  if (recurring.length === 0) return;

  const systemUserId = await getSystemUserId();
  if (!systemUserId) return;

  let createdCount = 0;
  for (const r of recurring) {
    // Each entry in `occurrences` is one prelevement to generate today,
    // with its own unique dedup reference.
    const occurrences = [];

    if (r.frequency === 'WEEKLY') {
      if (r.generation_weekday === weekday) {
        const week = isoWeekNumber(today);
        occurrences.push({
          ref: `REC-${r.id}-${today.getFullYear()}-W${String(week).padStart(2, '0')}`,
          periodLabel: `Semaine ${week}/${today.getFullYear()}`,
        });
      }
    } else if (r.frequency === 'YEARLY') {
      if (r.generation_month === month && r.generation_day === dayOfMonth) {
        occurrences.push({
          ref: `REC-${r.id}-${today.getFullYear()}`,
          periodLabel: String(today.getFullYear()),
        });
      }
    } else {
      // MONTHLY — generation_days is the source of truth (backfilled from
      // generation_day by migration); a configured day beyond this month's
      // length fires on the month's last day instead (31 -> 30/28).
      const days = (r.generation_days && r.generation_days.length > 0)
        ? r.generation_days
        : (r.generation_day ? [r.generation_day] : []);
      const monthLabel = today.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      for (const d of days) {
        const fires = d === dayOfMonth || (isLastDayOfMonth && d > daysInMonth);
        if (!fires) continue;
        occurrences.push({
          ref: `REC-${r.id}-${yyyymm}-D${String(d).padStart(2, '0')}`,
          // Legacy single-day monthly refs had no -D suffix; checking the
          // old format too prevents a double charge in the transition month.
          legacyRef: `REC-${r.id}-${yyyymm}`,
          periodLabel: days.length > 1 ? `${d} ${monthLabel}` : monthLabel,
        });
      }
    }

    for (const occ of occurrences) {
      const { rows: existingRows } = await pool.query(
        `SELECT id FROM prelevements WHERE reference = $1 OR reference = $2`,
        [occ.ref, occ.legacyRef || occ.ref]
      );
      if (existingRows.length > 0) continue;

      await prelevementModel.createPrelevement({
        category_id: r.category_id,
        amount: r.amount,
        description: r.description ? `${r.description} - ${occ.periodLabel}` : `Charge fixe - ${occ.periodLabel}`,
        reference: occ.ref,
        expense_date: today.toISOString().split('T')[0],
        declared_by: systemUserId,
        status: 'EN_ATTENTE',
        commercial_id: r.commercial_id || null,
      });
      createdCount++;
    }
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
