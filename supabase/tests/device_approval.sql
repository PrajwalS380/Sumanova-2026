-- Rolled-back check: new-device approval.
-- expect: off_ok true, enable_ok true, new_status pending, new_ok false, new_requests 0, old_requests 1,
--         decide_ok true, new_ok_after true, old_device_status approved
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev-a@example.invalid', '{"username":"devtesta","display_name":"Dev A"}', now(), now());
insert into public.login_events (user_id, device, platform, device_key, created_at) values
 ('00000000-0000-4000-8000-0000000000d1', 'Old phone', 'android', 'oldkey00000000', now() - interval '2 days');
create temp table r (k text, v text); grant all on r to authenticated;
-- trusted session (old phone)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","aal":"aal1","session_id":"sess-old-000001"}', true);
set local role authenticated;
insert into r select 'off_ok', public.device_ok()::text;
select public.set_device_approval(true, 'oldkey00000000', 'Old phone');
insert into r select 'enable_ok', public.device_ok()::text;
-- new sign-in elsewhere
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","aal":"aal1","session_id":"sess-new-000002"}', true);
insert into r select 'new_status', public.device_check('newkey00000000', 'Unknown laptop');
insert into r select 'new_ok', public.device_ok()::text;
insert into r select 'new_requests', count(*)::text from public.device_requests();
-- another session of the old phone (re-sign-in) is trusted by device key
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","aal":"aal1","session_id":"sess-old-000003"}', true);
insert into r select 'old_device_status', public.device_check('oldkey00000000', 'Old phone');
insert into r select 'old_requests', count(*)::text from public.device_requests();
select public.device_decide((select id from public.device_requests() limit 1), true);
insert into r select 'decide_ok', 'true';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","aal":"aal1","session_id":"sess-new-000002"}', true);
insert into r select 'new_ok_after', public.device_ok()::text;
reset role;
select * from r;
rollback;
