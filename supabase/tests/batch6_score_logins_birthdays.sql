-- Rolled-back check for batch 6. expect: first_login_new true, same_device_new false, other_device_new true,
-- alerts 1, devices 2, my_score 2, trophy "1,1,2", stranger_sees_score hidden, bday_sent true, friend_bday_note 1.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6-a@example.invalid', '{"username":"b6testa","display_name":"B6 A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6-b@example.invalid', '{"username":"b6testb","display_name":"B6 B"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6-c@example.invalid', '{"username":"b6testc","display_name":"B6 C"}', now(), now());
insert into public.friendships (user_a, user_b) values ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000f2');
update public.user_settings set date_of_birth = make_date(2000, extract(month from now())::int, extract(day from now())::int) where user_id='00000000-0000-4000-8000-0000000000f1';
create temp table r (k text, v text); grant all on r to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select public.post_story('00000000-0000-4000-8000-00000000f0f1', 'text', null, null, 'hi', '#111', '{}', 'friends');
insert into r select 'first_login_new', public.report_login('Pixel 8 · Chrome', 'android', 'devkey-aaaa-1111')::text;
insert into r select 'same_device_new', public.report_login('Pixel 8 · Chrome', 'android', 'devkey-aaaa-1111')::text;
insert into r select 'other_device_new', public.report_login('iPhone · Safari', 'ios', 'devkey-bbbb-2222')::text;
insert into r select 'alerts', count(*)::text from public.notifications where title like 'New sign-in%';
insert into r select 'devices', count(*)::text from public.my_devices();
insert into r select 'my_score', public.snap_score('00000000-0000-4000-8000-0000000000f1')::text;
insert into r select 'trophy', stories::text || ',' || friends || ',' || score from public.my_trophy_stats();
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'stranger_sees_score', coalesce(public.snap_score('00000000-0000-4000-8000-0000000000f1')::text, 'hidden');
reset role;
select set_config('request.jwt.claims', '', true);
insert into r select 'bday_sent', (public.send_birthday_notifications() >= 1)::text;
insert into r select 'friend_bday_note', count(*)::text from public.notifications where user_id='00000000-0000-4000-8000-0000000000f2' and title like '%birthday today';
select * from r;
rollback;
