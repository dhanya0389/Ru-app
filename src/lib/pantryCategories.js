// Pantry categorization — cached map of itemName → bucket, populated by the
// /api/categorize-pantry route on save. Display-only metadata; the canonical
// pantry is still the comma-joined string in `localStorage["ruhi_pantry"]`,
// and every API surface that reads pantry continues to read it as free text.
//
// Stored as: { "spinach": "vegetables", "tahini": "fats", ... }
// Lookup is case-insensitive (we canonicalize keys to lowercase on write).

const CATEGORIES_KEY = 'ruhi_pantry_categories'

// Canonical bucket order — drives the rendering order in the chip list and
// any other surface that groups by category.
export const BUCKET_ORDER = [
  'protein',
  'carbs',
  'vegetables',
  'fruits',
  'fats',
  'spices',
  'condiments',
  'drinks',
  'other',
]

// Display labels — fed into UI section headers.
export const BUCKET_LABELS = {
  protein: 'Protein',
  carbs: 'Carbs',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  fats: 'Fats + seeds',
  spices: 'Spices + herbs',
  condiments: 'Sauces + condiments',
  drinks: 'Drinks + wellness',
  other: 'Other',
}

// Visual identity per bucket — Tailwind class strings (not template literals,
// so JIT picks them up). Each bucket gets:
//   sectionBg     — tinted card background
//   sectionBorder — soft border around the card
//   dot           — solid color for the header dot + chip-border accent
//   chipBorder    — chip border color (matches dot at lower opacity)
//   chipHover     — chip hover background tint
// Color choices map to Ruhi's existing palette and the food meaning:
//   protein → terracotta (savory)        carbs → peach (warm grain)
//   vegetables → sage (green)            fruits → rose (berry)
//   fats → earth (creamy/nutty)          spices → teal (herbal)
//   condiments → terracotta (saucy)      drinks → deep (calm wellness)
// (protein + condiments share terracotta — distinguishable by position +
// label; the visual identity goal is clusters, not 8 unique hues.)
export const BUCKET_STYLES = {
  protein: {
    sectionBg: 'bg-ruhi-terracotta/10',
    sectionBorder: 'border-ruhi-terracotta/25',
    dot: 'bg-ruhi-terracotta',
    chipBorder: 'border-ruhi-terracotta/40',
    chipHover: 'hover:bg-ruhi-terracotta/15',
  },
  carbs: {
    sectionBg: 'bg-ruhi-peach/15',
    sectionBorder: 'border-ruhi-peach/30',
    dot: 'bg-ruhi-peach',
    chipBorder: 'border-ruhi-peach/50',
    chipHover: 'hover:bg-ruhi-peach/20',
  },
  vegetables: {
    sectionBg: 'bg-ruhi-sage/15',
    sectionBorder: 'border-ruhi-sage/30',
    dot: 'bg-ruhi-sage',
    chipBorder: 'border-ruhi-sage/50',
    chipHover: 'hover:bg-ruhi-sage/20',
  },
  fruits: {
    sectionBg: 'bg-ruhi-rose/15',
    sectionBorder: 'border-ruhi-rose/30',
    dot: 'bg-ruhi-rose',
    chipBorder: 'border-ruhi-rose/50',
    chipHover: 'hover:bg-ruhi-rose/20',
  },
  fats: {
    sectionBg: 'bg-ruhi-earth/10',
    sectionBorder: 'border-ruhi-earth/25',
    dot: 'bg-ruhi-earth',
    chipBorder: 'border-ruhi-earth/40',
    chipHover: 'hover:bg-ruhi-earth/15',
  },
  spices: {
    sectionBg: 'bg-ruhi-teal/15',
    sectionBorder: 'border-ruhi-teal/30',
    dot: 'bg-ruhi-teal',
    chipBorder: 'border-ruhi-teal/50',
    chipHover: 'hover:bg-ruhi-teal/20',
  },
  condiments: {
    sectionBg: 'bg-ruhi-terracotta/10',
    sectionBorder: 'border-ruhi-terracotta/25',
    dot: 'bg-ruhi-terracotta',
    chipBorder: 'border-ruhi-terracotta/40',
    chipHover: 'hover:bg-ruhi-terracotta/15',
  },
  drinks: {
    sectionBg: 'bg-ruhi-deep/10',
    sectionBorder: 'border-ruhi-deep/25',
    dot: 'bg-ruhi-deep',
    chipBorder: 'border-ruhi-deep/40',
    chipHover: 'hover:bg-ruhi-deep/15',
  },
  other: {
    sectionBg: 'bg-white/40',
    sectionBorder: 'border-ruhi-earth/20',
    dot: 'bg-ruhi-earth/60',
    chipBorder: 'border-ruhi-earth/40',
    chipHover: 'hover:bg-white/70',
  },
}

export function getCachedCategories() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCachedCategories(map) {
  if (typeof window === 'undefined') return
  if (!map || typeof map !== 'object') return
  // Canonicalize: lowercase keys, allowlist-filter buckets, drop empty values.
  const cleaned = {}
  for (const [k, v] of Object.entries(map)) {
    if (typeof k !== 'string' || !k.trim()) continue
    if (typeof v !== 'string') continue
    if (!BUCKET_ORDER.includes(v)) continue
    cleaned[k.trim().toLowerCase()] = v
  }
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cleaned))
}

export function clearCachedCategories() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CATEGORIES_KEY)
}

// Look up the bucket for a single chip — case-insensitive. Returns 'other' if
// the chip hasn't been categorized yet.
export function categoryFor(chip, cache) {
  if (!chip) return 'other'
  const map = cache || getCachedCategories()
  return map[String(chip).trim().toLowerCase()] || 'other'
}

// Group a chip list by bucket, preserving original order within each bucket.
// Returns an array of { bucket, label, chips } in BUCKET_ORDER, omitting
// empty buckets so the UI doesn't render dead headers.
export function groupChipsByCategory(chips, cache) {
  const map = cache || getCachedCategories()
  const grouped = {}
  for (const chip of chips || []) {
    const bucket = categoryFor(chip, map)
    if (!grouped[bucket]) grouped[bucket] = []
    grouped[bucket].push(chip)
  }
  return BUCKET_ORDER
    .filter((b) => grouped[b]?.length > 0)
    .map((b) => ({ bucket: b, label: BUCKET_LABELS[b], chips: grouped[b] }))
}

// Async helper — POSTs all chips to /api/categorize-pantry and merges the
// returned map into the existing cache (so previously-known categories stay
// even if a save fails to re-classify them). Returns the merged map. Throws
// on network/API failure; callers decide whether to surface or swallow.
export async function categorizeAndCache(chips) {
  if (!Array.isArray(chips) || chips.length === 0) {
    return getCachedCategories()
  }
  const res = await fetch('/api/categorize-pantry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: chips }),
  })
  if (!res.ok) {
    throw new Error(`categorize-pantry HTTP ${res.status}`)
  }
  const data = await res.json()
  const incoming = data?.categories || {}
  const merged = { ...getCachedCategories() }
  for (const [item, bucket] of Object.entries(incoming)) {
    if (typeof item !== 'string') continue
    if (typeof bucket !== 'string') continue
    if (!BUCKET_ORDER.includes(bucket)) continue
    merged[item.trim().toLowerCase()] = bucket
  }
  saveCachedCategories(merged)
  return merged
}
