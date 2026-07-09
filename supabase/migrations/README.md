# Multi-Villa Migration Guide

Run this **before** deploying the updated app to production.

## Phase 0: Backup (required)

1. In Supabase Dashboard → Table Editor, export CSV for:
   - `reservations`
   - `expenses`
   - `inventory`
   - `sales_log`
   - `profiles`
2. Save files locally with today's date (e.g. `backup-2026-07-09-reservations.csv`).
3. Confirm Supabase daily backups are enabled (Project Settings → Database).

## Phase 1: Run migration in Supabase SQL Editor

Open `001_multi_villa.sql` and run each step in order:

1. **Step 0** — Run baseline queries (uncomment), save row counts and revenue/expense sums.
2. **Step 1–2** — Create `properties` table and add `property_id` columns.
3. **Step 3** — Uncomment and replace `<YOUR_USER_ID>` with your user id:
   ```sql
   select id, email from auth.users;
   ```
4. **Step 4** — Uncomment and replace `<VILLA_1_ID>` with the id for `villa-1`.
5. **Step 5** — Run verification queries; counts and sums must match Step 0.
6. **Step 6** — Set `property_id` NOT NULL (only after verification passes).
7. **Step 7** — Enable RLS policies.

> **Note:** If you already have RLS policies on `reservations` or `expenses`, you may need to drop the old policies first to avoid conflicts. Check Supabase → Authentication → Policies.

## Phase 2: Deploy app

Deploy the updated app only after Step 6 passes.

## Phase 3: Smoke test

1. Log in and confirm **Solana Villa** (Villa 1) shows all historical reservations and expenses.
2. Switch to **Villa 2** — should be empty.
3. Create a test reservation on Villa 2, switch back to Villa 1 — it should not appear there.

## Rollback

- **Before app deploy:** Re-run backfill with correct Villa 1 id, or set `property_id = null` and fix.
- **After app deploy:** Revert to previous Vercel deployment; database rows are unchanged.
- **Full restore:** Re-import CSV backups from Phase 0.
