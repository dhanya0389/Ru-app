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
