'use client'

import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Subscribe to Supabase Auth state. Returns:
//   { session, user, status }
//   status: 'loading' | 'authenticated' | 'unauthenticated'
//   user:   normalized {id, email, name, image} so callers don't have to
//           know about Supabase's user_metadata shape (which varies by
//           OAuth provider — Google puts the avatar at picture or
//           avatar_url depending on the auth flow version).
//
// Replaces next-auth's useSession after PR #28's auth swap. Same return
// shape as before so NavMenu's auth UI (PR #25) doesn't need rewriting.
//
// No SessionProvider wrapper needed — Supabase's client is a singleton
// and onAuthStateChange dispatches to every subscribed component.

export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      // No Supabase client (env vars missing) → permanently unauthenticated.
      setLoading(false)
      return
    }
    let cancelled = false

    // Initial session pull on mount. Supabase reads from localStorage
    // (persistSession) so this is synchronous-ish — completes before the
    // user sees a real "loading" flash on most cold loads.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    // Live subscription — fires on sign-in, sign-out, token refresh, and
    // when the OAuth redirect lands and Supabase parses the URL hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        if (cancelled) return
        setSession(sess)
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const status = loading
    ? 'loading'
    : session
      ? 'authenticated'
      : 'unauthenticated'

  return {
    session,
    status,
    user: session?.user ? normalizeUser(session.user) : null,
  }
}

// Map Supabase's user object to a stable shape for the UI. Supabase puts
// most useful fields in `user_metadata`, but the exact keys depend on the
// OAuth provider (Google supplies both `picture` and `avatar_url` at
// different points). Centralize that brittleness here so callers don't.
function normalizeUser(supabaseUser) {
  const meta = supabaseUser.user_metadata || {}
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || meta.email || null,
    name: meta.full_name || meta.name || supabaseUser.email || 'You',
    image: meta.avatar_url || meta.picture || null,
  }
}

// Sign-in / sign-out handlers — exported alongside the hook so callers
// have one import for everything auth-related. Same names as next-auth's
// signIn/signOut so the call sites in NavMenu read identically.

export async function signIn() {
  if (!isSupabaseConfigured()) return
  // Bring the user back to wherever they started — typically the same
  // screen they were on when they tapped Sign in. window.location.origin
  // is the bare site root; Supabase redirects to that path after the
  // OAuth round-trip completes.
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

export async function signOut() {
  if (!isSupabaseConfigured()) return
  await supabase.auth.signOut()
}
