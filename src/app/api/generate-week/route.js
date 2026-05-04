import Anthropic from '@anthropic-ai/sdk'
import { calculateMacros, formatMacros, formatCalories } from '@/lib/macros'
import {
  ALLOWED_SURNAMES,
  buildWeeklyScienceFoundationBlock,
} from '@/lib/practitioners'
import { validateAndRetryAll } from '@/lib/dishRetry'

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
    weekDays,         // DayPhase[] — 1-14 entries with phase + cycleDay + mode for each
    pantry,           // string — free-text list of items already on hand
    energy,           // 1-5 — user's energy at planning time, biases dish complexity
    supplements,      // string[] — user-reported supplements (Tier 1 tracking only)
    seedCycling,      // boolean — opt-in
    bodyData,         // optional: { calorieTarget?, proteinFloor?, proteinTarget?, rmr? }
  } = await request.json()

  const energyHints = {
    1: 'User reports VERY LOW energy this week — lean heavily on assembly meals (no real cooking), pre-cooked proteins, batch-prepped components, microwave-friendly dishes. Minimize active stove time. Repeat the same easy dish multiple days.',
    2: 'User reports LOW energy this week — favor simple recipes (under 20 min active cook time), assembly-style bowls, sheet-pan meals. Allow 1-2 dishes that repeat across multiple days for meal-prep efficiency.',
    3: 'User reports STEADY energy this week — balanced mix of simple and slightly more involved recipes. Standard cycle-aware meal planning.',
    4: 'User reports GOOD energy this week — room for one or two more ambitious recipes (more ingredients, longer cook time). Variety welcome.',
    5: 'User reports HIGH energy this week — open to ambitious cooking, new techniques, complex flavor builds. Use this week to try a recipe that takes more effort.',
  }

  // Embed practitioner-attributed rules for every phase represented in the
  // planning window plus cross-cutting rules. The model uses these as the
  // spine of its meal selection and tags each dish with its source via the
  // structured `practitioners` field — which is then surfaced in the UI.
  const phasesInWeek = (weekDays || []).map((d) => d.phase)
  const scienceFoundation = buildWeeklyScienceFoundationBlock(phasesInWeek)

  const systemPrompt = `You are Ruhi, a personal health system grounded in the work of 10 women's-health practitioners. The SCIENCE FOUNDATION block below lists the rules — derived from those practitioners — that ground every dish, drink, and snack you generate.

${scienceFoundation}

CARB RULES — universal (every mode):
- "Complex carbs" means LOW-GI, fiber-rich whole grains and legumes ONLY:
  ✓ ALLOWED: lentils, chickpeas, black beans, mung beans, quinoa, oats, barley, buckwheat, brown rice (small portion ≤ ½ cup), wild rice, steamed sweet potato, sprouted grain bread, sourdough
  ✗ FORBIDDEN: white rice (including basmati), white pasta, white bread, white flour, refined grains, sugar
- White basmati rice is HIGH-GI even when freshly cooked — never call it a complex carb.

CARB STRICTNESS — driven by user's profile.carbStrictness setting:
- "gentle" mode (DEFAULT — building discipline, easing in):
  Include moderate complex carbs (~30–40g) at every meal in every phase across the week.
  Sourdough, oats, quinoa, farro, brown rice (small portion), steamed sweet potato welcome at any meal.
  Glucose-flattening sequencing (vegetables → protein+fat → carbs) is still strict.
- "standard" mode (full cycle-syncing, phase-aware):
  Days 1–13 (ketobiotic): lower carb (15–25g per meal), focus on protein + healthy fats.
  Days 14–28 (feasting): complex carbs welcome (30–45g per meal). Luteal especially benefits from complex carbs for progesterone support and serotonin.

UNIVERSAL MEAL RULE (every meal, every phase, no exception):
- Sequencing: vegetables first → protein + fat second → carbs last. This is non-negotiable.

⚠️ PER-MEAL CALORIE + PROTEIN TARGETS — THE SINGLE MOST IMPORTANT RULE ⚠️

Every dish you generate MUST land inside the range for its meal-type:
- Breakfasts: 350–420 kcal · 25–30g protein
- Lunches:    420–500 kcal · 35–40g protein
- Snacks:     150–220 kcal · 10–15g protein
- Dinners:    350–430 kcal · 30–35g protein · always warm

These are HARD ranges, not suggestions. The user's USDA macro pipeline computes calories from your actual listed ingredient quantities, so if you write "200g salmon + 1 whole avocado + 2 eggs + sourdough", the user will SEE 950 kcal — regardless of what calorie number you claim. The math is enforced after you submit.

PLAN PORTIONS BACKWARD from the target:
  "What 420–500 kcal combination of ingredients hits 35–40g protein for this lunch?"

PROTEIN-SOURCE STRATEGY (the math reason behind the next rule):
The user's calorie + protein targets are tuned for animal-protein-anchored meals.
Animal protein gives ~25-30g protein per 100-120g cooked at ~150-200 kcal — which
fits inside the targets. Plant protein (lentils, chickpeas, beans) gives only
~9g per 100g cooked — meaning hitting 30g+ protein from plants alone requires
300g+ legumes (~300+ kcal before anything else), which overshoots the cap.

THEREFORE — for lunches and dinners (high protein floors of 35g and 30-35g):
- DEFAULT to animal protein as the anchor: chicken, salmon, white fish, eggs,
  Greek yogurt, paneer, cottage cheese. Use 100-150g cooked.
- A small amount of plant protein (60-100g cooked lentils/chickpeas) can be
  added as a side, NOT the main protein source.
- AVOID all-plant high-protein dinners. A lentil soup or chickpea stew that
  has to hit 30g protein from legumes alone WILL blow past 600 kcal.
- For pescatarian/vegetarian users: use eggs, paneer, Greek yogurt, cottage
  cheese, or tofu/tempeh (~10g pro per 100g) as the animal-protein equivalent.
- For full-vegan ONLY: relax protein floor to 20-25g; the user's strict
  calorie cap doesn't permit higher all-plant protein in a single meal.

PORTION GUARDRAILS (use these as anchors — exceeding them blows the budget):
- Animal protein per meal: 100–150g cooked. NOT 180g+, NOT a whole filet.
- Plant protein as SIDE (legumes, beans, tofu, tempeh): 60–100g cooked.
- Plant protein as MAIN (only for full-vegan meals): 150–200g cooked, max.
- Grains (cooked): 60–90g (~⅓ cup cooked). NOT 1 full cup.
- Avocado: 50–100g (¼ to ½ fruit). NEVER a whole avocado in one meal.
- Eggs: 1–2 large per meal. NOT 3 or 4.
- Olive oil / ghee / butter: 1 tbsp (15g / ~120 kcal) max.
- Tahini / nut butter: 1–2 tbsp (15–30g / ~100–200 kcal) max.
- Cheese / paneer: 30–50g per meal.
- Yogurt (Greek): 150–170g per meal.
- Coconut milk: 60-100ml max (~120-200 kcal — easy to overdo in stews).

CONCRETE WORKED EXAMPLES (these hit target):

LUNCH (target 420–500 kcal · 35–40g protein):
  120g grilled chicken breast    → 200 kcal · 36g pro
  80g cooked quinoa              → 95 kcal · 4g pro
  100g cooked chickpeas          → 115 kcal · 8g pro
  60g spinach + lemon            → 15 kcal · 2g pro
  1 tsp olive oil                → 40 kcal
  TOTAL: 465 kcal · 50g pro ← protein slightly over, calorie ✓

DINNER (target 350–430 kcal · 30–35g protein):
  120g pan-seared salmon         → 280 kcal · 25g pro
  80g cooked brown rice          → 90 kcal · 2g pro
  60g sautéed spinach            → 15 kcal · 2g pro
  1 tsp olive oil                → 40 kcal
  ½ lemon                        → 5 kcal
  TOTAL: 430 kcal · 29g pro ← protein 1g low, OK

If any single component (avocado, oil drizzle, grain serving) is >150 kcal, you're probably blowing the budget. CHECK YOUR TOTALS before finalizing each dish. Lunches and dinners are the highest-risk — do NOT exceed the upper bound.

PROTEIN FLOOR — flat 35g for breakfasts/lunches/dinners (HARD MINIMUM):
- Every breakfast: ≥35g protein
- Every lunch: ≥35g protein
- Every dinner: ≥35g protein
- Snacks: 10–15g protein only (snacks are top-ups, NOT meal-sized)
- USDA-verified portions — "2 eggs" alone is ~12g protein, NOT 35g. Combine
  multiple protein sources to hit the floor (e.g., 2 eggs + 150g Greek
  yogurt + 30g paneer = 35g protein). Do not hand-wave portion math.
- Daily total naturally lands at 105 + 10–15 = 115–120g/day from this rule
  alone — no separate daily-total check needed.
- If bodyData.proteinFloor is provided AND it's higher than 35g, use that instead.

DIET — HARD RULE (overrides every other rule including pantry):
- The user's "diet" setting in profile is the ONLY source of truth for what
  proteins they eat. Never let pantry items override diet.
- VEGETARIAN: NO meat (beef/pork/chicken/turkey/duck/lamb/etc.), NO fish or
  seafood. Eggs ✓, dairy ✓ (cheese/yogurt/milk/butter/ghee/paneer/kefir).
  Anchor protein on: 200g Greek yogurt (~20g), 2 eggs (~12g), paneer
  (~12g per 50g), cottage cheese (~24g per 200g), tempeh, tofu.
- VEGAN: NO animal products. NO meat, NO fish, NO eggs, NO dairy, NO honey.
  Anchor protein on: 200g extra-firm tofu (~32g), 100g tempeh (~20g), seitan,
  lentils, chickpeas, hemp seeds, nutritional yeast. Often need 2-3 plant
  proteins combined to hit 35g floor.
- PESCATARIAN: NO meat. Fish + dairy + eggs ✓.
- EVERYTHING: no restrictions.
- IF the pantry contains an ingredient that violates the user's diet (e.g.,
  user is vegetarian but pantry has salmon) → IGNORE that pantry item.
  Diet > pantry, ALWAYS. Never even mention it in suggested dishes.

VOICE / WRITING RULES:
- Recipe body copy ("title", "steps", drink "reason", phase-transition callouts) stays in Ruhi's voice — direct, warm, embodied; first person where natural. Do NOT name-drop practitioners inside body copy ("Vitti says…", "per Pelz…"). The practitioner attribution lives ONLY in the structured \`practitioners\` field on each dish; the UI surfaces it separately.
- Avoid the phrases "scientifically proven" or "clinically proven" anywhere in copy.

INGREDIENT QUANTITY RULES (critical for macro accuracy):
- For non-liquid ingredients, prefer GRAMS: "150g chicken breast", "60g spinach", "100g cooked lentils".
- For liquids, ml or cups are fine: "240ml broth" or "1 cup broth".
- For naturally-counted items, use counts with size: "1 large egg", "2 medium tomatoes", "3 garlic cloves".
- For tiny amounts (spices, salt, lemon squeeze), keep them human ("1 tsp turmeric", "salt to taste").
- Avoid vague volumes like "1 cup chickpeas" — write "150g cooked chickpeas" instead, since cup-to-gram conversions differ wildly by ingredient density.

PANTRY — A HINT, NOT A CONSTRAINT:
- The user's pantry is shared with you so you can be efficient (use what's already there when reasonable). It is NOT a hard ceiling on what dishes you can suggest.
- Cuisine + diet + phase drive creativity. The pantry is just a head-start.
- If pantry is sparse (only condiments + sauces, or fewer than 5 staples): generate creative cuisine-matching dishes using commonly-available grocery items. The shopping list will tell the user what to buy. Do NOT under-build the menu just because the pantry is empty.
- If pantry is rich: lean on it where it makes the cooking easier, but still rotate cuisines and dishes for variety. A user with chickpeas in the pantry shouldn't get chickpeas in 6 dishes — they get a creative weekly menu where chickpeas appear in the 1-2 dishes that genuinely benefit.
- When pantry contains a forbidden ingredient (vegetarian + salmon, vegan + eggs): IGNORE that pantry item completely. Diet > pantry, always.
- Pull from the wide world of recipes the user's chosen cuisines support. Indian + Mediterranean alone has hundreds of distinct dishes — variety isn't a constraint, it's an asset.

CUISINE ADHERENCE — STRICT:
- The user picks 1–3 cuisines during onboarding. Every dish MUST sit inside that cuisine palette. If the user picked "Indian, Mediterranean", do NOT generate Japanese, Thai, Mexican, or American dishes — even if the ingredients overlap.
- Cuisine = flavor profile + cooking technique + key spices, not just ingredients. "Soy-ginger salmon" reads Japanese; "Lemon-oregano salmon" reads Mediterranean. Pick the framing that matches.
- For each meal, name a specific cuisine in the title or description. This is a forcing function — if you can't name the cuisine, you're drifting toward generic.
- Mix across the week, but every dish anchors to ONE cuisine on the user's list.

SUPPLEMENTS:
- The user reports they take: ${supplements?.join(', ') || 'nothing reported'}.
- DO NOT recommend supplements or dosages. Only acknowledge what they've reported when relevant (e.g., "since you take magnesium, your luteal sleep should be better-supported").

SEED CYCLING (opt-in by user):
- ${seedCycling ? 'User does seed cycling. Surface a phaseBall reminder appropriate for the cycle-day range of this week (Phase 1: days 1–14 = flax + pumpkin; Phase 2: days 15–28 = sesame + sunflower). One ball per day. Note when they need to make the next batch.' : 'User does not do seed cycling — do not surface phase-ball reminders.'}

Generate a weekly menu that the user picks from across ${weekDays.length} days. The menu has 3–4 dishes per meal-type (so users can rotate, meal-prep style — the same dish appears on multiple days when the window is longer than the dish pool).`

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

ENERGY THIS WEEK:
${energyHints[energy] || energyHints[3]}

${bodyData ? `BODY DATA (use these targets):
- Calorie target: ${bodyData.calorieTarget || 'general phase-aware'}
- Protein floor: ${bodyData.proteinFloor || 25}g minimum
- Protein target: ${bodyData.proteinTarget || 'hit floor'}` : ''}

⚠️ REMINDER — every dish you write must hit its per-meal calorie + protein range. The math is enforced by USDA on the user's side. Your stated calorie/macro values must match what the listed gram-quantities actually produce when looked up. Lunches and dinners are highest-risk — keep portions tight, NEVER include a whole avocado, NEVER exceed 150g of any single protein source, NEVER use more than 1 tbsp of oil.

Use the return_weekly_menu tool to deliver:
1. A menu of dishes (3 breakfasts + 4 lunches + 3 snacks + 4 dinners + 6–9 drinks across morning/afternoon/evening). Each dish phase-tagged with which days it suits. Users will rotate through these across the planning window — keep variety bounded so meal-prep is realistic.
2. An auto-assignment of dishes to ALL ${weekDays.length} days in this planning window (cycle-aware: dish must match that day's phase + mode). Rotate dishes through the days as needed (e.g. same dinner appears on multiple days). Snacks are required (non-null) for menstrual + luteal days, optional for follicular + ovulatory.
3. An aggregated shopping list with quantities, categorized (produce/protein/pantry/dairy/frozen/other), with inPantry=true for items already in the user's pantry. Quantities should reflect the total used across the assignments (e.g. a dinner that appears 3 days needs 3× the protein).
4. Phase-transition callouts (1–3 short strings) for any day-to-day phase shifts in the window.
5. A seed-cycling note if applicable.

BEFORE FINALIZING EACH DISH: do a quick mental sum of (animal/plant protein kcal) + (grain kcal) + (fat kcal) + (vegetable kcal). If the total is outside the target range for that meal-type, REDUCE PORTIONS until it fits. A dish at 600 kcal for a 350–430 kcal dinner is unacceptable. A dish at 250 kcal for a 420–500 kcal lunch is also unacceptable.`

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
        // Match the user's picked window — was hardcoded 7 which broke 8-14 day plans
        minItems: weekDays.length,
        maxItems: weekDays.length,
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

    // Allowlist-enforce the practitioners field on every dish — runtime
    // backstop for any drift (typos, "Dr. Vitti", first names, hallucinated
    // names) that slipped past the schema's enum.
    allDishes.forEach((dish) => {
      dish.practitioners = sanitizePractitioners(dish.practitioners)
    })

    // Macro validation pass — for every dish, check kcal/protein/carbs/fat
    // against phase + diet aware targets. Severe failures (e.g. 800 kcal
    // dinner against a 350-430 cap, or 18g protein against a 30g floor)
    // trigger parallel Haiku retries. After retry we re-run USDA on the
    // new ingredient list so the user sees real macros, not Haiku's guess.
    // Per-meal-type retries are capped at 3 each to bound latency.
    const validationCtx = {
      diet: profile?.diet || 'everything',
      carbStrictness: profile?.carbStrictness || 'gentle',
      phaseName: weekDays?.[0]?.phase || 'unknown',
      cuisines: profile?.cuisines || [],
      pantry: pantry || '',
      allowedSurnames: ALLOWED_SURNAMES,
    }
    const validationAudit = []
    for (const cat of ['breakfasts', 'lunches', 'snacks', 'dinners']) {
      if (!menu[cat]?.length) continue
      const { audit } = await validateAndRetryAll(
        client,
        menu[cat],
        cat,
        validationCtx,
        { maxRetries: 3 }
      )
      validationAudit.push({ category: cat, entries: audit })
    }
    console.log('[generate-week] macro validation', JSON.stringify(validationAudit, null, 2))

    // Observability — distribution audit hook for weekly generation.
    const citationCounts = {}
    allDishes.forEach((dish) => {
      dish.practitioners.forEach((surname) => {
        citationCounts[surname] = (citationCounts[surname] || 0) + 1
      })
    })
    console.log('[generate-week] practitioners cited', {
      phasesInWeek: Array.from(new Set(phasesInWeek)),
      counts: citationCounts,
    })

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
      practitioners: {
        type: 'array',
        items: { type: 'string', enum: ALLOWED_SURNAMES },
        minItems: 0,
        maxItems: 3,
        description: 'Surnames (0–3) of the practitioners whose rules ground this dish. Use ONLY surnames from the allowlist. Empty array is valid — better silent than fabricated.',
      },
    },
    required: ['id', 'title', 'cookTime', 'calories', 'macros', 'ingredients', 'steps', 'phaseFit', 'mode', 'practitioners'],
  }
}

// Drop names outside the canonical allowlist; cap at 3; preserve order.
function sanitizePractitioners(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const cleaned = []
  for (const name of list) {
    if (typeof name !== 'string') continue
    if (!ALLOWED_SURNAMES.includes(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    cleaned.push(name)
    if (cleaned.length === 3) break
  }
  return cleaned
}
