// localStorage wrapper for Ruhi user data

const STORAGE_KEY = 'ruhi_profile'

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
