// Hakemate 3.0 — embed-profile Edge Function
// Builds a text summary of the signed-in user's profile, turns it into a
// 384-number "meaning" vector with the free built-in gte-small model, and
// stores it so the Team DNA engine can compare builders by meaning.
//
// Deploy:  supabase functions deploy embed-profile
// Call from the app after the profile is saved (the app does this for you).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const model = new Supabase.ai.Session("gte-small");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Sign in first" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: p, error } = await admin
    .from("profiles")
    .select("headline, bio, interests, department, profile_skills(skills(name, category))")
    .eq("id", user.id)
    .single();
  if (error || !p) return json({ error: "Profile not found" }, 404);

  const skills = (p.profile_skills ?? []).map((s: any) => s.skills?.name).filter(Boolean);
  const text = [p.headline, p.bio, p.department, "Interests: " + (p.interests ?? []).join(", "),
                "Skills: " + skills.join(", ")].filter(Boolean).join(". ").slice(0, 2000);

  const embedding = await model.run(text, { mean_pool: true, normalize: true });
  const { error: upErr } = await admin
    .from("profiles")
    .update({ embedding: JSON.stringify(embedding), embedded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (upErr) return json({ error: upErr.message }, 500);
  return json({ ok: true, dims: (embedding as number[]).length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
