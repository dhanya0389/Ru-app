// Weekly plan data model + storage helpers.
//
// A WeeklyPlan covers 7 days. Generation uses Pelz's framing internally
// (Ketobiotic days 1–13, Hormone Feasting days 14–28) to drive macro
// distribution, but USER-FACING content never names practitioners.

/**
 * @typedef {'menstrual'|'follicular'|'ovulatory'|'luteal'|'unknown'} PhaseName
 * @typedef {'ketobiotic'|'feasting'} EatingMode
 *   ketobiotic: lower carb, higher fat+protein (cycle days 1–13)
 *   feasting:   higher carb (complex), more variety (days 14–28)
 *
 * @typedef {Object} DayPhase
 * @property {string} date           ISO date (YYYY-MM-DD)
 * @property {string} dayLabel       'Mon', 'Tue', etc.
 * @property {PhaseName} phase
 * @property {number} cycleDay       1-based cycle day for that date
 * @property {EatingMode} mode
 *
 * @typedef {Object} MenuItem
 * @property {string} id
 * @property {string} title
 * @property {string} cookTime
 * @property {string} calories
 * @property {string} macros          'Xg protein · Xg carbs · Xg fat'
 * @property {string[]} ingredients
 * @property {string[]} steps
 * @property {PhaseName[]} phaseFit   which phases this dish suits
 * @property {EatingMode} mode
 * @property {string} imageQuery
 *
 * @typedef {Object} DrinkItem
 * @property {string} title
 * @property {'morning'|'afternoon'|'evening'} timeOfDay
 * @property {PhaseName[]} phaseFit
 * @property {string} reason          short, time-of-day rationale
 *
 * @typedef {Object} DayAssignment
 * @property {string} date
 * @property {string} breakfastId
 * @property {string} lunchId
 * @property {string|null} snackId    null if optional + skipped
 * @property {string} dinnerId
 *
 * @typedef {Object} ShoppingItem
 * @property {string} name
 * @property {string} quantity        free text, e.g. '2 lbs', '1 bunch'
 * @property {string} category        'produce'|'protein'|'pantry'|'dairy'|'frozen'|'other'
 * @property {boolean} inPantry       true if user already has it
 *
 * @typedef {Object} WeeklyPlan
 * @property {string} weekOf          ISO date of week start (Mon)
 * @property {DayPhase[]} days        7 entries
 * @property {Object} menu
 * @property {MenuItem[]} menu.breakfasts   ~3
 * @property {MenuItem[]} menu.lunches      ~4
 * @property {MenuItem[]} menu.snacks       ~3
 * @property {MenuItem[]} menu.dinners      ~4
 * @property {DrinkItem[]} menu.drinks      ~6-9 across morning/afternoon/evening
 * @property {DayAssignment[]} assignments  7 entries — auto-assigned, swappable
 * @property {ShoppingItem[]} shoppingList
 * @property {string[]} phaseTransitionCallouts  e.g., ['Thu — luteal → menstrual: shifting to iron-rich, warming meals']
 * @property {string|null} seedCyclingNote        e.g., 'Make Phase 2 ball on Wed (Day 15)' or null if user opted out
 * @property {string} generatedAt     ISO datetime
 */

const STORAGE_KEY_PLAN = 'ruhi_weekly_plan'
const STORAGE_KEY_OPTINS = 'ruhi_optins'

/**
 * Storage helpers for the current weekly plan.
 * One plan at a time — overwriting is the expected behavior on regeneration.
 */
export function getWeeklyPlan() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY_PLAN)
  return raw ? JSON.parse(raw) : null
}

export function saveWeeklyPlan(/** @type {WeeklyPlan} */ plan) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan))
}

export function clearWeeklyPlan() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY_PLAN)
}

/**
 * Opt-ins:
 *   seedCycling:    boolean — surface phase-ball reminders
 *   bodyDataTier:   boolean — user has DEXA / RMR / personalized targets
 *   weeklyMode:     boolean — default to weekly view on app open
 */
export function getOptIns() {
  if (typeof window === 'undefined') return { seedCycling: false, bodyDataTier: false, weeklyMode: false }
  const raw = localStorage.getItem(STORAGE_KEY_OPTINS)
  return raw ? JSON.parse(raw) : { seedCycling: false, bodyDataTier: false, weeklyMode: false }
}

export function saveOptIns(optIns) {
  if (typeof window === 'undefined') return
  const merged = { ...getOptIns(), ...optIns }
  localStorage.setItem(STORAGE_KEY_OPTINS, JSON.stringify(merged))
  return merged
}

/**
 * Compute the phases for each day of the planning week.
 * Mirrors the logic in lib/phases.js but per-day across a 7-day window.
 *
 * @param {string} weekStartISO  ISO date for Monday of the planning week
 * @param {string} lastPeriodStartISO
 * @param {number} cycleLengthDays  e.g. 28
 * @returns {DayPhase[]}
 */
export function computeWeekPhases(weekStartISO, lastPeriodStartISO, cycleLengthDays = 28) {
  const days = []
  // Parse both ISO strings as LOCAL midnight (not UTC) — see lib/phases.js
  // for the same fix in getCurrentPhase. Without this, timezone offsets
  // shift the cycle-day calculation by one day in evening/late hours.
  const [sy, sm, sd] = weekStartISO.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const [py, pm, pd] = lastPeriodStartISO.split('-').map(Number)
  const lastPeriod = new Date(py, pm - 1, pd)
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const diffDays = Math.floor((d - lastPeriod) / (1000 * 60 * 60 * 24))
    const cycleDay = ((diffDays % cycleLengthDays) + cycleLengthDays) % cycleLengthDays + 1

    let phase = 'menstrual'
    if (cycleDay <= 5) phase = 'menstrual'
    else if (cycleDay <= 13) phase = 'follicular'
    else if (cycleDay <= 16) phase = 'ovulatory'
    else phase = 'luteal'

    const mode = cycleDay <= 13 ? 'ketobiotic' : 'feasting'

    days.push({
      date: d.toISOString().slice(0, 10),
      dayLabel: dayLabels[i],
      phase,
      cycleDay,
      mode,
    })
  }
  return days
}
