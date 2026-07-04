import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiGet, apiPost, apiPut } from '../lib/api';
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
function EditModal({ expense, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    category_id: expense?.category_id || '',
    amount: expense?.amount || '',
    description: expense?.description || '',
    reference: expense?.reference || '',
    expense_date: expense?.expense_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
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
function RecurringModal({ categories, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({ category_id: '', amount: '', description: '' });
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

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/prelevements/recurring', {
        category_id: parseInt(form.category_id),
        amount: parseFloat(form.amount),
        description: form.description || undefined
      });
      setForm({ category_id: '', amount: '', description: '' });
      fetchItems();
    } catch (e) { setError(e.message); }
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
      fetchItems();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="prel-cat-modal-overlay" onClick={onClose}>
      <div className="prel-cat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h3>Gérer les charges fixes mensuelles</h3>
        {error && <div className="prel-error">{error}</div>}
        
        <form onSubmit={handleAdd} className="prel-cat-add-row" style={{ flexDirection: 'column', gap: '8px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
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
            <input className="prel-form-input" type="number" step="0.01" min="0.01" placeholder="Montant" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required style={{ width: '100px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="prel-form-input" placeholder="Description (ex: Loyer, Internet...)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-sm"><IconPlus /> Ajouter</button>
          </div>
        </form>

        <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '16px' }}>
          {loading ? <p>Chargement...</p> : items.length === 0 ? <p style={{ color: 'var(--color-text-tertiary)' }}>Aucune charge fixe.</p> : (
            <ul className="prel-cat-tree">
              {items.map(item => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <div>
                    <div style={{ fontWeight: 500, opacity: item.is_active ? 1 : 0.5 }}>{item.description || 'Sans description'} - {formatMoney(item.amount)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>{item.parent_category_name ? `${item.parent_category_name} › ` : ''}{item.category_name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost btn-sm" style={{ color: item.is_active ? 'var(--color-success)' : 'var(--color-text-tertiary)' }} onClick={() => handleToggle(item.id, item.is_active)}>
                      {item.is_active ? 'Actif' : 'Inactif'}
                    </button>
                    <button className="prel-cat-icon-btn danger" onClick={() => handleDelete(item.id)} title="Supprimer"><IconTrash /></button>
                  </div>
                </li>
              ))}
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

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function PrelevementPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('declaration');
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category_id: '', date_from: '', date_to: '', search: '' });
  const [stats, setStats] = useState(null);

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);
  const [generating, setGenerating] = useState(false);

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

  const fetchExpenses = useCallback(async (p = page) => {
    try {
      const params = new URLSearchParams();
      params.set('page', p);
      params.set('limit', LIMIT);
      if (filters.category_id) params.set('category_id', filters.category_id);
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
      const data = await apiGet('/prelevements/stats');
      setStats(data.stats || null);
    } catch (err) {
      console.error('[Prelevement] fetchStats error:', err.message);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  useEffect(() => {
    if (tab === 'declaration') fetchExpenses();
    else fetchStats();
  }, [tab]);

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

  async function handleGenerateSalaries() {
    if (!window.confirm("Voulez-vous générer les propositions de salaires pour ce mois ?")) return;
    setGenerating(true);
    try {
      const res = await apiPost('/prelevements/generate-salaries');
      toast?.success?.(res.message || 'Salaires générés.');
      fetchExpenses();
    } catch (err) {
      toast?.error?.(err.message || 'Erreur lors de la génération.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateRecurring() {
    if (!window.confirm("Voulez-vous générer les charges fixes pour ce mois ?")) return;
    setGenerating(true);
    try {
      const res = await apiPost('/prelevements/generate-recurring');
      toast?.success?.(res.message || 'Charges fixes générées.');
      fetchExpenses();
    } catch (err) {
      toast?.error?.(err.message || 'Erreur lors de la génération.');
    } finally {
      setGenerating(false);
    }
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

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button className="prel-cat-btn" onClick={() => setShowCatModal(true)} style={{ flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Gérer les catégories
              </button>
              <button className="prel-cat-btn" onClick={() => setShowRecurringModal(true)} style={{ flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                Gérer les charges fixes
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className="btn btn-sm btn-outline-primary" onClick={handleGenerateSalaries} disabled={generating} style={{ flex: 1, padding: '0 8px' }}>
                {generating ? '...' : 'Générer Salaires'}
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={handleGenerateRecurring} disabled={generating} style={{ flex: 1, padding: '0 8px' }}>
                {generating ? '...' : 'Générer Charges Fixes'}
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
                    <th style={{textAlign:'right'}}>Montant</th>
                    <th style={{width:70}}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
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
        <AnalyseTab stats={stats} categories={categories} />
      )}

      {/* Modals */}
      {showCatModal && (
        <CategoryModal categories={categories} onClose={() => setShowCatModal(false)}
          onRefresh={() => { fetchCategories(); }} />
      )}
      {showRecurringModal && (
        <RecurringModal categories={categories} onClose={() => setShowRecurringModal(false)} />
      )}
      {editingExpense !== null && (
        <EditModal
          expense={editingExpense && typeof editingExpense === 'object' && editingExpense.id ? editingExpense : null}
          categories={categories}
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
