// localStorage wrapper for Ruhi user data

const STORAGE_KEY = 'ruhi_profile'
const PANTRY_KEY = 'ruhi_pantry'

export function saveProfile(data) {
  if (typeof window === 'undefined') return
  const existing = getProfile()
  const merged = { ...existing, ...data }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
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
