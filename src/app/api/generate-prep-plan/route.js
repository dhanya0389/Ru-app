import Anthropic from '@anthropic-ai/sdk'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// The prep planner takes a generated weekly plan and produces a Sunday
// cook-and-prep timeline. The differentiated value is BATCHING — the model
// sees the whole week's assignments and identifies cross-recipe efficiencies
// (cook all chicken at once, soak all lentils together, make a dressing
// that lasts 5 days). This is what turns a meal plan into a meal-prep plan.

export async function POST(request) {
  if (!client) {
    return Response.json(
      { error: 'missing_api_key', message: 'ANTHROPIC_API_KEY not set.' },
      { status: 503 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { plan, profile, pantry } = body || {}
  if (!plan || !plan.menu || !plan.assignments) {
    return Response.json({ error: 'missing_plan' }, { status: 400 })
  }

  // Build a compact dish-by-dish summary the model can reason over without
  // re-deriving everything from raw assignments. Including frequency
  // (assignment count) lets the model see "salmon 3x this week → cook all
  // at once" without us having to spell it out.
  const itemById = {}
  for (const cat of ['breakfasts', 'lunches', 'snacks', 'dinners']) {
    (plan.menu[cat] || []).forEach((it) => {
      itemById[it.id] = { ...it, _cat: cat }
    })
  }

  const dishUsage = {}
  for (const a of plan.assignments) {
    for (const slot of [
      { id: a.breakfastId, day: a.date, meal: 'breakfast' },
      { id: a.lunchId, day: a.date, meal: 'lunch' },
      { id: a.snackId, day: a.date, meal: 'snack' },
      { id: a.dinnerId, day: a.date, meal: 'dinner' },
    ]) {
      if (!slot.id || !itemById[slot.id]) continue
      if (!dishUsage[slot.id]) {
        dishUsage[slot.id] = { dish: itemById[slot.id], days: [] }
      }
      dishUsage[slot.id].days.push({ date: slot.day, meal: slot.meal })
    }
  }

  // Compact menu summary for the model — title + ingredients + days used.
  const dishSummary = Object.values(dishUsage)
    .map(({ dish, days }) => {
      const usage = days
        .map((d) => `${d.meal} on ${d.date}`)
        .join(', ')
      return `${dish.title} (${dish._cat}, ${days.length}x — ${usage})
  Ingredients: ${(dish.ingredients || []).join('; ')}`
    })
    .join('\n\n')

  const phaseProgression = (plan.days || [])
    .map((d) => `${d.dayLabel} ${d.date}: ${d.phase} d${d.cycleDay}`)
    .join(' · ')

  const systemPrompt = `You are Ruhi's meal-prep planner. The user has a weekly meal plan and wants a single Sunday-style prep session that batches across recipes — cooking efficient blocks rather than starting from scratch every day.

YOUR JOB:
1. Identify ingredients used across multiple meals (proteins, grains, sauces, dressings) and batch-cook them once.
2. Sequence active cooking so things happen in parallel (oven preheating + stovetop simmering + chopping).
3. Distinguish between:
   - ACTIVE COOKING (heat is involved, in parallel where possible)
   - BETWEEN-TASKS (chopping, washing, mixing, dressings) that fill gaps while active items cook
   - ASSEMBLY (cold prep, jars, snack containers — done at the end)
   - STORAGE (which container, fridge vs freezer, how many days each lasts, "use first")
4. Estimate total session time as a single number (~60-120 minutes typical).

CRITICAL — DIET (overrides everything, including pantry):
- The user's diet setting is the ONLY truth. NEVER mention forbidden ingredients, even in passing.
- VEGETARIAN: NO meat (beef/pork/chicken/turkey/lamb/etc.), NO fish or seafood. Eggs and dairy OK.
- VEGAN: NO animal products at all. NO meat/fish/eggs/dairy/honey.
- PESCATARIAN: NO meat. Fish, eggs, dairy OK.
- EVERYTHING: no restrictions.
- If the weekly plan or pantry contains a forbidden ingredient (validator should have caught this earlier, but in case): IGNORE it. Don't mention it in storage steps either.

OUTPUT STRUCTURE — keep each step SCANNABLE:
- title: 4-7 word imperative ("Roast sweet potato & batch tofu", "Simmer red lentils").
- temp (when active heat applies): "400°F" / "medium-high" / "low simmer" / null otherwise.
- portions: 1-5 short bullets in the form "QUANTITY INGREDIENT" — e.g. ["370g sweet potato", "1 tsp olive oil", "220g extra-firm tofu"]. Pull these out of prose.
- coversDishes: 1 short comma-separated string naming WHICH DISHES this step serves — e.g. "Mon/Wed dinner + Tue/Sat lunch + Thu breakfast hash". Use day abbreviations.
- steps: 2-5 short imperative bullets, one action each. NOT a paragraph. Each bullet ≤ 12 words.

Example of GOOD active step:
  title: "Roast sweet potato & batch tofu"
  temp: "400°F"
  minutes: 25
  parallel: false
  portions: ["370g sweet potato (1cm cubes)", "1 tsp olive oil", "½ tsp turmeric", "220g extra-firm tofu, sliced"]
  coversDishes: "Mon/Wed/Sat dinner + Thu breakfast hash"
  steps: ["Toss sweet potato with oil + turmeric.", "Spread on tray 1, roast 25 min, flip halfway.", "Press tofu 5 min, slice 1cm thick.", "Place on tray 2 same oven."]

Example of BAD active step (too prose-y, hard to scan — DON'T DO THIS):
  title: "Roast sweet potato & bake tofu simultaneously"
  detail: "Dice 370g sweet potato (covers Mon/Wed dinner + Tue/Sat dinner + Thu/Sat breakfast hash). Toss with 1 tsp olive oil, ½ teaspoon turmeric. Spread on a sheet tray and roast 25 minutes, flipping halfway. While that goes, press 220g of tofu for 5 minutes between paper towels..."

WRITING RULES:
- Direct, warm, embodied — first person where natural in tips/notes only.
- No practitioner name-drops.
- No "scientifically proven" / "clinically proven".
- Storage 'lasts' should be specific — "4 days fridge / 2 months freezer".
- Storage 'useBy' should reference a day or dish — "Use in Mon/Tue dinners first" not "use soon".

Return via the return_prep_plan tool.`

  const userMessage = `Plan a single prep session for this week.

PROFILE:
- Diet: ${profile?.diet || 'everything'}
- Carb strictness: ${profile?.carbStrictness || 'gentle'}
- Cuisines: ${profile?.cuisines?.join(', ') || 'any'}

PHASE PROGRESSION:
${phaseProgression}

PANTRY (already on hand — assume the rest comes from the shopping list):
${pantry || 'general staples'}

THIS WEEK'S DISHES + USAGE:

${dishSummary}

Build the prep plan. Group steps into ACTIVE / BETWEEN / ASSEMBLY / STORAGE. Identify which proteins, grains, sauces should be batched. Use return_prep_plan.`

  const prepPlanSchema = {
    type: 'object',
    properties: {
      totalMinutes: {
        type: 'number',
        description: 'Total session time in minutes (active + assembly). Typical: 60-120.',
      },
      summary: {
        type: 'string',
        description: 'One-sentence overview of what this prep session covers.',
      },
      active: {
        type: 'array',
        description: 'Active cooking steps in execution order. Each step happens with heat or attention; multiple steps can run in parallel.',
        items: {
          type: 'object',
          properties: {
            order:         { type: 'number', description: 'Step number (1-based).' },
            minutes:       { type: 'number', description: 'Active or elapsed minutes for this step.' },
            title:         { type: 'string', description: '4-7 word imperative title — "Roast sweet potato & batch tofu"' },
            temp:          { type: ['string', 'null'], description: 'Cooking temperature/heat level when applicable — "400°F" / "medium-high" / "low simmer". Null if no heat (e.g., rinsing, prepping).' },
            portions:      { type: 'array', items: { type: 'string' }, description: '1-5 short bullets in the form "QUANTITY INGREDIENT". Pull from prose.', minItems: 1, maxItems: 6 },
            coversDishes:  { type: 'string', description: 'Which dishes this step serves — "Mon/Wed dinner + Tue lunch + Thu breakfast hash"' },
            steps:         { type: 'array', items: { type: 'string' }, description: '2-5 short imperative bullets, ≤12 words each. NOT a paragraph.', minItems: 2, maxItems: 6 },
            parallel:      { type: 'boolean', description: 'True if this step runs in parallel with the previous step.' },
          },
          required: ['order', 'minutes', 'title', 'temp', 'portions', 'coversDishes', 'steps', 'parallel'],
        },
        minItems: 2,
        maxItems: 8,
      },
      between: {
        type: 'array',
        description: 'Tasks done while active cooking happens — chopping, washing, mixing dressings.',
        items: {
          type: 'object',
          properties: {
            title:        { type: 'string', description: '3-6 word imperative — "Whisk lemon-tahini dressing"' },
            portions:     { type: 'array', items: { type: 'string' }, description: '1-4 short "QUANTITY INGREDIENT" bullets', minItems: 0, maxItems: 5 },
            coversDishes: { type: ['string', 'null'], description: 'Which dishes this prep serves, or null if it\'s general prep.' },
            steps:        { type: 'array', items: { type: 'string' }, description: '1-3 short imperative bullets', minItems: 1, maxItems: 4 },
          },
          required: ['title', 'portions', 'coversDishes', 'steps'],
        },
        minItems: 0,
        maxItems: 6,
      },
      assembly: {
        type: 'array',
        description: 'Cold assembly at the end — snack jars, salad bases, dressings into containers.',
        items: {
          type: 'object',
          properties: {
            title:        { type: 'string', description: '3-6 word imperative — "Pack snack jars"' },
            portions:     { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 5 },
            coversDishes: { type: ['string', 'null'] },
            steps:        { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
          },
          required: ['title', 'portions', 'coversDishes', 'steps'],
        },
        minItems: 0,
        maxItems: 6,
      },
      storage: {
        type: 'array',
        description: 'How and where to store each batched item, with shelf-life reminder.',
        items: {
          type: 'object',
          properties: {
            item:    { type: 'string', description: 'What is being stored — "Cooked chicken thighs"' },
            where:   { type: 'string', description: 'Fridge or freezer + container hint — "Glass container, fridge"' },
            lasts:   { type: 'string', description: 'How long it stays good — "4 days fridge, 2 months freezer"' },
            useBy:   { type: 'string', description: 'Which day to use this by, or which dish to use it in first.' },
          },
          required: ['item', 'where', 'lasts', 'useBy'],
        },
        minItems: 1,
        maxItems: 10,
      },
      tips: {
        type: 'array',
        description: 'Optional 0–3 short, useful notes — phase-aware reminders, swap suggestions, leftover-revival ideas.',
        items: { type: 'string' },
        minItems: 0,
        maxItems: 3,
      },
    },
    required: ['totalMinutes', 'summary', 'active', 'between', 'assembly', 'storage', 'tips'],
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      tools: [
        {
          name: 'return_prep_plan',
          description: 'Return the structured Sunday prep plan for this week.',
          input_schema: prepPlanSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'return_prep_plan' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse) {
      console.error('generate-prep-plan: model did not call tool', message.stop_reason)
      return Response.json({ error: 'prep_plan_failed' }, { status: 500 })
    }

    const prepPlan = {
      ...toolUse.input,
      generatedAt: new Date().toISOString(),
      weekOf: plan.weekOf,
    }

    console.log('[generate-prep-plan] success', {
      weekOf: plan.weekOf,
      totalMinutes: prepPlan.totalMinutes,
      activeSteps: prepPlan.active?.length,
      storageItems: prepPlan.storage?.length,
    })

    return Response.json(prepPlan)
  } catch (error) {
    console.error('generate-prep-plan error:', error)
    return Response.json({ error: 'prep_plan_failed' }, { status: 500 })
  }
}
