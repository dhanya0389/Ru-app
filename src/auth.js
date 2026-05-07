// Auth.js (next-auth v5) configuration. App Router native.
//
// Phase 2 — basic identity only. No backend yet, so the user's session
// lives in an encrypted JWT cookie (default when no adapter is configured).
// Once Supabase lands, swap to the Supabase adapter so the same Google
// identity keys persisted user data across devices.
//
// Env vars (set locally in .env.local, in prod via Vercel project env):
//   AUTH_SECRET         — random 32-byte string. `openssl rand -base64 32`
//   AUTH_GOOGLE_ID      — OAuth client ID from Google Cloud Console
//   AUTH_GOOGLE_SECRET  — OAuth client secret
//   AUTH_TRUST_HOST     — 'true' on Vercel (auto-set there)
//
// Authorized redirect URI to register in GCP:
//   http://localhost:3000/api/auth/callback/google      (dev)
//   https://tryruhi.ai/api/auth/callback/google         (prod)

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      // Auth.js auto-reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from env.
      // No client-side scope = the default `openid email profile`, which is
      // a non-sensitive scope set (no Google review needed) and gives us
      // exactly what we need for identity: stable user ID, email, name,
      // avatar. We do NOT request gmail.send / gmail.read — those are
      // restricted scopes that need verification and aren't required for
      // login or for the feedback link (mailto: handles that).
    }),
  ],
  pages: {
    // No custom auth pages yet — Auth.js's default sign-in page handles it.
    // Future: add a branded sign-in screen if discovery feels rough.
  },
  callbacks: {
    // Trim the JWT to the minimum we display in the UI. Avoids ballooning
    // the cookie with refresh tokens or unused profile fields.
    async jwt({ token, user }) {
      if (user) {
        token.picture = user.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.image = token.picture
      }
      return session
    },
  },
})
