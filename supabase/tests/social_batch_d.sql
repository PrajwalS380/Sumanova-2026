-- Rolled-back check: daily question, quizzes, puzzles, recap, anniversaries.
-- expect: bad_scramble_rejected yes, direct_puzzle_blocked yes, a_reads_keys 0, a_reads_secret 0, recap_has_year 2026,
-- b_feed_before 0, b_feed_after 2, b_sees_quiz 1, b_score 2, retake_blocked yes, b_wrong false, b_right true, revealed cat,
-- c_sees_quiz 0, c_feed_only_self 1, anniv_sent 2
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sd-a@example.invalid', '{"username":"sdtesta","display_name":"Sd A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sd-b@example.invalid', '{"username":"sdtestb","display_name":"Sd B"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sd-c@example.invalid', '{"username":"sdtestc","display_name":"Sd C"}', now(), now());
insert into public.friendships (user_a, user_b, created_at) values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2', now() - interval '100 days');
create temp table r (k text, v text); create temp table ids (k text primary key, id uuid);
grant all on r, ids to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select public.answer_daily(3, 'Pizza');
insert into ids select 'quiz', public.create_quiz('About me', '[{"q":"Fav food?","options":["Dosa","Pizza"]},{"q":"Pet?","options":["Cat","Dog","None"]},{"q":"Colour?","options":["Pink","Blue"]}]', array[0,1,0]);
insert into ids select 'conv', public.get_or_create_direct('00000000-0000-4000-8000-0000000000f2');
insert into ids select 'pz', public.start_puzzle((select id from ids where k='conv'), 'scramble', '{"letters":"TCA","hint":"pet"}', 'cat');
do $$ begin perform public.start_puzzle((select id from ids where k='conv'), 'scramble', '{"letters":"XYZ"}', 'cat'); insert into r values ('bad_scramble_rejected','NO');
exception when others then insert into r values ('bad_scramble_rejected','yes'); end $$;
do $$ begin insert into public.messages (conversation_id, client_id, kind, body, sender_id) select id, gen_random_uuid(), 'puzzle', 'x', '00000000-0000-4000-8000-0000000000f1' from ids where k='conv'; insert into r values ('direct_puzzle_blocked','NO');
exception when others then insert into r values ('direct_puzzle_blocked','yes'); end $$;
insert into r select 'a_reads_keys', count(*)::text from public.quiz_keys;
insert into r select 'a_reads_secret', count(*)::text from public.puzzle_secrets;
insert into r select 'recap_has_year', (public.my_year_recap(2026) ->> 'year');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'b_feed_before', count(*)::text from public.daily_feed();
select public.answer_daily(3, 'Dosa');
insert into r select 'b_feed_after', count(*)::text from public.daily_feed();
insert into r select 'b_sees_quiz', count(*)::text from public.quizzes;
insert into r select 'b_score', (public.take_quiz((select id from ids where k='quiz'), array[0,1,1]) ->> 'score');
do $$ begin perform public.take_quiz((select id from ids where k='quiz'), array[0,1,0]); insert into r values ('retake_blocked','NO');
exception when others then insert into r values ('retake_blocked','yes'); end $$;
insert into r select 'b_wrong', public.puzzle_guess((select id from ids where k='pz'), 'act')::text;
insert into r select 'b_right', public.puzzle_guess((select id from ids where k='pz'), 'CAT')::text;
insert into r select 'revealed', media_meta ->> 'answer' from public.messages where id = (select id from ids where k='pz');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'c_sees_quiz', count(*)::text from public.quizzes;
select public.answer_daily(3, 'Idli');
insert into r select 'c_feed_only_self', count(*)::text from public.daily_feed();
reset role;
insert into r select 'anniv_sent', public.send_friend_anniversaries()::text;
select * from r;
rollback;
