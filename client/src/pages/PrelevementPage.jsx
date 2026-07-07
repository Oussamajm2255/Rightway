import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { formatDT, formatDate, formatDateTime } from '../lib/utils';
import './PrelevementPage.css';

/* ===== SVG Icons (inline, no extra imports) ===== */
function IconEdit() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconTrash() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>;
}
function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

function formatMoney(v) {
  if (v == null) return '—';
  return Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' DT';
}

/* ===== Category Tree Modal ===== */
function CategoryModal({ categories, onClose, onRefresh }) {
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const mainCats = categories.filter(c => !c.parent_id);

  async function handleAdd() {
    if (!newName.trim()) return;
    setError('');
    try {
      await apiPost('/prelevements/categories', {
        name: newName.trim(),
        parent_id: newParentId || null,
      });
      setNewName('');
      setNewParentId('');
      onRefresh();
    } catch (e) { setError(e.message); }
  }

  async function handleRename(id) {
    if (!editName.trim()) return;
    setError('');
    try {
      await apiPut(`/prelevements/categories/${id}`, { name: editName.trim() });
      setEditingId(null);
      onRefresh();
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await apiDelete(`/prelevements/categories/${id}`);
      onRefresh();
    } catch (e) { setError(e.message); }
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  return (
    <div className="prel-cat-modal-overlay" onClick={onClose}>
      <div className="prel-cat-modal" onClick={e => e.stopPropagation()}>
        <h3>Gérer les catégories</h3>
        {error && <div className="prel-error">{error}</div>}

        <ul className="prel-cat-tree">
          {mainCats.map(main => (
            <li key={main.id}>
              <div className="prel-cat-item">
                {editingId === main.id ? (
                  <>
                    <input className="prel-cat-name-input" value={editName}
                      onChange={e => setEditName(e.target.value)} autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleRename(main.id)} />
                    <div className="prel-cat-actions" style={{opacity:1}}>
                      <button className="prel-cat-icon-btn" onClick={() => handleRename(main.id)} title="Enregistrer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button className="prel-cat-icon-btn" onClick={() => setEditingId(null)} title="Annuler">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="prel-cat-name">{main.name}</span>
                    <div className="prel-cat-actions">
                      <button className="prel-cat-icon-btn" onClick={() => startEdit(main)} title="Renommer"><IconEdit /></button>
                      <button className="prel-cat-icon-btn danger" onClick={() => handleDelete(main.id)} title="Supprimer"><IconTrash /></button>
                    </div>
                  </>
                )}
              </div>
              {main.children?.map(child => (
                <div key={child.id} className="prel-cat-item prel-cat-item--child">
                  {editingId === child.id ? (
                    <>
                      <input className="prel-cat-name-input" value={editName}
                        onChange={e => setEditName(e.target.value)} autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleRename(child.id)} />
                      <div className="prel-cat-actions" style={{opacity:1}}>
                        <button className="prel-cat-icon-btn" onClick={() => handleRename(child.id)} title="Enregistrer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button className="prel-cat-icon-btn" onClick={() => setEditingId(null)} title="Annuler">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="prel-cat-name">{child.name}</span>
                      <div className="prel-cat-actions">
                        <button className="prel-cat-icon-btn" onClick={() => startEdit(child)} title="Renommer"><IconEdit /></button>
                        <button className="prel-cat-icon-btn danger" onClick={() => handleDelete(child.id)} title="Supprimer"><IconTrash /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ul>

        <div className="prel-cat-add-row">
          <select className="prel-form-select" value={newParentId}
            onChange={e => setNewParentId(e.target.value)} style={{flex:1}}>
            <option value="">Catégorie principale</option>
            {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="prel-form-input" placeholder="Nom..." value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{flex:2}} />
          <button className="btn btn-primary btn-sm" onClick={handleAdd} style={{whiteSpace:'nowrap'}}>
            <IconPlus /> Ajouter
          </button>
        </div>

        <div className="prel-modal-actions" style={{marginTop:'var(--space-4)'}}>
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Edit Expense Modal ===== */
function EditModal({ expense, categories, commercials, onClose, onSaved }) {
  const [form, setForm] = useState({
    category_id: expense?.category_id || '',
    amount: expense?.amount || '',
    description: expense?.description || '',
    reference: expense?.reference || '',
    expense_date: expense?.expense_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    commercial_id: expense?.commercial_id || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const mainCats = categories.filter(c => !c.parent_id);
  const selectedParent = categories.find(c => c.id === parseInt(form.category_id))?.parent_id;
  const childCats = categories.filter(c => c.parent_id === parseInt(form.category_id) || (!selectedParent && c.parent_id));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        category_id: parseInt(form.category_id),
        amount: parseFloat(form.amount),
        description: form.description || undefined,
        reference: form.reference || undefined,
        expense_date: form.expense_date,
        commercial_id: form.commercial_id || null,
      };
      if (expense) {
        await apiPut(`/prelevements/${expense.id}`, body);
      } else {
        await apiPost('/prelevements', body);
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="prel-modal-overlay" onClick={onClose}>
      <div className="prel-modal" onClick={e => e.stopPropagation()}>
        <h3>{expense ? 'Modifier le prélèvement' : 'Nouveau prélèvement'}</h3>
        {error && <div className="prel-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="prel-form-group">
            <label className="prel-form-label">Catégorie</label>
            <select className="prel-form-select" value={form.category_id}
              onChange={e => setForm(f => ({...f, category_id: e.target.value}))} required>
              <option value="">—</option>
              {mainCats.map(m => (
                <optgroup key={m.id} label={m.name}>
                  <option value={m.id}>{m.name} (général)</option>
                  {m.children?.map(ch => (
                    <option key={ch.id} value={ch.id}>&nbsp;&nbsp;{ch.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="prel-form-row">
            <div className="prel-form-group">
              <label className="prel-form-label">Montant (DT)</label>
              <input className="prel-form-input" type="number" step="0.01" min="0.01"
                value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} required />
            </div>
            <div className="prel-form-group">
              <label className="prel-form-label">Date</label>
              <input className="prel-form-input" type="date" value={form.expense_date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({...f, expense_date: e.target.value}))} required />
            </div>
          </div>
          <div className="prel-form-group">
            <label className="prel-form-label">Description</label>
            <textarea className="prel-form-textarea" value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))}
              placeholder="Détail de la dépense..." rows={2} />
          </div>
          <div className="prel-form-group">
            <label className="prel-form-label">Référence (optionnel)</label>
            <input className="prel-form-input" value={form.reference}
              onChange={e => setForm(f => ({...f, reference: e.target.value}))}
              placeholder="N° facture, reçu..." />
          </div>
          <div className="prel-form-group">
            <label className="prel-form-label">Commercial concerné (optionnel)</label>
            <select className="prel-form-select" value={form.commercial_id}
              onChange={e => setForm(f => ({...f, commercial_id: e.target.value}))}>
              <option value="">Général (aucun commercial)</option>
              {commercials.map(com => (
                <option key={com.id} value={com.id}>{com.full_name}</option>
              ))}
            </select>
          </div>
          <div className="prel-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '...' : expense ? 'Enregistrer' : 'Déclarer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ===== Delete Confirm ===== */
function DeleteModal({ expense, onClose, onDeleted }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost(`/prelevements/${expense.id}/delete`, { password });
      onDeleted();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="prel-modal-overlay" onClick={onClose}>
      <div className="prel-modal" onClick={e => e.stopPropagation()}>
        <h3>Supprimer le prélèvement</h3>
        {error && <div className="prel-error">{error}</div>}
        <p style={{fontSize:'0.9rem', color:'var(--color-text-secondary)', marginBottom:'var(--space-4)'}}>
          Vous allez supprimer définitivement :<br/>
          <strong>{expense.description || 'Sans description'}</strong> — <strong>{formatMoney(expense.amount)}</strong>
        </p>
        <form onSubmit={handleDelete}>
          <div className="prel-form-group">
            <label className="prel-form-label">Mot de passe</label>
            <input className="prel-form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required autoFocus />
          </div>
          <div className="prel-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? '...' : 'Supprimer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Analyse Tab — KPI + Charts
   ═══════════════════════════════════════════ */
function AnalyseTab({ stats, categories }) {
  const barRef = useRef(null);
  const pieRef = useRef(null);
  const lineRef = useRef(null);
  const chartsRef = useRef([]);

  useEffect(() => {
    if (!stats || typeof window === 'undefined') return;
    let ChartJs;
    import('chart.js/auto').then(mod => { ChartJs = mod.default; renderCharts(ChartJs); });

    async function renderCharts(Chart) {
      // Cleanup previous
      chartsRef.current.forEach(c => c?.destroy());
      chartsRef.current = [];

      const ChartClass = Chart;

      // --- Bar: Par catégorie principale ---
      if (barRef.current && stats.by_main_category?.length) {
        const sorted = [...stats.by_main_category].sort((a,b) => b.total - a.total);
        const ctx = barRef.current.getContext('2d');
        const c = new ChartClass(ctx, {
          type: 'bar',
          data: {
            labels: sorted.map(r => r.category_name),
            datasets: [{ label: 'Total (DT)', data: sorted.map(r => r.total),
              backgroundColor: '#0F3B2C', borderRadius: 4 }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { callback: v => formatMoney(v) } },
              y: { ticks: { font: { size: 11 } } },
            },
          },
        });
        chartsRef.current.push(c);
      }

      // --- Doughnut: Distribution ---
      if (pieRef.current && stats.by_main_category?.length) {
        const ctx = pieRef.current.getContext('2d');
        const colors = ['#0F3B2C','#B8860B','#165440','#0369A1','#475569','#854D0E','#14532D','#991B1B'];
        const c = new ChartClass(ctx, {
          type: 'doughnut',
          data: {
            labels: stats.by_main_category.map(r => r.category_name),
            datasets: [{
              data: stats.by_main_category.map(r => r.total),
              backgroundColor: colors.slice(0, stats.by_main_category.length),
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 12 } },
              tooltip: { callbacks: { label: ctx => ` ${ctx.parsed} DT (${stats.by_main_category[ctx.dataIndex]?.percentage}%)` } },
            },
          },
        });
        chartsRef.current.push(c);
      }

      // --- Line: Monthly trend ---
      if (lineRef.current && stats.monthly_trend?.length) {
        const ctx = lineRef.current.getContext('2d');
        const c = new ChartClass(ctx, {
          type: 'line',
          data: {
            labels: stats.monthly_trend.map(r => r.month),
            datasets: [{
              label: 'Dépenses (DT)',
              data: stats.monthly_trend.map(r => r.total),
              borderColor: '#0F3B2C',
              backgroundColor: 'rgba(15,59,44,0.05)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { ticks: { callback: v => formatMoney(v) } },
            },
          },
        });
        chartsRef.current.push(c);
      }
    }

    return () => { chartsRef.current.forEach(c => c?.destroy()); };
  }, [stats]);

  if (!stats) return <p style={{padding:'var(--space-8)', textAlign:'center', color:'var(--color-text-tertiary)'}}>Chargement des statistiques...</p>;

  return (
    <div>
      <div className="prel-kpi-grid">
        <div className="prel-kpi-card">
          <div className="prel-kpi-label">Total dépenses</div>
          <div className="prel-kpi-value primary">{formatMoney(stats.total_expenses)}</div>
          <div className="prel-kpi-sub">{stats.total_count} déclarations</div>
        </div>
        <div className="prel-kpi-card">
          <div className="prel-kpi-label">Ce mois</div>
          <div className="prel-kpi-value">{formatMoney(stats.current_month_total)}</div>
        </div>
        <div className="prel-kpi-card">
          <div className="prel-kpi-label">Moyenne mensuelle</div>
          <div className="prel-kpi-value">{formatMoney(stats.monthly_avg)}</div>
        </div>
        <div className="prel-kpi-card">
          <div className="prel-kpi-label">Nb. déclarations</div>
          <div className="prel-kpi-value">{stats.total_count}</div>
        </div>
      </div>

      <div className="prel-charts-grid">
        <div className="prel-chart-card">
          <h3>Dépenses par catégorie principale</h3>
          <div className="prel-chart-wrap"><canvas ref={barRef} /></div>
        </div>
        <div className="prel-chart-card">
          <h3>Distribution</h3>
          <div className="prel-chart-wrap"><canvas ref={pieRef} /></div>
        </div>
      </div>

      <div className="prel-charts-grid">
        <div className="prel-chart-card">
          <h3>Évolution mensuelle (12 mois)</h3>
          <div className="prel-chart-wrap"><canvas ref={lineRef} /></div>
        </div>
        {stats.top_expenses?.length > 0 && (
          <div className="prel-top-table-wrap">
            <h3>Top 10 dépenses</h3>
            <div className="prel-table-wrap">
              <table className="prel-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Description</th>
                    <th style={{textAlign:'right'}}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_expenses.map((e, i) => (
                    <tr key={i}>
                      <td>{formatDate(e.expense_date)}</td>
                      <td>{e.category_name}</td>
                      <td>{e.description || '—'}</td>
                      <td className="prel-amount">{formatMoney(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Recurring Expenses Modal ===== */
const WEEKDAYS = [
  { value: 1, label: 'Lundi' }, { value: 2, label: 'Mardi' }, { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' }, { value: 5, label: 'Vendredi' }, { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];
const MONTHS = [
  { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
];
const FREQUENCY_META = {
  WEEKLY: { label: 'Hebdomadaire', bg: '#EFF6FF', color: '#1D4ED8' },
  MONTHLY: { label: 'Mensuel', bg: '#ECFDF5', color: '#047857' },
  YEARLY: { label: 'Annuel', bg: '#F5F3FF', color: '#6D28D9' },
};

const EMPTY_RECURRING_FORM = {
  category_id: '', amount: '', description: '',
  frequency: 'MONTHLY', generation_days: [1], generation_day: 1, generation_weekday: 1, generation_month: 1,
  commercial_id: '',
};

function cycleLabel(item) {
  if (item.frequency === 'WEEKLY') {
    const wd = WEEKDAYS.find(w => w.value === item.generation_weekday);
    return `Chaque ${wd ? wd.label.toLowerCase() : '—'}`;
  }
  if (item.frequency === 'YEARLY') {
    const m = MONTHS.find(m => m.value === item.generation_month);
    return `Le ${item.generation_day} ${m ? m.label.toLowerCase() : '—'} (chaque année)`;
  }
  const days = (item.generation_days && item.generation_days.length > 0)
    ? item.generation_days
    : [item.generation_day];
  if (days.length === 1) return `Le ${days[0]} du mois`;
  return `Les ${days.join(', ')} du mois`;
}

function RecurringModal({ categories, commercials, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState(EMPTY_RECURRING_FORM);
  const [editingId, setEditingId] = useState(null);
  const mainCats = categories.filter(c => !c.parent_id);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet('/prelevements/recurring');
      setItems(data.recurring || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function buildPayload() {
    const payload = {
      category_id: parseInt(form.category_id),
      amount: parseFloat(form.amount),
      description: form.description || undefined,
      frequency: form.frequency,
      commercial_id: form.commercial_id || null,
    };
    if (form.frequency === 'WEEKLY') {
      payload.generation_weekday = parseInt(form.generation_weekday) || 1;
    } else if (form.frequency === 'YEARLY') {
      payload.generation_month = parseInt(form.generation_month) || 1;
      payload.generation_day = parseInt(form.generation_day) || 1;
    } else {
      payload.generation_days = form.generation_days.length > 0 ? form.generation_days : [1];
    }
    return payload;
  }

  function toggleMonthlyDay(day) {
    setForm(f => {
      const has = f.generation_days.includes(day);
      const next = has ? f.generation_days.filter(d => d !== day) : [...f.generation_days, day];
      return { ...f, generation_days: next.sort((a, b) => a - b) };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await apiPut(`/prelevements/recurring/${editingId}`, buildPayload());
      } else {
        await apiPost('/prelevements/recurring', buildPayload());
      }
      setForm(EMPTY_RECURRING_FORM);
      setEditingId(null);
      fetchItems();
    } catch (e) { setError(e.message); }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      category_id: String(item.category_id),
      amount: String(item.amount),
      description: item.description || '',
      frequency: item.frequency || 'MONTHLY',
      generation_days: (item.generation_days && item.generation_days.length > 0)
        ? [...item.generation_days].sort((a, b) => a - b)
        : [item.generation_day || 1],
      generation_day: item.generation_day || 1,
      generation_weekday: item.generation_weekday || 1,
      generation_month: item.generation_month || 1,
      commercial_id: item.commercial_id || '',
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_RECURRING_FORM);
    setError('');
  }

  async function handleToggle(id, currentActive) {
    try {
      await apiPut(`/prelevements/recurring/${id}`, { is_active: !currentActive });
      fetchItems();
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    if(!window.confirm("Supprimer cette charge fixe ?")) return;
    try {
      await apiDelete(`/prelevements/recurring/${id}`);
      if (editingId === id) handleCancelEdit();
      fetchItems();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="prel-cat-modal-overlay" onClick={onClose}>
      <div className="prel-cat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <h3>Gérer les charges fixes</h3>
        {error && <div className="prel-error">{error}</div>}

        <form onSubmit={handleSubmit} className="prel-cat-add-row" style={{ flexDirection: 'column', gap: '8px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
          {editingId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
              <span>Modification de la charge fixe #{editingId}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>Annuler la modification</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="prel-form-select" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} required style={{ flex: 1 }}>
              <option value="">Catégorie</option>
              {mainCats.map(m => (
                <optgroup key={m.id} label={m.name}>
                  <option value={m.id}>{m.name} (général)</option>
                  {m.children?.map(ch => <option key={ch.id} value={ch.id}>&nbsp;&nbsp;{ch.name}</option>)}
                </optgroup>
              ))}
            </select>
            <input className="prel-form-input" type="number" step="0.01" min="0.01" placeholder="Montant" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required style={{ width: '110px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="prel-form-input" placeholder="Description (ex: Loyer, Internet...)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="prel-form-select"
              value={form.commercial_id}
              onChange={e => setForm({...form, commercial_id: e.target.value})}
              title="Commercial concerné"
              style={{ flex: 1 }}
            >
              <option value="">Général (aucun commercial)</option>
              {commercials.map(com => (
                <option key={com.id} value={com.id}>{com.full_name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="prel-form-select"
              value={form.frequency}
              onChange={e => setForm({...form, frequency: e.target.value})}
              title="Cycle de génération"
              style={{ width: '150px' }}
            >
              <option value="WEEKLY">Hebdomadaire</option>
              <option value="MONTHLY">Mensuel</option>
              <option value="YEARLY">Annuel</option>
            </select>

            {form.frequency === 'WEEKLY' && (
              <select
                className="prel-form-select"
                value={form.generation_weekday}
                onChange={e => setForm({...form, generation_weekday: e.target.value})}
                title="Jour de la semaine"
                style={{ flex: 1 }}
              >
                {WEEKDAYS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            )}

            {form.frequency === 'MONTHLY' && (
              <div className="prel-day-grid">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                  const selected = form.generation_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`prel-day-btn${selected ? ' selected' : ''}`}
                      onClick={() => toggleMonthlyDay(day)}
                      title={`Jour ${day}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}

            {form.frequency === 'YEARLY' && (
              <>
                <select
                  className="prel-form-select"
                  value={form.generation_month}
                  onChange={e => setForm({...form, generation_month: e.target.value})}
                  title="Mois"
                  style={{ flex: 1 }}
                >
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input
                  className="prel-form-input" type="number" min="1" max="28"
                  placeholder="Jour (1-28)" value={form.generation_day}
                  onChange={e => setForm({...form, generation_day: e.target.value})}
                  title="Jour du mois" style={{ width: '110px' }} required
                />
              </>
            )}

            <button type="submit" className="btn btn-primary btn-sm">
              {editingId ? 'Enregistrer' : <><IconPlus /> Ajouter</>}
            </button>
          </div>
        </form>

        <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '16px' }}>
          {loading ? <p>Chargement...</p> : items.length === 0 ? <p style={{ color: 'var(--color-text-tertiary)' }}>Aucune charge fixe.</p> : (
            <ul className="prel-cat-tree">
              {items.map(item => {
                const freq = FREQUENCY_META[item.frequency] || FREQUENCY_META.MONTHLY;
                return (
                  <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div>
                      <div style={{ fontWeight: 500, opacity: item.is_active ? 1 : 0.5 }}>{item.description || 'Sans description'} - {formatMoney(item.amount)}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span>{item.parent_category_name ? `${item.parent_category_name} › ` : ''}{item.category_name}</span>
                        <span>&bull;</span>
                        <span
                          style={{ background: freq.bg, color: freq.color, borderRadius: '999px', padding: '1px 8px', fontWeight: 600, fontSize: '0.72rem' }}
                        >
                          {freq.label}
                        </span>
                        <span>{cycleLabel(item)}</span>
                        {item.commercial_name && (
                          <span className="prel-commercial-badge">{item.commercial_name}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: item.is_active ? 'var(--color-success)' : 'var(--color-text-tertiary)' }} onClick={() => handleToggle(item.id, item.is_active)}>
                        {item.is_active ? 'Actif' : 'Inactif'}
                      </button>
                      <button className="prel-cat-icon-btn" onClick={() => handleEdit(item)} title="Modifier"><IconEdit /></button>
                      <button className="prel-cat-icon-btn danger" onClick={() => handleDelete(item.id)} title="Supprimer"><IconTrash /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="prel-modal-actions" style={{marginTop:'var(--space-4)'}}>
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Settings Modal ===== */
function SettingsModal({ onClose }) {
  const [day, setDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/prelevements/settings')
      .then(res => setDay(res.settings?.salary_generation_day || 1))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await apiPut('/prelevements/settings', { salary_generation_day: parseInt(day) });
      toast?.success?.("Paramètres enregistrés.");
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prel-cat-modal-overlay" onClick={onClose}>
      <div className="prel-cat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <h3>Configuration Globale</h3>
        {error && <div className="prel-error">{error}</div>}
        
        {loading ? <p>Chargement...</p> : (
          <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 500 }}>Jour de génération automatique des salaires (1-28)</label>
            <input className="prel-form-input" type="number" min="1" max="28" value={day} onChange={e => setDay(e.target.value)} />
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
              Les prélèvements de salaires seront générés automatiquement chaque mois à ce jour en statut "EN ATTENTE".
            </p>
          </div>
        )}

        <div className="prel-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>{saving ? '...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function PrelevementPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('declaration');
  const [categories, setCategories] = useState([]);
  const [commercials, setCommercials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category_id: '', commercial_id: '', date_from: '', date_to: '', search: '' });
  const [stats, setStats] = useState(null);
  const [statsRange, setStatsRange] = useState({ date_from: '', date_to: '' });

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);

  const LIMIT = 20;

  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesError(null);
      const data = await apiGet('/prelevements/categories');
      const cats = data.categories || [];
      setCategories(cats);
      if (cats.length === 0) {
        setCategoriesError('Aucune catégorie trouvée (table vide). Cliquez sur "Gérer les catégories" pour en créer.');
      }
    } catch (err) {
      console.error('[Prelevement] fetchCategories error:', err.message);
      setCategoriesError(err.message || 'Erreur inconnue');
    }
  }, []);

  const fetchCommercials = useCallback(async () => {
    try {
      const data = await apiGet('/users/commercials');
      setCommercials(data.users || []);
    } catch (err) {
      console.error('[Prelevement] fetchCommercials error:', err.message);
    }
  }, []);

  const fetchExpenses = useCallback(async (p = page) => {
    try {
      const params = new URLSearchParams();
      params.set('page', p);
      params.set('limit', LIMIT);
      if (filters.category_id) params.set('category_id', filters.category_id);
      if (filters.commercial_id) params.set('commercial_id', filters.commercial_id);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      if (filters.search) params.set('search', filters.search);
      const data = await apiGet(`/prelevements?${params.toString()}`);
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('[Prelevement] fetchExpenses error:', err.message);
    }
  }, [page, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statsRange.date_from) params.set('date_from', statsRange.date_from);
      if (statsRange.date_to) params.set('date_to', statsRange.date_to);
      const qs = params.toString();
      const data = await apiGet(`/prelevements/stats${qs ? `?${qs}` : ''}`);
      setStats(data.stats || null);
    } catch (err) {
      console.error('[Prelevement] fetchStats error:', err.message);
    }
  }, [statsRange]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchCommercials(); }, [fetchCommercials]);

  useEffect(() => {
    if (tab === 'declaration') fetchExpenses();
    else fetchStats();
  }, [tab, fetchStats]);

  // Refetch expenses when filters/page change on declaration tab
  useEffect(() => {
    if (tab === 'declaration') fetchExpenses();
  }, [page, filters]);

  function handleFilterChange(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }

  const mainCats = categories.filter(c => !c.parent_id);
  const totalPages = Math.ceil(total / LIMIT);

  function handleSaved() {
    setEditingExpense(null);
    fetchExpenses();
    fetchCategories();
  }

  function handleDeleted() {
    setDeletingExpense(null);
    fetchExpenses();
  }

  async function handleUpdateStatus(id, newStatus) {
    if (!window.confirm(`Voulez-vous vraiment ${newStatus === 'VALIDE' ? 'valider' : 'rejeter'} ce prélèvement ?`)) return;
    try {
      await apiPut(`/prelevements/${id}/status`, { status: newStatus });
      toast?.success?.(`Le prélèvement a été ${newStatus === 'VALIDE' ? 'validé' : 'rejeté'}.`);
      fetchExpenses();
    } catch (err) {
      toast?.error?.(err.message || 'Erreur lors de la mise à jour.');
    }
  }

  return (
    <div className="page-content">
      <div className="prel-tabs">
        <button className={`prel-tab ${tab === 'declaration' ? 'active' : ''}`}
          onClick={() => setTab('declaration')}>
          Déclaration
        </button>
        <button className={`prel-tab ${tab === 'analyse' ? 'active' : ''}`}
          onClick={() => setTab('analyse')}>
          Analyse
        </button>
      </div>

      {tab === 'declaration' && (
        <div className="prel-decl-layout">
          {/* Left: Quick-add form */}
          <div className="prel-form-card">
            <h2>Nouveau prélèvement</h2>

            {categoriesError && (
              <div style={{
                background: 'var(--color-danger-bg,#fff0f0)',
                border: '1px solid var(--color-danger-border,#e74c3c)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                fontSize: '0.85rem',
                color: 'var(--color-danger,#c0392b)',
              }}>
                <strong>Erreur chargement catégories :</strong> {categoriesError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className="prel-cat-btn" onClick={() => setShowCatModal(true)} style={{ flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Gérer les catégories
              </button>
              <button className="prel-cat-btn" onClick={() => setShowRecurringModal(true)} style={{ flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                Gérer les charges fixes
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await apiPost('/prelevements', {
                  category_id: parseInt(fd.get('category_id')),
                  amount: parseFloat(fd.get('amount')),
                  description: fd.get('description') || undefined,
                  reference: fd.get('reference') || undefined,
                  expense_date: fd.get('expense_date'),
                  commercial_id: fd.get('commercial_id') || undefined,
                });
                e.target.reset();
                fetchExpenses();
                toast?.success?.('Prélèvement déclaré');
              } catch (err) {
                toast?.error?.(err.message);
              }
            }}>
              <div className="prel-form-group">
                <label className="prel-form-label">Catégorie</label>
                <select className="prel-form-select" name="category_id" required>
                  <option value="">—</option>
                  {mainCats.map(m => (
                    <optgroup key={m.id} label={m.name}>
                      <option value={m.id}>{m.name} (général)</option>
                      {m.children?.map(ch => (
                        <option key={ch.id} value={ch.id}>&nbsp;&nbsp;{ch.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="prel-form-row">
                <div className="prel-form-group">
                  <label className="prel-form-label">Montant (DT)</label>
                  <input className="prel-form-input" type="number" name="amount" step="0.01" min="0.01" required />
                </div>
                <div className="prel-form-group">
                  <label className="prel-form-label">Date</label>
                  <input className="prel-form-input" type="date" name="expense_date"
                    defaultValue={new Date().toISOString().slice(0,10)}
                    max={new Date().toISOString().slice(0,10)} required />
                </div>
              </div>
              <div className="prel-form-group">
                <label className="prel-form-label">Description</label>
                <textarea className="prel-form-textarea" name="description"
                  placeholder="Détail de la dépense..." rows={2} />
              </div>
              <div className="prel-form-group">
                <label className="prel-form-label">Référence (optionnel)</label>
                <input className="prel-form-input" name="reference" placeholder="N° facture, reçu..." />
              </div>
              <div className="prel-form-group">
                <label className="prel-form-label">Commercial concerné (optionnel)</label>
                <select className="prel-form-select" name="commercial_id" defaultValue="">
                  <option value="">Général (aucun commercial)</option>
                  {commercials.map(com => (
                    <option key={com.id} value={com.id}>{com.full_name}</option>
                  ))}
                </select>
                <span className="prel-form-hint">Attribue cette dépense à un commercial — visible dans Performances Commerciaux.</span>
              </div>
              <div className="prel-form-actions">
                <button type="submit" className="btn btn-primary">Déclarer</button>
              </div>
            </form>
          </div>

          {/* Right: Table */}
          <div className="prel-table-card">
            <div className="prel-table-header">
              <h2>Historique</h2>
              <div className="prel-table-filters">
                <input className="prel-search" placeholder="Rechercher..." value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)} />
                <select className="prel-filter-select" value={filters.category_id}
                  onChange={e => handleFilterChange('category_id', e.target.value)}>
                  <option value="">Toutes catégories</option>
                  {mainCats.map(m => (
                    <optgroup key={m.id} label={m.name}>
                      <option value={m.id}>{m.name}</option>
                      {m.children?.map(ch => (
                        <option key={ch.id} value={ch.id}>&nbsp;&nbsp;{ch.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <select className="prel-filter-select" value={filters.commercial_id}
                  onChange={e => handleFilterChange('commercial_id', e.target.value)}>
                  <option value="">Tous commerciaux</option>
                  {commercials.map(com => (
                    <option key={com.id} value={com.id}>{com.full_name}</option>
                  ))}
                </select>
                <input className="prel-filter-select" type="date" value={filters.date_from}
                  onChange={e => handleFilterChange('date_from', e.target.value)} title="Du" />
                <input className="prel-filter-select" type="date" value={filters.date_to}
                  onChange={e => handleFilterChange('date_to', e.target.value)} title="Au" />
              </div>
            </div>

            <div className="prel-table-wrap">
              <table className="prel-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Description</th>
                    <th>Référence</th>
                    <th>Commercial</th>
                    <th style={{textAlign:'right'}}>Montant</th>
                    <th style={{width:70}}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="prel-empty">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="3" width="20" height="18" rx="2"/>
                            <line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="12" y2="16"/>
                          </svg>
                          <p>Aucun prélèvement trouvé</p>
                        </div>
                      </td>
                    </tr>
                  ) : expenses.map(exp => (
                    <tr key={exp.id}>
                      <td>{formatDate(exp.expense_date)}</td>
                      <td>
                        <span style={{fontSize:'0.82rem'}}>
                          {exp.parent_category_name ? (
                            <><span style={{color:'var(--color-text-tertiary)'}}>{exp.parent_category_name}</span> › </>
                          ) : null}
                          {exp.category_name}
                        </span>
                      </td>
                      <td>{exp.description || '—'}</td>
                      <td style={{color:'var(--color-text-tertiary)', fontSize:'0.82rem'}}>{exp.reference || '—'}</td>
                      <td>
                        {exp.commercial_name
                          ? <span className="prel-commercial-badge">{exp.commercial_name}</span>
                          : <span style={{color:'var(--color-text-tertiary)', fontSize:'0.82rem'}}>Général</span>}
                      </td>
                      <td className="prel-amount">
                        {formatMoney(exp.amount)}
                        {exp.status === 'EN_ATTENTE' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '4px', fontWeight: 600 }}>EN ATTENTE</div>
                        )}
                        {exp.status === 'REJETE' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '4px', fontWeight: 600 }}>REJETÉ</div>
                        )}
                      </td>
                      <td>
                        <div className="prel-row-actions">
                          {exp.status === 'EN_ATTENTE' ? (
                            <>
                              <button className="prel-cat-icon-btn" style={{ color: 'var(--color-success)' }} onClick={() => handleUpdateStatus(exp.id, 'VALIDE')} title="Valider">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                              <button className="prel-cat-icon-btn" style={{ color: 'var(--color-danger)' }} onClick={() => handleUpdateStatus(exp.id, 'REJETE')} title="Rejeter">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="prel-cat-icon-btn"
                                onClick={() => setEditingExpense(exp)} title="Modifier">
                                <IconEdit />
                              </button>
                              <button className="prel-cat-icon-btn danger"
                                onClick={() => setDeletingExpense(exp)} title="Supprimer">
                                <IconTrash />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="prel-pagination">
                <button className="btn btn-ghost btn-sm" disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}>← Précédent</button>
                <span>Page {page} / {totalPages} ({total} résultat{total > 1 ? 's' : ''})</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}>Suivant →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'analyse' && (
        <>
          <div className="prel-stats-range">
            <label>Du
              <input className="prel-form-input" type="date" value={statsRange.date_from}
                max={statsRange.date_to || undefined}
                onChange={e => setStatsRange(r => ({ ...r, date_from: e.target.value }))} />
            </label>
            <label>Au
              <input className="prel-form-input" type="date" value={statsRange.date_to}
                min={statsRange.date_from || undefined}
                onChange={e => setStatsRange(r => ({ ...r, date_to: e.target.value }))} />
            </label>
            <div className="prel-stats-presets">
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  setStatsRange({ date_from: first.toISOString().slice(0, 10), date_to: '' });
                }}>
                Ce mois
              </button>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const threeAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                  setStatsRange({ date_from: threeAgo.toISOString().slice(0, 10), date_to: '' });
                }}>
                3 derniers mois
              </button>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), 0, 1);
                  setStatsRange({ date_from: first.toISOString().slice(0, 10), date_to: '' });
                }}>
                Cette année
              </button>
            </div>
            {(statsRange.date_from || statsRange.date_to) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setStatsRange({ date_from: '', date_to: '' })}>
                Réinitialiser
              </button>
            )}
            <span className="prel-stats-range-hint">
              {statsRange.date_from || statsRange.date_to
                ? 'Analyse limitée à la période sélectionnée'
                : 'Toute la période (tendance sur 12 mois)'}
            </span>
          </div>
          <AnalyseTab stats={stats} categories={categories} />
        </>
      )}

      {/* Modals */}
      {showCatModal && (
        <CategoryModal categories={categories} onClose={() => setShowCatModal(false)}
          onRefresh={() => { fetchCategories(); }} />
      )}
      {showRecurringModal && (
        <RecurringModal categories={categories} commercials={commercials} onClose={() => setShowRecurringModal(false)} />
      )}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
      {editingExpense !== null && (
        <EditModal
          expense={editingExpense && typeof editingExpense === 'object' && editingExpense.id ? editingExpense : null}
          categories={categories}
          commercials={commercials}
          onClose={() => setEditingExpense(null)}
          onSaved={handleSaved}
        />
      )}
      {deletingExpense && (
        <DeleteModal expense={deletingExpense} onClose={() => setDeletingExpense(null)}
          onDeleted={handleDeleted} />
      )}
    </div>
  );
}
