import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, LogIn, LogOut, Search } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PRODUCT_CATEGORIES } from '../lib/categories';
import { categoryIcon } from '../lib/category-icons';
import { BRAND } from '../lib/brand';
import { isPathActive, useNavLinks } from './useNavLinks';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  onLoginClick: () => void;
}

export default function MobileMenu({ open, onClose, onLoginClick }: MobileMenuProps) {
  const { signOut } = useAuth();
  const { main, account, user, profile } = useNavLinks();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) onClose();
    // close whenever the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
    setQuery('');
  };

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
      active ? 'bg-primary-600/15 text-primary-300' : 'text-dark-200 hover:text-white hover:bg-white/5'
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 z-[70] w-80 max-w-[85vw] bg-dark-900 border-l border-dark-700 flex flex-col transition-transform duration-300 lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-dark-700 shrink-0">
          <span className="text-white font-bold">{BRAND.name}</span>
          <button onClick={onClose} className="p-2 text-dark-300 hover:text-white" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <form onSubmit={submit} className="relative">
            <Search className="w-4 h-4 text-dark-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 focus:border-primary-500 rounded-xl text-sm text-white placeholder-dark-500"
            />
          </form>

          <nav className="space-y-1">
            {main.map((l) => (
              <Link key={l.path} to={l.path} className={linkClass(isPathActive(location.pathname, l.path))}>
                <l.icon className="w-5 h-5" /> {l.label}
              </Link>
            ))}
          </nav>

          {account.length > 0 && (
            <div>
              <p className="px-4 mb-2 text-[11px] uppercase tracking-wider text-dark-500">Account</p>
              <nav className="space-y-1">
                {account.map((l) => (
                  <Link key={l.path} to={l.path} className={linkClass(isPathActive(location.pathname, l.path))}>
                    <l.icon className="w-5 h-5" /> {l.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          <div>
            <p className="px-4 mb-2 text-[11px] uppercase tracking-wider text-dark-500">Categories</p>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCT_CATEGORIES.filter((c) => c !== 'Other').map((c) => {
                const Icon = categoryIcon(c);
                return (
                  <Link
                    key={c}
                    to={`/shop?category=${encodeURIComponent(c)}`}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-xs text-dark-200 hover:border-primary-600/50"
                  >
                    <Icon className="w-4 h-4 text-primary-400 shrink-0" />
                    <span className="truncate">{c}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-dark-700 shrink-0">
          {user ? (
            <>
              <p className="text-sm text-white font-medium truncate">{profile?.full_name || 'Signed in'}</p>
              <p className="text-xs text-dark-400 truncate mb-3">{profile?.email || user.email}</p>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                onClose();
                onLoginClick();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold"
            >
              <LogIn className="w-4 h-4" /> Login / Sign up
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
