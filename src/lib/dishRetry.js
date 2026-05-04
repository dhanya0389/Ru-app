// Single-dish retry — used when validateDish() flags a generated dish as
// out of spec (calories, protein, carbs, fat). One small Haiku call per
// failing dish, returns a corrected dish, then USDA recomputes macros from
// the new ingredients. If the retry STILL fails validation, ship the
// retried version anyway (don't infinite-loop).

import { calculateMacros, formatMacros, formatCalories } from '@/lib/macros'
import { buildRetryConstraints, validateDish } from '@/lib/macroValidator'

const RETRY_MODEL = 'claude-haiku-4-5-20251001'
const RETRY_MAX_TOKENS = 1024

// Tool schema for the single-dish fix — same shape as menuItemSchema in
// generate-week, just inline so this lib is self-contained. Practitioners
// must come from the canonical allowlist; the caller sanitizes downstream.
function buildDishSchema(allowedSurnames) {
  return {
    type: 'object',
    properties: {
      id:          { type: 'string' },
      title:       { type: 'string' },
      cookTime:    { type: 'string' },
      calories:    { type: 'string' },
      macros:      { type: 'string' },
      ingredients: { type: 'array', items: { type: 'string' } },
      steps:       { type: 'array', items: { type: 'string' } },
      phaseFit:    {
        type: 'array',
        items: { type: 'string', enum: ['menstrual', 'follicular', 'ovulatory', 'luteal', 'all'] },
      },
      mode:        { type: 'string', enum: ['ketobiotic', 'feasting'] },
      imageQuery:  { type: 'string' },
      practitioners: {
        type: 'array',
        items: { type: 'string', enum: allowedSurnames },
        minItems: 0,
        maxItems: 3,
      },
    },
    required: ['id', 'title', 'cookTime', 'calories', 'macros', 'ingredients', 'steps', 'phaseFit', 'mode', 'practitioners'],
  }
}

/**
 * Regenerate a single dish that failed validation, then re-run USDA on the
 * new ingredients so the user sees real numbers.
 *
 * @param {Anthropic} client — initialized Anthropic SDK client
 * @param {object} dish — original dish from generate-week / generate-cards
 * @param {string} mealType — 'breakfasts' | 'lunches' | 'snacks' | 'dinners' | 'meal'
 * @param {object} ctx — { diet, carbStrictness, phaseName, cuisines, pantry, allowedSurnames }
 * @param {object} validation — output of validateDish()
 * @returns {Promise<object>} corrected dish (with USDA macros applied), or
 *   the ORIGINAL dish if the retry fails entirely (so the plan is never
 *   left with a missing dish).
 */
export async function regenerateDish(client, dish, mealType, ctx, validation) {
  const constraints = buildRetryConstraints(mealType, ctx, validation)

  const systemPrompt = `You are fixing a single dish that failed Ruhi's macro validation. Return a corrected version with adjusted portions/ingredients to fit the targets. Keep the SPIRIT of the original — same cuisine direction, similar core ingredients where possible — but rebalance portions to hit the targets.

Hard rules:
- Use grams in ingredients ("120g chicken breast", "80g cooked quinoa") — the math is USDA-enforced after you submit.
- Animal-protein anchored unless user is vegan.
- Plant protein as a side (≤100g cooked), not the main, unless vegan.
- 1 tbsp olive oil max. ½ avocado max. 2 eggs max.
- Preserve the user's stated cuisines.
- DO NOT echo "scientifically proven" or name-drop practitioners in body copy.
- Voice: direct, warm, embodied — first person where natural.

Return via the fix_dish tool.`

  const userMessage = `ORIGINAL DISH (failing validation):
Title: ${dish.title}
Cook time: ${dish.cookTime || 'unspecified'}
Macros: ${dish.calories || '?'} · ${dish.macros || '?'}
Ingredients:
${(dish.ingredients || []).map((i) => `  - ${i}`).join('\n')}
Steps:
${(dish.steps || []).map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

CONSTRAINTS:
${constraints}

Return the corrected dish via fix_dish. Adjust portions until the math fits.`

  try {
    const message = await client.messages.create({
      model: RETRY_MODEL,
      max_tokens: RETRY_MAX_TOKENS,
      system: systemPrompt,
      tools: [
        {
          name: 'fix_dish',
          description: 'Return the portion-corrected dish that fits Ruhi\'s targets.',
          input_schema: buildDishSchema(ctx.allowedSurnames || []),
        },
      ],
      tool_choice: { type: 'tool', name: 'fix_dish' },
      messages: [{ role: 'user', content: userMessage }],
    })
    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse) {
      console.warn(`[dishRetry] Haiku did not call fix_dish for "${dish.title}"; keeping original`)
      return dish
    }
    const corrected = toolUse.input

    // Re-run USDA on the new ingredients so the user sees the actual macros
    // for the corrected portions, not Haiku's guess.
    if (corrected.ingredients?.length) {
      const calculated = await calculateMacros(corrected.ingredients)
      if (calculated) {
        corrected.macros = formatMacros(calculated)
        corrected.calories = formatCalories(calculated)
        corrected.macrosSource = 'usda'
      }
    }

    // Preserve fields that anchor the dish to the rest of the plan:
    //   - id: assignments[].breakfastId/lunchId/etc. point at this id; a new
    //     id orphans the day-by-day mapping (and any future history feature).
    //   - mode: phase-driven (ketobiotic vs feasting) — Haiku might flip it.
    //   - phaseFit: same — preserve the original eligibility list.
    return {
      ...corrected,
      id: dish.id || corrected.id,
      mode: dish.mode || corrected.mode,
      phaseFit: dish.phaseFit?.length ? dish.phaseFit : corrected.phaseFit,
    }
  } catch (err) {
    console.warn(`[dishRetry] retry failed for "${dish.title}":`, err?.message || err)
    return dish
  }
}

/**
 * Validate every dish in `dishes` for `mealType`. For dishes flagged as
 * severe, run regenerateDish() in parallel and replace them in the array.
 * Returns the (possibly corrected) array + an audit log of what changed.
 *
 * Caps the number of retries to prevent runaway latency / cost when
 * generation is broken in some unforeseen way.
 */
export async function validateAndRetryAll(client, dishes, mealType, ctx, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3
  const audit = []
  if (!Array.isArray(dishes) || dishes.length === 0) {
    return { dishes, audit }
  }

  // First pass: validate every dish, collect failures
  const failures = []
  dishes.forEach((dish, idx) => {
    const v = validateDish(dish, mealType, ctx)
    audit.push({
      title: dish.title,
      mealType,
      severe: v.severe,
      issues: v.issues.map((i) => ({ rule: i.rule, severity: i.severity, message: i.message })),
    })
    if (v.severe) {
      failures.push({ idx, dish, validation: v })
    }
  })

  if (failures.length === 0) return { dishes, audit }

  // Cap retries at maxRetries, prioritize the worst offenders (severe issues
  // count first, then largest calorie deviation).
  const ranked = failures
    .map((f) => {
      const calIssue = f.validation.issues.find((i) => i.rule === 'calories')
      const calDelta = calIssue
        ? Math.max(
            calIssue.actual - (calIssue.expected[1] || 0),
            (calIssue.expected[0] || 0) - calIssue.actual,
            0
          )
        : 0
      return { ...f, calDelta }
    })
    .sort((a, b) => b.calDelta - a.calDelta)
    .slice(0, maxRetries)

  // Run retries in parallel
  const corrected = await Promise.all(
    ranked.map((f) => regenerateDish(client, f.dish, mealType, ctx, f.validation))
  )

  // Mutate dishes array (caller passes by reference); record audit entries
  ranked.forEach((f, i) => {
    const newDish = corrected[i]
    dishes[f.idx] = newDish
    const reValidation = validateDish(newDish, mealType, ctx)
    audit.push({
      title: f.dish.title,
      mealType,
      retried: true,
      newTitle: newDish.title,
      stillFailing: reValidation.severe,
      newIssues: reValidation.issues.map((i) => ({ rule: i.rule, severity: i.severity, message: i.message })),
    })
  })

  return { dishes, audit }
}
