import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import SessionExpiryModal from './components/SessionExpiryModal';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import StockPage from './pages/StockPage';
import LivraisonsListPage from './pages/LivraisonsListPage';
import CreateLivraisonPage from './pages/CreateLivraisonPage';
import LivraisonDetailPage from './pages/LivraisonDetailPage';
import SalesPage from './pages/SalesPage';
import HistoriquePage from './pages/HistoriquePage';
import DashboardPage from './pages/DashboardPage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <h1>Right Way</h1>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AppRoutesInner />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AppRoutesInner() {
  return (
    <Routes>
      <Route
        path="/"
        element={<DashboardPage />}
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN']}>
              <UsersPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN']}>
              <ProductsPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN', 'ADMIN']}>
              <StockPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/historique"
        element={
          <ProtectedRoute>
            <HistoriquePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventes/:id"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['COMMERCIAL']}>
              <SalesPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/livraisons/nouvelle"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN', 'ADMIN']}>
              <CreateLivraisonPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/livraisons/:id"
        element={
          <ProtectedRoute>
            <LivraisonDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/livraisons"
        element={
          <ProtectedRoute>
            <LivraisonsListPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <SessionExpiryModal />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
