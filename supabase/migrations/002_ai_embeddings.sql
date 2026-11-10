-- =====================================================================
-- Hakemate 3.0 — AI "meaning match" with embeddings (Supabase only)
-- Adds a 384-dim embedding per profile (gte-small, computed for free in
-- the `embed-profile` Edge Function) and switches the engine's 30-point
-- meaning score to cosine similarity whenever both profiles have one.
-- =====================================================================
create extension if not exists vector with schema extensions;

alter table public.profiles add column if not exists embedding extensions.vector(384);
alter table public.profiles add column if not exists embedded_at timestamptz;

-- the browser must never write embeddings directly
revoke update (embedding, embedded_at) on public.profiles from authenticated, anon;

create or replace function public.meaning_similarity(a uuid, b uuid)
returns double precision language sql stable security definer
set search_path = public, extensions as $$
  select greatest(0, 1 - (pa.embedding <=> pb.embedding))
  from public.profiles pa, public.profiles pb
  where pa.id = a and pb.id = b
    and pa.embedding is not null and pb.embedding is not null;
$$;
