-- Solana Villa accepts up to 6 guests. Solana Villa 2 has no guest maximum.
-- Run this only after the app that understands an empty maximum is deployed.
alter table properties alter column max_pax drop not null;

update properties
set max_pax = 6
where slug = 'villa-1';

update properties
set max_pax = null
where slug = 'villa-2';
