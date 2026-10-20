-- Booking requests: Google Form submissions wait here until you approve/reject.
-- Run in Supabase SQL Editor after backup.

create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  property_id uuid not null references properties(id),
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  pax integer not null default 2 check (pax >= 1),
  suggested_price numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  overlap_warning text,
  notes text,
  reservation_id uuid references reservations(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists booking_requests_property_status_idx
  on booking_requests (property_id, status, created_at desc);

alter table booking_requests enable row level security;

create policy "Users can view own property booking requests"
  on booking_requests for select
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can update own property booking requests"
  on booking_requests for update
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

create policy "Users can delete own property booking requests"
  on booking_requests for delete
  using (
    property_id in (select id from properties where user_id = auth.uid())
  );

-- Inserts come from the server webhook (service role), not from the browser.
