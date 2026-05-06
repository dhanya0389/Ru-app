'use client'

import { useEffect, useRef, useState } from 'react'

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
// Click toggles a small popover with the explainer; outside-click closes.
// Tap-friendly on mobile (the previous title-attribute version was
// effectively invisible on touch).

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
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Close on outside click + Escape. Listeners armed only while open so we
  // don't leak handlers when the icon is dormant.
  useEffect(() => {
    if (!open) return
    function onPointer(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={wrapperRef} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label="Why is nutrition info unverified?"
        aria-expanded={open}
        className={`inline-flex items-center justify-center rounded-full transition-colors w-5 h-5
          ${open
            ? 'bg-ruhi-deep/10 text-ruhi-deep'
            : 'text-ruhi-earth/70 hover:text-ruhi-deep hover:bg-white/60'}`}
        onClick={(e) => {
          // Card containers wrap macros in a clickable button; stop propagation
          // so tapping the ⓘ doesn't also open the recipe view.
          e.stopPropagation()
          e.preventDefault()
          setOpen((v) => !v)
        }}
      >
        <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1 z-30 w-64 max-w-[calc(100vw-2rem)]
                     bg-ruhi-cream border border-ruhi-earth/20 rounded-lg shadow-lg
                     px-3 py-2 text-[11px] leading-relaxed text-ruhi-deep
                     screen-enter"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          USDA couldn&apos;t match every ingredient in this recipe — portion sizes
          are a useful guide rather than a precise count. Treat the recipe weights
          as the source of truth and adjust to your own appetite.
        </span>
      )}
    </span>
  )
}
