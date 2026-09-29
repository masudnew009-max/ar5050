import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Store, Search, Menu, LogIn, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BRAND } from '../lib/brand';
import { isPathActive, useNavLinks } from './useNavLinks';

interface HeaderProps {
  onLoginClick: () => void;
  onMenuClick: () => void;
}

export default function Header({ onLoginClick, onMenuClick }: HeaderProps) {
  const { signOut } = useAuth();
  const { main, account, user, profile } = useNavLinks();
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  };

  const initial = (profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase();

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 bg-dark-900/85 backdrop-blur-xl border-b border-white/5">
      <div className="h-full max-w-7xl mx-auto px-4 lg:px-8 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-600/30">
            <Store className="w-5 h-5 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-white font-bold text-lg tracking-tight">{BRAND.name}</span>
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-primary-400">{BRAND.tagline}</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 ml-4">
          {main.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isPathActive(location.pathname, l.path)
                  ? 'bg-primary-600/15 text-primary-300'
                  : 'text-dark-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={submitSearch} className="hidden md:block flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-dark-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-11 pr-4 py-2.5 bg-dark-800 border border-dark-700 focus:border-primary-500 rounded-full text-sm text-white placeholder-dark-500"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {/* Mobile search shortcut */}
          <Link to="/shop" className="md:hidden p-2.5 text-dark-300 hover:text-white rounded-full hover:bg-white/5" aria-label="Search">
            <Search className="w-5 h-5" />
          </Link>

          {user ? (
            <div className="relative hidden lg:block" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-dark-800 border border-dark-700 hover:border-primary-600/60 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-semibold flex items-center justify-center">
                  {initial}
                </span>
                <span className="text-sm text-white max-w-[120px] truncate">{profile?.full_name || 'Account'}</span>
                <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-dark-700">
                    <p className="text-white font-medium truncate">{profile?.full_name || 'Signed in'}</p>
                    <p className="text-xs text-dark-400 truncate">{profile?.email || user.email}</p>
                    {profile?.role && (
                      <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-primary-600/20 text-primary-300 capitalize">
                        {profile.role}
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    {account.map((l) => (
                      <Link
                        key={l.path}
                        to={l.path}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-200 hover:text-white hover:bg-white/5"
                      >
                        <l.icon className="w-4 h-4 text-primary-400" /> {l.label}
                      </Link>
                    ))}
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-full shadow-lg shadow-primary-600/30 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Login
            </button>
          )}

          <button onClick={onMenuClick} className="p-2.5 text-dark-200 hover:text-white rounded-full hover:bg-white/5" aria-label="Menu">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
}
