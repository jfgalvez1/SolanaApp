-- Optional guest contact number.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table reservations
  add column if not exists contact_number text;

alter table booking_requests
  add column if not exists contact_number text;
