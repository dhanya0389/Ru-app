'use client'

import { useEffect, useState } from 'react'
import { getProfile, getPantry, savePantry } from '@/lib/storage'
import {
  getWeeklyPlan,
  saveWeeklyPlan,
  clearWeeklyPlan,
  getOptIns,
  computeWeekPhases,
} from '@/lib/weeklyPlan'
import NavMenu from '@/components/NavMenu'
import TopTabs from '@/components/TopTabs'
import VoiceInput from '@/components/VoiceInput'
import SendShoppingListSheet from '@/components/SendShoppingListSheet'

const PHASE_LABEL = {
  menstrual: '🩸 Menstrual',
  follicular: '🌱 Follicular',
  ovulatory: '☀️ Ovulatory',
  luteal: '🌕 Luteal',
  unknown: 'Unknown',
}

const PHASE_DOT_BG = {
  menstrual: 'bg-ruhi-rose',
  follicular: 'bg-ruhi-sage',
  ovulatory: 'bg-ruhi-peach',
  luteal: 'bg-ruhi-terracotta',
  unknown: 'bg-ruhi-warm',
}

const TIPS_DURING_GENERATION = [
  'Reading your cycle phase across the week...',
  'Picking dishes that match your phase shifts...',
  'Balancing protein, carbs, and fat for each meal...',
  'Subtracting what you already have in your pantry...',
  'Building your shopping list...',
  'Finalizing the week.',
]

const ENERGY_LABELS = {
  1: 'running on empty',
  2: 'taking it slow',
  3: 'steady',
  4: 'feeling good',
  5: 'fabulous',
}

/**
 * Weekly mode — Sunday-style "plan the whole week" flow.
 * States: noPlan → generating → hasPlan (with Menu | Week | Shopping tabs)
 */
// Local-time YYYY-MM-DD helper (avoids the UTC drift of toISOString)
function toLocalISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayLocalISO() {
  return toLocalISO(new Date())
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalISO(date)
}

function diffDaysISO(startISO, endISO) {
  const [sy, sm, sd] = startISO.split('-').map(Number)
  const [ey, em, ed] = endISO.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

export default function WeeklyMode({ menuOpen, setMenuOpen, onNavigate }) {
  const [plan, setPlan] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('menu')
  const [tipIndex, setTipIndex] = useState(0)
  const [profile, setProfile] = useState(null)
  const [optIns, setOptIns] = useState({ seedCycling: false })
  const [pantry, setPantry] = useState('')
  // Calendar range picker — user picks start + end. Default: today → today+6
  // (a 7-day window). Hard cap at 14 days.
  const [startDate, setStartDate] = useState(todayLocalISO())
  const [endDate, setEndDate] = useState(addDaysISO(todayLocalISO(), 6))
  // Energy at planning time (1-5) — informs dish complexity & meal heaviness.
  // Same scale as Daily Check-in. Default 3 (steady).
  const [energy, setEnergy] = useState(3)
  // When user taps a menu tile, we render an expanded recipe view in place
  // of the tab content (same pattern as CardView's full-screen expand).
  const [expandedRecipe, setExpandedRecipe] = useState(null)

  useEffect(() => {
    setProfile(getProfile())
    setOptIns(getOptIns())
    setPlan(getWeeklyPlan())
    // Pre-fill the pantry field with what was persisted from the last
    // Daily Check-in or pantry edit. Same string is shared across surfaces.
    setPantry(getPantry())
  }, [])

  // Rotate tips while generating
  useEffect(() => {
    if (!generating) return
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS_DURING_GENERATION.length)
    }, 4000)
    return () => clearInterval(id)
  }, [generating])

  async function generatePlan() {
    if (!profile?.lastPeriodStart || !profile?.cycleLength) {
      setError('I need your cycle date + length to plan the week. Open the menu and add Cycle details.')
      return
    }
    // Validate the picked range (start ≤ end, ≤ 14 days)
    const numDays = diffDaysISO(startDate, endDate) + 1
    if (numDays < 1) {
      setError('End date must be on or after start date.')
      return
    }
    if (numDays > 14) {
      setError('Pick a window of 14 days or fewer.')
      return
    }
    setGenerating(true)
    setError(null)
    setTipIndex(0)
    // Persist the pantry on submit so the next visit (here or on Daily
    // Check-in) pre-fills with the same inventory.
    savePantry(pantry)

    const cycleLengthMap = { '24–26': 25, '27–29': 28, '30–32': 31, 'It varies': 28 }
    const cycleLengthDays = cycleLengthMap[profile.cycleLength] || 28
    const weekDays = computeWeekPhases(startDate, profile.lastPeriodStart, cycleLengthDays, numDays)

    try {
      const res = await fetch('/api/generate-week', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile,
          weekDays,
          pantry,
          energy,
          supplements: profile.supplements || [],
          seedCycling: optIns.seedCycling,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || body.error || `HTTP ${res.status}`)
      }
      const newPlan = await res.json()
      saveWeeklyPlan(newPlan)
      setPlan(newPlan)
      setTab('menu')
    } catch (err) {
      console.error('Weekly plan generation failed:', err)
      setError(err.message || 'Something went wrong. Try again in a minute.')
    } finally {
      setGenerating(false)
    }
  }

  // ── No plan state ──────────────────────────────────────────
  if (!plan && !generating) {
    return (
      <div className="ruhi-bg min-h-screen flex flex-col items-center px-6 py-6 max-w-md mx-auto relative z-10">
        <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

        <TopTabs active="weekly" onSelect={onNavigate} />

        <h2 className="font-display text-2xl text-ruhi-deep mb-1 mt-4 screen-enter">Plan your week</h2>
        <p className="text-sm text-ruhi-earth mb-5 text-center max-w-xs leading-relaxed screen-enter">
          Cycle-aware meals for the days you pick.
        </p>

        {/* Single grouped form card — date range, saved pantry, energy. */}
        {/* Replaces three free-floating sections with one cohesive surface. */}
        <div className="w-full bg-white/50 border border-white/60 rounded-2xl p-5 mb-5 screen-enter space-y-5">
          {/* Date range */}
          <div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="start-date" className="block text-xs text-ruhi-earth mb-1">From</label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/70 border border-ruhi-earth/40
                             focus:border-ruhi-deep focus:outline-none text-sm text-ruhi-deep"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="end-date" className="block text-xs text-ruhi-earth mb-1">To</label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={addDaysISO(startDate, 13)}
                  className="w-full p-2.5 rounded-xl bg-white/70 border border-ruhi-earth/40
                             focus:border-ruhi-deep focus:outline-none text-sm text-ruhi-deep"
                />
              </div>
            </div>
            <p className="text-[11px] text-ruhi-earth/80 mt-1.5">
              {(() => {
                const n = diffDaysISO(startDate, endDate) + 1
                if (n < 1) return 'End date must be on or after start.'
                if (n > 14) return 'Maximum 14 days at a time.'
                return `${n} day${n === 1 ? '' : 's'} of meals`
              })()}
            </p>
          </div>

          <div className="h-px bg-ruhi-warm" aria-hidden="true" />

          {/* Saved pantry — surfaces the persisted inventory + lets the user
              jump to the editor without leaving the planning flow. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-ruhi-earth">Your pantry</label>
              <button
                type="button"
                onClick={() => onNavigate?.('pantry')}
                className="text-[11px] text-ruhi-earth/80 hover:text-ruhi-deep underline-offset-2 hover:underline"
              >
                Edit
              </button>
            </div>
            <VoiceInput
              label="What's in your kitchen"
              placeholder="e.g. salmon, lentils, spinach, eggs, sweet potato..."
              initialValue={pantry}
              onResult={(text) => setPantry(text)}
            />
          </div>

          <div className="h-px bg-ruhi-warm" aria-hidden="true" />

          {/* Energy at planning time — informs dish complexity for the week */}
          <div>
            <label htmlFor="weekly-energy" className="block text-xs text-ruhi-earth mb-1.5">
              Energy this week — <span className="font-semibold text-ruhi-deep">{ENERGY_LABELS[energy]}</span>
            </label>
            <input
              id="weekly-energy"
              type="range"
              min="1"
              max="5"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              aria-valuetext={ENERGY_LABELS[energy]}
              className="w-full accent-ruhi-deep"
            />
            <p className="text-[11px] text-ruhi-earth/80 mt-1">
              Lower = simpler recipes. Higher = room for ambition.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-2 mb-4 max-w-xs text-center">
            {error}
          </p>
        )}

        <button
          onClick={generatePlan}
          className="w-full py-4 rounded-full bg-ruhi-deep text-ruhi-cream text-lg
                     hover:bg-ruhi-earth transition-all duration-300 hover:scale-[1.02]
                     shadow-lg shadow-ruhi-deep/20"
        >
          Plan this week
        </button>

        <p className="text-xs text-ruhi-earth mt-4 text-center max-w-xs">
          This takes about 1–2 minutes. Ruhi is reading your cycle, your pantry, and your preferences to build something good.
        </p>
      </div>
    )
  }

  // ── Generating state ───────────────────────────────────────
  if (generating) {
    return (
      <div className="ruhi-bg min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
        <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div aria-hidden="true" className="w-12 h-12 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
          <p className="font-display text-xl text-ruhi-deep animate-pulse">Ruhi is planning your week...</p>
          <p key={tipIndex} className="text-sm text-ruhi-earth leading-relaxed screen-enter">
            {TIPS_DURING_GENERATION[tipIndex]}
          </p>
        </div>
      </div>
    )
  }

  // ── Expanded recipe state (modal full-screen view) ────────
  if (expandedRecipe) {
    return (
      <div className="ruhi-bg min-h-screen flex flex-col items-center px-6 py-6 max-w-md mx-auto relative z-10">
        <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />
        <RecipeView
          item={expandedRecipe}
          onBack={() => setExpandedRecipe(null)}
          onShowSources={() => onNavigate?.('sources')}
        />
      </div>
    )
  }

  // ── Has plan state ─────────────────────────────────────────
  return (
    <div className="ruhi-bg min-h-screen flex flex-col items-center px-4 py-6 max-w-md mx-auto relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

      <TopTabs active="weekly" onSelect={onNavigate} />

      {/* Header — week range + phase progression */}
      <div className="w-full mb-4">
        <p className="text-xs uppercase tracking-widest text-ruhi-earth mb-1">Planning</p>
        <h2 className="font-display text-xl text-ruhi-deep mb-3">
          {formatDate(plan.days[0].date)} – {formatDate(plan.days[plan.days.length - 1].date)}
        </h2>
        <PhaseProgression days={plan.days} />
      </div>

      {/* Phase transition callouts */}
      {plan.phaseTransitionCallouts?.length > 0 && (
        <div className="w-full mb-4 space-y-2">
          {plan.phaseTransitionCallouts.map((callout, i) => (
            <div key={i} className="bg-ruhi-warm/40 rounded-xl px-3 py-2 text-xs text-ruhi-deep">
              {callout}
            </div>
          ))}
        </div>
      )}

      {/* Seed cycling note */}
      {plan.seedCyclingNote && (
        <div className="w-full mb-4 bg-ruhi-sage/20 rounded-xl px-3 py-2 text-xs text-ruhi-deep">
          🌱 {plan.seedCyclingNote}
        </div>
      )}

      {/* Tabs */}
      <div className="w-full flex gap-1 mb-4 bg-white/40 rounded-full p-1">
        <TabButton active={tab === 'menu'} onClick={() => setTab('menu')}>Menu</TabButton>
        <TabButton active={tab === 'week'} onClick={() => setTab('week')}>Week</TabButton>
        <TabButton active={tab === 'shopping'} onClick={() => setTab('shopping')}>Shopping</TabButton>
      </div>

      {/* Tab content */}
      {tab === 'menu' && <MenuTab menu={plan.menu} onOpenRecipe={setExpandedRecipe} />}
      {tab === 'week' && <WeekTab plan={plan} onOpenRecipe={setExpandedRecipe} />}
      {tab === 'shopping' && <ShoppingTab shoppingList={plan.shoppingList || []} />}

      {/* Bottom actions */}
      <div className="w-full mt-6 flex flex-col gap-2">
        <button
          onClick={() => { clearWeeklyPlan(); setPlan(null); }}
          className="text-xs text-ruhi-earth hover:text-ruhi-deep transition-colors text-center"
        >
          Regenerate this week
        </button>
      </div>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────

function PhaseProgression({ days }) {
  return (
    <div className="flex gap-1.5">
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.dayLabel} · ${PHASE_LABEL[d.phase]} day ${d.cycleDay}`}
          className="flex-1 text-center"
        >
          <div className={`h-1.5 rounded-full ${PHASE_DOT_BG[d.phase]}`} />
          <p className="text-[10px] text-ruhi-earth mt-1">{d.dayLabel.slice(0, 1)}</p>
        </div>
      ))}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`flex-1 py-2 rounded-full text-sm transition-all duration-200
        ${active
          ? 'bg-ruhi-deep text-ruhi-cream shadow-sm'
          : 'text-ruhi-earth hover:text-ruhi-deep hover:bg-white/30'
        }`}
    >
      {children}
    </button>
  )
}

// Per-meal kcal + protein target ranges (from her Notion meal-prep template).
// Shown next to each section header so users see what each meal type "should"
// hit. Defaults work for the general product; future tier with body data
// will scale these per-user.
const MEAL_TARGETS = {
  Breakfasts: '350–420 kcal · 25–30g protein',
  Lunches: '420–500 kcal · 35–40g protein',
  Snacks: '150–220 kcal · 10–15g protein · non-negotiable in luteal/menstrual',
  Dinners: '350–430 kcal · 30–35g protein · always warm',
}

function MenuTab({ menu, onOpenRecipe }) {
  return (
    <div className="w-full space-y-5 screen-enter">
      <MenuSection title="Breakfasts" items={menu.breakfasts} onOpenRecipe={onOpenRecipe} />
      <MenuSection title="Lunches" items={menu.lunches} onOpenRecipe={onOpenRecipe} />
      <MenuSection title="Snacks" items={menu.snacks} onOpenRecipe={onOpenRecipe} />
      <MenuSection title="Dinners" items={menu.dinners} onOpenRecipe={onOpenRecipe} />
      <DrinksSection drinks={menu.drinks} />
    </div>
  )
}

function MenuSection({ title, items, onOpenRecipe }) {
  const target = MEAL_TARGETS[title]
  return (
    <section>
      <div className="mb-2 px-1">
        <h3 className="text-xs uppercase tracking-widest text-ruhi-earth">{title}</h3>
        {target && (
          <p className="text-[10px] text-ruhi-earth/70 mt-0.5">Target: {target}</p>
        )}
      </div>
      <div className="space-y-2">
        {items?.map((item) => (
          <button
            key={item.id}
            onClick={() => onOpenRecipe?.(item)}
            className="w-full text-left bg-white/70 rounded-2xl p-4 border border-white/60 shadow-sm
                       hover:bg-white/90 hover:scale-[1.01] transition-all duration-200
                       cursor-pointer focus:outline-none focus-visible:border-ruhi-deep"
            aria-label={`Open recipe for ${item.title}`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h4 className="font-display text-base text-ruhi-deep leading-tight">{item.title}</h4>
              <span className="text-xs text-ruhi-earth flex-shrink-0">{item.cookTime}</span>
            </div>
            <p className="text-xs text-ruhi-earth mb-1">{item.macros}{item.calories ? ` · ${item.calories}` : ''}</p>
            <p className="text-[10px] uppercase tracking-wide text-ruhi-earth/80">
              {item.phaseFit?.join(' · ')}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}

function RecipeView({ item, onBack, onShowSources }) {
  const visiblePractitioners = item.practitioners?.slice(0, 2).join(', ')
  const overflow =
    item.practitioners?.length > 2 ? ` +${item.practitioners.length - 2}` : ''
  return (
    <div className="w-full screen-enter">
      <button
        onClick={onBack}
        className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start"
      >
        <span aria-hidden="true">←</span> Back to menu
      </button>

      <h2 className="font-display text-2xl text-ruhi-deep mb-2">{item.title}</h2>
      <div className="flex flex-wrap gap-3 text-sm text-ruhi-earth mb-2">
        <span>{item.cookTime}</span>
        {item.calories && <><span aria-hidden="true">·</span><span>{item.calories}</span></>}
      </div>
      <p className="text-sm text-ruhi-earth mb-2">{item.macros}</p>
      {item.phaseFit?.length > 0 && (
        <p className="text-[10px] uppercase tracking-wide text-ruhi-earth/80 mb-2">
          Best for: {item.phaseFit.join(' · ')}
        </p>
      )}
      <div className="mb-6">
        {item.practitioners?.length > 0 && (
          <button
            onClick={onShowSources}
            className="text-xs text-ruhi-earth/80 hover:text-ruhi-deep transition-colors underline-offset-2 hover:underline"
          >
            Why this? — {visiblePractitioners}{overflow}
          </button>
        )}
      </div>

      <div className="bg-white/70 rounded-2xl p-5 mb-4 border border-white/60 shadow-sm">
        <h4 className="text-sm font-bold text-ruhi-deep mb-3">Ingredients</h4>
        <ul className="text-sm text-ruhi-earth space-y-1.5">
          {item.ingredients?.map((ing, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-ruhi-sage mt-0.5">·</span>
              <span>{ing}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white/70 rounded-2xl p-5 mb-6 border border-white/60 shadow-sm">
        <h4 className="text-sm font-bold text-ruhi-deep mb-3">Steps</h4>
        <ol className="text-sm text-ruhi-earth space-y-3">
          {item.steps?.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-ruhi-warm flex items-center justify-center text-xs text-ruhi-deep font-medium">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function DrinksSection({ drinks }) {
  if (!drinks?.length) return null
  const grouped = { morning: [], afternoon: [], evening: [] }
  drinks.forEach((d) => grouped[d.timeOfDay]?.push(d))

  return (
    <section>
      <h3 className="text-xs uppercase tracking-widest text-ruhi-earth mb-2 px-1">Drinks</h3>
      <div className="space-y-3">
        {['morning', 'afternoon', 'evening'].map((timeOfDay) => (
          grouped[timeOfDay].length > 0 && (
            <div key={timeOfDay} className="bg-white/50 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wide text-ruhi-earth mb-2">{timeOfDay}</p>
              <div className="space-y-1.5">
                {grouped[timeOfDay].map((d, i) => (
                  <div key={i} className="text-sm text-ruhi-deep">
                    <span className="font-medium">{d.title}</span>
                    <span className="text-xs text-ruhi-earth"> — {d.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </section>
  )
}

function WeekTab({ plan, onOpenRecipe }) {
  // Build a lookup from id → menu item for fast assignment rendering
  const itemById = {}
  ;['breakfasts', 'lunches', 'snacks', 'dinners'].forEach((cat) => {
    plan.menu[cat]?.forEach((it) => { itemById[it.id] = it })
  })

  return (
    <div className="w-full space-y-3 screen-enter">
      {plan.days.map((day) => {
        const assignment = plan.assignments?.find((a) => a.date === day.date)
        const meals = assignment ? [
          { label: 'B', item: itemById[assignment.breakfastId] },
          { label: 'L', item: itemById[assignment.lunchId] },
          assignment.snackId && { label: 'S', item: itemById[assignment.snackId] },
          { label: 'D', item: itemById[assignment.dinnerId] },
        ].filter(Boolean) : []
        const totals = sumDailyMacros(meals.map(m => m.item))
        return (
          <div key={day.date} className="bg-white/70 rounded-2xl p-4 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-display text-lg text-ruhi-deep">{day.dayLabel}</p>
                <p className="text-xs text-ruhi-earth">{formatDate(day.date)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${PHASE_DOT_BG[day.phase]}`} />
                <span className="text-xs text-ruhi-earth">{PHASE_LABEL[day.phase]} · day {day.cycleDay}</span>
              </div>
            </div>
            {assignment && (
              <div className="space-y-1 text-sm">
                {meals.map(({ label, item }) => (
                  <DayMeal key={label} label={label} item={item} onOpenRecipe={onOpenRecipe} />
                ))}
              </div>
            )}
            {totals && (
              <div className="mt-3 pt-2 border-t border-ruhi-earth/10 flex justify-between text-[11px] text-ruhi-earth">
                <span>Daily total</span>
                <span>
                  ~{totals.calories} cal · <strong className="text-ruhi-deep">{totals.protein}g protein</strong>{totals.carbs > 0 ? ` · ${totals.carbs}g carbs` : ''}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayMeal({ label, item, onOpenRecipe }) {
  if (!item) return null
  return (
    <button
      onClick={() => onOpenRecipe?.(item)}
      className="flex items-baseline gap-2 w-full text-left rounded px-1 py-0.5
                 hover:bg-white/60 transition-colors"
      aria-label={`Open recipe for ${item.title}`}
    >
      <span className="w-5 flex-shrink-0 text-[10px] uppercase tracking-wide text-ruhi-earth">{label}</span>
      <span className="text-ruhi-deep flex-1">{item.title}</span>
    </button>
  )
}

// Parse free-text macros / calories strings from a menu item and sum them
// across the day's assigned meals. Returns null if no items contribute.
function sumDailyMacros(items) {
  let p = 0, c = 0, f = 0, cal = 0, found = false
  for (const it of items) {
    if (!it) continue
    const macros = it.macros || ''
    const calStr = it.calories || ''
    const pm = macros.match(/(\d+)\s*g\s*protein/i)
    const cm = macros.match(/(\d+)\s*g\s*carbs/i)
    const fm = macros.match(/(\d+)\s*g\s*fat/i)
    const calm = calStr.match(/~?\s*(\d+)/)
    if (pm || cm || fm || calm) found = true
    if (pm) p += parseInt(pm[1], 10)
    if (cm) c += parseInt(cm[1], 10)
    if (fm) f += parseInt(fm[1], 10)
    if (calm) cal += parseInt(calm[1], 10)
  }
  if (!found) return null
  return { protein: p, carbs: c, fat: f, calories: cal }
}

function ShoppingTab({ shoppingList }) {
  // Items default to checked if not already in pantry, unchecked if user has them.
  // Stable index-based keys since shopping items don't have unique IDs.
  const initialChecked = shoppingList.map((it) => !it.inPantry)
  const [checked, setChecked] = useState(initialChecked)
  // 1x default, 2x or 3x to scale shopping quantities for multiple servings/people
  const [multiplier, setMultiplier] = useState(1)
  // "Send to..." chooser sheet visibility
  const [sheetOpen, setSheetOpen] = useState(false)

  // Re-sync checked state if the shopping list itself changes (e.g. regenerate)
  useEffect(() => {
    setChecked(shoppingList.map((it) => !it.inPantry))
  }, [shoppingList])

  function toggleItem(idx) {
    setChecked((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      return next
    })
  }

  function selectAll() {
    setChecked(shoppingList.map(() => true))
  }
  function deselectAll() {
    setChecked(shoppingList.map(() => false))
  }

  // Selected items, formatted with scaled quantities, ready for the sheet.
  const sheetItems = shoppingList
    .filter((_, idx) => checked[idx])
    .map((it) => `${scaleQuantity(it.quantity, multiplier)} ${it.name}`.trim())

  const grouped = {}
  shoppingList.forEach((it, idx) => {
    const cat = it.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ item: it, idx })
  })
  const categoryOrder = ['produce', 'protein', 'dairy', 'pantry', 'frozen', 'other']

  const checkedCount = checked.filter(Boolean).length

  return (
    <div className="w-full space-y-4 screen-enter">
      {/* Header — counts + select all/none */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-ruhi-earth">
          <strong className="text-ruhi-deep">{checkedCount}</strong> of {shoppingList.length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-ruhi-earth hover:text-ruhi-deep underline underline-offset-2"
          >Select all</button>
          <span className="text-ruhi-earth/40">·</span>
          <button
            onClick={deselectAll}
            className="text-ruhi-earth hover:text-ruhi-deep underline underline-offset-2"
          >Deselect all</button>
        </div>
      </div>

      {/* 1x / 2x / 3x serving multiplier — segmented pill, theme-aware colors */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ruhi-earth">Servings</span>
        <div role="radiogroup" aria-label="Servings multiplier" className="inline-flex rounded-full p-0.5 bg-white/50 border border-ruhi-earth/20">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={multiplier === n}
              onClick={() => setMultiplier(n)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all duration-150
                ${multiplier === n
                  ? 'bg-ruhi-deep text-ruhi-cream shadow-sm'
                  : 'text-ruhi-earth hover:text-ruhi-deep'}`}
            >
              {n}x
            </button>
          ))}
        </div>
      </div>

      {/* Categorized list with checkboxes */}
      {categoryOrder.map((cat) => (
        grouped[cat]?.length > 0 && (
          <section key={cat}>
            <h3 className="text-xs uppercase tracking-widest text-ruhi-earth mb-2 px-1">{cat}</h3>
            <div className="bg-white/70 rounded-2xl p-2 border border-white/60 shadow-sm">
              {grouped[cat].map(({ item, idx }) => (
                <label
                  key={idx}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer
                    hover:bg-white/60 transition-colors
                    ${checked[idx] ? 'text-ruhi-deep' : 'text-ruhi-earth/50'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked[idx]}
                    onChange={() => toggleItem(idx)}
                    className="w-4 h-4 accent-ruhi-deep flex-shrink-0"
                    aria-label={`${item.name}, ${scaleQuantity(item.quantity, multiplier)}`}
                  />
                  <span className="flex-1 text-sm">{item.name}</span>
                  <span className="text-xs">{scaleQuantity(item.quantity, multiplier)}</span>
                </label>
              ))}
            </div>
          </section>
        )
      ))}

      <button
        onClick={() => setSheetOpen(true)}
        disabled={checkedCount === 0}
        className={`w-full py-3 rounded-full text-sm transition-all flex items-center justify-center gap-2
          ${checkedCount === 0
            ? 'bg-ruhi-earth/30 text-ruhi-earth cursor-not-allowed'
            : 'bg-ruhi-deep text-ruhi-cream hover:bg-ruhi-earth shadow-md hover:shadow-lg'}`}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
        Send {checkedCount} item{checkedCount === 1 ? '' : 's'} to grocery
      </button>
      <p className="text-[10px] text-ruhi-earth text-center -mt-1">
        Pick your grocery service — Instacart, Walmart, Amazon Fresh, Kroger, and more.
      </p>

      <SendShoppingListSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        items={sheetItems}
      />
    </div>
  )
}

// Multiply a free-text quantity by N. Handles common formats:
//   "500g" → "1500g" (or "1.5kg" if it crosses a threshold)
//   "4 medium" → "8 medium" / "12 medium"
//   "1 cup" → "2 cups" / "3 cups"
//   "1 small jar" → "2 small jars" / "3 small jars"
//   "Pinch" → "Pinch" (no quantity, leave as-is)
function scaleQuantity(qty, n) {
  if (!qty || n === 1) return qty
  const s = String(qty).trim()
  // Find the leading number (with optional fraction or decimal)
  const m = s.match(/^([\d./]+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(.*)$/)
  if (!m) return qty
  const value = parseQty(m[1])
  if (value == null || value === 0) return qty
  const rest = m[2].trim()
  let scaled = value * n

  // Smart unit threshold: g → kg when ≥ 1000, ml → L when ≥ 1000
  let unit = rest
  if (/^g\b/i.test(rest) && scaled >= 1000) {
    scaled = scaled / 1000
    unit = rest.replace(/^g\b/i, 'kg')
  } else if (/^ml\b/i.test(rest) && scaled >= 1000) {
    scaled = scaled / 1000
    unit = rest.replace(/^ml\b/i, 'L')
  }

  // Format the scaled number — strip .0 endings, max 1 decimal
  const formatted = Math.round(scaled * 10) / 10
  const numStr = Number.isInteger(formatted) ? String(formatted) : String(formatted)

  // Pluralize trailing noun if scaled > 1 and unit ends in a singular word
  const pluralized = pluralizeIfNeeded(unit, scaled)
  return pluralized ? `${numStr} ${pluralized}` : numStr
}

function parseQty(str) {
  const unicodeFractions = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }
  if (unicodeFractions[str]) return unicodeFractions[str]
  const fr = str.match(/^(\d+)\/(\d+)$/)
  if (fr) return parseInt(fr[1]) / parseInt(fr[2])
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

function pluralizeIfNeeded(unit, count) {
  if (!unit || count <= 1) return unit
  // Words that already end in 's' or are uncountable — leave alone
  if (/(?:s|ss)$/i.test(unit)) return unit
  // Skip pluralizing weight/volume units (kg, g, ml, L, oz, lb, cup, tsp, tbsp)
  if (/^(g|kg|ml|l|oz|lb|tsp|tbsp)\b/i.test(unit)) return unit
  // Common nouns to pluralize: tomato → tomatoes, jar → jars, knob → knobs
  if (/o$/i.test(unit)) return unit + 'es'
  if (/y$/i.test(unit)) return unit.slice(0, -1) + 'ies'
  return unit + 's'
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
