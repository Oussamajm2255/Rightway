import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '../lib/api';
import { formatDateTime, formatDT } from '../lib/utils';
import './UsersPage.css';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [togglingRem, setTogglingRem] = useState(null); // id of user being toggled
  const [editingSalary, setEditingSalary] = useState(null); // { userId, value }
  const [savingSalary, setSavingSalary] = useState(null); // userId being saved

  async function handleChangeRemuneration(userId, newType) {
    setTogglingRem(userId);
    try {
      await apiPut(`/users/${userId}`, { remuneration_type: newType });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingRem(null);
    }
  }

  function startEditSalary(userId, currentAmount) {
    setEditingSalary({ userId, value: currentAmount != null ? String(currentAmount) : '' });
  }

  function cancelEditSalary() {
    setEditingSalary(null);
  }

  async function saveSalary(userId) {
    if (!editingSalary || editingSalary.userId !== userId) return;
    const raw = editingSalary.value.trim();
    if (raw === '') {
      cancelEditSalary();
      return;
    }
    setSavingSalary(userId);
    try {
      await apiPut(`/users/${userId}`, { salary_amount: parseFloat(raw) });
      cancelEditSalary();
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSalary(null);
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      if (search) params.append('search', search);
      const data = await apiGet(`/users?${params.toString()}`);
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleEdit(user) {
    setEditingUser(user);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingUser(null);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingUser(null);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  }

  function handleDeleteClick(user) {
    setDeletingUser(user);
    setDeletePassword('');
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (!deletePassword) {
      setDeleteError('Veuillez saisir votre mot de passe.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await apiPut(`/users/${deletingUser.id}/deactivate`, { password: deletePassword });
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function getRoleBadge(role) {
    const map = {
      SUPER_ADMIN: { label: 'Super Admin', className: 'badge-super-admin' },
      DIRECTEUR_COMMERCIAL: { label: 'Directeur Com.', className: 'badge-directeur' },
      MAGASINIER: { label: 'Magasinier', className: 'badge-magasinier' },
      COMMERCIAL: { label: 'Commercial', className: 'badge-commercial' },
    };
    const item = map[role] || { label: role, className: '' };
    return <span className={`badge ${item.className}`}>{item.label}</span>;
  }

  return (
    <div className="users-page">
      <div className="brand-masthead">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle">Gérez les comptes Admin et Commercial</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Nouvel utilisateur
        </button>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Tous les rôles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="DIRECTEUR_COMMERCIAL">Directeur Commercial</option>
          <option value="MAGASINIER">Magasinier</option>
          <option value="COMMERCIAL">Commercial</option>
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-state">Chargement des utilisateurs...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <p>Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="table-container cards-on-mobile">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom complet</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Rémunération</th>
                <th>Téléphone</th>
                <th>Véhicule</th>
                <th>Statut</th>
                <th>Dernière connexion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'row-inactive' : ''}>
                  <td className="td-name" data-label="Nom">{user.full_name}</td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Rôle">{getRoleBadge(user.role)}</td>
                  <td data-label="Rémunération">
                    {(user.role === 'COMMERCIAL' || user.role === 'MAGASINIER' || user.role === 'DIRECTEUR_COMMERCIAL') ? (
                      <>
                        <div className="rem-toggle">
                          <button
                            className={`rem-toggle-btn commission${(user.remuneration_type || 'COMMISSION') === 'COMMISSION' ? ' active' : ''}`}
                            onClick={() => handleChangeRemuneration(user.id, 'COMMISSION')}
                            disabled={togglingRem === user.id}
                            title="Commission"
                          >
                            <svg className="rem-icon" viewBox="0 0 14 14" fill="none">
                              <path d="M2 12L5.5 7.5L8 10L12 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M9.5 4.5H12V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Commission
                          </button>
                          <button
                            className={`rem-toggle-btn salaire${user.remuneration_type === 'SALAIRE' ? ' active' : ''}`}
                            onClick={() => handleChangeRemuneration(user.id, 'SALAIRE')}
                            disabled={togglingRem === user.id}
                            title="Salaire"
                          >
                            <svg className="rem-icon" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                              <path d="M7 4V10M5 5.5H8.2C9 5.5 9.8 6.2 9.8 7C9.8 7.8 9 8.5 8.2 8.5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Salaire
                          </button>
                        </div>
                        {user.remuneration_type === 'SALAIRE' && (
                          editingSalary?.userId === user.id ? (
                            <div className="rem-salary-edit">
                              <input
                                className="rem-salary-input"
                                type="number"
                                step="0.001"
                                min="0"
                                value={editingSalary.value}
                                onChange={(e) => setEditingSalary({ userId: user.id, value: e.target.value })}
                                onBlur={() => saveSalary(user.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSalary(user.id);
                                  if (e.key === 'Escape') cancelEditSalary();
                                }}
                                autoFocus
                                disabled={savingSalary === user.id}
                              />
                              {savingSalary === user.id && <span className="rem-saving-spinner" />}
                            </div>
                          ) : (
                            <div
                              className="rem-salary rem-salary-clickable"
                              onClick={() => startEditSalary(user.id, user.salary_amount)}
                              title="Cliquer pour modifier le salaire"
                            >
                              {formatDT(user.salary_amount)}
                            </div>
                          )
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td data-label="Téléphone">{user.phone || '—'}</td>
                  <td className="td-vehicle" data-label="Véhicule">
                    {user.vehicle_name ? (
                      <span>
                        {user.vehicle_name}
                        {user.vehicle_plate && (
                          <span className="vehicle-plate">{user.vehicle_plate}</span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                  <td data-label="Statut">
                    <span className={`status-dot ${user.is_active ? 'active' : 'inactive'}`} />
                    {user.is_active ? 'Actif' : 'Inactif'}
                  </td>
                  <td className="td-date" data-label="Dernière connexion">
                    {user.last_login_at
                      ? formatDateTime(user.last_login_at)
                      : 'Jamais'}
                  </td>
                  <td className="td-actions">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleEdit(user)}
                    >
                      Modifier
                    </button>
                    {user.is_active && user.role !== 'SUPER_ADMIN' && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteClick(user)}
                      >
                        Désactiver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Form Modal */}
      {showForm && (
        <UserFormModal
          user={editingUser}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="modal-overlay" onClick={() => setDeletingUser(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Désactiver l'utilisateur</h3>
            <div className="modal-summary">
              <p>Vous allez désactiver le compte de :</p>
              <p className="summary-highlight">{deletingUser.full_name} ({deletingUser.email})</p>
              <p className="summary-role">Rôle : {deletingUser.role}</p>
            </div>
            <p className="modal-warning">Cette action est irréversible. L'utilisateur ne pourra plus se connecter.</p>

            {deleteError && <div className="login-error">{deleteError}</div>}

            <div className="form-group">
              <label className="form-label">Votre mot de passe</label>
              <input
                type="password"
                className="form-input"
                placeholder="Mot de passe pour confirmer"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeletingUser(null)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'Désactivation...' : 'Confirmer la désactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== User Form Modal ===== */
function UserFormModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'COMMERCIAL',
    phone: user?.phone || '',
    vehicle_name: user?.vehicle_name || '',
    vehicle_plate: user?.vehicle_plate || '',
    remuneration_type: user?.remuneration_type || 'COMMISSION',
    salary_amount: user?.salary_amount || '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!formData.full_name.trim() || !formData.email.trim()) {
      setError('Le nom et l\'email sont obligatoires.');
      return;
    }
    if (!isEdit && !formData.password) {
      setError('Le mot de passe est obligatoire pour un nouvel utilisateur.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const body = { ...formData };
        if (!body.password) delete body.password;
        await apiPut(`/users/${user.id}`, body);
      } else {
        await apiPost('/users', formData);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-form" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h3>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nom complet *</label>
              <input name="full_name" className="form-input" value={formData.full_name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input name="email" type="email" className="form-input" value={formData.email} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mot de passe {!isEdit && '*'}</label>
              <input name="password" type="password" className="form-input" value={formData.password} onChange={handleChange} placeholder={isEdit ? 'Laisser vide pour ne pas changer' : ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Rôle *</label>
              <select name="role" className="form-input" value={formData.role} onChange={handleChange} disabled={isEdit && user.role === 'SUPER_ADMIN'}>
                <option value="DIRECTEUR_COMMERCIAL">Directeur Commercial</option>
                <option value="MAGASINIER">Magasinier</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
          </div>
          
          {(formData.role === 'COMMERCIAL' || formData.role === 'MAGASINIER' || formData.role === 'DIRECTEUR_COMMERCIAL') && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rémunération</label>
                <div className="rem-toggle">
                  <button
                    type="button"
                    className={`rem-toggle-btn commission${formData.remuneration_type === 'COMMISSION' ? ' active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, remuneration_type: 'COMMISSION' }))}
                  >
                    <svg className="rem-icon" viewBox="0 0 14 14" fill="none">
                      <path d="M2 12L5.5 7.5L8 10L12 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9.5 4.5H12V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Commission
                  </button>
                  <button
                    type="button"
                    className={`rem-toggle-btn salaire${formData.remuneration_type === 'SALAIRE' ? ' active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, remuneration_type: 'SALAIRE' }))}
                  >
                    <svg className="rem-icon" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M7 4V10M5 5.5H8.2C9 5.5 9.8 6.2 9.8 7C9.8 7.8 9 8.5 8.2 8.5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Salaire
                  </button>
                </div>
              </div>
              
              {formData.remuneration_type === 'SALAIRE' && (
                <div className="form-group">
                  <label className="form-label">Montant du Salaire Mensuel (DT) *</label>
                  <input name="salary_amount" type="number" step="0.001" min="0" className="form-input" value={formData.salary_amount} onChange={handleChange} placeholder="Ex: 1200.000" />
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input name="phone" className="form-input" value={formData.phone} onChange={handleChange} placeholder="+216 XX XXX XXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Véhicule (nom)</label>
              <input name="vehicle_name" className="form-input" value={formData.vehicle_name} onChange={handleChange} placeholder="Ex: Isuzu NPR" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Plaque d'immatriculation</label>
              <input name="vehicle_plate" className="form-input" value={formData.vehicle_plate} onChange={handleChange} placeholder="Ex: 215 TUN 1234" />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Enregistrement...' : (isEdit ? 'Enregistrer les modifications' : 'Créer l\'utilisateur')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsersPage;
