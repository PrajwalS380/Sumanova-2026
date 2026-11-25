-- Rolled-back check for polls, live location, scheduled messages, chat screenshot alerts.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cx-a@example.invalid', '{"username":"cxtesta","display_name":"Cx A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cx-b@example.invalid', '{"username":"cxtestb","display_name":"Cx B"}', now(), now());
insert into public.friendships (user_a, user_b) values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2');
create temp table r (k text, v text);
create temp table ids (k text primary key, id uuid);
grant all on r, ids to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
insert into ids select 'conv', public.get_or_create_direct('00000000-0000-4000-8000-0000000000c2');
insert into public.messages (conversation_id, client_id, kind, body, media_meta, sender_id)
  select id, gen_random_uuid(), 'poll', 'Pizza or dosa?', '{"options":["Pizza","Dosa"]}', '00000000-0000-4000-8000-0000000000c1' from ids where k = 'conv';
insert into ids select 'poll', id from public.messages where kind = 'poll' and body = 'Pizza or dosa?';
do $$ begin
  insert into public.messages (conversation_id, client_id, kind, body, media_meta, sender_id)
    select id, gen_random_uuid(), 'poll', 'Bad', '{"options":["only one"]}', '00000000-0000-4000-8000-0000000000c1' from ids where k = 'conv';
  insert into r values ('bad_poll_rejected', 'NO');
exception when others then insert into r values ('bad_poll_rejected', 'yes'); end $$;
insert into public.messages (conversation_id, client_id, kind, body, media_meta, sender_id)
  select id, gen_random_uuid(), 'location', 'Live location', jsonb_build_object('lat', 12.97, 'lng', 77.59, 'live_until', now() + interval '1 hour'), '00000000-0000-4000-8000-0000000000c1' from ids where k = 'conv';
insert into ids select 'loc', id from public.messages where kind = 'location' and body = 'Live location';
insert into r select 'live_update', public.update_live_location((select id from ids where k = 'loc'), 13.0, 77.6)::text;
insert into r select 'sched_ok', (public.schedule_message((select id from ids where k = 'conv'), 'Happy birthday!', now() + interval '2 minutes') is not null)::text;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select public.vote_poll((select id from ids where k = 'poll'), 1);
insert into r select 'b_sees_votes', count(*)::text from public.poll_votes where message_id = (select id from ids where k = 'poll');
insert into r select 'b_sees_new_pin', (media_meta ->> 'lat') from public.messages where id = (select id from ids where k = 'loc');
do $$ begin
  perform public.update_live_location((select id from ids where k = 'loc'), 1, 1);
  insert into r values ('b_cannot_move_pin', 'NO');
exception when others then insert into r values ('b_cannot_move_pin', 'yes'); end $$;
insert into r select 'b_sees_a_schedule', count(*)::text from public.scheduled_messages;
select public.report_chat_screenshot((select id from ids where k = 'conv'));
insert into r select 'screenshot_line', body from public.messages where kind = 'system' and conversation_id = (select id from ids where k = 'conv');
reset role;

-- Time passes: deliver the scheduled message as A.
select set_config('request.jwt.claims', '', true); -- cron runs with no signed-in user
update public.scheduled_messages set send_at = now() - interval '1 second' where sender_id = '00000000-0000-4000-8000-0000000000c1';
insert into r select 'delivered', public.deliver_scheduled_messages()::text;
insert into r select 'sched_msg_sender', (sender_id = '00000000-0000-4000-8000-0000000000c1')::text from public.messages where body = 'Happy birthday!';
-- expect: bad_poll_rejected yes, live_update true, sched_ok true, b_sees_votes 1, b_sees_new_pin 13, b_cannot_move_pin yes,
--         b_sees_a_schedule 0, screenshot_line "Cx B took a screenshot of the chat", delivered 1, sched_msg_sender true
select * from r;
rollback;
