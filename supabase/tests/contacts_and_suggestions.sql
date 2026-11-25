-- Rolled-back check for contact matching + people you may know. Run with Supabase MCP execute_sql.
-- Users: A (me), B (A's friend), C (B's friend, in A's phone contacts, adds their number later).
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct-a@example.invalid', '{"username":"cttesta","display_name":"Ct A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct-b@example.invalid', '{"username":"cttestb","display_name":"Ct B"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct-c@example.invalid', '{"username":"cttestc","display_name":"Ct C"}', now(), now());
insert into public.friendships (user_a, user_b) values
 ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'),
 ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3');
create temp table r (k text, v text);
grant all on r to authenticated;

-- A syncs contacts (C's number, hashed on device) before C has joined by phone.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'matches_before', count(*)::text from public.sync_contacts(array[encode(extensions.digest('+919876543210', 'sha256'), 'hex'), 'junk']);
insert into r select 'pymk', string_agg(username || ':' || mutual, ',') from public.suggest_friends();
reset role;

-- C adds their number.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'c_last4', public.set_phone('+91 98765-43210');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'contact_sugg', string_agg(username, ',') from public.contact_suggestions();
insert into r select 'a_sees_c_phone_rows', count(*)::text from public.phone_numbers where user_id = '00000000-0000-4000-8000-0000000000a3';
insert into r select 'a_notified', count(*)::text from public.notifications where actor_id = '00000000-0000-4000-8000-0000000000a3' and title like '%is on SUMANOVA';
reset role;

-- C opts out of being found by number → no longer suggested.
update public.privacy_settings set find_by_phone = false where user_id = '00000000-0000-4000-8000-0000000000a3';
set local role authenticated;
insert into r select 'after_opt_out', count(*)::text from public.contact_suggestions();
reset role;
-- expect: matches_before 0, pymk cttestc:1, c_last4 3210, contact_sugg cttestc, a_sees_c_phone_rows 0, a_notified 1, after_opt_out 0
select * from r;
rollback;
