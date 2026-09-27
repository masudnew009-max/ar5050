import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Home from './pages/Home';
import BecomeSeller from './pages/BecomeSeller';
import AdminDashboard from './pages/admin/AdminDashboard';
import SellerDashboard from './pages/seller/SellerDashboard';
import ComingSoon from './pages/ComingSoon';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const isCustomer = profile?.role === 'customer';

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Layout><Home /></Layout>} />

      {/* Shop browsing (Phase 10-11 build out the real product/reel feed) */}
      <Route
        path="/shop"
        element={
          <Layout>
            <ComingSoon title="Shop" phaseNote="Shoppable reels & checkout arrive in Phase 10-11." />
          </Layout>
        }
      />

      {/* Customer -> Seller registration */}
      <Route
        path="/become-seller"
        element={
          !user ? (
            <Navigate to="/" replace />
          ) : isCustomer ? (
            <Layout><BecomeSeller /></Layout>
          ) : (
            <Navigate to={isSeller || isAdmin ? '/seller' : '/'} replace />
          )
        }
      />

      {/* Admin only (Phase 6 will add the Product Approval tab) */}
      <Route
        path="/admin"
        element={
          isAdmin ? (
            <Layout>
              <AdminDashboard />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Seller only (Phase 8-9 will add Product Upload / Reel Management tabs) */}
      <Route
        path="/seller"
        element={
          isSeller || isAdmin ? (
            <Layout>
              <SellerDashboard />
            </Layout>
          ) : user ? (
            <Navigate to="/become-seller" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
