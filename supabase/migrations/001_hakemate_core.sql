-- =====================================================================
-- Hakemate 3.0 — core schema (Supabase / PostgreSQL 15+)
-- Google-only sign in, user management, profiles, Team DNA engine,
-- teams, community (feed, hubs, kudos, follows, endorsements),
-- badges / XP / levels, notifications, admin tools.
--
-- Run once in the Supabase SQL editor (or with `supabase db push`).
-- The browser uses only the publishable/anon key. Every table has RLS.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 0. Settings
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id            int primary key default 1 check (id = 1),
  admin_emails  text[] not null default '{}',
  google_only   boolean not null default true
);
insert into public.app_settings (id, admin_emails)
values (1, array['lohithgamer12@gmail.com'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 1. User management (private, one row per auth user)
-- ---------------------------------------------------------------------
create table public.app_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  provider      text not null default 'google',
  role          text not null default 'member' check (role in ('member','moderator','admin')),
  status        text not null default 'active' check (status in ('active','suspended')),
  onboarded     boolean not null default false,
  tour_done     boolean not null default false,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index app_users_role_idx on public.app_users (role);

-- ---------------------------------------------------------------------
-- 2. Public profile
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references public.app_users(id) on delete cascade,
  handle           text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name     text not null check (char_length(display_name) between 2 and 60),
  avatar_url       text,
  headline         text check (char_length(headline) <= 90),
  bio              text check (char_length(bio) <= 400),
  college          text check (char_length(college) <= 160),
  department       text check (char_length(department) <= 80),
  year_of_study    text check (year_of_study in ('1st year','2nd year','3rd year','4th year','5th year','PG','Graduate')),
  city             text check (char_length(city) <= 60),
  state            text check (char_length(state) <= 60),
  event_mode       text not null default 'any' check (event_mode in ('any','online','offline')),
  hours_per_week   int  check (hours_per_week between 0 and 80),
  experience_level text not null default 'first_timer' check (experience_level in ('first_timer','some','veteran')),
  hackathons_count int  not null default 0 check (hackathons_count between 0 and 200),
  availability     text[] not null default '{}',
  interests        text[] not null default '{}',
  github_url       text check (github_url is null or github_url ~* '^https://(www\.)?github\.com/'),
  linkedin_url     text check (linkedin_url is null or linkedin_url ~* '^https://(www\.|in\.)?linkedin\.com/'),
  portfolio_url    text check (portfolio_url is null or portfolio_url ~* '^https://'),
  looking_for_team boolean not null default true,
  visible          boolean not null default true,
  showcase_badges  text[] not null default '{}' check (cardinality(showcase_badges) <= 3),
  xp               int not null default 0,
  level            int not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index profiles_interests_idx on public.profiles using gin (interests);
create index profiles_avail_idx     on public.profiles using gin (availability);
create index profiles_xp_idx        on public.profiles (xp desc);
create index profiles_text_trgm     on public.profiles using gin ((coalesce(headline,'') || ' ' || coalesce(bio,'')) extensions.gin_trgm_ops);

-- contact details: only the owner and their teammates can read them
create table public.profile_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone      text check (phone is null or phone ~ '^[0-9+ ]{7,16}$'),
  whatsapp   text check (whatsapp is null or whatsapp ~ '^[0-9+ ]{7,16}$'),
  discord    text check (char_length(discord) <= 40),
  email      text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ---------------------------------------------------------------------
-- 3. Skills, endorsements, projects
-- ---------------------------------------------------------------------
create table public.skills (
  id       serial primary key,
  name     text not null unique,
  category text not null check (category in
    ('Frontend','Backend','AI/ML','Design','Mobile','Hardware/IoT','Cyber Security','Data','Cloud/DevOps','Presentation'))
);

create table public.profile_skills (
  profile_id uuid references public.profiles(id) on delete cascade,
  skill_id   int  references public.skills(id) on delete cascade,
  level      int  not null default 2 check (level between 1 and 3),
  primary key (profile_id, skill_id)
);
create index profile_skills_skill_idx on public.profile_skills (skill_id);

create table public.endorsements (
  endorser_id uuid references public.profiles(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete cascade,
  skill_id    int  references public.skills(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (endorser_id, profile_id, skill_id),
  check (endorser_id <> profile_id)
);
create index endorsements_profile_idx on public.endorsements (profile_id, skill_id);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 300),
  tech        text[] not null default '{}',
  repo_url    text check (repo_url is null or repo_url ~* '^https://'),
  demo_url    text check (demo_url is null or demo_url ~* '^https://'),
  created_at  timestamptz not null default now()
);
create index projects_profile_idx on public.projects (profile_id);

-- ---------------------------------------------------------------------
-- 4. Hackathons and teams
-- ---------------------------------------------------------------------
create table public.hackathons (
  id                    text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  name                  text not null,
  organizer             text,
  mode                  text not null default 'online' check (mode in ('online','offline','hybrid')),
  location              text,
  starts_on             date,
  ends_on               date,
  registration_deadline date,
  url                   text check (url is null or url ~* '^https://'),
  team_min              int not null default 1,
  team_max              int not null default 4,
  domains               text[] not null default '{}',
  created_by            uuid references public.app_users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create table public.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 50),
  hackathon_id      text references public.hackathons(id) on delete set null,
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  description       text check (char_length(description) <= 400),
  needed_categories text[] not null default '{}',
  max_size          int not null default 4 check (max_size between 1 and 10),
  is_open           boolean not null default true,
  created_at        timestamptz not null default now()
);
create index teams_hackathon_idx on public.teams (hackathon_id);

create table public.team_members (
  team_id    uuid references public.teams(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  role_title text check (char_length(role_title) <= 40),
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.team_requests (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('invite','request')),
  status     text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  message    text check (char_length(message) <= 300),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index team_requests_one_pending on public.team_requests (team_id, user_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- 5. Community: hubs, posts, kudos, comments, follows
-- ---------------------------------------------------------------------
create table public.hubs (
  slug        text primary key,
  name        text not null,
  description text,
  icon        text not null,
  color       text not null,
  sort_order  int not null default 0
);

create table public.hub_members (
  hub_slug  text references public.hubs(slug) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (hub_slug, user_id)
);

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  hub_slug      text references public.hubs(slug) on delete set null,
  kind          text not null default 'update' check (kind in ('update','showcase','lft','question','win')),
  body          text not null check (char_length(body) between 1 and 2000),
  tags          text[] not null default '{}' check (cardinality(tags) <= 6),
  link_url      text check (link_url is null or link_url ~* '^https://'),
  team_id       uuid references public.teams(id) on delete set null,
  kudos_count   int not null default 0,
  comment_count int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_hub_idx     on public.posts (hub_slug, created_at desc);
create index posts_author_idx  on public.posts (author_id, created_at desc);

create table public.post_kudos (
  post_id    uuid references public.posts(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 800),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

-- ---------------------------------------------------------------------
-- 6. Badges, XP, notifications
-- ---------------------------------------------------------------------
create table public.badges (
  code        text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  tier        text not null check (tier in ('bronze','silver','gold','platinum')),
  category    text not null check (category in ('onboarding','community','teams','skills','events','special')),
  xp          int not null default 0,
  sort_order  int not null default 0
);

create table public.user_badges (
  user_id    uuid references public.profiles(id) on delete cascade,
  badge_code text references public.badges(code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

create table public.xp_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     int  not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);
create index xp_events_time_idx on public.xp_events (created_at desc);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users
                 where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users
                 where id = auth.uid() and role in ('admin','moderator') and status = 'active');
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where id = auth.uid() and status = 'active');
$$;

create or replace function public.is_teammate(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from public.team_members a
    join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;

create or replace function public.level_for_xp(p_xp int) returns int
language sql immutable as $$ select floor(sqrt(greatest(p_xp,0) / 50.0))::int + 1 $$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
$$;

create or replace function public.award_xp(p_user uuid, p_amount int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old int; v_new int; v_xp int;
begin
  if p_user is null or p_amount = 0 then return; end if;
  select level into v_old from public.profiles where id = p_user;
  if not found then return; end if;
  insert into public.xp_events (user_id, amount, reason) values (p_user, p_amount, p_reason);
  update public.profiles set xp = greatest(xp + p_amount, 0)
   where id = p_user returning xp into v_xp;
  v_new := public.level_for_xp(v_xp);
  if v_new <> v_old then
    update public.profiles set level = v_new where id = p_user;
    if v_new > v_old then
      perform public.notify(p_user, 'level', 'Level up! You reached level ' || v_new, null, '/me');
      if v_new >= 5  then perform public.grant_badge(p_user, 'level_5');  end if;
      if v_new >= 10 then perform public.grant_badge(p_user, 'level_10'); end if;
    end if;
  end if;
end $$;

create or replace function public.grant_badge(p_user uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_badge public.badges%rowtype;
begin
  select * into v_badge from public.badges where code = p_code;
  if not found then return false; end if;
  insert into public.user_badges (user_id, badge_code) values (p_user, p_code)
  on conflict do nothing;
  if not found then return false; end if;
  perform public.notify(p_user, 'badge', 'Badge unlocked: ' || v_badge.name, v_badge.description, '/me#badges');
  if v_badge.xp > 0 then perform public.award_xp(p_user, v_badge.xp, 'badge:' || p_code); end if;
  return true;
end $$;

-- internal helpers must not be callable from the browser
revoke execute on function public.award_xp(uuid,int,text)          from public, anon, authenticated;
revoke execute on function public.grant_badge(uuid,text)           from public, anon, authenticated;
revoke execute on function public.notify(uuid,text,text,text,text) from public, anon, authenticated;

-- =====================================================================
-- New user: only Google sign-in creates an account
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_name     text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  v_avatar   text := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
  v_base     text;
  v_handle   text;
  v_i        int := 0;
  v_google_only boolean;
  v_admins   text[];
begin
  select google_only, admin_emails into v_google_only, v_admins from public.app_settings where id = 1;
  if coalesce(v_google_only, true) and v_provider <> 'google' then
    raise exception 'Hakemate accepts Google sign-in only';
  end if;

  insert into public.app_users (id, email, full_name, avatar_url, provider, role)
  values (new.id, new.email, v_name, v_avatar, v_provider,
          case when new.email = any(coalesce(v_admins,'{}')) then 'admin' else 'member' end);

  v_base := lower(regexp_replace(split_part(new.email,'@',1), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(v_base) < 3 then v_base := 'builder'; end if;
  v_base := left(v_base, 18);
  v_handle := v_base;
  while exists (select 1 from public.profiles where handle = v_handle) loop
    v_i := v_i + 1;
    v_handle := v_base || v_i::text;
  end loop;

  insert into public.profiles (id, handle, display_name, avatar_url)
  values (new.id, v_handle, left(coalesce(nullif(trim(v_name),''), 'Builder'), 60), v_avatar);
  insert into public.profile_contacts (profile_id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Onboarding, tour, presence (called from the app)
-- =====================================================================
create or replace function public.complete_onboarding()
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype; v_skills int;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then raise exception 'No profile'; end if;
  select count(*) into v_skills from public.profile_skills where profile_id = p.id;
  if p.college is null or p.year_of_study is null or v_skills < 1 then
    raise exception 'Add your college, year and at least one skill first';
  end if;
  update public.app_users set onboarded = true where id = auth.uid();
  perform public.grant_badge(p.id, 'welcome_aboard');
  if v_skills >= 3 and p.bio is not null and cardinality(p.interests) >= 2
     and cardinality(p.availability) >= 1 then
    perform public.grant_badge(p.id, 'profile_pro');
  end if;
  if p.github_url is not null then perform public.grant_badge(p.id, 'open_source_soul'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.finish_tour()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.app_users set tour_done = true where id = auth.uid();
  perform public.grant_badge(auth.uid(), 'navigator');
end $$;

create or replace function public.touch_seen()
returns void language sql security definer set search_path = public as $$
  update public.app_users set last_seen_at = now() where id = auth.uid();
$$;

create or replace function public.my_account()
returns table (role text, status text, onboarded boolean, tour_done boolean, email text)
language sql stable security definer set search_path = public as $$
  select role, status, onboarded, tour_done, email from public.app_users where id = auth.uid();
$$;

-- re-check "Profile Pro" whenever skills or profile change
create or replace function public.check_profile_badges(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype; v_skills int;
begin
  select * into p from public.profiles where id = p_user;
  if not found then return; end if;
  if not exists (select 1 from public.app_users where id = p_user and onboarded) then return; end if;
  select count(*) into v_skills from public.profile_skills where profile_id = p_user;
  if v_skills >= 3 and p.bio is not null and cardinality(p.interests) >= 2 and cardinality(p.availability) >= 1 then
    perform public.grant_badge(p_user, 'profile_pro');
  end if;
  if v_skills >= 8 then perform public.grant_badge(p_user, 'polymath'); end if;
  if p.github_url is not null then perform public.grant_badge(p_user, 'open_source_soul'); end if;
end $$;
revoke execute on function public.check_profile_badges(uuid) from public, anon, authenticated;

create or replace function public.trg_profile_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.check_profile_badges(new.id); return new; end $$;
create trigger profiles_badges after update of bio, interests, availability, github_url on public.profiles
  for each row execute function public.trg_profile_changed();

create or replace function public.trg_skill_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.check_profile_badges(coalesce(new.profile_id, old.profile_id)); return coalesce(new, old); end $$;
create trigger profile_skills_badges after insert on public.profile_skills
  for each row execute function public.trg_skill_changed();

-- AI meaning similarity between two profiles (0..1). Returns null until
-- migration 002 (pgvector + embeddings) replaces it; the engine then falls
-- back to interests + text similarity.
create or replace function public.meaning_similarity(a uuid, b uuid)
returns double precision language sql stable as $$ select null::double precision $$;

-- =====================================================================
-- THE ENGINE: Team DNA match score (out of 100) with reasons
--   30 fills a missing skill category
--   30 meaning match (AI embeddings when present, else text + interests)
--   15 availability overlap
--   15 event mode & location
--   10 experience balance
-- =====================================================================
create or replace function public.my_categories(p_user uuid, p_team uuid default null)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct s.category), '{}')
  from public.profile_skills ps join public.skills s on s.id = ps.skill_id
  where ps.profile_id in (
    select p_user
    union
    select tm.user_id from public.team_members tm where p_team is not null and tm.team_id = p_team);
$$;

create or replace function public.match_candidates(p_team uuid default null, p_limit int default 30)
returns table (
  user_id uuid, handle text, display_name text, avatar_url text, headline text,
  college text, city text, level int, experience_level text,
  categories text[], score int, s_skill int, s_meaning int, s_avail int,
  s_mode int, s_exp int, reasons text[])
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  me        public.profiles%rowtype;
  have      text[];
  needed    text[];
  all_cats  text[] := array['Frontend','Backend','AI/ML','Design','Mobile','Hardware/IoT',
                            'Cyber Security','Data','Cloud/DevOps','Presentation'];
  v_team    public.teams%rowtype;
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
  ),
  scored as (
    select c.*,
      array(select unnest(c.cats) intersect select unnest(needed)) as fills,
      -- interests overlap (Jaccard)
      case when cardinality(c.interests) + cardinality(me.interests) = 0 then 0
           else (select count(*) from (select unnest(c.interests) intersect select unnest(me.interests)) x)::numeric
              / greatest((select count(*) from (select unnest(c.interests) union select unnest(me.interests)) y), 1)
      end as jac,
      word_similarity(my_text, coalesce(c.headline,'') || ' ' || coalesce(c.bio,'') || ' ' || array_to_string(c.interests,' ')) as txt,
      (select count(*) from (select unnest(c.availability) intersect select unnest(me.availability)) z) as av_common,
      greatest(cardinality(c.availability), cardinality(me.availability), 1) as av_max,
      case c.experience_level when 'first_timer' then 0 when 'some' then 1 else 2 end as c_exp
    from cand c
  ),
  pts as (
    select s.*,
      least(30, cardinality(s.fills) * 15 + case when cardinality(s.fills) = 0 and cardinality(s.cats) > 0 then 5 else 0 end) as p_skill,
      least(30, coalesce(round(30 * public.meaning_similarity(me.id, s.id)), round(s.jac * 18 + s.txt * 12)))::int as p_meaning,
      round(15.0 * s.av_common / s.av_max)::int as p_avail,
      ( case when s.event_mode = me.event_mode or s.event_mode = 'any' or me.event_mode = 'any' then 8 else 0 end
      + case when s.city is not null and lower(s.city) = lower(me.city) then 7
             when s.state is not null and lower(s.state) = lower(me.state) then 4 else 0 end ) as p_mode,
      case when s.c_exp <> exp_rank then 10 else 7 end as p_exp
    from scored s
  )
  select x.id, x.handle, x.display_name, x.avatar_url, x.headline, x.college, x.city, x.level,
         x.experience_level, x.cats,
         (x.p_skill + x.p_meaning + x.p_avail + x.p_mode + x.p_exp)::int,
         x.p_skill::int, x.p_meaning::int, x.p_avail::int, x.p_mode::int, x.p_exp::int,
         array_remove(array[
           case when cardinality(x.fills) > 0 then 'Covers ' || array_to_string(x.fills, ', ') || ', which you still need' end,
           case when x.jac >= 0.3 then 'Shares your interests' end,
           case when x.av_common > 0 then 'Free at the same times as you' end,
           case when x.city is not null and lower(x.city) = lower(me.city) then 'Same city: ' || x.city end,
           case when x.c_exp > exp_rank then 'More hackathon experience to guide the team'
                when x.c_exp < exp_rank then 'Fresh energy, you bring the experience' end,
           case when x.looking_for_team then 'Looking for a team right now' end
         ], null)
  from pts x
  order by 11 desc, x.level desc
  limit greatest(1, least(p_limit, 100));
end $$;

-- skill category coverage for a team ("Team Gap Radar")
create or replace function public.team_gap(p_team uuid)
returns table (category text, members int, needed boolean)
language sql stable security definer set search_path = public as $$
  with cats(category) as (values ('Frontend'),('Backend'),('AI/ML'),('Design'),('Mobile'),
        ('Hardware/IoT'),('Cyber Security'),('Data'),('Cloud/DevOps'),('Presentation')),
  cov as (
    select s.category, count(distinct ps.profile_id)::int as members
    from public.team_members tm
    join public.profile_skills ps on ps.profile_id = tm.user_id
    join public.skills s on s.id = ps.skill_id
    where tm.team_id = p_team group by s.category)
  select c.category, coalesce(cov.members, 0),
         c.category = any(coalesce((select t.needed_categories from public.teams t where t.id = p_team), '{}'))
  from cats c left join cov using (category);
$$;

-- =====================================================================
-- Teams workflow
-- =====================================================================
create or replace function public.create_team(p_name text, p_hackathon text, p_description text,
                                              p_needed text[], p_max int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_active_user() then raise exception 'Not allowed'; end if;
  insert into public.teams (name, hackathon_id, owner_id, description, needed_categories, max_size)
  values (p_name, nullif(p_hackathon,''), auth.uid(), p_description, coalesce(p_needed,'{}'), coalesce(p_max,4))
  returning id into v_id;
  insert into public.team_members (team_id, user_id, role_title) values (v_id, auth.uid(), 'Captain');
  perform public.grant_badge(auth.uid(), 'captain');
  perform public.award_xp(auth.uid(), 15, 'created a team');
  return v_id;
end $$;

create or replace function public.send_team_request(p_team uuid, p_user uuid, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team public.teams%rowtype; v_kind text; v_id uuid; v_size int;
begin
  if not public.is_active_user() then raise exception 'Not allowed'; end if;
  select * into v_team from public.teams where id = p_team;
  if not found then raise exception 'Team not found'; end if;
  select count(*) into v_size from public.team_members where team_id = p_team;
  if v_size >= v_team.max_size then raise exception 'Team is full'; end if;

  if p_user = auth.uid() then
    if not v_team.is_open then raise exception 'This team is not taking requests'; end if;
    v_kind := 'request';
  else
    if not exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid()) then
      raise exception 'Only team members can invite';
    end if;
    v_kind := 'invite';
  end if;
  if exists (select 1 from public.team_members where team_id = p_team and user_id = p_user) then
    raise exception 'Already in this team';
  end if;

  insert into public.team_requests (team_id, user_id, kind, message, created_by)
  values (p_team, p_user, v_kind, p_message, auth.uid()) returning id into v_id;

  if v_kind = 'invite' then
    perform public.notify(p_user, 'invite', 'You are invited to join ' || v_team.name, p_message, '/teams/' || p_team);
  else
    perform public.notify(v_team.owner_id, 'request', 'New join request for ' || v_team.name, p_message, '/teams/' || p_team);
  end if;
  return v_id;
end $$;

create or replace function public.respond_team_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.team_requests%rowtype; v_team public.teams%rowtype; v_size int; v_allowed boolean;
begin
  select * into r from public.team_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'Request not found'; end if;
  select * into v_team from public.teams where id = r.team_id;

  v_allowed := case when r.kind = 'invite' then r.user_id = auth.uid()
                    else exists (select 1 from public.team_members where team_id = r.team_id and user_id = auth.uid()) end;
  if r.created_by = auth.uid() and not p_accept then v_allowed := true; end if; -- cancel own
  if not v_allowed then raise exception 'Not allowed'; end if;

  if not p_accept then
    update public.team_requests set status = case when r.created_by = auth.uid() then 'cancelled' else 'declined' end,
           decided_at = now() where id = p_request;
    return;
  end if;

  select count(*) into v_size from public.team_members where team_id = r.team_id;
  if v_size >= v_team.max_size then raise exception 'Team is full'; end if;

  update public.team_requests set status = 'accepted', decided_at = now() where id = p_request;
  insert into public.team_members (team_id, user_id) values (r.team_id, r.user_id) on conflict do nothing;
  perform public.notify(r.created_by, 'team', 'Welcome to ' || v_team.name || '! Contacts are now unlocked.', null, '/teams/' || r.team_id);
end $$;

create or replace function public.leave_team(p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_next uuid;
begin
  delete from public.team_members where team_id = p_team and user_id = auth.uid();
  if exists (select 1 from public.teams where id = p_team and owner_id = auth.uid()) then
    select user_id into v_next from public.team_members where team_id = p_team order by joined_at limit 1;
    if v_next is null then delete from public.teams where id = p_team;
    else update public.teams set owner_id = v_next where id = p_team; end if;
  end if;
end $$;

-- XP + badges when someone joins a team
create or replace function public.trg_team_member_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_size int; v_max int;
begin
  perform public.award_xp(new.user_id, 20, 'joined a team');
  perform public.grant_badge(new.user_id, 'squad_up');
  select count(*), max(t.max_size) into v_size, v_max
    from public.team_members tm join public.teams t on t.id = tm.team_id where tm.team_id = new.team_id;
  if v_size >= v_max then
    perform public.grant_badge(tm.user_id, 'full_house') from public.team_members tm where tm.team_id = new.team_id;
  end if;
  if (select count(*) from public.team_members where user_id = new.user_id) >= 3 then
    perform public.grant_badge(new.user_id, 'team_hopper');
  end if;
  return new;
end $$;
create trigger team_members_added after insert on public.team_members
  for each row execute function public.trg_team_member_added();

-- =====================================================================
-- Community triggers: counters, XP, badges, notifications
-- =====================================================================
create or replace function public.trg_post_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  perform public.award_xp(new.author_id, 10, 'posted');
  perform public.grant_badge(new.author_id, 'first_post');
  select count(*) into v_count from public.posts where author_id = new.author_id;
  if v_count >= 10 then perform public.grant_badge(new.author_id, 'storyteller'); end if;
  if new.kind = 'showcase' then perform public.grant_badge(new.author_id, 'show_and_tell'); end if;
  if new.kind = 'win'      then perform public.grant_badge(new.author_id, 'champion'); end if;
  return new;
end $$;
create trigger posts_created after insert on public.posts
  for each row execute function public.trg_post_created();

create or replace function public.trg_kudos() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_total int;
begin
  if tg_op = 'INSERT' then
    update public.posts set kudos_count = kudos_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author <> new.user_id then
      perform public.award_xp(v_author, 2, 'received kudos');
      perform public.award_xp(new.user_id, 1, 'gave kudos');
      perform public.notify(v_author, 'kudos', 'Someone gave your post kudos', null, '/community#' || new.post_id);
      select coalesce(sum(kudos_count),0) into v_total from public.posts where author_id = v_author;
      if v_total >= 25 then perform public.grant_badge(v_author, 'crowd_favourite'); end if;
      if (select count(*) from public.post_kudos where user_id = new.user_id) >= 20 then
        perform public.grant_badge(new.user_id, 'cheerleader');
      end if;
    end if;
    return new;
  else
    update public.posts set kudos_count = greatest(kudos_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger post_kudos_changed after insert or delete on public.post_kudos
  for each row execute function public.trg_kudos();

create or replace function public.trg_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning author_id into v_author;
    perform public.award_xp(new.author_id, 3, 'commented');
    if v_author <> new.author_id then
      perform public.notify(v_author, 'comment', 'New reply on your post', left(new.body, 120), '/community#' || new.post_id);
    end if;
    if (select count(*) from public.post_comments where author_id = new.author_id) >= 15 then
      perform public.grant_badge(new.author_id, 'helping_hand');
    end if;
    return new;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger post_comments_changed after insert or delete on public.post_comments
  for each row execute function public.trg_comment();

create or replace function public.trg_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select display_name into v_name from public.profiles where id = new.follower_id;
  perform public.notify(new.followee_id, 'follow', v_name || ' started following you', null, '/u/' ||
          (select handle from public.profiles where id = new.follower_id));
  if (select count(*) from public.follows where followee_id = new.followee_id) >= 10 then
    perform public.grant_badge(new.followee_id, 'rising_star');
  end if;
  return new;
end $$;
create trigger follows_added after insert on public.follows
  for each row execute function public.trg_follow();

create or replace function public.trg_endorse() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_skill text;
begin
  select name into v_skill from public.skills where id = new.skill_id;
  perform public.award_xp(new.profile_id, 5, 'endorsed for ' || v_skill);
  perform public.notify(new.profile_id, 'endorse', 'You were endorsed for ' || v_skill, null, '/me');
  if (select count(*) from public.endorsements where profile_id = new.profile_id) >= 5 then
    perform public.grant_badge(new.profile_id, 'endorsed');
  end if;
  if (select count(*) from public.endorsements where endorser_id = new.endorser_id) >= 5 then
    perform public.grant_badge(new.endorser_id, 'talent_scout');
  end if;
  return new;
end $$;
create trigger endorsements_added after insert on public.endorsements
  for each row execute function public.trg_endorse();

create or replace function public.trg_hub_join() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_xp(new.user_id, 5, 'joined hub ' || new.hub_slug);
  if (select count(*) from public.hub_members where user_id = new.user_id) >= 3 then
    perform public.grant_badge(new.user_id, 'explorer');
  end if;
  return new;
end $$;
create trigger hub_members_added after insert on public.hub_members
  for each row execute function public.trg_hub_join();

create or replace function public.trg_project_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_xp(new.profile_id, 10, 'added project ' || new.name);
  perform public.grant_badge(new.profile_id, 'builder');
  return new;
end $$;
create trigger projects_added after insert on public.projects
  for each row execute function public.trg_project_added();

-- =====================================================================
-- Leaderboard + activity (read-only views)
-- =====================================================================
create or replace function public.leaderboard(p_days int default 7, p_limit int default 20)
returns table (user_id uuid, handle text, display_name text, avatar_url text, level int, college text, xp_gained bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle, p.display_name, p.avatar_url, p.level, p.college, sum(e.amount)
  from public.xp_events e join public.profiles p on p.id = e.user_id
  where e.created_at >= now() - make_interval(days => greatest(1, least(p_days, 365))) and p.visible
  group by p.id order by 7 desc limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.activity_heatmap(p_user uuid)
returns table (day date, points bigint)
language sql stable security definer set search_path = public as $$
  select (e.created_at at time zone 'Asia/Kolkata')::date, sum(e.amount)
  from public.xp_events e join public.profiles p on p.id = e.user_id
  where e.user_id = p_user and (p.visible or p.id = auth.uid())
    and e.created_at >= now() - interval '365 days'
  group by 1 order by 1;
$$;

-- =====================================================================
-- Admin: user management
-- =====================================================================
create or replace function public.admin_list_users(p_search text default null)
returns table (id uuid, email text, full_name text, avatar_url text, role text, status text,
               onboarded boolean, last_seen_at timestamptz, created_at timestamptz,
               handle text, xp int, level int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select u.id, u.email, u.full_name, u.avatar_url, u.role, u.status, u.onboarded, u.last_seen_at, u.created_at,
         p.handle, p.xp, p.level
  from public.app_users u left join public.profiles p on p.id = u.id
  where p_search is null or u.email ilike '%' || p_search || '%' or u.full_name ilike '%' || p_search || '%'
  order by u.created_at desc limit 500;
end $$;

create or replace function public.admin_update_user(p_user uuid, p_role text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'You cannot demote or suspend yourself';
  end if;
  update public.app_users set role = p_role, status = p_status where id = p_user;
end $$;

create or replace function public.admin_grant_badge(p_user uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only'; end if;
  return public.grant_badge(p_user, p_code);
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'users',     (select count(*) from public.app_users),
    'onboarded', (select count(*) from public.app_users where onboarded),
    'active_7d', (select count(*) from public.app_users where last_seen_at > now() - interval '7 days'),
    'teams',     (select count(*) from public.teams),
    'posts',     (select count(*) from public.posts),
    'suspended', (select count(*) from public.app_users where status = 'suspended'));
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.app_settings     enable row level security;
alter table public.app_users        enable row level security;
alter table public.profiles         enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.skills           enable row level security;
alter table public.profile_skills   enable row level security;
alter table public.endorsements     enable row level security;
alter table public.projects         enable row level security;
alter table public.hackathons       enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.team_requests    enable row level security;
alter table public.hubs             enable row level security;
alter table public.hub_members      enable row level security;
alter table public.posts            enable row level security;
alter table public.post_kudos       enable row level security;
alter table public.post_comments    enable row level security;
alter table public.follows          enable row level security;
alter table public.badges           enable row level security;
alter table public.user_badges      enable row level security;
alter table public.xp_events        enable row level security;
alter table public.notifications    enable row level security;

-- app_settings: admins only (no policy for others)
create policy settings_admin on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- app_users: own row or admin; writes only through functions
create policy app_users_read on public.app_users for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- profiles
create policy profiles_read on public.profiles for select to authenticated
  using (visible or id = auth.uid() or public.is_moderator());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_user()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (handle, display_name, avatar_url, headline, bio, college, department, year_of_study, city, state,
              event_mode, hours_per_week, experience_level, hackathons_count, availability, interests,
              github_url, linkedin_url, portfolio_url, looking_for_team, visible, showcase_badges)
  on public.profiles to authenticated;

-- contacts: owner or teammates
create policy contacts_read on public.profile_contacts for select to authenticated
  using (public.is_teammate(profile_id));
create policy contacts_write on public.profile_contacts for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy contacts_insert on public.profile_contacts for insert to authenticated
  with check (profile_id = auth.uid());

-- catalog tables
create policy skills_read on public.skills for select to authenticated using (true);
create policy skills_admin on public.skills for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy badges_read on public.badges for select to authenticated using (true);
create policy hubs_read on public.hubs for select to authenticated using (true);
create policy hubs_admin on public.hubs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy hackathons_read on public.hackathons for select to authenticated using (true);
create policy hackathons_mod on public.hackathons for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- profile skills / projects: public read, owner write
create policy pskills_read on public.profile_skills for select to authenticated using (true);
create policy pskills_write on public.profile_skills for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_active_user());
create policy projects_read on public.projects for select to authenticated using (true);
create policy projects_write on public.projects for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_active_user());

-- endorsements: endorse others for skills they listed
create policy endorse_read on public.endorsements for select to authenticated using (true);
create policy endorse_insert on public.endorsements for insert to authenticated
  with check (endorser_id = auth.uid() and public.is_active_user()
              and exists (select 1 from public.profile_skills ps where ps.profile_id = endorsements.profile_id and ps.skill_id = endorsements.skill_id));
create policy endorse_delete on public.endorsements for delete to authenticated using (endorser_id = auth.uid());

-- teams: readable by all signed-in users; changes by owner; creation through create_team()
create policy teams_read on public.teams for select to authenticated using (true);
create policy teams_update on public.teams for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy teams_delete on public.teams for delete to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy members_read on public.team_members for select to authenticated using (true);
create policy members_owner_remove on public.team_members for delete to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));
create policy requests_read on public.team_requests for select to authenticated
  using (user_id = auth.uid() or created_by = auth.uid()
         or exists (select 1 from public.team_members tm where tm.team_id = team_requests.team_id and tm.user_id = auth.uid()));

-- hubs membership
create policy hubm_read on public.hub_members for select to authenticated using (true);
create policy hubm_join on public.hub_members for insert to authenticated with check (user_id = auth.uid() and public.is_active_user());
create policy hubm_leave on public.hub_members for delete to authenticated using (user_id = auth.uid());

-- posts
create policy posts_read on public.posts for select to authenticated using (not hidden or author_id = auth.uid() or public.is_moderator());
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user() and kudos_count = 0 and comment_count = 0 and not hidden);
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_moderator());
create policy posts_moderate on public.posts for update to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy kudos_read on public.post_kudos for select to authenticated using (true);
create policy kudos_give on public.post_kudos for insert to authenticated with check (user_id = auth.uid() and public.is_active_user());
create policy kudos_take on public.post_kudos for delete to authenticated using (user_id = auth.uid());
create policy comments_read on public.post_comments for select to authenticated using (true);
create policy comments_insert on public.post_comments for insert to authenticated with check (author_id = auth.uid() and public.is_active_user());
create policy comments_delete on public.post_comments for delete to authenticated using (author_id = auth.uid() or public.is_moderator());

-- follows
create policy follows_read on public.follows for select to authenticated using (true);
create policy follows_add on public.follows for insert to authenticated with check (follower_id = auth.uid() and public.is_active_user());
create policy follows_remove on public.follows for delete to authenticated using (follower_id = auth.uid());

-- badges earned, xp: public read
create policy ubadges_read on public.user_badges for select to authenticated using (true);
create policy xp_read on public.xp_events for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- notifications: own only
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- nothing for anonymous visitors
revoke all on all tables in schema public from anon;

-- =====================================================================
-- Seed data
-- =====================================================================
insert into public.skills (name, category) values
 ('HTML/CSS','Frontend'),('JavaScript','Frontend'),('TypeScript','Frontend'),('React','Frontend'),('Next.js','Frontend'),('Tailwind CSS','Frontend'),
 ('Node.js','Backend'),('Express','Backend'),('Python','Backend'),('Django','Backend'),('Flask/FastAPI','Backend'),('Java/Spring','Backend'),('Supabase','Backend'),('Firebase','Backend'),('SQL/PostgreSQL','Backend'),('MongoDB','Backend'),
 ('Machine Learning','AI/ML'),('Deep Learning','AI/ML'),('Computer Vision','AI/ML'),('NLP/LLMs','AI/ML'),('Prompt Engineering','AI/ML'),('TensorFlow/PyTorch','AI/ML'),
 ('UI/UX Design','Design'),('Figma','Design'),('Graphic Design','Design'),('Video Editing','Design'),('3D/Blender','Design'),
 ('Flutter','Mobile'),('React Native','Mobile'),('Android (Kotlin)','Mobile'),
 ('Arduino','Hardware/IoT'),('Raspberry Pi','Hardware/IoT'),('ESP32','Hardware/IoT'),('Embedded C','Hardware/IoT'),('PCB/Circuit Design','Hardware/IoT'),
 ('Ethical Hacking','Cyber Security'),('Network Security','Cyber Security'),('Web Security','Cyber Security'),('CTF','Cyber Security'),
 ('Data Analysis','Data'),('Power BI/Tableau','Data'),('Excel','Data'),
 ('Git/GitHub','Cloud/DevOps'),('Docker','Cloud/DevOps'),('AWS/GCP/Azure','Cloud/DevOps'),('Vercel/Netlify','Cloud/DevOps'),
 ('Pitching','Presentation'),('PPT Design','Presentation'),('Documentation','Presentation'),('Research','Presentation')
on conflict (name) do nothing;

insert into public.hubs (slug, name, description, icon, color, sort_order) values
 ('ai-ml',    'AI & ML Hub',          'Models, datasets, LLM hacks and AI project teams.',         'brain',    '#7C5CFF', 1),
 ('web-dev',  'Web Builders',          'Frontend, backend and full-stack builders.',               'code',     '#2F6FED', 2),
 ('cyber',    'Cyber Security Guild',  'CTFs, security tools and safe-by-design projects.',        'shield',   '#0F9D7A', 3),
 ('iot',      'Hardware & IoT Lab',    'Arduino, ESP32, sensors and smart devices.',               'cpu',      '#F6681F', 4),
 ('design',   'Design Studio',         'UI/UX, Figma, branding and pitch decks.',                  'palette',  '#E0457B', 5),
 ('first-hack','First Hackathon Club', 'New to hackathons? Ask anything and find a friendly team.','sprout',   '#81BA43', 6)
on conflict (slug) do nothing;

insert into public.badges (code, name, description, icon, tier, category, xp, sort_order) values
 ('welcome_aboard',  'Welcome Aboard',     'Completed your Hakemate profile.',                       'rocket',   'bronze',  'onboarding', 50, 1),
 ('navigator',       'Navigator',          'Finished the community tour.',                           'compass',  'bronze',  'onboarding', 20, 2),
 ('profile_pro',     'Profile Pro',        '3+ skills, a bio, 2+ interests and your free times.',    'id-card',  'silver',  'onboarding', 40, 3),
 ('open_source_soul','Open Source Soul',   'Linked your GitHub.',                                    'github',   'bronze',  'skills',     15, 4),
 ('polymath',        'Polymath',           'Listed 8 or more skills.',                               'layers',   'silver',  'skills',     40, 5),
 ('builder',         'Builder',            'Added a project to your showcase.',                      'hammer',   'bronze',  'skills',     20, 6),
 ('endorsed',        'Endorsed',           'Received 5 skill endorsements.',                         'thumbs-up','silver',  'skills',     50, 7),
 ('talent_scout',    'Talent Scout',       'Endorsed 5 other builders.',                             'search',   'bronze',  'community',  25, 8),
 ('first_post',      'Hello World',        'Wrote your first community post.',                       'message',  'bronze',  'community',  10, 9),
 ('storyteller',     'Storyteller',        'Wrote 10 community posts.',                              'book',     'silver',  'community',  50, 10),
 ('show_and_tell',   'Show & Tell',        'Shared a project showcase.',                             'sparkles', 'bronze',  'community',  20, 11),
 ('crowd_favourite', 'Crowd Favourite',    'Your posts earned 25 kudos.',                            'heart',    'gold',    'community', 100, 12),
 ('cheerleader',     'Cheerleader',        'Gave 20 kudos to others.',                               'party',    'bronze',  'community',  20, 13),
 ('helping_hand',    'Helping Hand',       'Wrote 15 helpful replies.',                              'hand',     'silver',  'community',  50, 14),
 ('rising_star',     'Rising Star',        '10 builders follow you.',                                'star',     'gold',    'community', 100, 15),
 ('explorer',        'Explorer',           'Joined 3 community hubs.',                               'map',      'bronze',  'community',  20, 16),
 ('captain',         'Captain',            'Created your first team.',                               'flag',     'bronze',  'teams',      25, 17),
 ('squad_up',        'Squad Up',           'Joined a team.',                                         'users',    'bronze',  'teams',      25, 18),
 ('full_house',      'Full House',         'Your team reached full size.',                           'trophy',   'silver',  'teams',      60, 19),
 ('team_hopper',     'Team Player',        'Been part of 3 teams.',                                  'repeat',   'gold',    'teams',     100, 20),
 ('champion',        'Champion',           'Shared a hackathon win.',                                'medal',    'gold',    'events',    150, 21),
 ('level_5',         'Level 5',            'Reached level 5.',                                       'zap',      'silver',  'special',     0, 22),
 ('level_10',        'Level 10',           'Reached level 10.',                                      'crown',    'platinum','special',     0, 23),
 ('founding_member', 'Founding Member',    'Joined Hakemate in its first season.',                   'gem',      'platinum','special',     0, 24)
on conflict (code) do nothing;

insert into public.hackathons (id, name, organizer, mode, registration_deadline, url, team_min, team_max, domains) values
 ('international-hackathon-5', 'International Hackathon 5.0', 'AllCollegeEvent x ECLearnix', 'online', '2026-11-12',
  null, 2, 4, array['AI & Student Collaboration'])
on conflict (id) do nothing;

-- Founding Member for everyone who joins before 2027
create or replace function public.trg_founding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if now() < '2027-01-01' then perform public.grant_badge(new.id, 'founding_member'); end if;
  return new;
end $$;
create trigger profiles_founding after insert on public.profiles
  for each row execute function public.trg_founding();

-- realtime for notifications and the feed
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.posts;
  end if;
end $$;
