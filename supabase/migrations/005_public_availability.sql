-- Public availability for the /availability page.
-- Returns villa names and booked dates only. No guest, contact, price, or notes.
-- Run in the Supabase SQL Editor. Safe to re-run.

create or replace function public.get_public_availability()
returns table (
  property_id uuid,
  property_name text,
  property_slug text,
  reservation_id uuid,
  check_in text,
  check_out text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.slug,
    r.id,
    r.check_in::text,
    r.check_out::text,
    r.status::text
  from public.properties p
  left join public.reservations r
    on r.property_id = p.id
   and r.status in ('confirmed', 'reserved')
  order by p.slug, r.check_in;
$$;

revoke all on function public.get_public_availability() from public;
grant execute on function public.get_public_availability() to anon, authenticated;
