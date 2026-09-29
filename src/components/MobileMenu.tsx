import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, LogIn, LogOut, ChevronRight, LayoutGrid } from 'lucide-react';
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

/**
 * Slide-in drawer (opens from the hamburger icon, on every screen size):
 * who you are, all categories, the main pages, then your account links.
 */
export default function MobileMenu({ open, onClose, onLoginClick }: MobileMenuProps) {
  const { signOut } = useAuth();
  const { main, account, user, profile } = useNavLinks();
  const location = useLocation();

  const activeCategory =
    location.pathname === '/shop' ? new URLSearchParams(location.search).get('category') : null;
  const onAllCategories = location.pathname === '/shop' && !activeCategory;

  // close whenever the route changes
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // lock page scroll + close on Escape while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const initial = (
    profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || user?.email?.charAt(0) || '?'
  ).toUpperCase();

  const rowClass = (active: boolean) =>
    `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
      active
        ? 'bg-primary-600/15 text-primary-300 font-medium'
        : 'text-dark-200 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        className={`fixed bottom-0 left-0 top-0 z-[70] flex w-80 max-w-[85vw] flex-col border-r border-dark-700 bg-dark-900 transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Who you are */}
        <div className="shrink-0 border-b border-dark-700 bg-gradient-to-br from-primary-700/40 to-dark-900 px-5 pb-4 pt-4">
          <div className="flex items-start justify-between">
            <span className="text-sm font-semibold text-white/80">{BRAND.name}</span>
            <button
              onClick={onClose}
              className="-mr-2 -mt-1 p-2 text-dark-300 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {user ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-lg font-semibold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{profile?.full_name || 'Signed in'}</p>
                <p className="truncate text-xs text-dark-300">{profile?.email || user.email}</p>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-3 text-sm text-dark-200">Sign in to track orders and like reels.</p>
              <button
                onClick={() => {
                  onClose();
                  onLoginClick();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white"
              >
                <LogIn className="h-4 w-4" /> Login / Sign up
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
          {/* Categories */}
          <p className="px-5 pb-1 pt-4 text-xs font-medium text-dark-400">Shop by category</p>
          <nav>
            <Link to="/shop" className={rowClass(onAllCategories)}>
              <LayoutGrid className="h-5 w-5 shrink-0 text-primary-400" />
              <span className="flex-1">All Categories</span>
              <ChevronRight className="h-4 w-4 text-dark-500" />
            </Link>
            {PRODUCT_CATEGORIES.filter((c) => c !== 'Other').map((c) => {
              const Icon = categoryIcon(c);
              return (
                <Link
                  key={c}
                  to={`/shop?category=${encodeURIComponent(c)}`}
                  className={rowClass(activeCategory === c)}
                >
                  <Icon className="h-5 w-5 shrink-0 text-primary-400" />
                  <span className="flex-1">{c}</span>
                  <ChevronRight className="h-4 w-4 text-dark-500" />
                </Link>
              );
            })}
          </nav>

          {/* Main pages */}
          <div className="mx-5 my-3 border-t border-dark-700" />
          <nav>
            {main.map((l) => (
              <Link key={l.path} to={l.path} className={rowClass(isPathActive(location.pathname, l.path))}>
                <l.icon className="h-5 w-5 shrink-0" />
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Account */}
          {account.length > 0 && (
            <>
              <div className="mx-5 my-3 border-t border-dark-700" />
              <p className="px-5 pb-1 text-xs font-medium text-dark-400">My account</p>
              <nav>
                {account.map((l) => (
                  <Link key={l.path} to={l.path} className={rowClass(isPathActive(location.pathname, l.path))}>
                    <l.icon className="h-5 w-5 shrink-0" />
                    {l.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>

        {user && (
          <div className="shrink-0 border-t border-dark-700 p-4">
            <button
              onClick={() => {
                onClose();
                signOut();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-3 text-sm font-medium text-red-400"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
