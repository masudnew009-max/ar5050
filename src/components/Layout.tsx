import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Store,
  ShoppingBag,
  LogOut,
  LogIn,
  Menu,
  X,
  User,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { AuthModal } from './AuthModal';
import Footer from './Footer';
import InstallButton from './InstallButton';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isLoggedIn = !!user;
  const isAdmin = profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const isCustomer = profile?.role === 'customer';

  const navItems = [
    { label: 'Shop', path: '/shop', icon: ShoppingBag, show: true },
    { label: 'Become a Seller', path: '/become-seller', icon: Sparkles, show: isLoggedIn && isCustomer },
    { label: 'Seller Dashboard', path: '/seller', icon: LayoutDashboard, show: isSeller || isAdmin },
    { label: 'Admin Panel', path: '/admin', icon: Store, show: isAdmin },
  ].filter((item) => item.show);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-800/95 backdrop-blur-xl border-b border-dark-700">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:block text-white font-bold text-lg">Marketplace</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-dark-700/50 rounded-xl">
                  <User className="w-4 h-4 text-primary-400" />
                  <span className="text-white text-sm truncate max-w-[180px]">
                    {profile?.email || user?.email}
                  </span>
                  {profile?.role && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary-600/20 text-primary-400 capitalize">
                      {profile.role}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 text-dark-400 hover:text-white"
                >
                  {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>

                <button
                  onClick={signOut}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 text-dark-400 hover:text-white"
                >
                  {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>

                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-600/30"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-[60px] bottom-0 w-64 bg-dark-800/95 backdrop-blur-xl border-r border-dark-700 z-40 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {isLoggedIn && profile && (
            <div className="p-4 border-b border-dark-700 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-semibold">
                    {profile.full_name?.charAt(0) || profile.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{profile.full_name || 'User'}</p>
                  <p className="text-xs text-dark-400 truncate">{profile.email}</p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.path)
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-dark-700">
            {!isLoggedIn ? (
              <div className="text-center text-dark-500 text-xs">
                <p>Multi-Vendor Marketplace</p>
              </div>
            ) : (
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 w-full text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all lg:hidden"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="lg:ml-64 pt-[60px]">
        <div className="p-4 lg:p-8">{children}</div>
        <Footer />
      </main>

      <InstallButton />

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
