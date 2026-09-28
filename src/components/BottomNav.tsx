import { Link, useLocation } from 'react-router-dom';
import { LogIn, ClipboardList, LayoutDashboard, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isPathActive, useNavLinks } from './useNavLinks';

interface BottomNavProps {
  onLoginClick: () => void;
}

type Item = { label: string; icon: LucideIcon; path?: string; onClick?: () => void };

export default function BottomNav({ onLoginClick }: BottomNavProps) {
  const { main, user, isAdmin, isSeller } = useNavLinks();
  const location = useLocation();

  const last: Item = !user
    ? { label: 'Login', icon: LogIn, onClick: onLoginClick }
    : isAdmin
      ? { label: 'Admin', icon: Store, path: '/admin' }
      : isSeller
        ? { label: 'Dashboard', icon: LayoutDashboard, path: '/seller' }
        : { label: 'Orders', icon: ClipboardList, path: '/orders' };

  const items: Item[] = [...main.map((l) => ({ label: l.label, icon: l.icon, path: l.path })), last];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-dark-900/95 backdrop-blur-xl border-t border-white/5"
      style={{ height: 'var(--bottom-nav-h)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="h-[60px] grid grid-cols-4">
        {items.map((item) => {
          const active = item.path ? isPathActive(location.pathname, item.path) : false;
          const content = (
            <>
              <item.icon className={`w-5 h-5 ${active ? 'text-primary-400' : ''}`} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </>
          );
          const cls = `flex flex-col items-center justify-center gap-1 transition-colors ${
            active ? 'text-primary-400' : 'text-dark-400 active:text-white'
          }`;
          return item.path ? (
            <Link key={item.label} to={item.path} className={cls}>
              {content}
            </Link>
          ) : (
            <button key={item.label} onClick={item.onClick} className={cls}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
