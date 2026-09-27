import { useEffect, useState } from 'react';
import {
  Loader2, Plus, Trash2, Film, X, Eye, EyeOff, ImagePlus, VideoIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Product, Reel } from '../../lib/supabase';

export default function ReelManagement() {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [caption, setCaption] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [{ data: reelsData, error: reelsError }, { data: productsData }] = await Promise.all([
      supabase.from('reels').select('*').eq('seller_id', user!.id).order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('*')
        .eq('seller_id', user!.id)
        .eq('status', 'approved')
        .order('name', { ascending: true }),
    ]);

    if (reelsError) setError(reelsError.message);
    setReels(reelsData ?? []);
    setProducts(productsData ?? []);
    if ((productsData ?? []).length > 0) setProductId((productsData ?? [])[0].id);
    setLoading(false);
  };

  const resetForm = () => {
    setCaption('');
    setVideoFile(null);
    setThumbFile(null);
    setThumbPreview(null);
    setShowForm(false);
  };

  const handleThumbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError('Please select a product to link this reel to');
      return;
    }
    if (!videoFile) {
      setError('Please choose a video file');
      return;
    }

    setSubmitting(true);
    try {
      const videoExt = videoFile.name.split('.').pop();
      const videoPath = `${user!.id}/${Date.now()}.${videoExt}`;
      const { error: videoErr } = await supabase.storage.from('reel-videos').upload(videoPath, videoFile);
      if (videoErr) throw videoErr;
      const videoUrl = supabase.storage.from('reel-videos').getPublicUrl(videoPath).data.publicUrl;

      let thumbnailUrl: string | null = null;
      if (thumbFile) {
        const thumbExt = thumbFile.name.split('.').pop();
        const thumbPath = `${user!.id}/reel-thumb-${Date.now()}.${thumbExt}`;
        const { error: thumbErr } = await supabase.storage.from('product-images').upload(thumbPath, thumbFile);
        if (thumbErr) throw thumbErr;
        thumbnailUrl = supabase.storage.from('product-images').getPublicUrl(thumbPath).data.publicUrl;
      }

      const { error: insertErr } = await supabase.from('reels').insert({
        seller_id: user!.id,
        product_id: productId,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        caption: caption.trim() || null,
      });
      if (insertErr) throw insertErr;

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reel?')) return;
    const { error } = await supabase.from('reels').delete().eq('id', id);
    if (error) setError(error.message);
    else setReels((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleActive = async (reel: Reel) => {
    const { error } = await supabase.from('reels').update({ is_active: !reel.is_active }).eq('id', reel.id);
    if (error) setError(error.message);
    else await loadData();
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name || 'Product';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {products.length === 0 && !showForm && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
          You need at least one <strong>approved</strong> product before you can create a reel. Add a product in the "My Products" tab first.
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          disabled={products.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Reel
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">Add Reel</h3>
            <button type="button" onClick={resetForm} className="p-1.5 text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Link to Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex flex-col items-center justify-center gap-1.5 h-24 rounded-xl bg-dark-700 border border-dashed border-dark-600 cursor-pointer hover:border-primary-500 transition-colors text-dark-400 text-xs">
                <VideoIcon className="w-6 h-6" />
                {videoFile ? videoFile.name : 'Choose video file'}
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>

            <label className="h-24 rounded-xl bg-dark-700 border border-dashed border-dark-600 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-500 transition-colors">
              {thumbPreview ? (
                <img src={thumbPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-dark-400 text-xs">
                  <ImagePlus className="w-6 h-6" />
                  Thumbnail (optional)
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleThumbChange} className="hidden" />
            </label>
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Caption (optional)"
            className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Uploading...' : 'Publish Reel'}
          </button>
        </form>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-white font-medium">My Reels ({reels.length})</h3>
        </div>

        {reels.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-10">No reels yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
            {reels.map((reel) => (
              <div key={reel.id} className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
                <div className="aspect-[9/16] bg-dark-700 relative">
                  {reel.thumbnail_url ? (
                    <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <video src={reel.video_url} className="w-full h-full object-cover" muted />
                  )}
                  {!reel.is_active && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-dark-300">
                      Hidden
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-white text-xs truncate flex items-center gap-1">
                    <Film className="w-3 h-3 text-primary-400 flex-shrink-0" />
                    {productName(reel.product_id)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => toggleActive(reel)}
                      className="p-1 text-dark-400 hover:text-white"
                      title={reel.is_active ? 'Hide' : 'Show'}
                    >
                      {reel.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(reel.id)}
                      className="p-1 text-dark-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
