-- Rolled-back check for group calls: everyone rings, starting again joins the live call,
-- the call survives the starter leaving and ends when fewer than 2 remain, history shows the group.
-- expect: ringing_people 3, restart_joins_same true, after_b accepted, after_a_leaves accepted,
--         after_b_leaves ended, summary "🎥 Group video call · 0:00", history_rows "1:Test squad"
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gc-a@example.invalid', '{"username":"gctesta","display_name":"Gc A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gc-b@example.invalid', '{"username":"gctestb","display_name":"Gc B"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gc-c@example.invalid', '{"username":"gctestc","display_name":"Gc C"}', now(), now());
insert into public.friendships (user_a, user_b) values ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000d2'),('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000d3');
create temp table r (k text, v text); create temp table ids (k text primary key, id uuid);
grant all on r, ids to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
insert into ids select 'g', public.create_group('Test squad', array['00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000d3']::uuid[]);
insert into ids select 'call', public.start_call((select id from ids where k='g'), 'video');
insert into r select 'ringing_people', count(*)::text from public.call_participants where call_id=(select id from ids where k='call');
insert into r select 'restart_joins_same', (public.start_call((select id from ids where k='g'), 'video') = (select id from ids where k='call'))::text;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
set local role authenticated;
select public.answer_call((select id from ids where k='call'));
insert into r select 'after_b', status from public.calls where id=(select id from ids where k='call');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d3","role":"authenticated"}', true);
set local role authenticated;
select public.answer_call((select id from ids where k='call'));
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
select public.end_call((select id from ids where k='call'));
insert into r select 'after_a_leaves', status from public.calls where id=(select id from ids where k='call');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
set local role authenticated;
select public.end_call((select id from ids where k='call'));
insert into r select 'after_b_leaves', status from public.calls where id=(select id from ids where k='call');
insert into r select 'summary', body from public.messages where kind='system' and conversation_id=(select id from ids where k='g') and body like '%call%';
insert into r select 'history_rows', count(*)::text || ':' || max(other_display_name) from public.list_calls(10) where is_group;
reset role;
select * from r;
rollback;
