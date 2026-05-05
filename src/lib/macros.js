// Server-side macro calculation via USDA FoodData Central.
//
// LLMs hallucinate macro values badly — we saw 34g protein on a meal that
// actually contains 67g. This module replaces the AI's guess with real
// nutrition data:
//   1. Parse each ingredient string (quantity + unit + name)
//   2. Search USDA FoodData Central for the food item
//   3. Multiply nutrient-per-100g by parsed quantity in grams
//   4. Sum across all ingredients
//
// Free public API key required (USDA_API_KEY env var).

const USDA_API = 'https://api.nal.usda.gov/fdc/v1/foods/search'

// USDA nutrient IDs we care about. Calories appear under different IDs
// depending on dataset: SR Legacy uses 1008, Foundation uses 2047 (Atwater
// General) or 2048 (Atwater Specific). We check all three.
const NUTRIENT = { protein: 1003, fat: 1004, carbs: 1005 }
const CALORIE_IDS = [1008, 2047, 2048]

// Average weights for common "1 medium X" / "1 large X" items where the
// user input is a count rather than a weight. Conservative best-guesses.
const COUNT_WEIGHTS_G = {
  egg: 50,            // large egg
  'chicken breast': 170,  // 1 medium boneless skinless
  'salmon fillet': 170,
  'sweet potato': 200,    // 1 medium
  potato: 170,            // 1 medium
  onion: 150,             // 1 medium
  tomato: 120,
  garlic: 5,              // 1 clove
  lemon: 60,
  lime: 50,
  apple: 180,
  banana: 120,
  avocado: 200,
  cucumber: 200,
  carrot: 60,             // 1 medium
}

// Volume to grams conversion (rough — varies by ingredient density).
// For dry ingredients we lean on item-specific tables when needed.
const VOLUME_TO_G = {
  cup: 240,    // 1 cup ~= 240ml liquid; for dry/grain we approximate
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  ml: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
}

const WEIGHT_TO_G = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  lbs: 453.6,
  pound: 453.6,
  pounds: 453.6,
}

// Parse "1 ½ cups cooked lentils" / "150g salmon" / "3 large eggs" / "salt to taste"
// Returns { quantity, unit, name } or null if unparseable.
export function parseIngredient(str) {
  if (!str) return null
  let s = str.trim().toLowerCase()
  // Strip parenthetical notes: "1 can (400ml) chickpeas" → "1 can chickpeas"
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()

  // Number (incl. fractions like "1/2", "½", "1 1/2")
  const numRe = /^(\d+(?:\s\d+)?\/?\d*|[½⅓⅔¼¾⅛⅜⅝⅞]+)/
  const numMatch = s.match(numRe)
  if (!numMatch) {
    // No quantity — likely "salt to taste" or similar
    return { quantity: 0, unit: null, name: s, contributesMacros: false }
  }
  const quantity = parseFraction(numMatch[1])
  s = s.slice(numMatch[0].length).trim()

  // Unit (optional)
  const unitRe = /^(g|grams?|kg|oz|ounces?|lb|lbs|pounds?|ml|l|liters?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|small|medium|large|whole|fillet|breast|clove|cloves|piece|pieces|can|cans|jar|jars|bunch|bunches|bottle|sprig|sprigs|knob|pinch|handful|handfuls|stalk|stalks)\b\.?\s*/
  const unitMatch = s.match(unitRe)
  let unit = null
  if (unitMatch) {
    unit = unitMatch[1]
    s = s.slice(unitMatch[0].length).trim()
  }
  // Strip leading "of" ("1 cup of rice")
  s = s.replace(/^of\s+/, '').trim()
  // Strip everything from the FIRST comma onward — comma in an ingredient
  // string almost always signals prep notes ("chicken breast, thinly sliced",
  // "tomato, chopped"). Keeping just the first clause gives USDA a clean
  // food-name to match against.
  s = s.split(',')[0].trim()
  // Strip remaining single-word prep modifiers if they're trailing.
  s = s.replace(/\s+(chopped|diced|sliced|minced|grated|drained|rinsed|cooked|raw|fresh|dried|peeled|cubed|crushed|whole|finely|roughly|pitted|halved)\s*$/, '').trim()
  return { quantity, unit, name: s, contributesMacros: true }
}

function parseFraction(str) {
  const unicodeFractions = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }
  if (unicodeFractions[str]) return unicodeFractions[str]
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const fr = str.match(/^(\d+)\/(\d+)$/)
  if (fr) return parseInt(fr[1]) / parseInt(fr[2])
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// Convert (quantity, unit, name) → grams. Returns null when we can't.
function toGrams(quantity, unit, name) {
  if (!quantity) return 0
  if (!unit) {
    // No unit — treat as a count of items if we know the avg weight
    const w = matchCountWeight(name)
    return w ? quantity * w : null
  }
  if (WEIGHT_TO_G[unit]) return quantity * WEIGHT_TO_G[unit]
  if (VOLUME_TO_G[unit]) return quantity * VOLUME_TO_G[unit]
  // size descriptors with implicit count: "1 medium onion", "3 large eggs"
  if (['small', 'medium', 'large', 'whole', 'fillet', 'breast', 'piece', 'pieces'].includes(unit)) {
    const w = matchCountWeight(name)
    return w ? quantity * w : null
  }
  if (unit === 'clove' || unit === 'cloves') return quantity * 5
  if (unit === 'pinch') return quantity * 0.5
  if (unit === 'handful' || unit === 'handfuls') return quantity * 30 // leafy greens
  if (unit === 'can' || unit === 'cans') return quantity * 400 // typical canned-goods weight
  if (unit === 'jar' || unit === 'jars') return quantity * 200
  if (unit === 'bunch' || unit === 'bunches') return quantity * 60
  if (unit === 'sprig' || unit === 'sprigs') return quantity * 2
  if (unit === 'knob') return quantity * 15
  if (unit === 'stalk' || unit === 'stalks') return quantity * 40 // celery
  return null
}

function matchCountWeight(name) {
  for (const [key, w] of Object.entries(COUNT_WEIGHTS_G)) {
    if (name.includes(key)) return w
  }
  return null
}

// Words in a USDA description that likely indicate a PROCESSED form when the
// user asked for a basic ingredient. Used to reject obvious mismatches:
// "chicken breast" matching "Chicken breast tenders, breaded, uncooked", or
// "fresh spinach" matching "Pasta, fresh-refrigerated, spinach".
const REJECT_IF_PRESENT = [
  'breaded', 'fried', 'fritter', 'pasta', 'pizza', 'soup,', 'sauce,',
  'cookie', 'cake', 'cracker', 'cereal', 'snack', 'bar,', 'mix,',
  'restaurant', 'fast food', 'frozen meal',
]

// Words to STRIP from the search query before sending to USDA — they confuse
// matching since USDA descriptions don't use them (USDA uses "raw" not "fresh").
// Expanded May 4: more prep adjectives so queries like "extra firm tofu" or
// "lightly toasted hemp seeds" reduce to "tofu" / "hemp seeds" — those have
// USDA hits, the modifier-laden phrases don't.
const STRIP_FROM_QUERY = /\b(organic|free.?range|grass.?fed|wild|farmed|low.?sodium|unsweetened|plain|fresh|extra.?firm|firm|silken|soft|hard|raw|cooked|dry|dried|whole|ground|crumbled|crushed|chopped|diced|sliced|minced|grated|toasted|lightly|roughly|finely|freshly|lightly.?toasted|roasted|baked|steamed|boiled|softened|unsalted|salted|frozen|canned|jarred|store.?bought|home.?made|homemade|low.?fat|reduced.?fat|nonfat|non.?fat|full.?fat|skinless|boneless|seedless|pitted|peeled|chilled|warmed|ripe|unripe|small|medium|large)\b/gi

function cleanQuery(name) {
  return name
    .replace(STRIP_FROM_QUERY, '')
    .replace(/\s+/g, ' ')
    .split(/\s+or\s+/)[0]   // "chicken or vegetable broth" → "chicken broth"
    .trim()
}

// Build a list of progressively-broader query variants to try when the
// initial search misses. "extra firm tofu" already gets cleaned to "tofu",
// but compound phrases like "Greek yogurt unsweetened plain" → "Greek yogurt"
// → "yogurt" let us fall back to broader hits.
function queryVariants(name) {
  const cleaned = cleanQuery(name)
  if (!cleaned) return []
  const variants = [cleaned]
  // Drop adjectives one word at a time from the LEFT (cuisine prefixes like
  // "Greek yogurt" → "yogurt"; "smoked salmon" → "salmon")
  const words = cleaned.split(/\s+/).filter(Boolean)
  for (let i = 1; i < words.length; i++) {
    const broader = words.slice(i).join(' ')
    if (broader && !variants.includes(broader)) variants.push(broader)
  }
  // Also try the LAST word alone as a final fallback ("hemp seeds" → "hemp"
  // already covered by the loop above; this handles edge cases).
  return variants
}

// Score a USDA candidate against the original query — higher = better match.
// Replaces the prior "first reasonable match" logic, which sometimes picked
// a mediocre Foundation entry when a much better SR Legacy entry existed.
//
// Scoring rules:
//   +10 if the description starts with the query word (best — exact root)
//   +5  for each query word found in the description (deeper relevance)
//   -8  if a REJECT_IF_PRESENT word is in description but not in query
//   -3  per extra prep modifier in description ("with sauce", "fried")
//   -2  if it's a branded / commercial form when query is generic
function scoreCandidate(food, query) {
  const desc = (food.description || '').toLowerCase()
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(Boolean)
  let score = 0

  // Exact root start = strong signal
  if (queryWords[0] && desc.startsWith(queryWords[0])) score += 10
  // Each query word in description
  queryWords.forEach((w) => {
    if (w.length > 2 && desc.includes(w)) score += 5
  })
  // Reject penalties
  for (const word of REJECT_IF_PRESENT) {
    if (desc.includes(word) && !queryLower.includes(word.replace(',', ''))) {
      score -= 8
    }
  }
  // Extra modifier penalty — ", with X" ", and Y" suggests the entry is a
  // composite dish, not a base ingredient.
  const modifierCount = (desc.match(/,\s*\w+/g) || []).length
  score -= modifierCount * 1.5
  // Branded foods often have inflated/processed nutrient profiles
  if (food.brandOwner || food.brandName) score -= 2

  return score
}

// Search USDA. Three layers of fallback:
//   1. For each query variant, search Foundation (canonical raw foods)
//   2. For each query variant, search SR Legacy (broader, includes cooked)
//   3. Pick the highest-scoring candidate across all variants + dataTypes
async function searchUSDA(name, apiKey) {
  const variants = queryVariants(name)
  if (variants.length === 0) return null

  async function fetchCandidates(query, dataType) {
    const url = `${USDA_API}?query=${encodeURIComponent(query)}&pageSize=5&dataType=${encodeURIComponent(dataType)}&api_key=${apiKey}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return []
      const data = await res.json()
      return (data.foods || []).map((f) => ({ ...f, _query: query, _dataType: dataType }))
    } catch {
      return []
    }
  }

  // Try the most specific variant first; only broaden if needed. This keeps
  // us from getting bad-but-broad matches when a precise hit was available.
  for (const variant of variants) {
    // For each variant, try Foundation first, then SR Legacy
    const foundation = await fetchCandidates(variant, 'Foundation')
    const srLegacy = await fetchCandidates(variant, 'SR Legacy')
    const candidates = [...foundation, ...srLegacy]
    if (candidates.length === 0) continue

    // Score and pick the best
    const scored = candidates
      .map((c) => ({ food: c, score: scoreCandidate(c, variant) }))
      .sort((a, b) => b.score - a.score)
    const best = scored[0]
    // Only accept if the score is positive — negative means worse than nothing
    if (!best || best.score < 0) continue

    const food = best.food
    const find = (id) => food.foodNutrients?.find(n => n.nutrientId === id)?.value || 0
    const findCalories = () => {
      for (const id of CALORIE_IDS) {
        const v = find(id)
        if (v > 0) return v
      }
      return 0
    }
    return {
      proteinPer100g: find(NUTRIENT.protein),
      carbsPer100g: find(NUTRIENT.carbs),
      fatPer100g: find(NUTRIENT.fat),
      caloriesPer100g: findCalories(),
      matchedAs: food.description,
      matchedVia: `${variant} (${food._dataType})`,
    }
  }
  return null
}

/**
 * Calculate macros for a recipe given its ingredients list.
 * Falls back gracefully when an ingredient can't be parsed or matched.
 *
 * @param {string[]} ingredients
 * @returns {Promise<{protein:number, carbs:number, fat:number, calories:number, debug?:object}>}
 */
export async function calculateMacros(ingredients) {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey || !ingredients?.length) return null

  let totalP = 0, totalC = 0, totalF = 0, totalCal = 0
  const debug = []

  // Run lookups in parallel for speed
  const lookups = await Promise.all(ingredients.map(async (raw) => {
    const parsed = parseIngredient(raw)
    if (!parsed || !parsed.contributesMacros) {
      return { raw, skipped: true, reason: 'no quantity (e.g., salt to taste)' }
    }
    const grams = toGrams(parsed.quantity, parsed.unit, parsed.name)
    if (!grams) {
      return { raw, parsed, skipped: true, reason: 'cannot convert to grams' }
    }
    const nutrients = await searchUSDA(parsed.name, apiKey)
    if (!nutrients) {
      return { raw, parsed, grams, skipped: true, reason: 'no USDA match' }
    }
    const factor = grams / 100
    return {
      raw,
      parsed,
      grams,
      matchedAs: nutrients.matchedAs,
      protein: nutrients.proteinPer100g * factor,
      carbs: nutrients.carbsPer100g * factor,
      fat: nutrients.fatPer100g * factor,
      calories: nutrients.caloriesPer100g * factor,
    }
  }))

  for (const r of lookups) {
    if (r.skipped) {
      debug.push({ raw: r.raw, skipped: true, reason: r.reason })
      continue
    }
    totalP += r.protein
    totalC += r.carbs
    totalF += r.fat
    totalCal += r.calories
    debug.push({ raw: r.raw, matchedAs: r.matchedAs, grams: Math.round(r.grams), p: Math.round(r.protein), c: Math.round(r.carbs), f: Math.round(r.fat) })
  }

  const result = {
    protein: Math.round(totalP),
    carbs: Math.round(totalC),
    fat: Math.round(totalF),
    calories: Math.round(totalCal),
    debug,
  }

  // Sanity check — if values are implausible for a single meal, return null
  // so the caller falls back to the AI's macro guess. USDA matching can
  // surface wrong items (e.g., dry beans when user said cooked, or processed
  // forms with inflated nutrients) and confidently-wrong is worse than
  // approximately-right.
  if (
    result.calories < 100 || result.calories > 2000 ||
    result.protein < 3   || result.protein > 100 ||
    result.carbs < 0     || result.carbs > 200 ||
    result.fat < 0       || result.fat > 100
  ) {
    return null
  }
  return result
}

/**
 * Format calculated macros as the macro display string used in cards.
 * @returns string like "32g protein · 45g carbs · 18g fat"
 */
export function formatMacros(macros) {
  if (!macros) return null
  return `${macros.protein}g protein · ${macros.carbs}g carbs · ${macros.fat}g fat`
}

export function formatCalories(macros) {
  if (!macros) return null
  return `~${macros.calories} cal`
}
