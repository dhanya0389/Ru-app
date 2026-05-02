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
