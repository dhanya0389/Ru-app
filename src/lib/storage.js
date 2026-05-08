// localStorage wrapper for Ruhi user data.
//
// PR #30 added an opt-in cloud mirror for the profile: when a Supabase
// auth session is active, useProfileSync calls setActiveUserId() to wire
// the user's id in here, and every saveProfile() best-effort upserts to
// Supabase in addition to writing localStorage. Anonymous users (no
// active id) keep working with localStorage only.
//
// Cloud persistence for the other surfaces (journal, weekly_plans,
// pantry) lands in PR #32 using the same setActiveUserId pattern.

const STORAGE_KEY = 'ruhi_profile'
const PANTRY_KEY = 'ruhi_pantry'

let activeUserId = null

// Wire a Supabase user id so saveProfile mirrors writes to the cloud.
// Pass null on sign-out to drop back to local-only writes (localStorage
// is intentionally NOT cleared — anonymous use after sign-out continues
// per the locked Phase 2 design decision).
export function setActiveUserId(userId) {
  activeUserId = userId || null
}

// Read-only accessor used by useProfileSync's reconcile path so it can
// avoid mirroring back the cloud blob it just pulled.
export function getActiveUserId() {
  return activeUserId
}

// Overwrite the entire local profile blob without firing the cloud
// mirror. Used by useProfileSync after pulling the authoritative cloud
// row so the local store matches without round-tripping back to Supabase.
export function replaceLocalProfile(data) {
  if (typeof window === 'undefined') return
  if (data == null) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function saveProfile(data) {
  if (typeof window === 'undefined') return
  const existing = getProfile()
  const merged = { ...existing, ...data }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  if (activeUserId) {
    // Best-effort cloud mirror. Dynamic import keeps the storage layer
    // free of a hard Supabase dependency for anonymous users (the cloud
    // module isn't pulled into the bundle until the first signed-in save).
    import('./cloudProfile')
      .then(({ saveProfileToCloud }) =>
        saveProfileToCloud(activeUserId, merged).catch((err) =>
          console.warn('[storage] cloud profile save failed:', err.message)
        )
      )
      .catch((err) => console.warn('[storage] cloudProfile import failed:', err.message))
  }
  return merged
}

export function getProfile() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function clearProfile() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function isOnboardingComplete() {
  const profile = getProfile()
  return profile?.onboardingComplete === true
}

// Pantry — a single free-text string, the same shape users already type into
// the kitchen / pantry fields on Daily Check-in and Weekly Mode. Saved on
// submit (not every keystroke), pre-fills the next visit.

export function getPantry() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(PANTRY_KEY) || ''
}

export function savePantry(text) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PANTRY_KEY, text || '')
}

export function clearPantry() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PANTRY_KEY)
}

// Pantry chip helpers
//
// Storage stays as a single comma-joined free-text string (back-compat with
// every existing surface that reads/writes pantry as text). Components that
// want a removable-chip UX use these to parse on read and join on save.

// Parse the free-text pantry string into a deduped, trimmed list of chips.
// Splits on commas, semicolons, or newlines; ignores empty + whitespace-only
// fragments; preserves first-seen casing for nicer display ("Tahini" beats
// "tahini" if the user typed it that way first).
export function parsePantryChips(text) {
  if (!text || typeof text !== 'string') return []
  const seen = new Set()
  const chips = []
  for (const raw of text.split(/[,;\n]+/)) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    chips.push(trimmed)
  }
  return chips
}

// Inverse — chip array → comma-joined string for storage.
export function joinPantryChips(chips) {
  if (!Array.isArray(chips)) return ''
  return chips.map((c) => String(c).trim()).filter(Boolean).join(', ')
}

// Merge new chips into an existing chip list, dedupe (case-insensitive),
// preserve order: existing first, new appended. Used after voice or image
// adds to avoid duplicating items already in the pantry.
export function mergePantryChips(existing, additions) {
  const out = []
  const seen = new Set()
  const push = (c) => {
    const trimmed = String(c || '').trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(trimmed)
  }
  ;(existing || []).forEach(push)
  ;(additions || []).forEach(push)
  return out
}
