-- Rolled-back check for batch 5. expect: story_row "{…e2} 12.97,77.59 meta={}", heat "1:1", near 1, explored 2,
-- mem_search 1, mem_search_month 1, b_sees "63 driving", b_notified 1, b_explored_rows 0.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5-a@example.invalid', '{"username":"b5testa","display_name":"B5 A"}', now(), now()),
 ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5-b@example.invalid', '{"username":"b5testb","display_name":"B5 B"}', now(), now());
insert into public.friendships (user_a, user_b) values ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000e2');
create temp table r (k text, v text); grant all on r to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select public.post_story('00000000-0000-4000-8000-00000000e0e1', 'text', null, null, 'hello #nova', '#111', '{"mentions":["00000000-0000-4000-8000-0000000000e2"],"map":{"lat":12.97164,"lng":77.59462}}', 'everyone');
insert into r select 'story_row', mentions::text || ' ' || map_lat || ',' || map_lng || ' meta=' || media_meta::text from public.stories where id='00000000-0000-4000-8000-00000000e0e1';
insert into r select 'heat', count(*)::text || ':' || coalesce(max(stories),0) from public.story_heat(12, 77, 13.5, 78.5);
insert into r select 'near', count(*)::text from public.stories_near(12.97, 77.59);
select public.share_location(12.97, 77.59, 10, 60, true, 'friends', null, true, 64);
reset role;
update public.location_shares set updated_at = now() - interval '60 seconds' where user_id='00000000-0000-4000-8000-0000000000e1';
set local role authenticated;
select public.share_location(12.98, 77.59, 10, null, null, null, null, false, 63);
insert into r select 'explored', count(*)::text from public.explored_cells;
select public.add_memory('00000000-0000-4000-8000-00000000e0e2','image','00000000-0000-4000-8000-0000000000e1/00000000-0000-4000-8000-00000000e0e2.webp','{"tags":"selfie night"}', 100, null);
insert into r select 'mem_search', count(*)::text from public.search_memories('selfie');
insert into r select 'mem_search_month', count(*)::text from public.search_memories(to_char(now(),'FMMonth'));
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'b_sees', battery::text || ' ' || coalesce(motion,'-') from public.friend_locations();
insert into r select 'b_notified', count(*)::text from public.notifications where title like '%mentioned you%';
insert into r select 'b_explored_rows', count(*)::text from public.explored_cells;
reset role;
select * from r;
rollback;
