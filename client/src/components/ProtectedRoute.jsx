import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !token) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [token, loading, navigate, location]);

  if (loading || !token) {
    return (
      <div className="app-shell">
        <h1>Right Way</h1>
        <p>Chargement...</p>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
