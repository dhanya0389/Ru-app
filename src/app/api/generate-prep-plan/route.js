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

WRITING RULES:
- Direct, warm, embodied — first person where natural ("I'd start with...").
- No practitioner name-drops.
- No "scientifically proven" / "clinically proven".
- Step text should be specific: portions, temps, times. "Roast chicken 25 min at 400°F" not "cook chicken until done".
- When a step covers multiple recipes, name them: "Cook 600g chicken (covers Mon/Wed dinner + Tue lunch)".
- Storage notes should be specific: "Fridge in glass container — eat by Wed" not "Store in fridge".

WHAT YOU HAVE:
- The full weekly plan (dishes + days each is used)
- The user's pantry (existing items)
- The user's cycle phase progression (so you can flag any time-sensitive items, e.g. "make this fresh Friday — luteal needs warm food")

Build the prep timeline as a SINGLE sequence the user can execute Sunday afternoon (or whatever day they prep). Group steps into ACTIVE / BETWEEN / ASSEMBLY / STORAGE sections.

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
        description: 'Active cooking steps in execution order. Each step happens with heat or attention; multiple steps can run in parallel and that should be noted in the step text.',
        items: {
          type: 'object',
          properties: {
            order:    { type: 'number', description: 'Step number (1-based).' },
            minutes:  { type: 'number', description: 'Active or elapsed minutes for this step.' },
            title:    { type: 'string', description: 'Short imperative title — "Roast chicken thighs"' },
            detail:   { type: 'string', description: 'Specific instructions — temp/time/portion. Reference which dishes this serves.' },
            parallel: { type: 'boolean', description: 'True if this step runs in parallel with the previous step (do not block on it).' },
          },
          required: ['order', 'minutes', 'title', 'detail', 'parallel'],
        },
        minItems: 2,
        maxItems: 8,
      },
      between: {
        type: 'array',
        description: 'Tasks done while active cooking happens — chopping, washing, mixing dressings. Filler that fits into the gaps.',
        items: {
          type: 'object',
          properties: {
            title:  { type: 'string' },
            detail: { type: 'string', description: 'What to do, with portions and any storage notes.' },
          },
          required: ['title', 'detail'],
        },
        minItems: 0,
        maxItems: 6,
      },
      assembly: {
        type: 'array',
        description: 'Cold assembly done at the end — snack jars, salad bases, dressings into containers.',
        items: {
          type: 'object',
          properties: {
            title:  { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['title', 'detail'],
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
