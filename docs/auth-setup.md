# Google OAuth setup (one-time, ~15 min)

PR #25 ships the Auth.js + Google sign-in code. To make it work, you need
to register Ruhi as an OAuth client with Google and put the resulting
credentials into env vars.

## 1. Create / pick a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Top bar → project dropdown → **New Project**
3. Name: **Ruhi** (or anything — internal only)
4. Create. Make sure it's selected after creation.

## 2. Configure the OAuth consent screen

1. Left nav → **APIs & Services** → **OAuth consent screen**
2. User type: **External** → Create
3. App information:
   - App name: **Ruhi**
   - User support email: your email
   - App logo: optional (use the lotus icon at `app/icon.js` later)
4. App domain (optional but cleaner):
   - Application home page: `https://tryruhi.ai`
   - Application privacy policy / terms: leave blank for now (add when you write them)
5. Authorized domains: add **tryruhi.ai**
6. Developer contact: your email
7. Save and continue → **Scopes** screen.

## 3. Scopes

Add only:
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `openid`

These are **non-sensitive scopes** — no Google verification needed, no
review queue. We are NOT requesting `gmail.send` or `gmail.read`; those
are restricted scopes and would trigger a multi-week verification process.
The feedback link uses a plain `mailto:` and doesn't need any Gmail scope.

Save and continue → Test users → add your own email so you can sign in
during dev → Save → Back to dashboard.

## 4. Create the OAuth client ID

1. Left nav → **APIs & Services** → **Credentials**
2. Top → **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: **Ruhi web**
5. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `https://tryruhi.ai`
6. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://tryruhi.ai/api/auth/callback/google`
7. Create. Copy the **Client ID** and **Client secret** that pop up.

## 5. Generate AUTH_SECRET

```sh
openssl rand -base64 32
```

Copy the output.

## 6. Set env vars

### Local dev (`.env.local`)

```
AUTH_SECRET=<openssl output from step 5>
AUTH_GOOGLE_ID=<client ID from step 4>
AUTH_GOOGLE_SECRET=<client secret from step 4>
```

Restart the dev server.

### Vercel (production)

Vercel project → Settings → Environment Variables. Add the same three
keys. Apply to all three environments (Production, Preview, Development).
Vercel auto-deploys after env changes.

## 7. Test

1. `npm run dev`
2. Open http://localhost:3000
3. Open the menu (top-right hamburger)
4. Click **Sign in with Google**
5. You'll be redirected to Google's consent screen → pick your account →
   redirected back to localhost:3000 with a session cookie
6. Open the menu again — you should see your name + avatar + "Sign out"

If you hit `redirect_uri_mismatch`, check that the URI you registered in
step 4 exactly matches the one Auth.js is sending (including the
`/api/auth/callback/google` suffix and protocol).

## What this does and doesn't do

✅ User can sign in with Google
✅ Session cookie persists across page refreshes
✅ Menu shows the user's name + avatar
✅ Sign-out clears the session

❌ User data still lives in `localStorage` per device — sign-in does not
   sync the journal, plan, or pantry across devices yet. That requires a
   backend (Supabase migration, Phase 2 next step).
❌ No cross-device sync.
❌ No way to send mail on the user's behalf — the feedback link uses
   `mailto:` directly.

That's by design. This PR is the identity layer; the persistence layer
comes next.
