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
 * Bud: outlined three-peak silhouette with interior petal seams, base cup,
 *      and a small stem reaching down toward the vine.
 * Bloom: filled five-petal silhouette over a leaf-pad bowl.
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
      {/* Closed bud — three peaks at top, narrow body, base cup + stem.
          Inner <g> applies a static 0.85 scale around the icon center
          (14, 14) so the bud reads as smaller next to the bloom while
          preserving its silhouette exactly. The matrix form
          (0.85 0 0 0.85 2.1 2.1) is the math for translate(14,14) +
          scale(0.85) + translate(-14,-14). The outer .lotus-bud-group
          stays free for CSS animation transforms (state crossfade +
          breathing pulse) — they compose with the inner static one. */}
      <g
        className="lotus-bud-group"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform="matrix(0.85 0 0 0.85 2.1 2.1)">
          <path
            strokeWidth="1.4"
            d="M 7.5 9
               C 7.5 7.8, 8.6 7.2, 9.5 8
               C 10.3 8.7, 10.7 9.6, 11 10.6
               C 11.4 8.4, 12.4 5.6, 14 3.5
               C 15.6 5.6, 16.6 8.4, 17 10.6
               C 17.3 9.6, 17.7 8.7, 18.5 8
               C 19.4 7.2, 20.5 7.8, 20.5 9
               C 21.6 11.5, 21.6 15.5, 20 18
               C 18.4 20.4, 16.2 21.4, 14 21.4
               C 11.8 21.4, 9.6 20.4, 8 18
               C 6.4 15.5, 6.4 11.5, 7.5 9 Z"
          />
          <path strokeWidth="1" d="M 11 10.6 C 11.4 14, 11.4 18, 12.5 21" />
          <path strokeWidth="1" d="M 17 10.6 C 16.6 14, 16.6 18, 15.5 21" />
          <path strokeWidth="1" d="M 11.8 21.3 Q 14 22.6, 16.2 21.3" />
          <path strokeWidth="1" d="M 14 22.5 V 25" />
        </g>
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
