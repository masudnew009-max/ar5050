# Multi-Vendor E-commerce Platform

Stack: React + Vite + Tailwind CSS + Supabase

## Phase 0 — Setup (done)
- Fresh project structure, based on the old `ar-traders-wholesale-main` codebase.
- Reused: Tailwind theme (`primary`/`dark` palette), global CSS, Supabase client
  setup, `AuthModal`, `useAuth` hook, PWA icons/manifest, base tooling
  (ESLint, TypeScript configs, Vite config).
- Dropped: all wholesale-specific pages/logic (Inventory, Dues, Barcode
  scanner, Memo printing, Routes/SR system) — will be replaced by the
  multi-vendor feature set phase by phase.
- Role model changed from `admin | sr | customer` to `admin | seller | customer`.

## Progress
Phases 0–12 done (Phase 12: seller email via Edge Function `notify-seller`, migration 010). Setup steps: see the header of `supabase/functions/notify-seller/index.ts`. Next: Phase 13 — Courier API.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Roadmap
See `Multi-Vendor-Platform-Phase-Plan.md` for the full phase-by-phase plan
(Phase 0 through Phase 15).
