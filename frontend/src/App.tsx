import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/layout';
import { ToastContainer } from './components/ui';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SetupPage } from './pages/auth/SetupPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { BillingPage } from './pages/billing/BillingPage';
import OnlineOrdersPage from './pages/online-orders/OnlineOrdersPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { SectionsPage } from './pages/sections/SectionsPage';
import { TablesPage } from './pages/tables/TablesPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import BusserPage from './pages/busser/BusserPage';
import { NotFoundPage } from './pages/error/ErrorPage';
import NFCOrdering from './pages/nfc/NFCOrdering';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: '#fff0f0' }}>
          <h1>Something went wrong</h1>
          <h2>Error Message:</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <h2>Error Name:</h2>
          <pre>{this.state.error?.name}</pre>
          <h2>Stack Trace:</h2>
          <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
          <h2>Component Stack:</h2>
          <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap' }}>{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  const { checkAuth, checkSetup, needsSetup, isAuthenticated, isLoading, user } = useAuthStore();
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    const init = async () => {
      await checkSetup();
      await checkAuth();
      setCheckingSetup(false);
    };
    init();
  }, []);

  // Show loading while checking setup
  if (checkingSetup || isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Loading Oyebill...</p>
        </div>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ToastContainer />
        <Routes>
        {/* Auth Routes */}
        <Route
          path="/login"
          element={
            needsSetup ? (
              <Navigate to="/setup" replace />
            ) : isAuthenticated ? (
              <Navigate to="/billing" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/setup"
          element={needsSetup ? <SetupPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/reset-password"
          element={
            isAuthenticated && user?.mustResetPassword ? (
              <ResetPasswordPage />
            ) : (
              <Navigate to="/billing" replace />
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <BillingPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/online-orders"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <OnlineOrdersPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <ProductsPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <CategoriesPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sections"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <SectionsPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <TablesPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <SettingsPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/busser"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <BusserPage />
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              {user?.mustResetPassword ? (
                <Navigate to="/reset-password" replace />
              ) : (
                <CustomersPage />
              )}
            </ProtectedRoute>
          }
        />

        {/* NFC/QR Customer Ordering - Public Route */}
        <Route
          path="/order/:tableNumber"
          element={<NFCOrdering />}
        />

        {/* Default Redirect */}
        <Route
          path="/"
          element={<Navigate to="/billing" replace />}
        />
        <Route
          path="*"
          element={<NotFoundPage />}
        />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;