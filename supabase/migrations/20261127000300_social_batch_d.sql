-- Social batch D: daily question, friend quizzes, chat puzzles (trivia / word scramble / drawing guess),
-- year in review, friendship anniversaries. Countdown stickers live in story / snap media_meta.

-- ---------------------------------------------------------------------------
-- Daily question: one built-in question per UTC day (the app holds the list); you see friends'
-- answers once you've answered.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_answers (
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  question    smallint not null check (question between 0 and 999),
  answer      text not null check (char_length(btrim(answer)) between 1 and 200),
  created_at  timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_answers enable row level security;
create policy "own daily answers" on public.daily_answers for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.answer_daily(p_question int, p_answer text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.daily_answers (user_id, day, question, answer)
  values (auth.uid(), (now() at time zone 'utc')::date, p_question, btrim(p_answer))
  on conflict (user_id, day) do update set answer = excluded.answer, created_at = now();
end;
$$;

create or replace function public.daily_feed()
returns table (user_id uuid, display_name text, username text, avatar_url text, answer text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.user_id, p.display_name, p.username, p.avatar_url, a.answer, a.created_at
  from public.daily_answers a join public.profiles p on p.id = a.user_id
  where a.day = (now() at time zone 'utc')::date
    and exists (select 1 from public.daily_answers me where me.user_id = auth.uid() and me.day = a.day)
    and (a.user_id = auth.uid() or public.are_friends(auth.uid(), a.user_id))
  order by a.created_at desc limit 100;
$$;

-- ---------------------------------------------------------------------------
-- Friend quizzes ("How well do you know me?"): answers are kept in quiz_keys, which nobody can read.
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 60),
  questions    jsonb not null,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);
create index if not exists quizzes_owner on public.quizzes (owner_id, created_at desc);
alter table public.quizzes enable row level security;
create policy "owner and friends see quizzes" on public.quizzes for select to authenticated
  using (owner_id = (select auth.uid()) or (archived_at is null and public.are_friends((select auth.uid()), owner_id)));

create table if not exists public.quiz_keys (
  quiz_id  uuid primary key references public.quizzes (id) on delete cascade,
  answers  smallint[] not null
);
alter table public.quiz_keys enable row level security; -- no policies: only the functions below read it

create table if not exists public.quiz_attempts (
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  answers     smallint[] not null,
  score       smallint not null,
  created_at  timestamptz not null default now(),
  primary key (quiz_id, user_id)
);
alter table public.quiz_attempts enable row level security;
create policy "see attempts on my quizzes or my own" on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = (select auth.uid())));

-- p_questions: [{"q": "...", "options": ["a","b","c"]}, ...] (3–10 questions, 2–4 options); p_answers: index per question
create or replace function public.create_quiz(p_title text, p_questions jsonb, p_answers int[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare n int; i int; v_id uuid; o int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'questions missing'; end if;
  n := jsonb_array_length(p_questions);
  if n < 3 or n > 10 then raise exception 'a quiz has 3 to 10 questions'; end if;
  if coalesce(array_length(p_answers, 1), 0) <> n then raise exception 'pick the right answer for every question'; end if;
  for i in 0 .. n - 1 loop
    if char_length(btrim(coalesce(p_questions -> i ->> 'q', ''))) not between 1 and 120 then raise exception 'question % needs text (up to 120)', i + 1; end if;
    if jsonb_typeof(p_questions -> i -> 'options') <> 'array' then raise exception 'question % needs options', i + 1; end if;
    o := jsonb_array_length(p_questions -> i -> 'options');
    if o < 2 or o > 4 then raise exception 'question % needs 2 to 4 options', i + 1; end if;
    if exists (select 1 from jsonb_array_elements(p_questions -> i -> 'options') x where jsonb_typeof(x) <> 'string' or char_length(btrim(x #>> '{}')) not between 1 and 60) then
      raise exception 'options are 1–60 characters';
    end if;
    if p_answers[i + 1] is null or p_answers[i + 1] < 0 or p_answers[i + 1] >= o then raise exception 'pick the right answer for question %', i + 1; end if;
  end loop;
  if (select count(*) from public.quizzes where owner_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception 'that’s enough quizzes for today'; end if;
  insert into public.quizzes (owner_id, title, questions) values (auth.uid(), btrim(p_title), p_questions) returning id into v_id;
  insert into public.quiz_keys (quiz_id, answers) values (v_id, p_answers::smallint[]);
  return v_id;
end;
$$;

-- Returns the score and the right answers (only after you've played).
create or replace function public.take_quiz(p_quiz uuid, p_answers int[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.quizzes; k smallint[]; s int := 0; i int; v_owner text;
begin
  select * into q from public.quizzes where id = p_quiz and archived_at is null;
  if not found or q.owner_id = auth.uid() or not public.are_friends(auth.uid(), q.owner_id) then raise exception 'quiz not found'; end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz and user_id = auth.uid()) then raise exception 'you already took this quiz'; end if;
  select answers into k from public.quiz_keys where quiz_id = p_quiz;
  if coalesce(array_length(p_answers, 1), 0) <> array_length(k, 1) then raise exception 'answer every question'; end if;
  for i in 1 .. array_length(k, 1) loop
    if p_answers[i] = k[i] then s := s + 1; end if;
  end loop;
  insert into public.quiz_attempts (quiz_id, user_id, answers, score) values (p_quiz, auth.uid(), p_answers::smallint[], s);
  select display_name into v_owner from public.profiles where id = auth.uid();
  perform public.notify(q.owner_id, 'system', coalesce(v_owner, 'A friend') || ' took your quiz', s || ' of ' || array_length(k, 1) || ' right — ' || q.title, '/quiz/' || p_quiz, auth.uid());
  return jsonb_build_object('score', s, 'total', array_length(k, 1), 'answers', to_jsonb(k));
end;
$$;

-- My result (with the key) for a quiz I already took, or the key for my own quiz.
create or replace function public.quiz_result(p_quiz uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when q.owner_id = auth.uid() then jsonb_build_object('answers', to_jsonb(k.answers), 'owner', true)
    when a.user_id is not null then jsonb_build_object('score', a.score, 'total', array_length(k.answers, 1), 'answers', to_jsonb(k.answers), 'mine', to_jsonb(a.answers))
    else null end
  from public.quizzes q join public.quiz_keys k on k.quiz_id = q.id
  left join public.quiz_attempts a on a.quiz_id = q.id and a.user_id = auth.uid()
  where q.id = p_quiz and (q.owner_id = auth.uid() or public.are_friends(auth.uid(), q.owner_id));
$$;

-- Leaderboard on a quiz: owner sees everyone; players see friends who played.
create or replace function public.quiz_board(p_quiz uuid)
returns table (user_id uuid, display_name text, avatar_url text, score smallint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.user_id, p.display_name, p.avatar_url, a.score, a.created_at
  from public.quiz_attempts a join public.profiles p on p.id = a.user_id join public.quizzes q on q.id = a.quiz_id
  where a.quiz_id = p_quiz
    and (q.owner_id = auth.uid() or (exists (select 1 from public.quiz_attempts me where me.quiz_id = p_quiz and me.user_id = auth.uid())
         and (a.user_id = auth.uid() or public.are_friends(auth.uid(), a.user_id))))
  order by a.score desc, a.created_at limit 100;
$$;

-- ---------------------------------------------------------------------------
-- Chat puzzles (message kind 'puzzle'): trivia, word scramble, drawing guess. The answer is in
-- puzzle_secrets (unreadable); guesses are checked here; the first right guess wins and reveals it.
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text','image','video','voice','sticker','system','snap','poll','location','hangout','game','todo','puzzle'));

create table if not exists public.puzzle_secrets (
  message_id  uuid primary key references public.messages (id) on delete cascade,
  answer      text not null check (char_length(answer) between 1 and 60)
);
alter table public.puzzle_secrets enable row level security; -- no policies

create table if not exists public.puzzle_guesses (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  correct     boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists puzzle_guesses_msg on public.puzzle_guesses (message_id, created_at);
alter table public.puzzle_guesses enable row level security;
create policy "members see guesses" on public.puzzle_guesses for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_member(m.conversation_id)));
alter publication supabase_realtime add table public.puzzle_guesses;

-- Puzzles can only be created through start_puzzle.
create or replace function public.messages_guard_puzzle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'puzzle' and coalesce(current_setting('snv.puzzle', true), '') <> '1' then
    raise exception 'start puzzles from the games menu';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_guard_puzzle on public.messages;
create trigger messages_guard_puzzle before insert on public.messages for each row execute function public.messages_guard_puzzle();
revoke all on function public.messages_guard_puzzle() from public, anon, authenticated;

create or replace function public.puzzle_norm(t text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(lower(btrim(coalesce(t, ''))), '[^[:alnum:]]+', '', 'g');
$$;

-- p_kind trivia: p_meta {question, options[2..4]}, p_answer = index as text
-- p_kind scramble: p_meta {letters, hint?}, p_answer = the word (letters must be its shuffle)
-- p_kind draw: p_meta {strokes: [[x,y,...], ...] in 0..1000, hint?}, p_answer = the word
create or replace function public.start_puzzle(p_conversation uuid, p_kind text, p_meta jsonb, p_answer text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ans text := btrim(coalesce(p_answer, '')); v_meta jsonb; o int;
begin
  if auth.uid() is null or not public.is_member(p_conversation) then raise exception 'not in this chat'; end if;
  if p_kind not in ('trivia', 'scramble', 'draw') then raise exception 'unknown puzzle'; end if;
  if char_length(v_ans) not between 1 and 40 then raise exception 'the answer is 1–40 characters'; end if;
  if octet_length(p_meta::text) > 24000 then raise exception 'drawing is too big'; end if;
  if p_kind = 'trivia' then
    o := jsonb_array_length(coalesce(p_meta -> 'options', '[]'::jsonb));
    if o < 2 or o > 4 or char_length(coalesce(p_meta ->> 'question', '')) not between 1 and 200 or v_ans !~ '^[0-3]$' or v_ans::int >= o then
      raise exception 'trivia needs a question, 2–4 options and the right one';
    end if;
    v_meta := jsonb_build_object('puzzle', 'trivia', 'question', p_meta ->> 'question', 'options', p_meta -> 'options');
  elsif p_kind = 'scramble' then
    if (select string_agg(c, '' order by c) from regexp_split_to_table(public.puzzle_norm(p_meta ->> 'letters'), '') c)
       is distinct from (select string_agg(c, '' order by c) from regexp_split_to_table(public.puzzle_norm(v_ans), '') c) then
      raise exception 'letters must be the word shuffled';
    end if;
    v_meta := jsonb_build_object('puzzle', 'scramble', 'letters', upper(p_meta ->> 'letters'), 'hint', left(p_meta ->> 'hint', 60), 'length', char_length(public.puzzle_norm(v_ans)));
  else
    if jsonb_typeof(p_meta -> 'strokes') <> 'array' or jsonb_array_length(p_meta -> 'strokes') = 0 then raise exception 'draw something first'; end if;
    v_meta := jsonb_build_object('puzzle', 'draw', 'strokes', p_meta -> 'strokes', 'hint', left(p_meta ->> 'hint', 60), 'length', char_length(public.puzzle_norm(v_ans)));
  end if;
  perform set_config('snv.puzzle', '1', true);
  insert into public.messages (conversation_id, sender_id, client_id, kind, body, media_meta)
  values (p_conversation, auth.uid(), gen_random_uuid(), 'puzzle',
          case p_kind when 'trivia' then 'Trivia' when 'scramble' then 'Word puzzle' else 'Guess the drawing' end, v_meta)
  returning id into v_id;
  perform set_config('snv.puzzle', '0', true);
  insert into public.puzzle_secrets (message_id, answer) values (v_id, v_ans);
  return v_id;
end;
$$;

create or replace function public.puzzle_guess(p_message uuid, p_guess text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare m public.messages; s text; ok boolean; tries int; v_name text;
begin
  select * into m from public.messages where id = p_message and kind = 'puzzle' and deleted_at is null for update;
  if not found or not public.is_member(m.conversation_id) then raise exception 'puzzle not found'; end if;
  if m.sender_id = auth.uid() then raise exception 'you made this one — let the others guess'; end if;
  if m.media_meta ->> 'solved_by' is not null then raise exception 'already solved'; end if;
  select count(*) into tries from public.puzzle_guesses where message_id = p_message and user_id = auth.uid();
  if tries >= (case when m.media_meta ->> 'puzzle' = 'trivia' then 1 else 8 end) then raise exception 'no guesses left'; end if;
  select answer into s from public.puzzle_secrets where message_id = p_message;
  ok := (case when m.media_meta ->> 'puzzle' = 'trivia' then btrim(p_guess) = s else public.puzzle_norm(p_guess) = public.puzzle_norm(s) end);
  insert into public.puzzle_guesses (message_id, user_id, correct) values (p_message, auth.uid(), ok);
  if ok then
    select display_name into v_name from public.profiles where id = auth.uid();
    update public.messages set media_meta = media_meta || jsonb_build_object('solved_by', auth.uid(), 'solved_name', v_name, 'answer', s, 'solved_at', now())
    where id = p_message;
  end if;
  return ok;
end;
$$;

-- ---------------------------------------------------------------------------
-- Year in review (your own numbers only)
-- ---------------------------------------------------------------------------
create or replace function public.my_year_recap(p_year int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC'); b timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC'); me uuid := auth.uid(); r jsonb;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select jsonb_build_object(
    'year', p_year,
    'messages', (select count(*) from public.messages where sender_id = me and created_at >= a and created_at < b and kind <> 'system'),
    'snaps', (select count(*) from public.snaps where sender_id = me and created_at >= a and created_at < b),
    'stories', (select count(*) from public.stories where user_id = me and created_at >= a and created_at < b),
    'memories', (select count(*) from public.memories where user_id = me and taken_at >= a and taken_at < b and deleted_at is null),
    'new_friends', (select count(*) from public.friendships where me in (user_a, user_b) and created_at >= a and created_at < b),
    'best_streak', (select coalesce(max(best), 0) from public.streaks where me in (user_a, user_b)),
    'busiest_month', (select extract(month from created_at)::int from public.messages where sender_id = me and created_at >= a and created_at < b group by 1 order by count(*) desc limit 1),
    'top_friends', coalesce((
      select jsonb_agg(t order by t.n desc) from (
        select p.id, p.display_name, p.avatar_url, count(*) as n
        from public.messages mm
        join public.conversations c on c.id = mm.conversation_id and c.kind = 'direct'
        join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id <> me
        join public.profiles p on p.id = cm.user_id
        where mm.created_at >= a and mm.created_at < b and mm.kind <> 'system'
          and exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.user_id = me)
        group by p.id, p.display_name, p.avatar_url order by count(*) desc limit 3
      ) t), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Friendship anniversaries (daily 03:41 UTC): 100 days, then every whole year.
-- ---------------------------------------------------------------------------
create or replace function public.send_friend_anniversaries()
returns int language plpgsql security definer set search_path = '' as $$
declare f record; n int := 0; today date := (now() at time zone 'utc')::date; label text; pa record; pb record;
begin
  for f in
    select user_a, user_b, created_at::date as since from public.friendships
    where created_at::date < today
      and ((today - created_at::date) = 100
        or (extract(month from created_at) = extract(month from today) and extract(day from created_at) = extract(day from today)))
  loop
    label := (case when today - f.since = 100 then '100 days' else (extract(year from age(today, f.since))::int || case when extract(year from age(today, f.since)) = 1 then ' year' else ' years' end) end);
    select display_name, username into pa from public.profiles where id = f.user_a;
    select display_name, username into pb from public.profiles where id = f.user_b;
    perform public.notify(f.user_a, 'system', label || ' of friendship with ' || pb.display_name, 'You became friends on ' || to_char(f.since, 'FMDD Mon YYYY') || '. Send a snap!', '/u/' || pb.username, null);
    perform public.notify(f.user_b, 'system', label || ' of friendship with ' || pa.display_name, 'You became friends on ' || to_char(f.since, 'FMDD Mon YYYY') || '. Send a snap!', '/u/' || pa.username, null);
    n := n + 2;
  end loop;
  return n;
end;
$$;
revoke all on function public.send_friend_anniversaries() from public, anon, authenticated;
select cron.schedule('sumanova-friend-anniversaries', '41 3 * * *', $$select public.send_friend_anniversaries()$$);

revoke all on function public.answer_daily(int, text), public.daily_feed(), public.create_quiz(text, jsonb, int[]), public.take_quiz(uuid, int[]),
  public.quiz_result(uuid), public.quiz_board(uuid), public.start_puzzle(uuid, text, jsonb, text), public.puzzle_guess(uuid, text),
  public.my_year_recap(int) from public, anon;
grant execute on function public.answer_daily(int, text), public.daily_feed(), public.create_quiz(text, jsonb, int[]), public.take_quiz(uuid, int[]),
  public.quiz_result(uuid), public.quiz_board(uuid), public.start_puzzle(uuid, text, jsonb, text), public.puzzle_guess(uuid, text),
  public.my_year_recap(int) to authenticated;
