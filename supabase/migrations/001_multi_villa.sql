-- =============================================================================
-- Multi-Villa Migration for Solana Villa Reservation Manager
-- =============================================================================
-- IMPORTANT: Run Phase 0 backup steps BEFORE executing this script.
-- See supabase/migrations/README.md for the full checklist.
--
-- This script is NON-DESTRUCTIVE:
--   - No DELETE, TRUNCATE, or DROP on existing tables
--   - Only adds columns and tags existing rows with property_id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 0: BASELINE (run first, save results to a file before continuing)
-- -----------------------------------------------------------------------------
/*
select 'reservations' as table_name, count(*) as row_count from reservations
union all
select 'expenses', count(*) from expenses;

select count(*) as reservation_count, coalesce(sum(total_price), 0) as total_revenue_stored from reservations;
select count(*) as expense_count, coalesce(sum(amount), 0) as total_expenses_stored from expenses;
*/

-- -----------------------------------------------------------------------------
-- STEP 1: Create properties table
-- -----------------------------------------------------------------------------
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  base_price numeric not null default 2500,
  included_pax integer not null default 2,
  extra_pax_price numeric not null default 500,
  max_pax integer not null default 5,
  created_at timestamptz default now(),
  unique (user_id, slug)
);

-- -----------------------------------------------------------------------------
-- STEP 2: Add nullable property_id columns
-- -----------------------------------------------------------------------------
alter table reservations add column if not exists property_id uuid references properties(id);
alter table expenses add column if not exists property_id uuid references properties(id);

-- -----------------------------------------------------------------------------
-- STEP 3: Insert properties for YOUR user
-- Replace '<YOUR_USER_ID>' with your auth.users id from:
--   select id, email from auth.users;
-- -----------------------------------------------------------------------------
/*
insert into properties (user_id, name, slug, base_price, included_pax, extra_pax_price, max_pax)
values
  ('<YOUR_USER_ID>', 'Solana Villa', 'villa-1', 2500, 2, 500, 5),
  ('<YOUR_USER_ID>', 'Villa 2', 'villa-2', 2500, 2, 500, 5)
returning id, slug;
*/

-- -----------------------------------------------------------------------------
-- STEP 4: Backfill — tag ALL existing rows to Villa 1
-- Replace '<VILLA_1_ID>' with the id returned for slug 'villa-1'
-- -----------------------------------------------------------------------------
/*
update reservations
set property_id = '<VILLA_1_ID>'
where property_id is null;

update expenses
set property_id = '<VILLA_1_ID>'
where property_id is null;
*/

-- -----------------------------------------------------------------------------
-- STEP 5: VERIFICATION (must match baseline before continuing)
-- -----------------------------------------------------------------------------
/*
select count(*) as unassigned_reservations from reservations where property_id is null;
select count(*) as unassigned_expenses from expenses where property_id is null;
-- Both must be 0

select coalesce(sum(total_price), 0) as total_revenue_stored from reservations;
select coalesce(sum(amount), 0) as total_expenses_stored from expenses;
-- Must match Step 0 baseline

select p.name, count(r.id) as reservation_count
from properties p
left join reservations r on r.property_id = p.id
group by p.name;

select p.name, count(e.id) as expense_count
from properties p
left join expenses e on e.property_id = p.id
group by p.name;
-- Villa 1 should have all historical data; Villa 2 should be 0
*/

-- -----------------------------------------------------------------------------
-- STEP 6: Set NOT NULL (only after Step 5 passes)
-- -----------------------------------------------------------------------------
/*
alter table reservations alter column property_id set not null;
alter table expenses alter column property_id set not null;
*/

-- -----------------------------------------------------------------------------
-- STEP 7: Enable RLS and policies
-- NOTE: If you already have RLS policies on reservations/expenses, drop them first
-- to avoid conflicts. Check Supabase → Authentication → Policies.
-- -----------------------------------------------------------------------------
alter table properties enable row level security;

create policy "Users can view own properties"
  on properties for select
  using (user_id = auth.uid());

create policy "Users can insert own properties"
  on properties for insert
  with check (user_id = auth.uid());

create policy "Users can update own properties"
  on properties for update
  using (user_id = auth.uid());

create policy "Users can view own property reservations"
  on reservations for select
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can insert own property reservations"
  on reservations for insert
  with check (
    property_id in (select id from properties where user_id = auth.uid())
    and user_id = auth.uid()
  );

create policy "Users can update own property reservations"
  on reservations for update
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can delete own property reservations"
  on reservations for delete
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can view own property expenses"
  on expenses for select
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can insert own property expenses"
  on expenses for insert
  with check (
    property_id in (select id from properties where user_id = auth.uid())
    and user_id = auth.uid()
  );

create policy "Users can update own property expenses"
  on expenses for update
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can delete own property expenses"
  on expenses for delete
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );
