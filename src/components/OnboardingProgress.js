'use client'

/**
 * Top-of-screen progress indicator for onboarding.
 * One lotus icon per step. The icon for the current step renders as a closed
 * bud that gently breathes; on advance, that bud blooms into a full flower
 * silhouette and the next bud takes over the breathing.
 *
 * States per icon:
 *   - future: closed bud, faded
 *   - current: closed bud, full color, breathing pulse
 *   - done:   open bloom, solid silhouette
 *
 * Hidden in single-section edit mode (no flow to track).
 */
export default function OnboardingProgress({ current, total, hidden = false }) {
  if (hidden) return null

  return (
    <div className="w-full px-4 pt-5 pb-2 max-w-md mx-auto">
      <div
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current + 1} of ${total}`}
        className="flex items-end justify-between gap-1"
      >
        {Array.from({ length: total }).map((_, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'future'
          // Tailwind's alpha-slash modifier doesn't work with our raw-hex
          // var-based color tokens, so use the opacity utility for the
          // faded future state instead of `text-ruhi-earth/40`.
          const colorClass =
            state === 'future' ? 'text-ruhi-earth opacity-40'
              : state === 'current' ? 'text-ruhi-deep'
                : 'text-ruhi-deep'
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`block flex-1 max-w-[30px] ${colorClass}`}
            >
              <LotusIcon state={state} />
            </span>
          )
        })}
      </div>
      <p
        className="text-center text-xs text-ruhi-earth/70 mt-2 tracking-wide"
        aria-hidden="true"
      >
        Step {current + 1} of {total}
      </p>
    </div>
  )
}

/**
 * One lotus mark with two stacked groups (bud + bloom). CSS in globals.css
 * crossfades and scales between them based on the lotus-{state} class.
 *
 * Bud: outlined three-peak silhouette with interior petal seams and a tiny
 *      cup + stem at the base — matches the closed-tulip-bud reference.
 * Bloom: filled five-petal silhouette over a leaf-pad bowl — matches the
 *        classic lotus-flower reference.
 *
 * Strokes/fills use currentColor so the parent's text color drives the tone.
 */
function LotusIcon({ state }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={`lotus-svg lotus-${state} block w-full h-auto`}
      aria-hidden="true"
    >
      {/* Closed bud — three distinct petals (tall center + two side petals
          leaning outward), small V-cup base, short stem. Silhouette is
          one closed path; two interior division lines mark where the
          side petals overlap the center petal. */}
      <g
        className="lotus-bud-group"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Outer silhouette: left peak → saddle → center peak → saddle →
            right peak → outer-right curve → base */}
        <path
          strokeWidth="1.4"
          d="M 11 19
             C 9 18, 7.5 14, 7.5 10
             C 7.5 7, 9 5, 10 5
             C 11 6, 11.5 8, 11.5 10
             C 12 7, 13 4.5, 14 3
             C 15 4.5, 16 7, 16.5 10
             C 16.5 8, 17 6, 18 5
             C 19 5, 20.5 7, 20.5 10
             C 20.5 14, 19 18, 17 19
             Z"
        />
        {/* Petal division lines — saddle down to base */}
        <path strokeWidth="1" d="M 11.5 10 C 11.5 13, 11.5 16, 12 19" />
        <path strokeWidth="1" d="M 16.5 10 C 16.5 13, 16.5 16, 16 19" />
        {/* Cup base — V hanging below */}
        <path strokeWidth="1.2" d="M 11 19 L 14 22 L 17 19" />
        {/* Stem */}
        <path strokeWidth="1.2" d="M 14 22 V 25" />
      </g>

      {/* Open bloom — five petals fanned out over a leaf-pad bowl, filled */}
      <g className="lotus-bloom-group" fill="currentColor">
        <path
          d="M 14 15 C 11.5 12.5, 11.5 7, 14 3 C 16.5 7, 16.5 12.5, 14 15 Z"
          transform="rotate(-65 14 15)"
        />
        <path
          d="M 14 15 C 11.5 12.5, 11.5 6.5, 14 3 C 16.5 6.5, 16.5 12.5, 14 15 Z"
          transform="rotate(-32 14 15)"
        />
        <path d="M 14 15 C 11.5 12.5, 11.5 6, 14 2.5 C 16.5 6, 16.5 12.5, 14 15 Z" />
        <path
          d="M 14 15 C 11.5 12.5, 11.5 6.5, 14 3 C 16.5 6.5, 16.5 12.5, 14 15 Z"
          transform="rotate(32 14 15)"
        />
        <path
          d="M 14 15 C 11.5 12.5, 11.5 7, 14 3 C 16.5 7, 16.5 12.5, 14 15 Z"
          transform="rotate(65 14 15)"
        />
        {/* Leaf-pad bowl under the petals */}
        <path d="M 4 16.5 Q 14 22.5, 24 16.5 Q 14 19, 4 16.5 Z" />
      </g>
    </svg>
  )
}
