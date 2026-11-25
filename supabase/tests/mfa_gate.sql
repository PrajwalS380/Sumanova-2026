-- Rolled-back check: two-step gate. expect: no_factor_settings_rows 1, aal1_with_factor_rows 0, aal2_rows 1.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mfa-a@example.invalid', '{"username":"mfatesta","display_name":"Mfa A"}', now(), now());
create temp table r (k text, v text); grant all on r to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a9","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
insert into r select 'no_factor_settings_rows', count(*)::text from public.user_settings;
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a9', 'test', 'totp', 'verified', now(), now(), 'x');
set local role authenticated;
insert into r select 'aal1_with_factor_rows', count(*)::text from public.user_settings;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a9","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
insert into r select 'aal2_rows', count(*)::text from public.user_settings;
reset role;
select * from r;
rollback;
