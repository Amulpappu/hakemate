# Hakemate 3.0

AI teammate finder for hackathons, built for International Hackathon 5.0, Domain 4 (ACE TeamUp Challenge).
Team Hakemate, Rathinam Technical Campus: Lohith K, Nigun S, John Christ S, Kumar C.

Students sign in with Google, build a profile in a guided setup, take a short tour, then get teammates
ranked by a **Team DNA score out of 100** with plain reasons. Around the matching sits a community
(feed, hubs, kudos, follows, skill endorsements) with **XP, levels, badges and a leaderboard**.

```
hakemate/
  web/        React app (Vite): every page the user sees
  server/     Node + Express: plain-word AI search, serves the built app
  supabase/
    migrations/001_hakemate_core.sql   tables, security rules, engine, badges, seed data
    migrations/002_ai_embeddings.sql   optional: real AI meaning match (pgvector)
    migrations/003_lock_down_functions.sql  security: who may call database functions
    migrations/004_collaboration_feedback_events.sql  team chat, tasks, feedback, event-aware matching
    sample/                            18 sample student profiles for the demo (+ a script to remove them)
    functions/embed-profile/           optional Edge Function that makes the embeddings
    test/                              local test scripts (not needed in production)
```

---

## 1. Database (Supabase)

Project: **HACKMATE 3.0** (`vgotoybpbxpimmhbibit`, Mumbai region).

1. Supabase dashboard → SQL Editor → New query.
2. Paste and run, in order: `001_hakemate_core.sql`, `003_lock_down_functions.sql`, `004_collaboration_feedback_events.sql`.
   For the demo, also run `supabase/sample/seed_sample_profiles.sql` (remove later with `remove_sample_profiles.sql`).
   (If the project already has old Hakemate tables with the same names, back them up and drop them first.)
3. Optional, for real AI meaning match: run `002_ai_embeddings.sql`, then deploy the Edge Function:
   ```
   supabase functions deploy embed-profile --project-ref vgotoybpbxpimmhbibit
   ```
   The app calls it automatically after a profile is saved. Without it, the engine uses
   interest overlap + text similarity for the 30 meaning points, so everything still works.

`lohithgamer12@gmail.com` becomes **admin** automatically on first sign-in (change the list in the
`app_settings` table).

## 2. Google sign-in (the only way to log in)

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized JavaScript origins: `http://localhost:5173` and your live URL.
   - Authorized redirect URI: `https://vgotoybpbxpimmhbibit.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Sign In / Providers → **Google** → enable, paste the Client ID and Client Secret.
3. In the same page, **turn off Email** (and any other provider). The database also refuses non-Google sign-ups.
4. Supabase → Authentication → URL Configuration:
   - Site URL: your live URL
   - Redirect URLs: `http://localhost:5173/**` and `https://your-live-url/**`

## 3. Run it locally

```
cd web
cp .env.example .env        # paste the anon / publishable key from Supabase → Settings → API
npm install
npm run dev                 # http://localhost:5173

cd ../server
npm install
GEMINI_API_KEY=your-key npm run dev   # optional; search falls back to keywords without it
```

## 4. Deploy (Antigravity)

Paste this to Antigravity:

> Deploy the Hakemate project in this folder. Build the React app in `web/` with `npm install && npm run build`,
> using env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Run the Node server in `server/` with
> `npm install && npm start`; it serves `web/dist` and `/api/search`. Set env `PORT` (host default) and
> `GEMINI_API_KEY` (secret, server only, never in the web build). Single Node service on Render or Railway is fine.
> If deploying to Vercel instead, deploy `web/` as a static Vite site with a rewrite of all routes to `/index.html`;
> `/api/search` then needs a Vercel function wrapping `server/search.js`.
> After deploy, add the live URL to Supabase Auth redirect URLs and to the Google OAuth origins.

Never put the Supabase **service_role** key or the Gemini key in the web app.

---

## How the Team DNA engine scores a match

`match_candidates()` in the database, run for you or for one of your teams:

| Part | Points | How |
|---|---|---|
| Fills a missing skill | 30 | 15 per skill area the person covers that you or your team still need |
| Meaning match | 30 | AI embeddings (gte-small) when available, else interest overlap + bio text similarity |
| Free at the same times | 15 | overlap of free times |
| Event mode and location | 15 | 8 if online/offline preference fits, +7 same city or +4 same state |
| Experience balance | 10 | 10 when experience levels complement, 7 when equal |

Every match returns these five parts plus plain reasons, shown as the coloured Team DNA strand.

## Final Round features (from the problem statement)

| Problem statement asks | Where in the app |
|---|---|
| Student profiles: skills, interests, roles | Profile setup (`/welcome`) and profile page |
| Smart matching on compatibility + hackathon requirements | Team DNA score; on a hackathon page it also uses the event's online/offline mode, venue, team size, and skips people already in a team for that event |
| Send or accept invitations, create teams | Teams, team page, invite dialog |
| Collaboration: team chat, task sharing, event-based | Team page: live **Team chat** and **Team tasks** (To do / Doing / Done, owner, due date). **Hackathons** pages group teams by event |
| Test with sample profiles, improve with feedback | 18 sample students (tagged "Sample profile"), 👍/👎 on every match, **Give feedback** page, results in Admin |
| Privacy and consent | Contacts unlock only after both accept; chat and tasks visible to team members only |
| Future integration with ACE | Each hackathon has a link `https://<site>/join?event=<id>` for a "Find teammates" button on the ACE event page. Students sign in and land on that hackathon |

## Community and gamification

- **Hubs**: AI & ML, Web Builders, Cyber Security Guild, Hardware & IoT Lab, Design Studio, First Hackathon Club
- **Posts**: update, looking for team, showcase, question, win. Kudos and replies, live new-post banner
- **Follow** builders, **endorse** their skills, add **projects** to your profile
- **XP** for posting (10), replies (3), kudos received (2), endorsements (5), joining a team (20), creating one (15), hubs (5), projects (10)
- **Levels**: level = floor(sqrt(XP / 50)) + 1, shown as a ring around the avatar
- **24 badges** in bronze, silver, gold and platinum, awarded automatically by database triggers; pin 3 to your profile
- **Leaderboard** for the week, month or year, and a contribution heatmap on every profile

## Security

- Row Level Security on every table; nothing is readable without signing in.
- Users can edit only their own profile fields; XP, levels and badges can only be changed by database triggers.
- Phone, WhatsApp and email are visible only to the owner and their teammates.
- Suspended users cannot post, join or invite. Admin tools check the role inside the database.

## Tests

`supabase/test/behaviour_test.sql` runs sign-ups, onboarding, matching, team invites, contact unlocking,
kudos, comments, follows, endorsements, badges, leaderboard and permission checks against a local Postgres.

## Data sources

- **Colleges, states and districts:** the Government of India AISHE (All India Survey on Higher Education) institution list,
  taken from the MIT-licensed `aishe-institutions-list` dataset (names, state and district only). About 70,000 colleges are in
  `web/api/_data/colleges.json` and are searched on the server by `/api/colleges`, so phones never download the full list.
- **GitHub skills:** read in the student's own browser from GitHub's public API (repo list + each repo's language breakdown).
  Without sign-in GitHub allows about 60 requests an hour per network; "Sign in with GitHub" will raise that.
