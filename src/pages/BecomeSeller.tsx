import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { registerSeller } from '../lib/supabase';

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function BecomeSeller() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [shopDescription, setShopDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShopNameChange = (value: string) => {
    setShopName(value);
    if (!slugTouched) setShopSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerSeller({
        shopName,
        shopSlug: slugify(shopSlug),
        shopDescription: shopDescription || undefined,
        contactPhone: contactPhone || undefined,
        address: address || undefined,
      });
      await refreshProfile();
      navigate('/seller');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto text-white">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600/20 rounded-2xl mb-3">
          <Store className="w-7 h-7 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold">Become a Seller</h1>
        <p className="text-dark-400 text-sm mt-1">
          Set up your shop to start listing products. Products still need
          admin approval before they go live.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-dark-800 border border-dark-700 rounded-2xl p-6">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">Shop Name</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => handleShopNameChange(e.target.value)}
            required
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g. Rahman Fashion House"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">Shop URL</label>
          <div className="flex items-center gap-2">
            <span className="text-dark-500 text-sm">/shop/</span>
            <input
              type="text"
              value={shopSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setShopSlug(e.target.value);
              }}
              required
              className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="rahman-fashion-house"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">Shop Description</label>
          <textarea
            value={shopDescription}
            onChange={(e) => setShopDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="What do you sell?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">Contact Phone</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="01XXXXXXXXX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Shop / warehouse address"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-600/30 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {loading ? 'Creating shop...' : 'Create Shop'}
        </button>
      </form>
    </div>
  );
}
