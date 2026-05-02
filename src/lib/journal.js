// Voice journal — localStorage-backed entries with phase + day metadata so
// past entries can be retrieved for the same phase/day on future check-ins.
// Same storage pattern as the rest of Ruhi (pantry, profile). Phase 2 swaps
// localStorage for Supabase so journals survive device switches.

const JOURNAL_KEY = 'ruhi_journal'

// Entry shape:
//   id          string   — stable ID for React keys + future delete-by-id
//   timestamp   number   — Date.now()
//   phase       string?  — 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal' | null
//   day         number?  — cycle day, 1-28-ish, null if user doesn't track
//   energy      number   — 1-5 at time of entry
//   note        string   — what the user said/typed
//   reflection  string?  — AI's short embodied response, may be null on save failure

export function getEntries() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function addEntry({ note, energy, phase, day, reflection = null }) {
  if (typeof window === 'undefined') return null
  const entry = {
    id: makeId(),
    timestamp: Date.now(),
    phase: phase ?? null,
    day: typeof day === 'number' ? day : null,
    energy: typeof energy === 'number' ? energy : null,
    note: String(note || '').trim(),
    reflection: reflection ? String(reflection).trim() : null,
  }
  const next = [entry, ...getEntries()]
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(next))
  return entry
}

export function clearEntries() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(JOURNAL_KEY)
}

// Retrieval for the AI: same phase, day within ±2, excluding any entry from
// today's calendar date (the user's current-session journal shouldn't be
// surfaced back at them as "past wisdom"). Returns reverse-chronological,
// capped at `limit`. Empty array if no phase, no day, or no matches.
export function findRelevantEntries(phaseName, day, limit = 2) {
  if (!phaseName || typeof day !== 'number') return []
  const entries = getEntries()
  if (entries.length === 0) return []

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  return entries
    .filter((e) => e.phase === phaseName)
    .filter((e) => typeof e.day === 'number' && Math.abs(e.day - day) <= 2)
    .filter((e) => e.timestamp < todayMs)
    .slice(0, limit)
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `j_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
