-- Rolled-back check for batch 7. expect: double_move_blocked yes, ttt_winner_is_a true, c4_drop_row 39 (bottom row),
-- hang_msg 1, far_checkin_blocked yes, checked_in true, album_item true, key true, overdue_alerts 1,
-- b_sees_album_items 1, b_alerted 1.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000b7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b7-a@example.invalid', '{"username":"b7testa","display_name":"B7 A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000b8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b7-b@example.invalid', '{"username":"b7testb","display_name":"B7 B"}', now(), now());
insert into public.friendships (user_a, user_b) values ('00000000-0000-4000-8000-0000000000b7','00000000-0000-4000-8000-0000000000b8');
create temp table r (k text, v text); create temp table ids (k text primary key, id uuid); grant all on r, ids to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}', true);
set local role authenticated;
insert into ids select 'conv', public.get_or_create_direct('00000000-0000-4000-8000-0000000000b8');
insert into ids select 'ttt', public.start_game((select id from ids where k='conv'), 'ttt', '00000000-0000-4000-8000-0000000000b8');
select public.game_move((select id from ids where k='ttt'), 0);
do $$ begin perform public.game_move((select id from ids where k='ttt'), 1); insert into r values ('double_move_blocked','NO'); exception when others then insert into r values ('double_move_blocked','yes'); end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
set local role authenticated;
select public.game_move((select id from ids where k='ttt'), 3);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}', true);
set local role authenticated;
select public.game_move((select id from ids where k='ttt'), 1);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
set local role authenticated;
select public.game_move((select id from ids where k='ttt'), 4);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'ttt_winner_is_a', ((public.game_move((select id from ids where k='ttt'), 2)) ->> 'winner' = '00000000-0000-4000-8000-0000000000b7')::text;
insert into ids select 'c4', public.start_game((select id from ids where k='conv'), 'c4', '00000000-0000-4000-8000-0000000000b8');
insert into r select 'c4_drop_row', (array_position(array(select x::int from jsonb_array_elements_text(public.game_move((select id from ids where k='c4'), 3) -> 'board') x), 1))::text;
insert into ids select 'hang', public.create_hangout((select id from ids where k='conv'), 'Pizza night', 'Nova Cafe', 12.97, 77.59, now() + interval '1 hour');
insert into r select 'hang_msg', count(*)::text from public.messages where kind='hangout' and conversation_id=(select id from ids where k='conv');
do $$ begin perform public.checkin_hangout((select id from ids where k='hang'), 13.2, 77.59); insert into r values ('far_checkin_blocked','NO'); exception when others then insert into r values ('far_checkin_blocked','yes'); end $$;
select public.checkin_hangout((select id from ids where k='hang'), 12.9701, 77.5901);
insert into r select 'checked_in', (checked_in_at is not null)::text from public.hangout_rsvps where hangout_id=(select id from ids where k='hang') and user_id='00000000-0000-4000-8000-0000000000b7';
insert into ids select 'safe', public.start_safety_checkin(array['00000000-0000-4000-8000-0000000000b8']::uuid[], now() + interval '10 minutes', 'Walking home');
insert into ids select 'album', public.create_shared_album('Goa trip', array['00000000-0000-4000-8000-0000000000b8']::uuid[]);
insert into r select 'album_item', (public.add_album_item((select id from ids where k='album'), 'image', (select id from ids where k='album')::text || '/00000000-0000-4000-8000-0000000000b7/x.webp') is not null)::text;
insert into r select 'key', (public.publish_e2e_key('{"kty":"EC","crv":"P-256","x":"abc","y":"def"}') is not null)::text;
reset role;
update public.safety_checkins set due_at = now() - interval '1 minute' where id = (select id from ids where k='safe');
select set_config('request.jwt.claims', '', true);
insert into r select 'overdue_alerts', public.alert_overdue_checkins()::text;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b8","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'b_sees_album_items', count(*)::text from public.shared_album_items;
insert into r select 'b_alerted', count(*)::text from public.notifications where title like '%hasn’t checked in';
reset role;
select * from r;
rollback;
