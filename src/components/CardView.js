'use client'

import { useState, useEffect } from 'react'
import { phaseInfo } from '@/lib/phases'

// Rotating tidbits shown while the API call is in flight. Phase-aware so
// luteal users get luteal-flavored notes, etc. The first item is always the
// phase's mindset (most relevant); the rest are general embodied-cycle tips.
const GENERAL_TIPS = [
  'Vegetables first, protein and fat second, carbs last — your blood sugar will thank you.',
  'Pair fruit with protein or fat. Skip the fruit-only snack.',
  'Sweet potato deserves to be steamed, not roasted.',
  'Turmeric works best with a pinch of black pepper.',
  'Magnesium-rich foods (dark leafy greens, pumpkin seeds) ease luteal-phase tension.',
  'Fermented foods help the gut work better — even a spoonful counts.',
  'Hydrate before caffeine. The slump is often dehydration in disguise.',
]

function tipsForPhase(phase) {
  const phaseTip = phase ? phaseInfo[phase.name]?.mindset : null
  return phaseTip ? [phaseTip, ...GENERAL_TIPS] : GENERAL_TIPS
}

// ── Fallback data (used when API key not connected) ─────────────────

const FALLBACK_MEALS = [
  {
    title: 'Spiced Chickpea Bowl',
    cookTime: '20 min',
    calories: '~480 cal',
    macros: '28g protein · 52g carbs · 18g fat',
    ingredients: ['chickpeas', 'spinach', 'sweet potato', 'tahini', 'lemon', 'cumin', 'chili flakes'],
    steps: [
      'Steam or microwave sweet potato until tender (8 min).',
      'Warm chickpeas in a pan with cumin, turmeric, and chili flakes.',
      'Wilt spinach into the chickpeas.',
      'Assemble bowl: sweet potato base, chickpea-spinach mix on top.',
      'Drizzle tahini + lemon. Finish with chili flakes.',
    ],
  },
  {
    title: 'Lemon Garlic Salmon with Greens',
    cookTime: '18 min',
    calories: '~520 cal',
    macros: '38g protein · 22g carbs · 28g fat',
    ingredients: ['salmon fillet', 'kale', 'garlic', 'lemon', 'olive oil', 'quinoa'],
    steps: [
      'Cook quinoa according to package (or use pre-cooked).',
      'Pan-sear salmon in olive oil, 4 min each side.',
      'Sauté garlic and kale in the same pan until wilted.',
      'Plate: quinoa base, salmon on top, greens on the side.',
      'Squeeze lemon over everything.',
    ],
  },
  {
    title: 'Thai Coconut Curry',
    cookTime: '25 min',
    calories: '~460 cal',
    macros: '24g protein · 38g carbs · 22g fat',
    ingredients: ['coconut milk', 'tofu or chicken', 'bell pepper', 'basil', 'curry paste', 'rice'],
    steps: [
      'Start rice in a pot or rice cooker.',
      'Sauté curry paste in a pan for 1 min.',
      'Add coconut milk, bring to a simmer.',
      'Add protein and bell pepper, cook 8-10 min.',
      'Serve over rice, top with fresh basil.',
    ],
  },
  {
    title: 'Mediterranean Egg Scramble',
    cookTime: '12 min',
    calories: '~420 cal',
    macros: '26g protein · 30g carbs · 24g fat',
    ingredients: ['eggs', 'cherry tomatoes', 'feta', 'spinach', 'olive oil', 'sourdough'],
    steps: [
      'Toast sourdough.',
      'Sauté cherry tomatoes in olive oil until they burst.',
      'Add spinach, wilt quickly.',
      'Push to the side, scramble eggs in the same pan.',
      'Plate with crumbled feta on top.',
    ],
  },
]

const FALLBACK_MOVEMENT = {
  title: 'Evening Walk + Stretch',
  duration: '25 min',
  description: 'A gentle walk followed by 10 minutes of stretching. Focus on hip openers and shoulder release. Start with 5 minutes of easy walking to warm up, then transition into stretches — pigeon pose, figure-four stretch, seated forward fold, and a gentle spinal twist on each side. Finish with 2 minutes of standing shoulder rolls and neck circles.',
}

const FALLBACK_ENERGY = {
  title: 'Steady Mode',
  description: 'You have enough in the tank to finish one meaningful thing. Pick the smallest version of what matters most and do just that. This isn\'t the night for a new project or a big reorganization. It\'s a night for closing one loop — replying to that message, finishing that last section, or making tomorrow\'s plan.',
  tip: 'Put your phone in another room for the next 30 minutes. See what your mind does with the quiet.',
}

// Minutes the user "has" for each cooking mood — used to pick a fallback meal that fits.
const COOKING_MOOD_MINUTES = { quick: 15, medium: 30, therapy: 45 }

function pickFallbackMeal(cookingMood, excludeTitle) {
  const limit = COOKING_MOOD_MINUTES[cookingMood] ?? 30
  const parse = (m) => parseInt(m.cookTime, 10) || 0
  // Meals that fit within the user's time budget, ordered by longest first (most interesting).
  const eligible = FALLBACK_MEALS
    .filter(m => parse(m) <= limit && m.title !== excludeTitle)
    .sort((a, b) => parse(b) - parse(a))
  if (eligible.length > 0) return eligible[0]
  // No meal fits — pick the shortest one that isn't excluded.
  const byShort = [...FALLBACK_MEALS].filter(m => m.title !== excludeTitle).sort((a, b) => parse(a) - parse(b))
  return byShort[0] || FALLBACK_MEALS[0]
}

// ── Main component ──────────────────────────────────────────────────

export default function CardView({ profile, phase, energy, cookingMood, kitchen, onBack }) {
  const [cards, setCards] = useState(null)
  const [expandedCard, setExpandedCard] = useState(null) // null or 'meal' | 'movement' | 'energy'
  const [loading, setLoading] = useState(true)
  const [isFallback, setIsFallback] = useState(false)

  useEffect(() => {
    generateCards()
  }, [])

  async function generateCards() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, phase, energy, cookingMood, kitchen }),
      })
      if (!res.ok) throw new Error('API failed')
      const data = await res.json()
      setCards(data)
      setIsFallback(false)
    } catch (err) {
      console.warn('Using fallback cards:', err)
      setCards({
        meal: pickFallbackMeal(cookingMood),
        movement: FALLBACK_MOVEMENT,
        energy: FALLBACK_ENERGY,
      })
      setIsFallback(true)
    }
    setLoading(false)
  }

  async function surpriseMe() {
    setExpandedCard(null)
    setLoading(true)
    try {
      const res = await fetch('/api/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile, phase, energy, cookingMood, kitchen,
          excludeMeal: cards?.meal?.title,
        }),
      })
      if (!res.ok) throw new Error('API failed')
      const data = await res.json()
      setCards(data)
      setIsFallback(false)
    } catch (err) {
      setCards(prev => ({ ...prev, meal: pickFallbackMeal(cookingMood, cards?.meal?.title) }))
      setIsFallback(true)
    }
    setLoading(false)
  }

  // Expand a card to full screen
  function expandCard(type) {
    setExpandedCard(type)
  }

  function collapseCard() {
    setExpandedCard(null)
  }

  if (loading) {
    return <LoadingState phase={phase} />
  }

  const cardDataList = [
    cards?.meal ? { type: 'meal', data: cards.meal } : null,
    cards?.movement ? { type: 'movement', data: cards.movement } : null,
    cards?.energy ? { type: 'energy', data: cards.energy } : null,
  ].filter(Boolean)

  // ── Full-screen expanded card overlay ───────────────────────────
  if (expandedCard) {
    return (
      <div className="fixed inset-0 z-50 bg-ruhi-cream fullscreen-card-enter" role="dialog" aria-modal="true">
        <div className="h-full overflow-y-auto">
          <div className="max-w-md mx-auto px-6 py-8">
            {/* Close button */}
            <button
              onClick={collapseCard}
              className="mb-6 text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors flex items-center gap-1"
            >
              <span aria-hidden="true">←</span> Back to cards
            </button>

            {expandedCard === 'meal' && cards?.meal && (
              <ExpandedMealCard meal={cards.meal} onSurprise={surpriseMe} />
            )}
            {expandedCard === 'movement' && cards?.movement && (
              <ExpandedMovementCard movement={cards.movement} />
            )}
            {expandedCard === 'energy' && cards?.energy && (
              <ExpandedEnergyCard energy={cards.energy} />
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Three-card view (all visible, each tappable to expand) ──────
  return (
    <div className="ruhi-bg min-h-screen flex flex-col px-6 py-6 max-w-md mx-auto relative z-10">
      {/* Header */}
      <button onClick={onBack} className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start">
        <span aria-hidden="true">←</span> Adjust check-in
      </button>

      {phase && (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ruhi-warm/60 text-sm text-ruhi-earth mb-2 self-center">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ruhi-sage" />
          {phase.name} · Day {phase.day}
        </div>
      )}

      {isFallback && (
        <p role="status" className="text-xs text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-1.5 mb-3 self-center max-w-xs text-center">
          Showing sample cards — personalized meals need an ANTHROPIC_API_KEY in <code>.env.local</code>.
        </p>
      )}

      {/* Three-card column — all visible at once. Tap any to expand. */}
      <section
        role="region"
        aria-label="Tonight's cards"
        className="flex-1 flex flex-col gap-4 mt-2"
      >
        {cardDataList.map((card) => {
          const cardLabel = ['meal','movement','energy'].includes(card.type)
            ? `${card.type} card`
            : 'card'
          return (
            <button
              key={card.type}
              type="button"
              aria-label={`Open ${cardLabel}`}
              onClick={() => expandCard(card.type)}
              className="screen-enter block w-full text-left rounded-2xl border border-white/60 shadow-md
                         backdrop-blur-sm overflow-hidden bg-white/70
                         transition-all duration-300 hover:scale-[1.015] hover:shadow-lg
                         focus:outline-none"
            >
              {card.type === 'meal' && <MealCardPreview meal={card.data} />}
              {card.type === 'movement' && <MovementCardPreview movement={card.data} />}
              {card.type === 'energy' && <EnergyCardPreview energy={card.data} />}
            </button>
          )
        })}
      </section>

      <p className="text-xs text-ruhi-earth mt-4 text-center">
        Tap a card to open it
      </p>
    </div>
  )
}

// ── Loading state with rotating tips ────────────────────────────────

function LoadingState({ phase }) {
  const tips = tipsForPhase(phase)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex(i => (i + 1) % tips.length)
    }, 5500)
    return () => clearInterval(id)
  }, [tips.length])

  return (
    <div className="ruhi-bg min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-6 max-w-sm text-center">
        <div aria-hidden="true" className="w-12 h-12 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
        <p className="font-display text-xl text-ruhi-deep animate-pulse">Ruhi is thinking...</p>
        <p
          key={tipIndex}
          className="text-sm text-ruhi-earth leading-relaxed screen-enter"
        >
          {tips[tipIndex]}
        </p>
      </div>
    </div>
  )
}

// ── Preview cards (face-down style — category prominent, title peek) ────

function FaceDownCard({ category, accentBg, title }) {
  return (
    <div className="px-6 py-7 flex flex-col items-center text-center">
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${accentBg} mb-3`} />
      <p className="text-xs tracking-[0.2em] uppercase text-ruhi-earth mb-2">
        {category}
      </p>
      <h3 className="font-display text-xl text-ruhi-deep leading-snug max-w-xs">
        {title}
      </h3>
    </div>
  )
}

function MealCardPreview({ meal }) {
  return <FaceDownCard category="Meal" accentBg="bg-ruhi-rose" title={meal.title} />
}

function MovementCardPreview({ movement }) {
  return <FaceDownCard category="Movement" accentBg="bg-ruhi-sage" title={movement.title} />
}

function EnergyCardPreview({ energy }) {
  return <FaceDownCard category="Energy & Mindset" accentBg="bg-ruhi-gold" title={energy.title} />
}

// ── Expanded cards (full screen) ────────────────────────────────────

function ExpandedMealCard({ meal, onSurprise }) {
  return (
    <div className="screen-enter">
      <div aria-hidden="true" className="w-12 h-12 rounded-full bg-ruhi-rose/20 flex items-center justify-center mb-5">
        <span className="text-xl">🍽</span>
      </div>
      <h2 className="font-display text-2xl text-ruhi-deep mb-2">{meal.title}</h2>
      <div className="flex gap-3 text-sm text-ruhi-earth mb-2">
        <span>{meal.cookTime}</span>
        <span aria-hidden="true">·</span>
        <span>{meal.calories}</span>
      </div>
      <p className="text-sm text-ruhi-earth mb-6">{meal.macros}</p>

      <div className="bg-white/70 rounded-2xl p-5 mb-4">
        <h4 className="text-sm font-bold text-ruhi-deep mb-3">Ingredients</h4>
        <ul className="text-sm text-ruhi-earth space-y-1.5">
          {meal.ingredients?.map((ing, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-ruhi-sage mt-0.5">·</span>
              <span>{ing}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white/70 rounded-2xl p-5 mb-6">
        <h4 className="text-sm font-bold text-ruhi-deep mb-3">Steps</h4>
        <ol className="text-sm text-ruhi-earth space-y-3">
          {meal.steps?.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-ruhi-warm flex items-center justify-center text-xs text-ruhi-deep font-medium">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <button
        onClick={onSurprise}
        className="w-full py-3 rounded-full bg-ruhi-gold text-ruhi-deep text-sm
                   hover:bg-ruhi-earth hover:text-ruhi-cream transition-all shadow-sm hover:shadow-md"
      >
        Surprise me — different meal
      </button>
    </div>
  )
}

function ExpandedMovementCard({ movement }) {
  return (
    <div className="screen-enter">
      <div aria-hidden="true" className="w-12 h-12 rounded-full bg-ruhi-sage/20 flex items-center justify-center mb-5">
        <span className="text-xl">🏃‍♀️</span>
      </div>
      <h2 className="font-display text-2xl text-ruhi-deep mb-2">{movement.title}</h2>
      <p className="text-sm text-ruhi-earth mb-6">{movement.duration}</p>

      <div className="bg-white/70 rounded-2xl p-5">
        <p className="text-ruhi-deep leading-relaxed">{movement.description}</p>
      </div>
    </div>
  )
}

function ExpandedEnergyCard({ energy }) {
  return (
    <div className="screen-enter">
      <div aria-hidden="true" className="w-12 h-12 rounded-full bg-ruhi-gold/20 flex items-center justify-center mb-5">
        <span className="text-xl">✨</span>
      </div>
      <h2 className="font-display text-2xl text-ruhi-deep mb-4">{energy.title}</h2>

      <div className="bg-white/70 rounded-2xl p-5 mb-4">
        <p className="text-ruhi-deep leading-relaxed">{energy.description}</p>
      </div>

      <div className="bg-ruhi-warm/40 rounded-2xl p-5 border border-ruhi-warm">
        <p className="text-sm font-medium text-ruhi-deep mb-1">Tonight's tip</p>
        <p className="text-sm text-ruhi-deep italic">{energy.tip}</p>
      </div>
    </div>
  )
}
