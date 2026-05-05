// Smart pantry-text parser — shape-based router.
//
// Two paths:
//   • Trivial comma list ("eggs, kefir, sourdough") → use parsePantryChips.
//     Free, instant. The Daily / Weekly / Pantry surfaces have always had
//     this and it works perfectly for the 95% case.
//   • Anything with prose ("I want eggs every morning, and limit to 2
//     proteins this week") → POST to /api/parse-pantry-text and let Haiku
//     break it into { items, preferences, constraints }.
//
// The router is SHAPE-based, not keyword-based: any comma/semicolon/newline
// fragment with ≥ 5 words triggers the AI path. No maintained word list,
// no keyword detection. This avoids context-blindness (a hand-rolled list
// of "want, prefer, limit, just" eventually misses real prose) and lets
// the model do what it's actually good at.
//
// Preferences and constraints from the AI path are surfaced to the caller
// to persist (EditPantry → localStorage) or pass transient (WeeklyMode →
// this week's generation only).

import { parsePantryChips } from './storage'

// Empty parse — used for empty inputs and as the simple-path return shape.
function emptyParse(items = []) {
  return { items, preferences: [], constraints: {} }
}

// Decide whether the input needs AI parsing. The rule: any fragment (split on
// commas / semicolons / newlines) that's ≥ 5 words is prose, not a chip.
// Stays purely structural — no keyword peek.
function needsAIParse(text) {
  if (!text || typeof text !== 'string') return false
  const fragments = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
  for (const frag of fragments) {
    const wordCount = frag.split(/\s+/).filter(Boolean).length
    if (wordCount >= 5) return true
  }
  return false
}

// Parse pantry-textbox input. Async because the prose path is a network call.
// Returns { items, preferences, constraints } in all cases.
//
// Failure modes the caller should know about:
//   • API down / rate-limited → falls back to simple parser. Items still go
//     through; preferences + constraints are silently dropped. Better than
//     blocking the user from adding pantry chips.
//   • Empty input → empty parse, no network call.
export async function parsePantryText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return emptyParse()
  }

  if (!needsAIParse(text)) {
    return emptyParse(parsePantryChips(text))
  }

  try {
    const res = await fetch('/api/parse-pantry-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.warn('parse-pantry-text failed, falling back to simple parser', res.status)
      return emptyParse(parsePantryChips(text))
    }
    const data = await res.json()
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      preferences: Array.isArray(data?.preferences) ? data.preferences : [],
      constraints: data?.constraints && typeof data.constraints === 'object' ? data.constraints : {},
    }
  } catch (err) {
    console.warn('parse-pantry-text network error, falling back', err)
    return emptyParse(parsePantryChips(text))
  }
}

// localStorage helpers — consumed by EditPantry (persist) and WeeklyMode /
// DailyCheckin (read for prompt context). Kept here so all the pantry-text
// state has one home.

const PREFS_KEY = 'ruhi_pantry_preferences'
const CONSTRAINTS_KEY = 'ruhi_pantry_constraints'

export function getPantryPreferences() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string' && s.trim()) : []
  } catch {
    return []
  }
}

// Append new preferences to the persisted list, deduped (case-insensitive).
// EditPantry calls this when the AI extracts preferences from typed prose.
export function addPantryPreferences(newPrefs) {
  if (typeof window === 'undefined') return []
  const additions = Array.isArray(newPrefs) ? newPrefs.filter(Boolean) : []
  if (additions.length === 0) return getPantryPreferences()
  const existing = getPantryPreferences()
  const seen = new Set(existing.map((p) => p.toLowerCase()))
  const merged = [...existing]
  for (const p of additions) {
    const trimmed = String(p).trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(trimmed)
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
  return merged
}

export function setPantryPreferences(prefs) {
  if (typeof window === 'undefined') return
  const arr = Array.isArray(prefs) ? prefs.filter((s) => typeof s === 'string' && s.trim()) : []
  localStorage.setItem(PREFS_KEY, JSON.stringify(arr))
}

export function clearPantryPreferences() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PREFS_KEY)
}

export function getPantryConstraints() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CONSTRAINTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Merge new constraints into the saved object. Newer values win — if the
// user types "limit to 2 proteins", that supersedes the old maxProteins.
export function mergePantryConstraints(newCons) {
  if (typeof window === 'undefined') return {}
  const additions = newCons && typeof newCons === 'object' ? newCons : {}
  const existing = getPantryConstraints()
  const merged = { ...existing, ...additions }
  localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(merged))
  return merged
}

export function setPantryConstraints(cons) {
  if (typeof window === 'undefined') return
  const obj = cons && typeof cons === 'object' ? cons : {}
  localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(obj))
}

export function clearPantryConstraints() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CONSTRAINTS_KEY)
}

// Combine persisted + transient preferences/constraints for one generation
// pass. Transient wins on key conflicts (e.g. "limit to 3 proteins this week"
// typed in WeeklyMode supersedes the persisted maxProteins=2). Used by
// WeeklyMode + DailyCheckin to assemble the request body.
export function combinePantryContext(transient = {}) {
  const persistedPrefs = getPantryPreferences()
  const persistedCons = getPantryConstraints()
  const tPrefs = Array.isArray(transient.preferences) ? transient.preferences : []
  const tCons = transient.constraints && typeof transient.constraints === 'object' ? transient.constraints : {}

  // Dedupe preferences case-insensitively, persisted first then transient.
  const seen = new Set()
  const preferences = []
  for (const p of [...persistedPrefs, ...tPrefs]) {
    const trimmed = String(p || '').trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    preferences.push(trimmed)
  }

  return {
    preferences,
    constraints: { ...persistedCons, ...tCons },
  }
}
