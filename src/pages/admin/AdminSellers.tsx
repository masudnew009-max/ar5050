import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, Store, Phone, MapPin, Ban, CheckCircle2, Package,
  CreditCard, Eye, X, ShieldCheck, ShieldX, ShieldQuestion,
} from 'lucide-react';
import { supabase, KycStatus, getSellerKycSignedUrl } from '../../lib/supabase';

interface SellerRow {
  id: string;
  shop_name: string;
  shop_slug: string;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  productCount: number;
  nid_number: string | null;
  nid_name: string | null;
  nid_front_url: string | null;
  nid_back_url: string | null;
  kyc_status: KycStatus;
  kyc_rejection_reason: string | null;
}

type ProfileEmbed = { email: string; full_name: string | null; is_active: boolean };

interface RawSeller {
  id: string;
  shop_name: string;
  shop_slug: string;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
  nid_number: string | null;
  nid_name: string | null;
  nid_front_url: string | null;
  nid_back_url: string | null;
  kyc_status: KycStatus;
  kyc_rejection_reason: string | null;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
}

type KycFilter = 'all' | KycStatus;

const KYC_FILTERS: { id: KycFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'KYC Pending' },
  { id: 'approved', label: 'KYC Approved' },
  { id: 'rejected', label: 'KYC Rejected' },
];

const kycBadge: Record<KycStatus, { cls: string; icon: typeof ShieldCheck; label: string }> = {
  pending: { cls: 'status-pending', icon: ShieldQuestion, label: 'KYC Pending' },
  approved: { cls: 'status-approved', icon: ShieldCheck, label: 'KYC Verified' },
  rejected: { cls: 'status-rejected', icon: ShieldX, label: 'KYC Rejected' },
};

export default function AdminSellers() {
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kycFilter, setKycFilter] = useState<KycFilter>('all');
  const [actingId, setActingId] = useState<string | null>(null);

  const [viewerUrls, setViewerUrls] = useState<{ front: string; back: string; shopName: string } | null>(null);
  const [viewerLoadingId, setViewerLoadingId] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [sellersRes, productsRes] = await Promise.all([
      supabase
        .from('seller_profiles')
        .select(
          'id, shop_name, shop_slug, contact_phone, address, created_at, nid_number, nid_name, nid_front_url, nid_back_url, kyc_status, kyc_rejection_reason, profiles(email, full_name, is_active)'
        )
        .order('created_at', { ascending: false }),
      supabase.from('products').select('seller_id'),
    ]);

    if (sellersRes.error) {
      setError(sellersRes.error.message);
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    (productsRes.data ?? []).forEach((p: { seller_id: string }) => {
      counts[p.seller_id] = (counts[p.seller_id] ?? 0) + 1;
    });

    const rows: SellerRow[] = ((sellersRes.data ?? []) as unknown as RawSeller[]).map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        shop_name: row.shop_name,
        shop_slug: row.shop_slug,
        contact_phone: row.contact_phone,
        address: row.address,
        created_at: row.created_at,
        email: p?.email ?? '',
        full_name: p?.full_name ?? null,
        is_active: p?.is_active ?? true,
        productCount: counts[row.id] ?? 0,
        nid_number: row.nid_number,
        nid_name: row.nid_name,
        nid_front_url: row.nid_front_url,
        nid_back_url: row.nid_back_url,
        kyc_status: row.kyc_status,
        kyc_rejection_reason: row.kyc_rejection_reason,
      };
    });

    setSellers(rows);
    setLoading(false);
  };

  const toggleBlock = async (seller: SellerRow) => {
    const blocking = seller.is_active;
    const message = blocking
      ? `Block "${seller.shop_name}"?\n\nTheir products and reels will disappear from the shop and they won't be able to add or edit products.`
      : `Unblock "${seller.shop_name}"?`;
    if (!confirm(message)) return;

    setActingId(seller.id);
    setError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !seller.is_active })
      .eq('id', seller.id);

    if (error) setError(error.message);
    else setSellers((prev) => prev.map((s) => (s.id === seller.id ? { ...s, is_active: !s.is_active } : s)));
    setActingId(null);
  };

  const viewNid = async (seller: SellerRow) => {
    if (!seller.nid_front_url || !seller.nid_back_url) return;
    setError(null);
    setViewerLoadingId(seller.id);
    try {
      const [front, back] = await Promise.all([
        getSellerKycSignedUrl(seller.nid_front_url),
        getSellerKycSignedUrl(seller.nid_back_url),
      ]);
      setViewerUrls({ front, back, shopName: seller.shop_name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load NID photos');
    } finally {
      setViewerLoadingId(null);
    }
  };

  const approveKyc = async (seller: SellerRow) => {
    setActingId(seller.id);
    setError(null);
    const { error } = await supabase
      .from('seller_profiles')
      .update({ kyc_status: 'approved', kyc_rejection_reason: null })
      .eq('id', seller.id);
    if (error) setError(error.message);
    else
      setSellers((prev) =>
        prev.map((s) => (s.id === seller.id ? { ...s, kyc_status: 'approved', kyc_rejection_reason: null } : s))
      );
    setActingId(null);
  };

  const confirmRejectKyc = async (seller: SellerRow) => {
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejecting this KYC');
      return;
    }
    setActingId(seller.id);
    setError(null);
    const { error } = await supabase
      .from('seller_profiles')
      .update({ kyc_status: 'rejected', kyc_rejection_reason: rejectReason.trim() })
      .eq('id', seller.id);
    if (error) setError(error.message);
    else
      setSellers((prev) =>
        prev.map((s) =>
          s.id === seller.id ? { ...s, kyc_status: 'rejected', kyc_rejection_reason: rejectReason.trim() } : s
        )
      );
    setActingId(null);
    setRejectingId(null);
    setRejectReason('');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sellers.filter((s) => {
      if (kycFilter !== 'all' && s.kyc_status !== kycFilter) return false;
      if (!q) return true;
      return [s.shop_name, s.shop_slug, s.email, s.full_name ?? '', s.contact_phone ?? '', s.nid_number ?? '']
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [sellers, query, kycFilter]);

  const blockedCount = sellers.filter((s) => !s.is_active).length;
  const kycCounts = useMemo(() => {
    const c: Record<KycFilter, number> = { all: sellers.length, pending: 0, approved: 0, rejected: 0 };
    sellers.forEach((s) => { c[s.kyc_status] += 1; });
    return c;
  }, [sellers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shop, owner, email, phone or NID number"
            className="w-full pl-9 pr-3 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <p className="text-sm text-dark-400 whitespace-nowrap">
          {sellers.length} seller{sellers.length === 1 ? '' : 's'}
          {blockedCount > 0 && <span className="text-red-400"> · {blockedCount} blocked</span>}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {KYC_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setKycFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              kycFilter === f.id ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-300 hover:text-white'
            }`}
          >
            {f.label} <span className="opacity-70">({kycCounts[f.id]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-dark-400 text-sm text-center py-12 bg-dark-800 border border-dark-700 rounded-2xl">
          {sellers.length === 0 ? 'No sellers have registered yet.' : 'No sellers match this filter.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const badge = kycBadge[s.kyc_status];
            return (
              <div key={s.id} className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Store className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      <p className="font-medium truncate">{s.shop_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${s.is_active ? 'status-approved' : 'status-rejected'}`}>
                        {s.is_active ? 'Active' : 'Blocked'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${badge.cls}`}>
                        <badge.icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">/{s.shop_slug}</p>
                  </div>

                  <button
                    onClick={() => toggleBlock(s)}
                    disabled={actingId === s.id}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50 flex-shrink-0 ${
                      s.is_active
                        ? 'bg-dark-700 hover:bg-red-500/20 text-dark-300 hover:text-red-400'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                  >
                    {actingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : s.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {s.is_active ? 'Block' : 'Unblock'}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-dark-300">
                  <p className="truncate">
                    {s.full_name || 'No name'} · <span className="text-dark-400">{s.email}</span>
                  </p>
                  {s.contact_phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-dark-500" />
                      {s.contact_phone}
                    </p>
                  )}
                  {s.address && (
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-dark-400">
                    <Package className="w-3.5 h-3.5 text-dark-500" />
                    {s.productCount} product{s.productCount === 1 ? '' : 's'} · joined{' '}
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {s.nid_name && (
                    <p className="flex items-center gap-1.5 text-dark-400 truncate">
                      <CreditCard className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                      {s.nid_name} · {s.nid_number}
                    </p>
                  )}
                </div>

                {s.kyc_status === 'rejected' && s.kyc_rejection_reason && (
                  <p className="text-xs text-red-400 mt-2">KYC rejection reason: {s.kyc_rejection_reason}</p>
                )}

                <div className="mt-3 pt-3 border-t border-dark-700 flex flex-wrap items-center gap-2">
                  {s.nid_front_url && s.nid_back_url ? (
                    <button
                      onClick={() => viewNid(s)}
                      disabled={viewerLoadingId === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-200 disabled:opacity-50"
                    >
                      {viewerLoadingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      View NID Photos
                    </button>
                  ) : (
                    <span className="text-xs text-dark-500">No NID photos on file (registered before KYC was required)</span>
                  )}

                  {s.kyc_status !== 'approved' && (
                    <button
                      onClick={() => approveKyc(s)}
                      disabled={actingId === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Approve KYC
                    </button>
                  )}
                  {s.kyc_status !== 'rejected' && (
                    <button
                      onClick={() => { setRejectingId(s.id); setRejectReason(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-dark-700 hover:bg-red-500/20 text-dark-300 hover:text-red-400"
                    >
                      <ShieldX className="w-3.5 h-3.5" />
                      Reject KYC
                    </button>
                  )}
                </div>

                {rejectingId === s.id && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="Why is this KYC being rejected? (shown to the seller)"
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmRejectKyc(s)}
                        disabled={actingId === s.id}
                        className="px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                      <button onClick={() => setRejectingId(null)} className="px-3 py-1.5 text-sm rounded-lg bg-dark-700 text-dark-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewerUrls && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setViewerUrls(null)} />
          <div className="relative bg-dark-800 border border-dark-700 rounded-2xl p-4 max-w-lg w-full">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium">{viewerUrls.shopName} — NID</p>
              <button onClick={() => setViewerUrls(null)} className="p-1.5 text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <img src={viewerUrls.front} alt="NID front" className="w-full rounded-xl border border-dark-700" />
              <img src={viewerUrls.back} alt="NID back" className="w-full rounded-xl border border-dark-700" />
            </div>
            <p className="text-xs text-dark-500 mt-3">This link expires in a few minutes and is only visible to admins.</p>
          </div>
        </div>
      )}
    </div>
  );
}
