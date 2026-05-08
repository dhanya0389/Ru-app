// Cloud profile read/write — Supabase `profiles` table (PR #30).
//
// The profile is stored as a single JSONB blob keyed by user_id, mirroring
// the localStorage `ruhi_profile` shape. Row-level security on the table
// (see supabase/migrations/0001_init.sql) ensures a user can only touch
// their own row, so the anon key is safe to use from the browser.
//
// These helpers are async (network calls) and return null / throw on
// failure. They're called from useProfileSync (initial reconcile on
// sign-in) and from saveProfile in lib/storage.js (best-effort dual-write
// on every local mutation while signed in).

import { supabase } from './supabase'

// Fetch the user's profile row. Returns the parsed JSON blob, or null
// when the user has no row yet (typical for first sign-in before the
// auto-import path has uploaded local state).
export async function loadProfileFromCloud(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    // Surface the message but don't throw — callers treat null as
    // "no cloud row" and fall back to local-only behavior.
    console.warn('[cloudProfile] load failed:', error.message)
    return null
  }
  return data?.data ?? null
}

// Upsert the user's profile row with the given blob. Throws on error so
// the caller can decide whether to retry or surface to the user.
export async function saveProfileToCloud(userId, profile) {
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, data: profile },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}
