## Copilot instructions for this repository

Purpose: Give an AI coding agent the minimal, actionable context to be productive in this React+Supabase app.

- **Quick start (dev):** `npm install` then `npm run dev` (Vite server at http://localhost:5173).
- **Build / preview:** `npm run build` and `npm run preview`.

## High-level architecture
- Frontend: React 18 + TypeScript, built with Vite. See `package.json` and `vite.config.ts`.
- Styling: Tailwind CSS (`tailwind.config.js`, `src/index.css`).
- Auth / DB / Storage: Supabase (Postgres). Client is initialized in `src/lib/supabase.ts`.
- UI split: pages/components live under `src/components/` (e.g., `AdminPage.tsx`, `CreateInvoicePage.tsx`).
- Migrations and DB schema: `supabase/migrations/` contains SQL migration files — use Supabase dashboard or CLI to apply.

## Data flow & integration points (what to inspect first)
- App -> Supabase: all DB and storage calls use the exported `supabase` client in `src/lib/supabase.ts`.
  - This file also configures auth persistence (`storageKey: 'supabase.auth.token'`).
  - It contains a `clearAllUserData()` helper that deletes `expenses`, `time_entries`, `profiles` and calls `supabase.auth.admin.deleteUser(...)`.
    - Note: `auth.admin.deleteUser` implies elevated privileges (service role) if executed server-side — be cautious running this in-browser.
- Storage bucket: receipts are uploaded to a `receipts` bucket (referenced from README and storage setup). Check Supabase storage policies when debugging uploads.
- Referential order: code deletes `expenses` before `time_entries` (see `clearAllUserData`) because of FK constraints.

## Developer workflows & commands (explicit)
- Install: `npm install` (Node.js 18+ recommended per README).
- Dev server: `npm run dev` (Vite) — hot reload enabled.
- Lint: `npm run lint` runs ESLint across the repo.
- Migrations:
  - Option A: Use Supabase Dashboard SQL editor to run `supabase/migrations/*.sql` in chronological order.
  - Option B: If you use the Supabase CLI locally, `supabase db push` is referenced in README (ensure appropriate CLI auth).

## Project-specific conventions & gotchas
- Environment variables: frontend expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `src/lib/supabase.ts`). Missing values throw an error on init.
- Auth/session: Supabase client is configured with `flowType: 'pkce'`, `persistSession: true`, and `storage: localStorage` — session behavior is controlled here.
- Dependencies: `lucide-react` is excluded in `vite.config.ts` `optimizeDeps.exclude` — see that file if bundling or dep pre-bundling issues arise.
- TypeScript: project is TypeScript-first (`tsconfig.json`, `@types/*` packages). Match the existing style.
- RLS & security: README documents Row Level Security (RLS) policies. Expect security enforced at DB layer — validate both client and policy when debugging permission errors.

## Files to open when working on features/bugs
- `src/lib/supabase.ts` — single source of truth for Supabase usage and common helpers.
- `supabase/migrations/` — schema and permission changes; update or add SQL here for backend changes.
- `src/components/*` — UI entry points and pages (Admin, TimeEntries, Expenses, Invoices, Estimate worksheets).
- `vite.config.ts` and `package.json` — build/runtime scripts and Vite optimizations.
- `README.md` — contains developer instructions, env setup, and DB notes worth copying into PRs.

## Debugging pointers (practical, observable patterns)
- Missing envs: the app throws early from `src/lib/supabase.ts` if `VITE_*` vars are unset — verify `.env` or running environment.
- Supabase permission failures: inspect RLS policies and `supabase/migrations/*` SQL for recent permission changes.
- Receipt uploads: check Supabase Storage bucket name `receipts` and its policy; files >5MB or unsupported formats may be rejected (see README troubleshooting).
- User deletion: `clearAllUserData()` demonstrates the intended deletion order; do not call `auth.admin.deleteUser` from client without proper server-side key.

## When editing code as an AI
- Keep changes minimal and file-scoped unless the task requires systemic change. Follow existing TypeScript types and React patterns.
- Prefer updating `src/lib/supabase.ts` for shared Supabase behavior instead of scattering client config.
- If creating DB changes, add SQL migration files under `supabase/migrations/` with chronological timestamp filenames.

## Examples (quick pointers to patterns)
- Auth init: `src/lib/supabase.ts` (env check, client options).
- Delete order: `src/lib/supabase.ts` `clearAllUserData()` removes `expenses` then `time_entries` then `profiles`.
- Vite exclusion: `vite.config.ts` contains `optimizeDeps.exclude: ['lucide-react']`.

If anything here is unclear or you'd like more detail about a specific area (auth flows, RLS policies, or upgrade/migration steps), tell me which part and I'll expand or update this file.
