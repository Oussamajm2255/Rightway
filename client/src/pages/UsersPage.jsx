import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost } from '../lib/api';
import { formatDateTime } from '../lib/utils';
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

  async function handleToggleRemuneration(user) {
    const newType = user.remuneration_type === 'SALAIRE' ? 'COMMISSION' : 'SALAIRE';
    setTogglingRem(user.id);
    try {
      await apiPut(`/users/${user.id}`, { remuneration_type: newType });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingRem(null);
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
      ADMIN: { label: 'Admin', className: 'badge-admin' },
      COMMERCIAL: { label: 'Commercial', className: 'badge-commercial' },
    };
    const item = map[role] || { label: role, className: '' };
    return <span className={`badge ${item.className}`}>{item.label}</span>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
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
          <option value="ADMIN">Admin</option>
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
        <div className="table-container">
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
                  <td className="td-name">{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td>
                    {user.role === 'COMMERCIAL' ? (
                      <button
                        className={`btn btn-sm ${user.remuneration_type === 'SALAIRE' ? 'btn-outline-warning' : 'btn-outline-success'}`}
                        onClick={() => handleToggleRemuneration(user)}
                        disabled={togglingRem === user.id}
                        title={user.remuneration_type === 'SALAIRE' ? 'Passer en Commission' : 'Passer en Salaire'}
                      >
                        {togglingRem === user.id ? '...' : (
                          user.remuneration_type === 'SALAIRE' ? '💼 Salaire' : '💰 Commission'
                        )}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>{user.phone || '—'}</td>
                  <td className="td-vehicle">
                    {user.vehicle_name ? (
                      <span>
                        {user.vehicle_name}
                        {user.vehicle_plate && (
                          <span className="vehicle-plate">{user.vehicle_plate}</span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`status-dot ${user.is_active ? 'active' : 'inactive'}`} />
                    {user.is_active ? 'Actif' : 'Inactif'}
                  </td>
                  <td className="td-date">
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
                <option value="ADMIN">Admin (Gestionnaire Dépôt)</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
          </div>

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
