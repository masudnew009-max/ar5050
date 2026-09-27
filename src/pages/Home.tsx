import { ShoppingBag } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { user, profile } = useAuth();

  return (
    <div className="text-white text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600/20 rounded-2xl mb-6">
        <ShoppingBag className="w-8 h-8 text-primary-400" />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold mb-3">Multi-Vendor Marketplace</h1>
      <p className="text-dark-400 max-w-xl mx-auto">
        Sign in, browse the shop, or register your own shop from the sidebar
        to start selling.
      </p>

      {user && (
        <div className="mt-8 inline-block text-left bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-sm text-dark-400">Signed in as</p>
          <p className="font-medium">{profile?.email ?? user.email}</p>
          <p className="text-sm text-primary-400 mt-1">Role: {profile?.role ?? 'loading...'}</p>
        </div>
      )}
    </div>
  );
}
