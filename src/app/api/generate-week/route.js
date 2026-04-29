import Anthropic from '@anthropic-ai/sdk'
import { calculateMacros, formatMacros, formatCalories } from '@/lib/macros'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

export async function POST(request) {
  if (!client) {
    return Response.json(
      { error: 'missing_api_key', message: 'ANTHROPIC_API_KEY not set. See .env.local.example.' },
      { status: 503 }
    )
  }

  const {
    profile,
    weekDays,         // DayPhase[] — 7 entries with phase + cycleDay + mode for each
    pantry,           // string — free-text list of items already on hand
    supplements,      // string[] — user-reported supplements (Tier 1 tracking only)
    seedCycling,      // boolean — opt-in
    bodyData,         // optional: { calorieTarget?, proteinFloor?, proteinTarget?, rmr? }
  } = await request.json()

  // System prompt encodes the science INTERNALLY but never names practitioners
  // in card-content. The model knows about Pelz's framing (ketobiotic /
  // hormone feasting) and uses it to drive macro distribution, but card titles,
  // descriptions, and tips never say "Pelz" or any other name. If a user
  // wants to know the science, the future Science page lists everyone.
  const systemPrompt = `You are Ruhi, a personal health system. You generate weekly meal plans grounded in cycle-syncing science and modern metabolic research.

INTERNAL FRAMING (use to drive decisions, but NEVER name practitioners in user-facing content):
- Cycle-day-based eating modes:
  * Days 1–13 (menstrual + follicular): KETOBIOTIC mode — lower carb, higher fat + protein, supports insulin sensitivity and energy stabilization
  * Days 14–28 (ovulatory + luteal): HORMONE FEASTING mode — higher complex carbs, more variety, supports progesterone production and luteal-phase metabolism
- Phase-specific food priorities:
  * Menstrual: iron-rich, warming, root vegetables, bone broth; gentle movement only
  * Follicular: cruciferous vegetables, fermented foods, lighter proteins; creative energy
  * Ovulatory: raw vegetables OK; lighter, more variety; high-intensity movement OK
  * Luteal: progesterone-supporting foods (tropical fruits essential), complex carbs (NOT refined), magnesium-rich, comfort without junk

CARB RULES — universal (every mode):
- "Complex carbs" means LOW-GI, fiber-rich whole grains and legumes ONLY:
  ✓ ALLOWED: lentils, chickpeas, black beans, mung beans, quinoa, oats, barley, buckwheat, brown rice (small portion ≤ ½ cup), wild rice, steamed sweet potato, sprouted grain bread, sourdough
  ✗ FORBIDDEN: white rice (including basmati), white pasta, white bread, white flour, refined grains, sugar
- White basmati rice is HIGH-GI even when freshly cooked — never call it a complex carb.

CARB STRICTNESS — driven by user's profile.carbStrictness setting:
- "gentle" mode (DEFAULT — building discipline, easing in):
  Include moderate complex carbs (~30–40g) at every meal in every phase across the week.
  Sourdough, oats, quinoa, farro, brown rice (small portion), steamed sweet potato welcome at any meal.
  Inchauspé sequencing is still strict.
- "standard" mode (full cycle-syncing, phase-aware):
  Days 1–13 (ketobiotic): lower carb (15–25g per meal), focus on protein + healthy fats.
  Days 14–28 (feasting): complex carbs welcome (30–45g per meal). Luteal especially benefits from complex carbs for progesterone support and serotonin.

UNIVERSAL MEAL RULE (every meal, every phase, no exception):
- Sequencing: vegetables first → protein + fat second → carbs last. This is non-negotiable.

PROTEIN FLOOR:
- Default: 25g minimum per meal (30g+ for luteal/menstrual when blood sugar regulation matters most)
- If bodyData.proteinFloor is provided, use that instead.

VOICE / WRITING RULES:
- NEVER mention specific practitioners or doctors by name in any card content (no "Dr. So-and-so", no "per Pelz", no "Vitti says", no name-drops).
- If you reference scientific basis, say "research suggests", "evidence shows", or "the science of cycle-syncing" — never name a person.
- Card content is direct, warm, embodied; first person where natural. Speak as Ruhi.

INGREDIENT QUANTITY RULES (critical for macro accuracy):
- For non-liquid ingredients, prefer GRAMS: "150g chicken breast", "60g spinach", "100g cooked lentils".
- For liquids, ml or cups are fine: "240ml broth" or "1 cup broth".
- For naturally-counted items, use counts with size: "1 large egg", "2 medium tomatoes", "3 garlic cloves".
- For tiny amounts (spices, salt, lemon squeeze), keep them human ("1 tsp turmeric", "salt to taste").
- Avoid vague volumes like "1 cup chickpeas" — write "150g cooked chickpeas" instead, since cup-to-gram conversions differ wildly by ingredient density.

PANTRY AWARENESS:
- The user has provided a pantry list. Prefer dishes that use those items.
- Do not require ingredients the user already lacks if reasonable substitutions exist within their pantry.

SUPPLEMENTS:
- The user reports they take: ${supplements?.join(', ') || 'nothing reported'}.
- DO NOT recommend supplements or dosages. Only acknowledge what they've reported when relevant (e.g., "since you take magnesium, your luteal sleep should be better-supported").

SEED CYCLING (opt-in by user):
- ${seedCycling ? 'User does seed cycling. Surface a phaseBall reminder appropriate for the cycle-day range of this week (Phase 1: days 1–14 = flax + pumpkin; Phase 2: days 15–28 = sesame + sunflower). One ball per day. Note when they need to make the next batch.' : 'User does not do seed cycling — do not surface phase-ball reminders.'}

Generate a weekly menu that the user picks from across 7 days. The menu has 3–4 dishes per meal-type (so users can rotate, meal-prep style).`

  const userMessage = `Generate my weekly menu for the week of ${weekDays[0]?.date}.

PROFILE:
- Diet: ${profile?.diet || 'everything'}
- Carb strictness: ${profile?.carbStrictness || 'gentle'}
- Cuisines: ${profile?.cuisines?.join(', ') || 'any'}
- Avoidances: ${profile?.avoidances || 'none'}
- Movement preferences: ${profile?.movements?.join(', ') || 'any'}
- Movement frequency: ${profile?.movementFrequency || 'moderate'}
- Goals: ${profile?.goals?.join(', ') || 'general wellness'}
- Life stage: ${profile?.age || 'not specified'}

THIS WEEK'S CYCLE PROGRESSION:
${weekDays.map(d => `- ${d.dayLabel} ${d.date}: ${d.phase} day ${d.cycleDay} (${d.mode} mode)`).join('\n')}

PANTRY (already on hand):
${pantry || 'general staples'}

${bodyData ? `BODY DATA (use these targets):
- Calorie target: ${bodyData.calorieTarget || 'general phase-aware'}
- Protein floor: ${bodyData.proteinFloor || 25}g minimum
- Protein target: ${bodyData.proteinTarget || 'hit floor'}` : ''}

Use the return_weekly_menu tool to deliver:
1. A menu of dishes (3 breakfasts + 4 lunches + 3 snacks + 4 dinners + 6–9 drinks across morning/afternoon/evening). Each dish phase-tagged with which days it suits.
2. An auto-assignment of dishes to the 7 days (cycle-aware: dish must match that day's phase + mode). Snacks are required (non-null) for menstrual + luteal days, optional for follicular + ovulatory.
3. An aggregated shopping list with quantities, categorized (produce/protein/pantry/dairy/frozen/other), with inPantry=true for items already in the user's pantry.
4. Phase-transition callouts (1–3 short strings) for any day-to-day phase shifts in the week.
5. A seed-cycling note if applicable.`

  // Schema enforced via tool_use — guarantees valid structured output.
  const menuSchema = {
    type: 'object',
    properties: {
      menu: {
        type: 'object',
        properties: {
          breakfasts: { type: 'array', items: menuItemSchema(), minItems: 3, maxItems: 4 },
          lunches:    { type: 'array', items: menuItemSchema(), minItems: 4, maxItems: 5 },
          snacks:     { type: 'array', items: menuItemSchema(), minItems: 3, maxItems: 4 },
          dinners:    { type: 'array', items: menuItemSchema(), minItems: 4, maxItems: 5 },
          drinks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title:     { type: 'string' },
                timeOfDay: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
                phaseFit:  { type: 'array', items: { type: 'string' } },
                reason:    { type: 'string', description: 'short, time-of-day rationale' },
              },
              required: ['title', 'timeOfDay', 'phaseFit', 'reason'],
            },
            minItems: 6, maxItems: 9,
          },
        },
        required: ['breakfasts', 'lunches', 'snacks', 'dinners', 'drinks'],
      },
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date:        { type: 'string' },
            breakfastId: { type: 'string' },
            lunchId:     { type: 'string' },
            snackId:     { type: ['string', 'null'] },
            dinnerId:    { type: 'string' },
          },
          required: ['date', 'breakfastId', 'lunchId', 'dinnerId'],
        },
        minItems: 7, maxItems: 7,
      },
      shoppingList: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:     { type: 'string' },
            quantity: { type: 'string' },
            category: { type: 'string', enum: ['produce', 'protein', 'pantry', 'dairy', 'frozen', 'other'] },
            inPantry: { type: 'boolean' },
          },
          required: ['name', 'quantity', 'category', 'inPantry'],
        },
      },
      phaseTransitionCallouts: {
        type: 'array',
        items: { type: 'string' },
        description: '1–3 short strings flagging cycle-phase transitions in the week',
      },
      seedCyclingNote: {
        type: ['string', 'null'],
        description: 'Phase-ball reminder string, or null if user opted out',
      },
    },
    required: ['menu', 'assignments', 'shoppingList', 'phaseTransitionCallouts', 'seedCyclingNote'],
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,  // weekly plan is large; truncation at 8192 dropped shoppingList
      system: systemPrompt,
      tools: [
        {
          name: 'return_weekly_menu',
          description: 'Return the personalized weekly meal menu with assignments and shopping list.',
          input_schema: menuSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'return_weekly_menu' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse) {
      console.error('Claude did not call return_weekly_menu. Stop reason:', message.stop_reason)
      return Response.json({ error: 'Failed to generate weekly menu' }, { status: 500 })
    }

    // Replace AI-guessed macros with USDA-calculated values for every dish
    // across all 4 categories. Run all lookups in parallel — each dish's
    // calculateMacros internally parallelizes its own ingredient lookups too.
    const menu = toolUse.input.menu
    const allDishes = [
      ...(menu.breakfasts || []),
      ...(menu.lunches || []),
      ...(menu.snacks || []),
      ...(menu.dinners || []),
    ]
    await Promise.all(allDishes.map(async (dish) => {
      if (!dish.ingredients?.length) return
      const calculated = await calculateMacros(dish.ingredients)
      if (calculated) {
        dish.macros = formatMacros(calculated)
        dish.calories = formatCalories(calculated)
        dish.macrosSource = 'usda'
      }
    }))

    // Compose the full WeeklyPlan response with the day-phase metadata
    const result = {
      weekOf: weekDays[0]?.date,
      days: weekDays,
      menu,
      assignments: toolUse.input.assignments,
      shoppingList: toolUse.input.shoppingList,
      phaseTransitionCallouts: toolUse.input.phaseTransitionCallouts,
      seedCyclingNote: toolUse.input.seedCyclingNote,
      generatedAt: new Date().toISOString(),
    }
    return Response.json(result)
  } catch (error) {
    console.error('Claude API error (weekly):', error)
    return Response.json({ error: 'Failed to generate weekly menu' }, { status: 500 })
  }
}

function menuItemSchema() {
  return {
    type: 'object',
    properties: {
      id:          { type: 'string', description: 'short stable id, e.g. "salmon-dal"' },
      title:       { type: 'string' },
      cookTime:    { type: 'string' },
      calories:    { type: 'string' },
      macros:      { type: 'string', description: 'e.g. "32g protein · 28g carbs · 18g fat"' },
      ingredients: { type: 'array', items: { type: 'string' } },
      steps:       { type: 'array', items: { type: 'string' } },
      phaseFit:    {
        type: 'array',
        items: { type: 'string', enum: ['menstrual', 'follicular', 'ovulatory', 'luteal', 'all'] },
        description: 'Which phases this dish suits',
      },
      mode:        { type: 'string', enum: ['ketobiotic', 'feasting'] },
      imageQuery:  { type: 'string', description: '2-3 word stock-photo query' },
    },
    required: ['id', 'title', 'cookTime', 'calories', 'macros', 'ingredients', 'steps', 'phaseFit', 'mode'],
  }
}
