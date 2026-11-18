-- Stay type from the Solana Villa 2 Google Form
-- (Overnight 12:00 PM–9:00 AM, or Day Tour 11:00 AM–9:00 PM).
-- Run in Supabase SQL Editor. Safe to re-run.

alter table reservations
  add column if not exists stay_type text;

alter table booking_requests
  add column if not exists stay_type text;
