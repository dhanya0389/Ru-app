// Macro validator — pure functions that score a single dish against
// phase + diet aware targets. Used server-side after USDA recomputes
// macros from the AI-listed ingredient grams. Dishes that fail are sent
// back to the AI (Haiku) for a single targeted retry.
//
// The bug being closed:
//   AI generates "200g salmon + 1 whole avocado + 2 eggs + sourdough"
//   USDA correctly computes ~950 kcal for that combo
//   The user sees a 950 kcal "morning bowl" — way over Ruhi's 350-420
//   kcal breakfast target. The macros are RIGHT; the meal is OVER BUDGET.
//
// The fix path:
//   Prompt-only tightening got us from 0/14 strict-pass → 8/14, but the
//   remaining 6 dishes free-styled past the cap. This validator + retry
//   loop closes the gap by enforcing the math after generation, not just
//   asking the AI nicely.

// Per-meal kcal + protein RANGES — match WeeklyMode.MEAL_TARGETS exactly.
// These are Dhanya's Notion meal-prep template targets, not invented.
const MEAL_TARGETS = {
  breakfasts: { kcal: [350, 420] },
  lunches:    { kcal: [420, 500] },
  snacks:     { kcal: [150, 220] },
  dinners:    { kcal: [350, 430] },
  // 'meal' = the single meal card on Daily Check-in. Treated as dinner.
  meal:       { kcal: [350, 430] },
}

// Phase + diet aware protein floors (and ceilings — protein well over the
// upper bound usually means oversized animal-protein portions which also
// blow the calorie cap). The vegan/vegetarian floors are deliberately
// relaxed because hitting 30g+ from plants alone forces 600+ kcal meals.
function proteinTargetFor(diet, phaseName, mealType) {
  const phase = String(phaseName || '').toLowerCase()
  const isHigh = phase === 'luteal' || phase === 'menstrual'
  // Snacks are smaller-targets across the board
  if (mealType === 'snacks') return [10, 15]

  const d = String(diet || 'everything').toLowerCase()
  if (d === 'vegan') return isHigh ? [22, 28] : [18, 24]
  if (d === 'vegetarian') return isHigh ? [27, 33] : [22, 28]
  // pescatarian + everything: same — both have animal protein available
  // For lunches the floor is higher (35-40g); use that when mealType is lunch
  if (mealType === 'lunches') return isHigh ? [38, 42] : [35, 40]
  // Breakfasts: smaller protein target than lunch/dinner
  if (mealType === 'breakfasts') return [25, 30]
  // Dinners + the daily 'meal' card
  return isHigh ? [30, 35] : [28, 33]
}

// Carb cap — driven by user's carbStrictness setting (gentle vs standard)
// and current cycle phase. Gentle mode allows complex carbs at every meal;
// standard mode is phase-aware (low days 1-13, higher days 14-28).
function carbCapFor(carbStrictness, phaseName, mealType) {
  if (mealType === 'snacks') return 25
  const strict = String(carbStrictness || 'gentle').toLowerCase()
  if (strict === 'gentle') return 50  // ~30-40g target with some headroom
  // standard mode = phase aware
  const phase = String(phaseName || '').toLowerCase()
  const lowCarbPhase = phase === 'menstrual' || phase === 'follicular'
  return lowCarbPhase ? 30 : 50
}

// Fat ranges are fuzzy — only flag when wildly off. We don't want fat to be
// the reason a dish gets retried since the calorie cap already constrains it.
function fatRangeFor(mealType) {
  if (mealType === 'snacks') return [3, 18]
  return [8, 28]
}

// Parse a macros string ("28g protein · 38g carbs · 12g fat") into numbers.
// Returns { protein, carbs, fat } with NaN for missing fields.
function parseMacros(macrosStr) {
  const s = String(macrosStr || '')
  const m = (re) => {
    const match = s.match(re)
    return match ? parseInt(match[1], 10) : NaN
  }
  return {
    protein: m(/(\d+)\s*g\s*protein/i),
    carbs:   m(/(\d+)\s*g\s*carbs/i),
    fat:     m(/(\d+)\s*g\s*fat/i),
  }
}

function parseCalories(calStr) {
  const m = String(calStr || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : NaN
}

/**
 * Validate a single dish against meal-type + phase + diet aware targets.
 *
 * @param {object} dish — { title, calories, macros, ingredients, ... }
 * @param {string} mealType — 'breakfasts'|'lunches'|'snacks'|'dinners'|'meal'
 * @param {object} ctx — { diet, carbStrictness, phaseName, cuisines }
 * @returns {{valid, severe, issues}}
 *   issues: [{ rule, actual, expected, severity, message }]
 *   severe: true if any issue is severe enough to trigger a retry
 *   valid: true if zero issues at any severity
 */
export function validateDish(dish, mealType, ctx = {}) {
  const issues = []
  const cal = parseCalories(dish?.calories)
  const macros = parseMacros(dish?.macros)
  const calRange = MEAL_TARGETS[mealType]?.kcal || MEAL_TARGETS.meal.kcal
  const protRange = proteinTargetFor(ctx.diet, ctx.phaseName, mealType)
  const carbCap = carbCapFor(ctx.carbStrictness, ctx.phaseName, mealType)
  const fatRange = fatRangeFor(mealType)

  // Calories — most important. Severe if >50 over upper bound or >75 under
  // lower bound (under is less harmful but still off-spec).
  if (Number.isFinite(cal)) {
    if (cal > calRange[1] + 50) {
      issues.push({
        rule: 'calories', actual: cal, expected: calRange, severity: 'severe',
        message: `${cal} kcal is ${cal - calRange[1]} over the upper bound (${calRange[0]}–${calRange[1]} kcal target for ${mealType}).`,
      })
    } else if (cal > calRange[1]) {
      issues.push({
        rule: 'calories', actual: cal, expected: calRange, severity: 'marginal',
        message: `${cal} kcal is ${cal - calRange[1]} over the upper bound.`,
      })
    } else if (cal < calRange[0] - 75) {
      issues.push({
        rule: 'calories', actual: cal, expected: calRange, severity: 'severe',
        message: `${cal} kcal is ${calRange[0] - cal} under the lower bound (${calRange[0]}–${calRange[1]} kcal target).`,
      })
    } else if (cal < calRange[0]) {
      issues.push({
        rule: 'calories', actual: cal, expected: calRange, severity: 'marginal',
        message: `${cal} kcal is ${calRange[0] - cal} under the lower bound.`,
      })
    }
  }

  // Protein — severe when >10g under floor (not enough protein for the phase).
  // Over-protein is less harmful but still flag if extremely high (usually
  // means oversized animal portions).
  if (Number.isFinite(macros.protein)) {
    if (macros.protein < protRange[0] - 10) {
      issues.push({
        rule: 'protein', actual: macros.protein, expected: protRange, severity: 'severe',
        message: `${macros.protein}g protein is ${protRange[0] - macros.protein}g under the floor (${protRange[0]}–${protRange[1]}g target).`,
      })
    } else if (macros.protein < protRange[0]) {
      issues.push({
        rule: 'protein', actual: macros.protein, expected: protRange, severity: 'marginal',
        message: `${macros.protein}g protein is ${protRange[0] - macros.protein}g under the floor.`,
      })
    } else if (macros.protein > protRange[1] + 15) {
      // Way over the protein target — usually means oversized portions
      issues.push({
        rule: 'protein', actual: macros.protein, expected: protRange, severity: 'severe',
        message: `${macros.protein}g protein is ${macros.protein - protRange[1]}g over the upper bound — usually means oversized animal-protein portion. Reduce.`,
      })
    }
  }

  // Carbs — severe when >15g over cap.
  if (Number.isFinite(macros.carbs)) {
    if (macros.carbs > carbCap + 15) {
      issues.push({
        rule: 'carbs', actual: macros.carbs, expected: [0, carbCap], severity: 'severe',
        message: `${macros.carbs}g carbs is ${macros.carbs - carbCap}g over the ${ctx.carbStrictness || 'gentle'}-mode cap of ${carbCap}g for ${mealType}.`,
      })
    } else if (macros.carbs > carbCap) {
      issues.push({
        rule: 'carbs', actual: macros.carbs, expected: [0, carbCap], severity: 'marginal',
        message: `${macros.carbs}g carbs is ${macros.carbs - carbCap}g over the cap.`,
      })
    }
  }

  // Fat — flag only when wildly off. Calorie cap usually constrains it.
  if (Number.isFinite(macros.fat)) {
    if (macros.fat > fatRange[1] + 10) {
      issues.push({
        rule: 'fat', actual: macros.fat, expected: fatRange, severity: 'severe',
        message: `${macros.fat}g fat is ${macros.fat - fatRange[1]}g over typical (${fatRange[0]}–${fatRange[1]}g for ${mealType}).`,
      })
    }
  }

  const severe = issues.some((i) => i.severity === 'severe')
  return {
    valid: issues.length === 0,
    severe,
    issues,
  }
}

/**
 * Build the constraint block sent to the retry model — describes what the
 * fixed dish must satisfy, in plain language. The model also gets the
 * original dish + the validation issues so it knows what to change.
 */
export function buildRetryConstraints(mealType, ctx, validation) {
  const calRange = MEAL_TARGETS[mealType]?.kcal || MEAL_TARGETS.meal.kcal
  const protRange = proteinTargetFor(ctx.diet, ctx.phaseName, mealType)
  const carbCap = carbCapFor(ctx.carbStrictness, ctx.phaseName, mealType)
  const cuisines = Array.isArray(ctx.cuisines) && ctx.cuisines.length
    ? ctx.cuisines.join(', ')
    : 'any'

  return `Meal type: ${mealType}
Target: ${calRange[0]}–${calRange[1]} kcal · ${protRange[0]}–${protRange[1]}g protein · ≤${carbCap}g carbs
Diet: ${ctx.diet || 'everything'}
Cycle phase: ${ctx.phaseName || 'unknown'}
Carb strictness: ${ctx.carbStrictness || 'gentle'}
Cuisines (preserve): ${cuisines}
${ctx.pantry ? `Pantry available: ${ctx.pantry}` : ''}

Issues to fix:
${validation.issues.map((i) => `- ${i.message}`).join('\n')}

Anchor on animal protein for lunches/dinners (100–150g chicken/salmon/fish/eggs/Greek yogurt) UNLESS user is vegan. Plant protein (lentils/chickpeas) as a side, max 100g cooked. Avocado max 100g (½ fruit). Eggs max 2. Olive oil max 1 tbsp. Use grams in the ingredients list — the math is enforced by USDA.`
}

// Exposed for tests + retry call.
export { MEAL_TARGETS, proteinTargetFor, carbCapFor, fatRangeFor, parseMacros, parseCalories }
