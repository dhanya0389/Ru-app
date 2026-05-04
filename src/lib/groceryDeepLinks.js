// Public search-URL deep links for major US grocery services.
// Pure URL construction — no APIs, no auth, no approval needed.
//
// Each service object:
//   id         — stable string key
//   name       — display label
//   tagline    — short context (e.g., "Delivery + pickup")
//   buildUrl   — (query: string) => string
//
// IMPORTANT: URL parameter names are based on each service's public search page
// as of plan creation. Verify on real devices before relying on them — services
// occasionally change query-string conventions.

export const GROCERY_SERVICES = [
  {
    id: 'instacart',
    name: 'Instacart',
    tagline: 'Delivery from many stores',
    buildUrl: (q) => `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`,
  },
  {
    id: 'amazonFresh',
    name: 'Amazon Fresh',
    tagline: 'Whole Foods + Fresh',
    buildUrl: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=amazonfresh`,
  },
  {
    id: 'walmart',
    name: 'Walmart',
    tagline: 'Grocery delivery + pickup',
    buildUrl: (q) => `https://www.walmart.com/grocery/search?query=${encodeURIComponent(q)}`,
  },
  {
    id: 'kroger',
    name: 'Kroger',
    tagline: 'Ralphs · King Soopers · Fred Meyer',
    buildUrl: (q) => `https://www.kroger.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    id: 'target',
    name: 'Target',
    tagline: 'Same-day with Shipt',
    buildUrl: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
  },
  {
    id: 'albertsons',
    name: 'Albertsons',
    tagline: 'Safeway · Vons · Jewel-Osco',
    buildUrl: (q) => `https://www.albertsons.com/shop/search-results.html?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'costco',
    name: 'Costco',
    tagline: 'Bulk + grocery',
    buildUrl: (q) => `https://www.costco.com/CatalogSearch?keyword=${encodeURIComponent(q)}`,
  },
  {
    id: 'traderJoes',
    name: "Trader Joe's",
    tagline: 'Search only — no delivery',
    buildUrl: (q) => `https://www.traderjoes.com/home/search?q=${encodeURIComponent(q)}`,
  },
]

// Browsers commonly cap URLs around 2000 chars. Stay safely below.
const URL_SAFE_LIMIT = 1900

// Returns the items that should actually be sent in the URL (everything if it
// fits, top N if not) plus a flag the caller can use to surface a warning.
export function fitItemsToUrl(items, maxFallback = 10) {
  const fullQuery = items.join(' ')
  // Test against the longest URL pattern we use (Amazon, with the i= suffix).
  const probeUrl = `https://www.amazon.com/s?k=${encodeURIComponent(fullQuery)}&i=amazonfresh`
  if (probeUrl.length <= URL_SAFE_LIMIT) {
    return { items, truncated: false }
  }
  return { items: items.slice(0, maxFallback), truncated: true }
}

// Format the same items as a human-readable list for clipboard / email / share.
export function formatHumanList(items) {
  if (!items.length) return ''
  return items.map((line) => `- ${line}`).join('\n')
}

// Strip the leading quantity from a formatted shopping-list line so the
// remaining text is a clean search term. Examples:
//   "500g chicken breast"      → "chicken breast"
//   "1.5kg sweet potato"       → "sweet potato"
//   "4 large eggs"             → "large eggs"
//   "1 cup tahini"             → "tahini"
//   "240ml broth"              → "broth"
//   "2 medium tomatoes"        → "medium tomatoes"
//   "Pinch of salt"            → "Pinch of salt"   (no number → leave)
//   "1/2 lemon"                → "lemon"
// The grocery store searches the noun, not the prep amount — quantities make
// the search useless ("500g chicken breast" matches nothing on Amazon).
export function extractItemName(line) {
  if (!line) return ''
  const s = String(line).trim()
  // Match: leading number (digits/fractions/unicode), optional unit token —
  // unit MUST be followed by whitespace or end-of-string (lookahead) so a
  // bare "l" inside "lemon" / "large" doesn't get eaten as a liter unit.
  const m = s.match(
    /^(?:[\d./]+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(?:(?:g|kg|ml|l|oz|lb|cup|cups|tsp|tbsp)(?=\s|$))?\s*(.*)$/i
  )
  if (!m) return s
  // Drop a leading "of" (e.g. "1 cup of broth" → "broth").
  const rest = (m[1] || '').replace(/^of\s+/i, '').trim()
  return rest || s
}
