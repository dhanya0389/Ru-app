'use client'

// Browser-side Supabase client. Singleton — one instance per page load.
//
// Env vars (set in .env.local + Vercel project settings):
//   NEXT_PUBLIC_SUPABASE_URL       — project URL, e.g. https://xxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  — public-safe key (RLS gates real data access)
//
// If env vars are missing (e.g. brand-new local clone before .env.local is
// populated), we export `null` rather than throwing. The hybrid model
// requires the app to function for unauthenticated users via localStorage —
// missing Supabase config should never break the experience for someone
// who isn't trying to sign in.
//
// Phase 2 plan: this module backs both auth (Supabase Auth Google provider,
// PR #28) and data persistence (Supabase Postgres with RLS, PR #29+).

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let client = null
if (url && key) {
  client = createClient(url, key, {
    auth: {
      // Persist session in localStorage (default) so refresh keeps the
      // user signed in. detectSessionInUrl picks up the OAuth redirect
      // hash on return from Google → Supabase → Ruhi.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
} else if (typeof window !== 'undefined') {
  // Only warn in the browser; SSR doesn't need Supabase to render the page.
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing — sign-in disabled.'
  )
}

export const supabase = client

// Convenience: returns true when Supabase is wired up. Components use this
// to gate the sign-in CTA — if Supabase isn't configured locally, we hide
// the sign-in button rather than show a broken one.
export function isSupabaseConfigured() {
  return supabase !== null
}
