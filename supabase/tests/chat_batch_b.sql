-- Rolled-back check: pins, to-do lists, reminders. expect: pin_on true, b_sees_pins 1, outsider_pins 0,
-- outsider_pin_blocked yes, todo_items 2, toggled true, after_remove 1, outsider_todo 0, bad_todo_rejected yes,
-- reminder_ok true, reminder_past_rejected yes, reminder_sent 1, b_sees_a_reminders 0, unpin false
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bb-a@example.invalid', '{"username":"bbtesta","display_name":"Bb A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bb-b@example.invalid', '{"username":"bbtestb","display_name":"Bb B"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bb-c@example.invalid', '{"username":"bbtestc","display_name":"Bb C"}', now(), now());
insert into public.friendships (user_a, user_b) values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2');
create temp table r (k text, v text);
create temp table ids (k text primary key, id uuid);
grant all on r, ids to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
insert into ids select 'conv', public.get_or_create_direct('00000000-0000-4000-8000-0000000000e2');
insert into public.messages (conversation_id, client_id, kind, body, sender_id) select id, gen_random_uuid(), 'text', 'Meet at 6', '00000000-0000-4000-8000-0000000000e1' from ids where k = 'conv';
insert into ids select 'msg', id from public.messages where body = 'Meet at 6';
insert into public.messages (conversation_id, client_id, kind, body, sender_id) select id, gen_random_uuid(), 'todo', 'Trip packing', '00000000-0000-4000-8000-0000000000e1' from ids where k = 'conv';
insert into ids select 'todo', id from public.messages where kind = 'todo' and body = 'Trip packing';
do $$ begin
  insert into public.messages (conversation_id, client_id, kind, body, sender_id) select id, gen_random_uuid(), 'todo', '', '00000000-0000-4000-8000-0000000000e1' from ids where k = 'conv';
  insert into r values ('bad_todo_rejected', 'NO');
exception when others then insert into r values ('bad_todo_rejected', 'yes'); end $$;
insert into r select 'pin_on', public.toggle_pin((select id from ids where k = 'msg'))::text;
insert into ids select 'i1', public.todo_add((select id from ids where k = 'todo'), 'Charger');
insert into ids select 'i2', public.todo_add((select id from ids where k = 'todo'), 'Sunscreen');
insert into r select 'reminder_ok', (public.remind_message((select id from ids where k = 'msg'), now() + interval '2 minutes') is not null)::text;
do $$ begin
  perform public.remind_message((select id from ids where k = 'msg'), now() - interval '1 minute');
  insert into r values ('reminder_past_rejected', 'NO');
exception when others then insert into r values ('reminder_past_rejected', 'yes'); end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'b_sees_pins', count(*)::text from public.message_pins where unpinned_at is null;
insert into r select 'todo_items', count(*)::text from public.todo_items where removed_at is null;
insert into r select 'toggled', public.todo_toggle((select id from ids where k = 'i1'))::text;
select public.todo_remove((select id from ids where k = 'i2'));
insert into r select 'after_remove', count(*)::text from public.todo_items where removed_at is null;
insert into r select 'b_sees_a_reminders', count(*)::text from public.message_reminders;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'outsider_pins', count(*)::text from public.message_pins;
insert into r select 'outsider_todo', count(*)::text from public.todo_items;
do $$ begin
  perform public.toggle_pin((select id from ids where k = 'msg'));
  insert into r values ('outsider_pin_blocked', 'NO');
exception when others then insert into r values ('outsider_pin_blocked', 'yes'); end $$;
reset role;

update public.message_reminders set remind_at = now() - interval '1 second' where user_id = '00000000-0000-4000-8000-0000000000e1';
select public.send_message_reminders();
insert into r select 'reminder_sent', count(*)::text from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and title = 'Reminder';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'unpin', public.toggle_pin((select id from ids where k = 'msg'))::text;
reset role;
select * from r;
rollback;
