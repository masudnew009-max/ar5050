# Multi-Vendor E-commerce Platform (AR Traders)

Stack: React + Vite + Tailwind CSS + Supabase (hosted on Vercel)

## What's built
- **Auth & roles:** admin / seller / customer, Become a Seller with NID KYC.
- **Shopping:** TikTok-style home feed (reels + products), Shop with category grid and sub-categories,
  product pages, Cart (localStorage), multi-item Checkout, My Orders.
- **Payments:** Cash on Delivery, or manual bKash / Nagad / Rocket / bank transfer to the platform's accounts
  (customer enters a Transaction ID; admin verifies). Admin manages the methods under *Payment Methods*.
- **Sellers:** analytics, products, reels, payouts and payout account.
- **Admin panel:** sellers, products, approvals, orders (payment verify/reject), commission, delivery zones,
  payment methods, seller payouts.
- **Info pages:** Contact, Shop FAQ, Terms & Conditions.

## Supabase migrations
Run every file in `supabase/migrations/` in filename order in the SQL Editor
(`001` ... `018`). Edge Function `notify-seller` emails sellers on new orders and needs SMTP secrets
(see the comment at the top of `supabase/functions/notify-seller/index.ts`).
Demo data for testing: `supabase/seed/demo_data.sql`.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Still to do
SMS notifications, courier integration (Pathao / Steadfast / RedX), card payments, n8n automation and
social auto-posting, monetization, real reel comments, final testing and domain move.
Brand name and contact details live in `src/lib/brand.ts`.
