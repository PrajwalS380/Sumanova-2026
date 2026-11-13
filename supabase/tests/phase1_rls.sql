-- Phase 1 RLS / trigger verification. Runs entirely inside a transaction that
-- is rolled back, so it leaves no data behind. Run in the Supabase SQL editor.
-- Verified 2026-11-13 against the hosted project; every row matched `expect`.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.local','{"username":"Alice_A","display_name":"Alice","date_of_birth":"2000-02-02"}', now(), now()),
       ('bbbbbbbb-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.local','{"username":"bob_b","display_name":"Bob"}', now(), now());
create temp table results(test text, result text, expect text) on commit drop;
grant all on results to authenticated, anon;
insert into results select 'trigger lowercases username', username::text, 'alice_a' from public.profiles where id='aaaaaaaa-0000-0000-0000-000000000001';
insert into results select 'trigger stores dob privately', date_of_birth::text, '2000-02-02' from public.user_settings where user_id='aaaaaaaa-0000-0000-0000-000000000001';

set local role anon;
insert into results select 'anon reads profiles', count(*)::text, '0' from public.profiles;
insert into results select 'anon reads privacy', count(*)::text, '0' from public.privacy_settings;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);
insert into results select 'alice reads profiles', count(*)::text, '2' from public.profiles;
insert into results select 'alice reads settings', count(*)::text, '1' from public.user_settings;
insert into results select 'alice reads privacy', count(*)::text, '1' from public.privacy_settings;
with u as (update public.profiles set display_name='HACKED' where id='bbbbbbbb-0000-0000-0000-000000000002' returning 1)
  insert into results select 'alice edits bob profile', count(*)::text, '0' from u;
with u as (update public.privacy_settings set ghost_mode=false where user_id='bbbbbbbb-0000-0000-0000-000000000002' returning 1)
  insert into results select 'alice edits bob privacy', count(*)::text, '0' from u;
with u as (update public.profiles set bio='hi' where id='aaaaaaaa-0000-0000-0000-000000000001' returning 1)
  insert into results select 'alice edits own profile', count(*)::text, '1' from u;
insert into results select 'username taken after signup', (not public.is_username_available('ALICE_A'))::text, 'true';

select test, result, expect, result = expect as pass from results;
rollback;
