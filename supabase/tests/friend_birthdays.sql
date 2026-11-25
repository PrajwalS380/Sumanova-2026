-- Rolled-back check for friend_birthdays(): a friend sees day + month only, never
-- the raw date of birth, and nothing when show_birthday is off. Run with the
-- Supabase MCP execute_sql tool (needs at least one existing profile).
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bday-test@example.invalid',
        '{"username":"bdaytester","display_name":"Bday Tester"}', now(), now());
create temp table t as
  select least(a.id, '00000000-0000-4000-8000-0000000000b1'::uuid) as user_a, greatest(a.id, '00000000-0000-4000-8000-0000000000b1'::uuid) as user_b,
         a.id as me, '00000000-0000-4000-8000-0000000000b1'::uuid as friend
  from (select id from public.profiles where id <> '00000000-0000-4000-8000-0000000000b1' limit 1) a;
grant select on t to authenticated;
insert into public.friendships (user_a, user_b) select user_a, user_b from t;
update public.user_settings set date_of_birth = '2001-11-25' where user_id = (select friend from t);
select set_config('request.jwt.claims', json_build_object('sub', (select me from t), 'role', 'authenticated')::text, true);
set local role authenticated;
-- expect: month 11, day 25, raw_dob_rows_visible 0
select (select month from public.friend_birthdays() where user_id = (select friend from t)) as month,
       (select day from public.friend_birthdays() where user_id = (select friend from t)) as day,
       (select count(*) from public.user_settings where user_id = (select friend from t)) as raw_dob_rows_visible;
reset role;
update public.privacy_settings set show_birthday = false where user_id = (select friend from t);
set local role authenticated;
-- expect: 0
select count(*) as hidden_rows from public.friend_birthdays();
rollback;
