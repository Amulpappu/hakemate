-- =====================================================================
-- Hakemate 3.0 — Final Round features from the problem statement
--   * Support Collaboration: team chat + task sharing (team members only)
--   * Smart Matching on hackathon requirements: event mode, location,
--     team size, and people already taken for that event
--   * Improve using student feedback: rate matches + general feedback
--   * Sample profiles flag (seeded separately in sample/seed_sample_profiles.sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Sample profile flag (users cannot change it: not in the update grant)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_sample boolean not null default false;

create or replace function public.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 1. Team chat
-- ---------------------------------------------------------------------
create table public.team_messages (
  id         bigserial primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index team_messages_team_idx on public.team_messages (team_id, created_at desc);
alter table public.team_messages enable row level security;

create policy tmsg_read on public.team_messages for select to authenticated
  using (public.is_team_member(team_id));
create policy tmsg_send on public.team_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_team_member(team_id) and public.is_active_user());
create policy tmsg_delete on public.team_messages for delete to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. Task sharing
-- ---------------------------------------------------------------------
create table public.team_tasks (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_on      date,
  created_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index team_tasks_team_idx on public.team_tasks (team_id, status);
alter table public.team_tasks enable row level security;

create policy ttask_read on public.team_tasks for select to authenticated
  using (public.is_team_member(team_id));
create policy ttask_add on public.team_tasks for insert to authenticated
  with check (created_by = auth.uid() and public.is_team_member(team_id) and public.is_active_user()
              and (assignee_id is null or exists (select 1 from public.team_members m where m.team_id = team_tasks.team_id and m.user_id = assignee_id)));
create policy ttask_edit on public.team_tasks for update to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id) and public.is_active_user()
              and (assignee_id is null or exists (select 1 from public.team_members m where m.team_id = team_tasks.team_id and m.user_id = assignee_id)));
create policy ttask_remove on public.team_tasks for delete to authenticated
  using (public.is_team_member(team_id));

-- team_id and created_by never change after creation
revoke update on public.team_tasks from authenticated, anon;
grant update (title, status, assignee_id, due_on) on public.team_tasks to authenticated;

create or replace function public.trg_task_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_team text;
begin
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  if new.assignee_id is not null and new.assignee_id <> auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select name into v_team from public.teams where id = new.team_id;
    perform public.notify(new.assignee_id, 'task', 'New task for you in ' || v_team, new.title, '/teams/' || new.team_id || '#tasks');
  end if;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status <> 'done' then
    perform public.award_xp(coalesce(new.assignee_id, auth.uid()), 5, 'finished a team task');
  end if;
  return new;
end $$;
create trigger team_tasks_changed before insert or update on public.team_tasks
  for each row execute function public.trg_task_changed();

-- ---------------------------------------------------------------------
-- 3. Student feedback
-- ---------------------------------------------------------------------
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('match','general')),
  rating     int  not null check (rating between 1 and 5),
  about_user uuid references public.profiles(id) on delete cascade,
  comment    text check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  check ((kind = 'match') = (about_user is not null))
);
create unique index feedback_one_per_match on public.feedback (user_id, about_user) where kind = 'match';
alter table public.feedback enable row level security;

create policy fb_read on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy fb_add on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

-- one rating per suggested teammate; changing your mind replaces it
create or replace function public.rate_match(p_user uuid, p_helpful boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() then raise exception 'Not allowed'; end if;
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then raise exception 'That person was not found'; end if;
  if p_user = auth.uid() then raise exception 'You cannot rate yourself'; end if;
  insert into public.feedback (user_id, kind, rating, about_user)
  values (auth.uid(), 'match', case when p_helpful then 5 else 1 end, p_user)
  on conflict (user_id, about_user) where kind = 'match'
  do update set rating = excluded.rating, created_at = now();
end $$;

create or replace function public.my_match_ratings()
returns table (about_user uuid, helpful boolean)
language sql stable security definer set search_path = public as $$
  select about_user, rating >= 4 from public.feedback where user_id = auth.uid() and kind = 'match';
$$;

create or replace function public.admin_feedback()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'match_total',   (select count(*) from public.feedback where kind = 'match'),
    'match_helpful', (select count(*) from public.feedback where kind = 'match' and rating >= 4),
    'general_total', (select count(*) from public.feedback where kind = 'general'),
    'general_avg',   (select round(avg(rating)::numeric, 1) from public.feedback where kind = 'general'),
    'recent', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select f.rating, f.comment, f.created_at, p.display_name, p.handle
        from public.feedback f join public.profiles p on p.id = f.user_id
        where f.kind = 'general' order by f.created_at desc limit 50) x), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 4. Event-aware matching (hackathon requirements)
-- ---------------------------------------------------------------------
drop function if exists public.match_candidates(uuid, int);

create or replace function public.match_candidates(p_team uuid default null, p_limit int default 30, p_hackathon text default null)
returns table (
  user_id uuid, handle text, display_name text, avatar_url text, headline text,
  college text, city text, level int, experience_level text,
  categories text[], score int, s_skill int, s_meaning int, s_avail int,
  s_mode int, s_exp int, reasons text[], is_sample boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  me        public.profiles%rowtype;
  have      text[];
  needed    text[];
  all_cats  text[] := array['Frontend','Backend','AI/ML','Design','Mobile','Hardware/IoT',
                            'Cyber Security','Data','Cloud/DevOps','Presentation'];
  v_team    public.teams%rowtype;
  v_hk      public.hackathons%rowtype;
  v_hk_id   text;
  my_text   text;
  exp_rank  int;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Sign in first'; end if;

  if p_team is not null then
    select * into v_team from public.teams where id = p_team;
    if not found or not exists (select 1 from public.team_members tm0 where tm0.team_id = p_team and tm0.user_id = me.id) then
      raise exception 'You are not in this team';
    end if;
  end if;

  v_hk_id := coalesce(nullif(p_hackathon, ''), v_team.hackathon_id);
  if v_hk_id is not null then select * into v_hk from public.hackathons where id = v_hk_id; end if;

  have := public.my_categories(me.id, p_team);
  if p_team is not null and cardinality(v_team.needed_categories) > 0 then
    needed := array(select unnest(v_team.needed_categories) except select unnest(have));
  else
    needed := array(select unnest(all_cats) except select unnest(have));
  end if;
  my_text  := coalesce(me.headline,'') || ' ' || coalesce(me.bio,'') || ' ' || array_to_string(me.interests,' ');
  exp_rank := case me.experience_level when 'first_timer' then 0 when 'some' then 1 else 2 end;

  return query
  with cand as (
    select p.*,
      coalesce((select array_agg(distinct s.category) from public.profile_skills ps
                join public.skills s on s.id = ps.skill_id where ps.profile_id = p.id), '{}') as cats
    from public.profiles p
    join public.app_users u on u.id = p.id
    where p.id <> me.id and p.visible and u.status = 'active' and u.onboarded
      and (p_team is null or not exists (select 1 from public.team_members t where t.team_id = p_team and t.user_id = p.id))
      -- already in a team for this hackathon = already taken
      and (v_hk.id is null or not exists (
            select 1 from public.team_members t2 join public.teams tt on tt.id = t2.team_id
            where t2.user_id = p.id and tt.hackathon_id = v_hk.id))
  ),
  scored as (
    select c.*,
      array(select unnest(c.cats) intersect select unnest(needed)) as fills,
      case when cardinality(c.interests) + cardinality(me.interests) = 0 then 0
           else (select count(*) from (select unnest(c.interests) intersect select unnest(me.interests)) x)::numeric
              / greatest((select count(*) from (select unnest(c.interests) union select unnest(me.interests)) y), 1)
      end as jac,
      word_similarity(my_text, coalesce(c.headline,'') || ' ' || coalesce(c.bio,'') || ' ' || array_to_string(c.interests,' ')) as txt,
      (select count(*) from (select unnest(c.availability) intersect select unnest(me.availability)) z) as av_common,
      greatest(cardinality(c.availability), cardinality(me.availability), 1) as av_max,
      case c.experience_level when 'first_timer' then 0 when 'some' then 1 else 2 end as c_exp,
      -- does this person fit the event's mode and place?
      case
        when v_hk.id is null then null
        when v_hk.mode = 'online' then c.event_mode in ('online','any')
        else c.event_mode in ('offline','any')
      end as fits_event,
      (v_hk.location is not null and c.city is not null and v_hk.location ilike '%' || c.city || '%') as near_event
    from cand c
  ),
  pts as (
    select s.*,
      least(30, cardinality(s.fills) * 15 + case when cardinality(s.fills) = 0 and cardinality(s.cats) > 0 then 5 else 0 end) as p_skill,
      least(30, coalesce(round(30 * public.meaning_similarity(me.id, s.id)), round(s.jac * 18 + s.txt * 12)))::int as p_meaning,
      round(15.0 * s.av_common / s.av_max)::int as p_avail,
      case
        -- no event picked: compare with me
        when v_hk.id is null then
            (case when s.event_mode = me.event_mode or s.event_mode = 'any' or me.event_mode = 'any' then 8 else 0 end)
          + (case when s.city is not null and lower(s.city) = lower(me.city) then 7
                  when s.state is not null and lower(s.state) = lower(me.state) then 4 else 0 end)
        -- online event: location does not matter
        when v_hk.mode = 'online' then case when s.fits_event then 15 else 6 end
        -- offline / hybrid event: mode + near the venue (or near me)
        else (case when s.fits_event then 8 when v_hk.mode = 'hybrid' then 4 else 0 end)
           + (case when s.near_event then 7
                   when s.city is not null and lower(s.city) = lower(me.city) then 5
                   when s.state is not null and lower(s.state) = lower(me.state) then 3 else 0 end)
      end as p_mode,
      case when s.c_exp <> exp_rank then 10 else 7 end as p_exp
    from scored s
  )
  select x.id, x.handle, x.display_name, x.avatar_url, x.headline, x.college, x.city, x.level,
         x.experience_level, x.cats,
         (x.p_skill + x.p_meaning + x.p_avail + x.p_mode + x.p_exp)::int,
         x.p_skill::int, x.p_meaning::int, x.p_avail::int, x.p_mode::int, x.p_exp::int,
         array_remove(array[
           case when cardinality(x.fills) > 0 then 'Covers ' || array_to_string(x.fills, ', ') || ', which you still need' end,
           case when x.fits_event then 'Fits this event: ' || case v_hk.mode when 'online' then 'happy to work online' else 'can attend in person' end end,
           case when x.near_event then 'Lives near the venue (' || x.city || ')' end,
           case when x.jac >= 0.3 then 'Shares your interests' end,
           case when x.av_common > 0 then 'Free at the same times as you' end,
           case when v_hk.id is null and x.city is not null and lower(x.city) = lower(me.city) then 'Same city: ' || x.city end,
           case when x.c_exp > exp_rank then 'More hackathon experience to guide the team'
                when x.c_exp < exp_rank then 'Fresh energy, you bring the experience' end,
           case when x.looking_for_team then 'Looking for a team right now' end
         ], null),
         x.is_sample
  from pts x
  order by 11 desc, x.level desc
  limit greatest(1, least(p_limit, 100));
end $$;

-- team size follows the hackathon's rule
create or replace function public.create_team(p_name text, p_hackathon text, p_description text,
                                              p_needed text[], p_max int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_max int := coalesce(p_max, 4); v_hk_max int;
begin
  if not public.is_active_user() then raise exception 'Not allowed'; end if;
  if nullif(p_hackathon,'') is not null then
    select team_max into v_hk_max from public.hackathons where id = p_hackathon;
    if v_hk_max is not null then v_max := least(v_max, v_hk_max); end if;
  end if;
  insert into public.teams (name, hackathon_id, owner_id, description, needed_categories, max_size)
  values (p_name, nullif(p_hackathon,''), auth.uid(), p_description, coalesce(p_needed,'{}'), v_max)
  returning id into v_id;
  insert into public.team_members (team_id, user_id, role_title) values (v_id, auth.uid(), 'Captain');
  perform public.grant_badge(auth.uid(), 'captain');
  perform public.award_xp(auth.uid(), 15, 'created a team');
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from anon, public;
revoke execute on function public.trg_task_changed() from authenticated;

-- realtime for chat and the task board (RLS still applies)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.team_messages, public.team_tasks;
  end if;
end $$;
