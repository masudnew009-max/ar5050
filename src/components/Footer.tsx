import { Link } from 'react-router-dom';
import { Store, Phone, Mail, MapPin, Banknote } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { PRODUCT_CATEGORIES } from '../lib/categories';
import { useNavLinks } from './useNavLinks';

export default function Footer() {
  const { account, user } = useNavLinks();
  const { phone, email, address } = BRAND.contact;
  const hasContact = phone || email || address;
  const quickCategories = PRODUCT_CATEGORIES.filter((c) => c !== 'Other').slice(0, 6);

  const colTitle = 'text-white font-semibold text-sm mb-4';
  const linkClass = 'text-sm text-dark-400 hover:text-primary-300 transition-colors';

  return (
    <footer className="mt-8 border-t border-white/5 bg-gradient-to-b from-dark-900 to-dark-950">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-12 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </span>
              <span className="text-white font-bold text-lg">{BRAND.name}</span>
            </Link>
            <p className="text-sm text-dark-400 leading-relaxed max-w-xs">{BRAND.about}</p>
            <span className="inline-flex items-center gap-2 mt-5 px-3 py-1.5 rounded-full bg-primary-600/10 border border-primary-600/30 text-xs text-primary-300">
              <Banknote className="w-3.5 h-3.5" /> Cash on Delivery available
            </span>
          </div>

          {/* Explore */}
          <div>
            <h3 className={colTitle}>Explore</h3>
            <ul className="space-y-2.5">
              <li><Link to="/shop" className={linkClass}>Shop</Link></li>
              <li><Link to="/reels" className={linkClass}>Shoppable Reels</Link></li>
              {quickCategories.map((c) => (
                <li key={c}>
                  <Link to={`/shop?category=${encodeURIComponent(c)}`} className={linkClass}>{c}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account / sell */}
          <div>
            <h3 className={colTitle}>{user ? 'Your account' : 'Sell with us'}</h3>
            <ul className="space-y-2.5">
              {account.map((l) => (
                <li key={l.path}><Link to={l.path} className={linkClass}>{l.label}</Link></li>
              ))}
              {!user && <li className="text-sm text-dark-400">Sign in to track orders or open your own shop.</li>}
            </ul>
          </div>

          {/* Contact */}
          {hasContact && (
            <div>
              <h3 className={colTitle}>Contact</h3>
              <ul className="space-y-3 text-sm text-dark-400">
                {phone && <li className="flex gap-2"><Phone className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />{phone}</li>}
                {email && <li className="flex gap-2"><Mail className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />{email}</li>}
                {address && <li className="flex gap-2"><MapPin className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />{address}</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-dark-500">
          <p>&copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          <p>{BRAND.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
