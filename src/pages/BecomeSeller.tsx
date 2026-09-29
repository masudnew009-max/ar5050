import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2, CreditCard, ImagePlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { registerSeller, supabase } from '../lib/supabase';

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface IdImagePickerProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function IdImagePicker({ label, file, onChange }: IdImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    onChange(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  return (
    <label className="flex flex-col items-center justify-center gap-1.5 h-28 rounded-xl bg-dark-700 border border-dashed border-dark-600 cursor-pointer hover:border-primary-500 transition-colors overflow-hidden text-dark-400 text-xs text-center px-2">
      {preview ? (
        <img src={preview} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <ImagePlus className="w-6 h-6" />
          {label}
        </>
      )}
      <input type="file" accept="image/*" onChange={handleChange} className="hidden" required={!file} />
    </label>
  );
}

export default function BecomeSeller() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [shopDescription, setShopDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  const [nidNumber, setNidNumber] = useState('');
  const [nidName, setNidName] = useState('');
  const [nidFront, setNidFront] = useState<File | null>(null);
  const [nidBack, setNidBack] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShopNameChange = (value: string) => {
    setShopName(value);
    if (!slugTouched) setShopSlug(slugify(value));
  };

  const uploadNidImage = async (file: File, side: 'front' | 'back') => {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('seller-kyc').upload(path, file);
    if (error) throw error;
    return path; // stored as a path, not a public URL — the bucket is private
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nidFront || !nidBack) {
      setError('Please upload photos of both sides of your NID');
      return;
    }

    setLoading(true);
    try {
      const [nidFrontPath, nidBackPath] = await Promise.all([
        uploadNidImage(nidFront, 'front'),
        uploadNidImage(nidBack, 'back'),
      ]);

      await registerSeller({
        shopName,
        shopSlug: slugify(shopSlug),
        nidNumber,
        nidName,
        nidFrontPath,
        nidBackPath,
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

        <div className="pt-2 border-t border-dark-700">
          <p className="flex items-center gap-2 text-sm font-medium text-dark-200 mb-1 mt-3">
            <CreditCard className="w-4 h-4 text-primary-400" />
            Identity Verification (NID)
          </p>
          <p className="text-xs text-dark-500 mb-3 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Only visible to you and the marketplace admin — never shown publicly.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={nidName}
              onChange={(e) => setNidName(e.target.value)}
              required
              placeholder="Name on NID"
              className="px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              value={nidNumber}
              onChange={(e) => setNidNumber(e.target.value)}
              required
              placeholder="NID number"
              className="px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <IdImagePicker label="NID front photo" file={nidFront} onChange={setNidFront} />
            <IdImagePicker label="NID back photo" file={nidBack} onChange={setNidBack} />
          </div>
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
