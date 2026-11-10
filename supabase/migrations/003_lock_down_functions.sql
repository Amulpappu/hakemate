-- Hakemate 3.0: tighten who can call database functions (from the Supabase security check)

-- 1. Visitors who are not signed in can call nothing
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke execute on functions from anon, public;

-- 2. Trigger functions run by the database only, never from the browser
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'trg\_%' or p.proname = 'handle_new_user')
  loop
    execute format('revoke execute on function %s from authenticated', r.sig);
  end loop;
end $$;

-- 3. Fixed search_path on the small helpers
alter function public.level_for_xp(int)            set search_path = public;
alter function public.touch_updated_at()           set search_path = public;
alter function public.meaning_similarity(uuid, uuid) set search_path = public;
