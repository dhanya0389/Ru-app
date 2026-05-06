'use client'

// Shared trust-signal components for macro lines on meal cards.
//
// USDA-verified badge: a small inline pill that signals the displayed
// macros came from USDA FoodData Central, not a model guess. Used next
// to macro lines whenever macros are present.
//
// Nutrition unverified icon: a single ⓘ button used in place of the
// previous "Macros pending — couldn't verify nutrition data" italic line.
// Reframes a failure state into a soft, opt-in info reveal — the user
// taps the icon when they want context, the card stays calm otherwise.

export function UsdaBadge() {
  return (
    <span
      title="Nutrition verified via USDA FoodData Central"
      aria-label="USDA verified"
      className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide font-medium
                 px-1.5 py-0.5 rounded-md bg-ruhi-sage/25 text-ruhi-deep border border-ruhi-sage/40
                 align-middle"
    >
      <svg
        aria-hidden="true"
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="5 12 10 17 19 7" />
      </svg>
      USDA
    </span>
  )
}

export function NutritionInfoIcon({ size = 14 }) {
  return (
    <button
      type="button"
      title="USDA couldn't match every ingredient in this recipe — portion sizes are a useful guide rather than a precise count."
      aria-label="Nutrition info"
      className="inline-flex items-center justify-center rounded-full text-ruhi-earth/70
                 hover:text-ruhi-deep hover:bg-white/60 transition-colors w-5 h-5 align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </button>
  )
}
