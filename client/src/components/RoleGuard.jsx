import { useAuth } from '../context/AuthContext';

function RoleGuard({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="app-shell">
        <h1>Right Way</h1>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="app-shell">
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Accès refusé</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Vous n'avez pas les droits nécessaires pour accéder à cette page.
            Veuillez contacter un administrateur si vous pensez qu'il s'agit d'une erreur.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default RoleGuard;
