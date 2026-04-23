'use client'

import { useState, useEffect, useRef } from 'react'
import { phaseInfo } from '@/lib/phases'

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

const CARD_LABELS = ['Meal', 'Movement', 'Energy & Mindset']

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
  const [activeIndex, setActiveIndex] = useState(0)
  const [expandedCard, setExpandedCard] = useState(null) // null or 'meal' | 'movement' | 'energy'
  const [loading, setLoading] = useState(true)
  const [isFallback, setIsFallback] = useState(false)
  const [swipeDir, setSwipeDir] = useState(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

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

  function goToCard(index) {
    if (index === activeIndex) return
    setSwipeDir(index > activeIndex ? 'left' : 'right')
    setActiveIndex(index)
    setTimeout(() => setSwipeDir(null), 400)
  }

  function nextCard() {
    if (activeIndex < 2) goToCard(activeIndex + 1)
  }

  function prevCard() {
    if (activeIndex > 0) goToCard(activeIndex - 1)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) nextCard()
      else prevCard()
    }
  }

  // Expand a card to full screen
  function expandCard(type) {
    setExpandedCard(type)
  }

  function collapseCard() {
    setExpandedCard(null)
  }

  if (loading) {
    return (
      <div className="ruhi-bg min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
          <div aria-hidden="true" className="w-12 h-12 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
          <p className="font-display text-xl text-ruhi-deep animate-pulse">Ruhi is thinking...</p>
        </div>
      </div>
    )
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

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight') nextCard()
    else if (e.key === 'ArrowLeft') prevCard()
  }

  // ── Card stack view ─────────────────────────────────────────────
  return (
    <div className="ruhi-bg min-h-screen flex flex-col px-6 py-8 max-w-md mx-auto relative z-10">
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
        <p role="status" className="text-xs text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-1.5 mb-4 self-center max-w-xs text-center">
          Showing sample cards — personalized meals need an ANTHROPIC_API_KEY in <code>.env.local</code>.
        </p>
      )}

      {/* Card stack area */}
      <div
        className="flex-1 relative"
        style={{ perspective: '1000px' }}
        role="region"
        aria-label="Daily cards"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {cardDataList.map((card, i) => {
          const offset = i - activeIndex
          const isActive = offset === 0
          const isBehind = offset > 0
          const isGone = offset < 0

          return (
            <div
              key={card.type}
              className="absolute inset-0 transition-all duration-500 ease-out"
              style={{
                transform: isActive
                  ? 'translateY(0) scale(1) rotateY(0)'
                  : isBehind
                    ? `translateY(${offset * 24}px) scale(${1 - offset * 0.05}) rotateY(0)`
                    : `translateX(${offset * 120}px) scale(0.9) rotateY(${offset * 8}deg)`,
                opacity: isGone ? 0 : isBehind ? Math.max(0.3, 1 - offset * 0.3) : 1,
                zIndex: 3 - Math.abs(offset),
                pointerEvents: isActive ? 'auto' : 'none',
                filter: isBehind ? `blur(${offset}px)` : 'none',
              }}
            >
              <div
                className={`h-full rounded-2xl border border-white/50 shadow-lg backdrop-blur-sm overflow-hidden cursor-pointer
                            ${isActive && swipeDir === 'left' ? 'cascade-enter-left' : ''}
                            ${isActive && swipeDir === 'right' ? 'cascade-enter-right' : ''}`}
                onClick={() => isActive && expandCard(card.type)}
              >
                {card.type === 'meal' && (
                  <MealCardPreview meal={card.data} />
                )}
                {card.type === 'movement' && (
                  <MovementCardPreview movement={card.data} />
                )}
                {card.type === 'energy' && (
                  <EnergyCardPreview energy={card.data} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Card indicator dots + label */}
      <div className="flex flex-col items-center mt-6 gap-2">
        <p className="text-sm text-ruhi-earth" aria-live="polite">{CARD_LABELS[activeIndex]}</p>
        <div className="flex gap-1 items-center">
          <button
            onClick={prevCard}
            disabled={activeIndex === 0}
            aria-label="Previous card"
            className={`w-11 h-11 flex items-center justify-center text-ruhi-earth text-lg transition-opacity ${activeIndex === 0 ? 'opacity-0 pointer-events-none' : 'hover:text-ruhi-deep'}`}
          >
            <span aria-hidden="true">‹</span>
          </button>
          {cardDataList.map((_, i) => (
            <button
              key={i}
              onClick={() => goToCard(i)}
              aria-label={`Go to ${CARD_LABELS[i]} card`}
              aria-current={activeIndex === i ? 'true' : undefined}
              className="w-11 h-11 flex items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`rounded-full transition-all duration-300 block
                  ${activeIndex === i
                    ? 'w-8 h-3 bg-ruhi-deep'
                    : 'w-3 h-3 bg-ruhi-earth/50 hover:bg-ruhi-earth'
                  }`}
              />
            </button>
          ))}
          <button
            onClick={nextCard}
            disabled={activeIndex === cardDataList.length - 1}
            aria-label="Next card"
            className={`w-11 h-11 flex items-center justify-center text-ruhi-earth text-lg transition-opacity ${activeIndex === cardDataList.length - 1 ? 'opacity-0 pointer-events-none' : 'hover:text-ruhi-deep'}`}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <p className="text-xs text-ruhi-earth mt-1">Tap card to open · Swipe or use arrow keys to browse</p>
      </div>
    </div>
  )
}

// ── Preview cards (shown in the stack) ──────────────────────────────

function MealCardPreview({ meal }) {
  return (
    <div className="bg-white/80 h-full p-6">
      <div aria-hidden="true" className="w-10 h-10 rounded-full bg-ruhi-rose/20 flex items-center justify-center mb-4">
        <span className="text-lg">🍽</span>
      </div>
      <h3 className="font-display text-xl text-ruhi-deep mb-1">{meal.title}</h3>
      <div className="flex gap-3 text-sm text-ruhi-earth mb-4">
        <span>{meal.cookTime}</span>
        <span aria-hidden="true">·</span>
        <span>{meal.calories}</span>
      </div>
      <p className="text-sm text-ruhi-earth">Tap to see recipe</p>
    </div>
  )
}

function MovementCardPreview({ movement }) {
  return (
    <div className="bg-white/80 h-full p-6">
      <div aria-hidden="true" className="w-10 h-10 rounded-full bg-ruhi-sage/20 flex items-center justify-center mb-4">
        <span className="text-lg">🏃‍♀️</span>
      </div>
      <h3 className="font-display text-xl text-ruhi-deep mb-1">{movement.title}</h3>
      <p className="text-sm text-ruhi-earth mb-4">{movement.duration}</p>
      <p className="text-sm text-ruhi-earth">Tap to see details</p>
    </div>
  )
}

function EnergyCardPreview({ energy }) {
  return (
    <div className="bg-white/80 h-full p-6">
      <div aria-hidden="true" className="w-10 h-10 rounded-full bg-ruhi-gold/20 flex items-center justify-center mb-4">
        <span className="text-lg">✨</span>
      </div>
      <h3 className="font-display text-xl text-ruhi-deep mb-3">{energy.title}</h3>
      <p className="text-sm text-ruhi-earth">Tap to read more</p>
    </div>
  )
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
