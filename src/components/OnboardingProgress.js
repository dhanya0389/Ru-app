'use client'

/**
 * Top-of-screen progress indicator for onboarding.
 * One lotus icon per step, all sitting on a soft horizontal vine. The
 * current step's bud breathes; on advance it blooms into a filled lotus
 * silhouette and the next bud takes over the breathing.
 *
 * States per icon:
 *   - future: closed bud, faded earth tone
 *   - current: closed bud, full deep tone, breathing pulse
 *   - done:   open bloom, solid filled silhouette
 *
 * Hidden in single-section edit mode (no flow to track).
 */
export default function OnboardingProgress({ current, total, hidden = false }) {
  if (hidden) return null

  return (
    <div className="w-full px-4 pt-5 pb-2 max-w-md mx-auto">
      <div className="relative">
        {/* Soft vine running behind the lotuses — anchored at ~80% from the
            top of the row so each lotus appears to grow from a shared stem.
            Wrapped in a positioning div because SVG elements don't auto-
            stretch from left+right insets (their intrinsic 300×150 default
            takes over). The SVG fills the wrapper via w-full h-full and
            preserveAspectRatio="none" lets the gentle wave stretch to any
            width; non-scaling-stroke keeps the stroke crisp. */}
        <div
          className="absolute pointer-events-none text-ruhi-earth"
          style={{ left: '8px', right: '8px', top: '78%', height: '7px', opacity: 0.45 }}
          aria-hidden="true"
        >
          <svg
            className="block w-full h-full"
            viewBox="0 0 100 4"
            preserveAspectRatio="none"
          >
            <path
              d="M 0 2 Q 6 1, 12 2 T 24 2 T 36 2 T 48 2 T 60 2 T 72 2 T 84 2 T 96 2 L 100 2"
              stroke="currentColor"
              strokeWidth="0.7"
              fill="none"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div
          role="progressbar"
          aria-valuenow={current + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Step ${current + 1} of ${total}`}
          className="flex items-end justify-between gap-1 relative"
        >
          {Array.from({ length: total }).map((_, i) => {
            const state = i < current ? 'done' : i === current ? 'current' : 'future'
            // Tailwind's alpha-slash modifier doesn't work with our raw-hex
            // var-based color tokens, so use the opacity utility for the
            // faded future state.
            const colorClass =
              state === 'future' ? 'text-ruhi-earth opacity-40' : 'text-ruhi-deep'
            return (
              <span
                key={i}
                aria-hidden="true"
                className={`block flex-1 max-w-[28px] ${colorClass}`}
              >
                <LotusIcon state={state} />
              </span>
            )
          })}
        </div>
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
 * Bud and bloom share the same base line (y≈19) so both sit cleanly on the
 * vine. The bud has no stem because the vine takes over that role.
 *
 * Strokes/fills use currentColor so the parent's text color drives the tone.
 */
function LotusIcon({ state }) {
  return (
    <svg
      viewBox="0 0 28 22"
      className={`lotus-svg lotus-${state} block w-full h-auto`}
      aria-hidden="true"
    >
      {/* Closed bud — three-peak silhouette, no stem. Base sits at y=19. */}
      <g
        className="lotus-bud-group"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          strokeWidth="1.4"
          d="M 14 5
             C 12.5 6, 11 8, 11 11
             C 10.5 9.5, 9 9, 8 10
             C 6.8 11.5, 6.8 14.5, 8 17
             C 9 18.5, 11 19, 14 19
             C 17 19, 19 18.5, 20 17
             C 21.2 14.5, 21.2 11.5, 20 10
             C 19 9, 17.5 9.5, 17 11
             C 17 8, 15.5 6, 14 5 Z"
        />
        <path strokeWidth="1" d="M 11 11 C 11.5 13.5, 11.5 16.5, 12.5 18.7" />
        <path strokeWidth="1" d="M 17 11 C 16.5 13.5, 16.5 16.5, 15.5 18.7" />
      </g>

      {/* Open bloom — five petals fan over a leaf-pad bowl. Bowl base at y=19. */}
      <g className="lotus-bloom-group" fill="currentColor">
        <path
          d="M 14 14 C 11.5 12, 11.5 6.5, 14 3 C 16.5 6.5, 16.5 12, 14 14 Z"
          transform="rotate(-65 14 14)"
        />
        <path
          d="M 14 14 C 11.5 12, 11.5 6, 14 2.5 C 16.5 6, 16.5 12, 14 14 Z"
          transform="rotate(-32 14 14)"
        />
        <path d="M 14 14 C 11.5 12, 11.5 5.5, 14 2 C 16.5 5.5, 16.5 12, 14 14 Z" />
        <path
          d="M 14 14 C 11.5 12, 11.5 6, 14 2.5 C 16.5 6, 16.5 12, 14 14 Z"
          transform="rotate(32 14 14)"
        />
        <path
          d="M 14 14 C 11.5 12, 11.5 6.5, 14 3 C 16.5 6.5, 16.5 12, 14 14 Z"
          transform="rotate(65 14 14)"
        />
        {/* Leaf-pad bowl under the petals */}
        <path d="M 4 15 Q 14 19, 24 15 Q 14 17, 4 15 Z" />
      </g>
    </svg>
  )
}
