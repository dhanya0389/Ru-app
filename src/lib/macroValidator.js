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

// Flat 35g protein floor for every breakfast/lunch/dinner regardless of
// diet or phase, per Dhanya's May 4 call: "every meal that comes in should
// have a minimum of 35g of protein. That 35g should be approximately
// accurate to USDA data." Daily total naturally lands at 105 + snack →
// 115-120g/day, hitting her Notion target without a separate daily check.
//
// Snacks stay smaller (10-15g) — they're a top-up, not a meal.
//
// Upper bounds are loose (50g for meals) so the validator doesn't penalize
// a slightly protein-rich dish that fits the calorie cap.
function proteinTargetFor(diet, phaseName, mealType) {
  if (mealType === 'snacks') return [10, 15]
  return [35, 50]
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

// Diet violation detection — diet is a HARD rule that overrides pantry.
// If the user's profile says vegetarian and the AI generated a salmon
// dish (because salmon was in the pantry), that's a trust-breaking bug.
// We scan each ingredient against forbidden patterns and trigger retry.
//
// Patterns are case-insensitive word-boundary regexes. "egg" matches
// "egg/eggs/egg whites/scrambled egg" but not "eggplant" (word boundary
// requires non-letter to follow).
const MEAT_PATTERN = /\b(beef|pork|chicken|turkey|duck|goose|lamb|veal|venison|rabbit|bacon|sausage|ham|prosciutto|chorizo|salami|pepperoni|bratwurst|hot ?dog|mutton|steak|brisket|tenderloin|short ?ribs?)\b/i
const FISH_PATTERN = /\b(salmon|tuna|cod|halibut|trout|sardines?|anchov(?:y|ies)|mackerel|tilapia|haddock|sea ?bass|swordfish|sole|bream|snapper|perch|catfish)\b/i
const SHELLFISH_PATTERN = /\b(shrimp|prawns?|lobster|crab|crayfish|scallops?|oysters?|clams?|mussels?|squid|octopus|calamari|crawfish)\b/i
const DAIRY_PATTERN = /\b(milk|cream|butter(?!nut)|ghee|cheese|cheddar|mozzarella|parmesan|feta|paneer|cottage ?cheese|ricotta|brie|gouda|provolone|goat ?cheese|halloumi|yog(?:h)?urt|kefir|whey|casein|sour ?cream)\b/i
const EGG_PATTERN = /\beggs?\b|\begg ?whites?\b|\byolks?\b/i
const HONEY_PATTERN = /\bhoney\b/i

const FORBIDDEN_BY_DIET = {
  vegan: [
    { pattern: MEAT_PATTERN, label: 'meat' },
    { pattern: FISH_PATTERN, label: 'fish' },
    { pattern: SHELLFISH_PATTERN, label: 'shellfish' },
    { pattern: DAIRY_PATTERN, label: 'dairy' },
    { pattern: EGG_PATTERN, label: 'eggs' },
    { pattern: HONEY_PATTERN, label: 'honey' },
  ],
  vegetarian: [
    { pattern: MEAT_PATTERN, label: 'meat' },
    { pattern: FISH_PATTERN, label: 'fish' },
    { pattern: SHELLFISH_PATTERN, label: 'shellfish' },
  ],
  pescatarian: [
    { pattern: MEAT_PATTERN, label: 'meat' },
  ],
  // 'everything' / unspecified → no restrictions
}

// Plant-derived "dairy" terms — these should NEVER trigger the dairy
// violation pattern. "oat milk", "coconut cream", "almond yogurt", etc. are
// vegan-compliant. Without this exclusion the bare \bmilk\b alternative
// matches "milk" inside "oat milk" and incorrectly flags vegan dishes.
const PLANT_DAIRY_RE = /\b(oat|almond|soy|soya|coconut|rice|hemp|cashew|macadamia|pea|hazelnut|flax|walnut|sunflower|sesame|pumpkin ?seed|tigernut)\s+(milk|cream|yog(?:h)?urt|butter|cheese|kefir)\b/gi

/**
 * Scan a dish's ingredient list for items forbidden by the user's diet.
 * Returns an array of { ingredient, label } for each violation found,
 * or empty array if the dish is diet-compliant.
 */
function findDietViolations(ingredients, diet) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return []
  const d = String(diet || '').toLowerCase()
  const rules = FORBIDDEN_BY_DIET[d]
  if (!rules) return []  // 'everything' / unknown → permit everything
  const violations = []
  for (const rawIng of ingredients) {
    if (typeof rawIng !== 'string') continue
    // Strip plant-derived dairy phrases before pattern matching so
    // "oat milk" / "coconut cream" / "almond yogurt" don't trigger the
    // dairy violation pattern. Replace with a non-word filler that breaks
    // the dairy regex's word-boundary anchors.
    const ing = rawIng.replace(PLANT_DAIRY_RE, '$1plant$2')
    for (const { pattern, label } of rules) {
      if (pattern.test(ing)) {
        violations.push({ ingredient: rawIng, label })
        break  // one violation per ingredient is enough
      }
    }
  }
  return violations
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

  // Diet violations — HARD rule, always severe. Trust-breaking bug class:
  // a vegetarian user must never see chicken/salmon, vegan user must never
  // see eggs/dairy. Pantry contents do NOT override diet.
  const dietViolations = findDietViolations(dish?.ingredients, ctx.diet)
  if (dietViolations.length > 0) {
    issues.push({
      rule: 'diet', actual: dietViolations, expected: ctx.diet, severity: 'severe',
      message: `Diet violation (${ctx.diet}): contains ${dietViolations.map(v => `"${v.ingredient}" (${v.label})`).join(', ')}. Replace with diet-compliant alternative.`,
    })
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

  // Build diet-aware protein-source guidance for the retry. Different from
  // the main prompt because Haiku gets a focused single-dish task and
  // benefits from spelling out exactly what's permitted.
  const diet = String(ctx.diet || '').toLowerCase()
  let proteinGuidance
  if (diet === 'vegan') {
    proteinGuidance = `DIET = VEGAN. NO meat, NO fish, NO eggs, NO dairy (no cheese/yogurt/milk/butter/ghee/paneer/kefir), NO honey. Anchor on tempeh (~20g pro / 100g), firm tofu (~16g pro / 100g), seitan, lentils, chickpeas, hemp seeds (~10g pro / 30g), nutritional yeast. Combine 2-3 plant proteins to hit the 35g floor.`
  } else if (diet === 'vegetarian') {
    proteinGuidance = `DIET = VEGETARIAN. NO meat, NO fish/seafood. Eggs, dairy, paneer, Greek yogurt, kefir, cottage cheese, cheese all OK. Anchor on Greek yogurt (~20g pro / 200g), 2-3 eggs (~12g), paneer (~12g pro / 50g), cottage cheese (~24g pro / 200g), tempeh, tofu.`
  } else if (diet === 'pescatarian') {
    proteinGuidance = `DIET = PESCATARIAN. NO meat. Fish/seafood, eggs, dairy all OK. Anchor on salmon/tuna/white fish (100-150g cooked) or eggs/Greek yogurt.`
  } else {
    proteinGuidance = `DIET = ${ctx.diet || 'everything'}. Anchor on animal protein (100-150g cooked chicken/salmon/fish/eggs/Greek yogurt). Plant protein as side, max 100g cooked.`
  }

  return `Meal type: ${mealType}
Target: ${calRange[0]}–${calRange[1]} kcal · ≥${protRange[0]}g protein (floor — go higher if needed to hit 35g) · ≤${carbCap}g carbs
Diet: ${ctx.diet || 'everything'}
Cycle phase: ${ctx.phaseName || 'unknown'}
Carb strictness: ${ctx.carbStrictness || 'gentle'}
Cuisines (preserve): ${cuisines}
${ctx.pantry ? `Pantry hints (DIET OVERRIDES these — ignore any pantry item that violates the diet): ${ctx.pantry}` : ''}

${proteinGuidance}

Issues to fix:
${validation.issues.map((i) => `- ${i.message}`).join('\n')}

Avocado max 100g (½ fruit). Olive oil max 1 tbsp. Use grams in the ingredients list — the math is enforced by USDA. Diet is a HARD rule — never include forbidden ingredients even if they're in the pantry.`
}

// Exposed for tests + retry call.
export {
  MEAL_TARGETS,
  proteinTargetFor,
  carbCapFor,
  fatRangeFor,
  parseMacros,
  parseCalories,
  findDietViolations,
  FORBIDDEN_BY_DIET,
}
