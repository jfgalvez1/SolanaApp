-- Guest check-in preference from the Google Form (e.g. early, standard, late).
-- Run in Supabase SQL Editor. Safe to re-run.

alter table reservations
  add column if not exists check_in_preference text;

alter table booking_requests
  add column if not exists check_in_preference text;
