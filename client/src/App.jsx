import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import SessionExpiryModal from './components/SessionExpiryModal';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import TruckLoader from './components/TruckLoader';
import { ToastProvider } from './context/ToastContext';
import { PushProvider } from './context/PushContext';
import { CategoryPaletteProvider } from './context/CategoryPaletteContext';

// Eager — critical path, always loaded
import LoginPage from './pages/LoginPage';

// Lazy-loaded page components — reduces initial bundle by ~60%
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const BenefitsPage = lazy(() => import('./pages/BenefitsPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const LivraisonsListPage = lazy(() => import('./pages/LivraisonsListPage'));
const CreateLivraisonPage = lazy(() => import('./pages/CreateLivraisonPage'));
const LivraisonDetailPage = lazy(() => import('./pages/LivraisonDetailPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const RealtimeMonitorPage = lazy(() => import('./pages/RealtimeMonitorPage'));
const HistoriquePage = lazy(() => import('./pages/HistoriquePage'));
const CommercialsPage = lazy(() => import('./pages/CommercialsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PrelevementPage = lazy(() => import('./pages/PrelevementPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <TruckLoader />;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Suspense fallback={<TruckLoader fullscreen={false} />}>
                <AppRoutesInner />
              </Suspense>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === 'COMMERCIAL' || user?.role === 'DIRECTEUR_COMMERCIAL' || user?.role === 'MAGASINIER') {
    return <Navigate to="/livraisons" replace />;
  }
  return <DashboardPage />;
}

function AppRoutesInner() {
  return (
    <Routes>
      <Route
        path="/"
        element={<HomeRoute />}
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
        path="/prelevements"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN']}>
              <PrelevementPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/benefits"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN']}>
              <BenefitsPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER']}>
              <StockPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/commercials"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN']}>
              <CommercialsPage />
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/historique"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'COMMERCIAL']}>
              <HistoriquePage />
            </RoleGuard>
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
        path="/livraisons/:id/realtime"
        element={
          <ProtectedRoute>
            <RealtimeMonitorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/livraisons/nouvelle"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL']}>
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
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parametres"
        element={
          <ProtectedRoute>
            <RoleGuard roles={['SUPER_ADMIN']}>
              <AdminSettingsPage />
            </RoleGuard>
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
          <PushProvider>
            <CategoryPaletteProvider>
              <AppRoutes />
              <SessionExpiryModal />
            </CategoryPaletteProvider>
          </PushProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
