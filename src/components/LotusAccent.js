'use client'

/**
 * Slim botanical mark — a single curving lotus stem with one bud and one leaf.
 * Single-stroke, color inherited via currentColor so the theme can drive it.
 * Used sparingly: above the Landing wordmark and on the Transition screen.
 *
 * The shape is hand-tuned in SVG, not generated, so it carries a touch of the
 * "drawn by someone who cared" feeling rather than feeling vector-perfect.
 */
export default function LotusAccent({ className = '', width = 56, height = 96 }) {
  return (
    <svg
      role="img"
      aria-label="Lotus stalk ornament"
      width={width}
      height={height}
      viewBox="0 0 56 96"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Bud — closed lotus at the top */}
      <path
        strokeWidth="1.2"
        d="M 28 6
           C 24 11, 22 18, 23 24
           C 25 25, 27 25, 28 25
           C 29 25, 31 25, 33 24
           C 34 18, 32 11, 28 6 Z"
      />
      {/* Inner bud lines */}
      <path strokeWidth="0.8" d="M 28 8 V 24" />
      <path strokeWidth="0.8" d="M 25 12 C 26 16, 26 20, 27 24" />
      <path strokeWidth="0.8" d="M 31 12 C 30 16, 30 20, 29 24" />

      {/* Stem — a gentle s-curve from bud down */}
      <path
        strokeWidth="1.2"
        d="M 28 25
           C 31 38, 22 50, 28 64
           C 33 76, 26 86, 28 94"
      />

      {/* Leaf on the left side, mid-stem */}
      <path
        strokeWidth="1.2"
        d="M 26 56
           C 14 54, 6 60, 4 70
           C 14 70, 22 65, 26 60 Z"
      />
      {/* Leaf vein */}
      <path strokeWidth="0.7" d="M 25 58 C 18 62, 12 66, 6 68" />
    </svg>
  )
}
