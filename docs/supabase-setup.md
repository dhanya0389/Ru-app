# Supabase setup (one-time, ~10 min)

This doc walks you through creating the Supabase project that backs Ruhi's
cross-device sync. Supabase replaces both the existing Auth.js sign-in
(unifies identity + database on one platform) AND localStorage as the
canonical store for signed-in users. Anonymous users continue to use
localStorage — see PR #27 plan for the hybrid model.

---

## 1. Create the project

1. Go to <https://supabase.com> → **Sign up** (use the same Google account
   that owns the GCP project for PR #25 — keeps things tidy).
2. **New project**:
   - Organization: pick or create one (free)
   - Name: **ruhi-prod**
   - Database password: generate a strong one and **save it in 1Password**
     (you'll need this for direct DB access; not exposed to the app)
   - Region: pick the closest to your users (`us-east-1` if Vercel is
     deploying east-coast, otherwise match the Vercel region)
   - Pricing plan: **Free** — gives 500 MB database + 2 GB bandwidth + 50 K
     monthly active users. More than enough for the cohort + early users.
3. Click **Create new project** and wait ~2 min for provisioning.

---

## 2. Get your API keys

Once provisioned:

1. Left sidebar → **Project Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`
   - **anon (public) key** — long JWT-looking string starting `eyJh...`
3. (Optional, advanced) The **service_role** key on the same page is the
   admin key — never expose this client-side. We won't use it for now.

---

## 3. Configure Google as the auth provider

This is where the GCP OAuth client from `docs/auth-setup.md` (PR #25) plugs in.

1. Supabase dashboard → **Authentication** → **Providers**
2. Find **Google** in the list → toggle it on
3. Paste:
   - **Client ID**: same `AUTH_GOOGLE_ID` from your `.env.local`
   - **Client Secret**: same `AUTH_GOOGLE_SECRET`
4. Note the **Callback URL** Supabase shows you — it'll be:
   `https://<your-project>.supabase.co/auth/v1/callback`

5. **Update your GCP OAuth client** to add this new callback URL:
   - Go back to <https://console.cloud.google.com/apis/credentials>
   - Edit the **Ruhi web** OAuth client
   - In **Authorized redirect URIs**, ADD (don't remove the existing ones):
     `https://<your-project>.supabase.co/auth/v1/callback`
   - Save.

   You can leave the old `localhost:3000/api/auth/callback/google` URI in
   the list — it's harmless even after we swap to Supabase Auth, and we
   may still want it during transition.

6. Back in Supabase → Save Google provider config.

---

## 4. Set Site URL and redirect allow-list

Supabase needs to know which URLs to redirect users back to after sign-in.

1. Supabase dashboard → **Authentication** → **URL Configuration**
2. **Site URL**: `https://tryruhi.ai` (production)
3. **Redirect URLs** (allowlist — paste these one per line):
   ```
   http://localhost:3000
   http://localhost:3000/**
   https://tryruhi.ai
   https://tryruhi.ai/**
   ```
4. Save.

---

## 5. Add env vars

### Local dev (`.env.local`)

Add these two lines:
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL from step 2>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from step 2>
```

(The `NEXT_PUBLIC_` prefix makes them readable client-side, which is fine
for these — the anon key is designed to be public; row-level security
gates actual data access.)

### Vercel (production)

Vercel project → Settings → Environment Variables. Add the same two keys.
Apply to all three environments (Production, Preview, Development).

---

## 6. Once you're done

Send me:
- Confirmation that steps 1–5 are done
- (You don't need to send the URL or keys — they're in your env vars)

I'll start PR #28 (Auth swap + database schema) once you've completed this
setup. PR #27 (journal redesign) is independent and continues in parallel.

---

## What this gets us

After these steps, the project is provisioned but **no app code is wired
to it yet**. PR #28 will:
1. Add the `@supabase/supabase-js` client
2. Create `lib/supabase.js`
3. Replace next-auth's Google sign-in with Supabase Auth's Google sign-in
   (NavMenu UI is preserved — only the underlying handler changes)
4. Define the database schema (profiles, journals, weekly_plans, pantry_*)
5. Add Row-Level Security policies
6. Add the "import your local data" prompt for first sign-in

Until PR #28 ships, signing in still goes through Auth.js. The Supabase
project sits idle, ready to receive code.
