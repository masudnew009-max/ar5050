import { useEffect, useState } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, Package, ImagePlus, X, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Product } from '../../lib/supabase';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { useSubcategories } from '../../hooks/useSubcategories';

const emptyForm = {
  name: '',
  description: '',
  category: PRODUCT_CATEGORIES[0],
  subcategory: '',
  price: '',
  stock: '',
  unit: 'pcs',
};

export default function ProductUpload() {
  const { user } = useAuth();
  const subMap = useSubcategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setProducts(data ?? []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? '',
      category: product.category ?? PRODUCT_CATEGORIES[0],
      subcategory: product.subcategory ?? '',
      price: String(product.price),
      stock: String(product.stock),
      unit: product.unit,
    });
    setImagePreview(product.image_url);
    setImageFile(null);
    setShowForm(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile);
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = parseFloat(form.price);
    const stock = parseInt(form.stock, 10);
    if (!form.name.trim() || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
      setError('Please fill in a valid name, price, and stock');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = editingId
        ? products.find((p) => p.id === editingId)?.image_url ?? null
        : null;

      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        // only sent once migration 015 is live (sub-categories loaded), so saving never breaks before it
        ...(Object.keys(subMap).length > 0 ? { subcategory: form.subcategory || null } : {}),
        price,
        stock,
        unit: form.unit.trim() || 'pcs',
        image_url: imageUrl,
      };

      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert({ ...payload, seller_id: user!.id });
        if (error) throw error;
      }

      resetForm();
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) setError(error.message);
    else setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    if (error) setError(error.message);
    else await loadProducts();
  };

  const statusBadge = (status: Product['status']) => {
    const map: Record<Product['status'], string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
    };
    return <span className={`text-xs px-2 py-0.5 rounded capitalize ${map[status]}`}>{status}</span>;
  };

  return (
    <div className="max-w-3xl space-y-6">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">{editingId ? 'Edit Product' : 'Add Product'}</h3>
            <button type="button" onClick={resetForm} className="p-1.5 text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-4 items-start">
            <label className="w-24 h-24 rounded-xl bg-dark-700 border border-dashed border-dark-600 flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-500 transition-colors">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-dark-500" />
              )}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            <div className="flex-1 grid grid-cols-1 gap-3">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Product name"
                required
                className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })}
                className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {(subMap[form.category] ?? []).length > 0 && (
                <select
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                  className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sub-category (optional)</option>
                  {subMap[form.category].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Description"
            className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1">Price (৳)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Stock</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                required
                className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="pcs"
                className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {editingId && (
            <p className="text-xs text-dark-500">
              Editing an already-approved product keeps it live — it won't need re-approval.
            </p>
          )}
          {!editingId && (
            <p className="text-xs text-dark-500">
              New products go to the admin for approval before they appear in the shop.
            </p>
          )}

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
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Submit for Approval'}
          </button>
        </form>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-white font-medium">My Products ({products.length})</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-10">
            You haven't added any products yet.
          </p>
        ) : (
          <div className="divide-y divide-dark-700">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-12 h-12 rounded-lg bg-dark-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-dark-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">{product.name}</p>
                    {statusBadge(product.status)}
                  </div>
                  <p className="text-dark-400 text-xs mt-0.5">
                    ৳{product.price} · Stock: {product.stock} {product.unit}
                  </p>
                  {product.status === 'rejected' && product.rejection_reason && (
                    <p className="text-red-400 text-xs mt-1">Reason: {product.rejection_reason}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {product.status === 'approved' && (
                    <button
                      onClick={() => toggleActive(product)}
                      title={product.is_active ? 'Hide from shop' : 'Show in shop'}
                      className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
                    >
                      {product.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => startEdit(product)} className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
