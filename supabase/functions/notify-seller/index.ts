/**
 * Phase 12 — notify-seller (Supabase Edge Function)
 *
 * Called by the browser right after `place_order` succeeds:
 *   supabase.functions.invoke('notify-seller', { body: { order_id } })
 *
 * What it does
 *  1. Verifies the caller is signed in AND is the customer who owns the order.
 *  2. Groups the order's items by seller.
 *  3. Emails each seller ONLY their own items + the delivery details.
 *  4. Records each email in `order_notifications` first, so a seller is never
 *     emailed twice for the same order (calling again is harmless).
 *
 * Secrets to set (Supabase → Edge Functions → Secrets):
 *   SMTP_HOST   e.g. smtp.gmail.com
 *   SMTP_PORT   e.g. 465   (465 = SSL, 587 = STARTTLS)
 *   SMTP_USER   the mailbox login
 *   SMTP_PASS   the mailbox password / Gmail "App password"
 *   SMTP_FROM   (optional) sender, e.g. "Marketplace <you@gmail.com>"; defaults to SMTP_USER
 *   SITE_URL    (optional) e.g. https://ar5050.vercel.app — adds a dashboard link
 * SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Customer-supplied text goes into HTML — always escape it.
const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (n: number) => `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

type ItemRow = {
  seller_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  commission_amount: number;
  seller_net_amount: number;
  product: { name: string } | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id ?? '');
    if (!UUID.test(orderId)) return json({ error: 'Invalid order_id' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Who is calling?
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Not signed in' }, 401);

    const admin = createClient(url, service);

    // 2. Is this their order?
    const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order || order.customer_id !== user.id) return json({ error: 'Order not found' }, 404);

    // 3. Items grouped by seller
    const { data: items, error: itemsError } = await admin
      .from('order_items')
      .select('seller_id, quantity, unit_price, subtotal, commission_amount, seller_net_amount, product:products(name)')
      .eq('order_id', orderId);
    if (itemsError) throw itemsError;

    const bySeller = new Map<string, ItemRow[]>();
    for (const it of (items ?? []) as unknown as ItemRow[]) {
      if (!it.seller_id) continue;
      bySeller.set(it.seller_id, [...(bySeller.get(it.seller_id) ?? []), it]);
    }
    if (bySeller.size === 0) return json({ sent: 0, skipped: 0, failed: 0 });

    const sellerIds = [...bySeller.keys()];
    const [{ data: profiles }, { data: shops }] = await Promise.all([
      admin.from('profiles').select('id, email, full_name').in('id', sellerIds),
      admin.from('seller_profiles').select('id, shop_name').in('id', sellerIds),
    ]);
    const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email as string | null]));
    const shopOf = new Map((shops ?? []).map((s) => [s.id, s.shop_name as string]));

    // 4. SMTP
    const host = Deno.env.get('SMTP_HOST');
    const user_ = Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_PASS');
    if (!host || !user_ || !pass) return json({ error: 'SMTP is not configured on the server' }, 500);
    const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
    const from = Deno.env.get('SMTP_FROM') ?? user_;
    const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: user_, pass },
    });

    const shortId = orderId.slice(0, 8).toUpperCase();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const [sellerId, rows] of bySeller) {
      const to = emailOf.get(sellerId);
      if (!to) {
        failed++;
        continue;
      }

      // Claim first: if the row already exists, this seller was already emailed.
      const { error: claimError } = await admin
        .from('order_notifications')
        .insert({ order_id: orderId, seller_id: sellerId });
      if (claimError) {
        if (claimError.code === '23505') skipped++;
        else failed++;
        continue;
      }

      const gross = rows.reduce((s, r) => s + Number(r.subtotal), 0);
      const net = rows.reduce((s, r) => s + Number(r.seller_net_amount), 0);

      const lines = rows
        .map(
          (r) => `<tr>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(r.product?.name ?? 'Product')}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${esc(r.quantity)}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(r.unit_price)}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(r.subtotal)}</td>
          </tr>`
        )
        .join('');

      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
        <h2 style="color:#16a34a;margin-bottom:4px">New order #${shortId}</h2>
        <p style="margin-top:0">Hello ${esc(shopOf.get(sellerId) ?? 'seller')}, you have a new order.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:8px;text-align:left">Product</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px;text-align:right">Price</th>
            <th style="padding:8px;text-align:right">Total</th>
          </tr></thead>
          <tbody>${lines}</tbody>
        </table>
        <p style="font-size:14px">Your items total <b>${money(gross)}</b> — after commission you receive <b>${money(net)}</b>.</p>
        <h3 style="margin-bottom:4px">Deliver to</h3>
        <p style="margin-top:0;font-size:14px">
          ${esc(order.customer_name)}<br>
          Phone: ${esc(order.customer_phone)}<br>
          ${esc(order.delivery_address)}<br>
          ${esc(order.thana)}, ${esc(order.zilla)}<br>
          Payment: ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online'}
        </p>
        ${siteUrl ? `<p><a href="${esc(siteUrl)}/seller" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open seller dashboard</a></p>` : ''}
      </div>`;

      try {
        await transporter.sendMail({
          from,
          to,
          subject: `New order #${shortId} — ${money(gross)}`,
          html,
        });
        sent++;
      } catch (err) {
        console.error('sendMail failed', sellerId, err);
        // Release the claim so a later call can retry this seller.
        await admin.from('order_notifications').delete().eq('order_id', orderId).eq('seller_id', sellerId);
        failed++;
      }
    }

    return json({ sent, skipped, failed });
  } catch (err) {
    console.error('notify-seller error', err);
    return json({ error: 'Internal error' }, 500);
  }
});
