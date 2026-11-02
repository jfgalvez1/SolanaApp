-- Let the signed-in app hear new booking requests as they arrive.
-- Polling still works if this has not been run yet.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_requests'
  ) then
    alter publication supabase_realtime add table booking_requests;
  end if;
end $$;
