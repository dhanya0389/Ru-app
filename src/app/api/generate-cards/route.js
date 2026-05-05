import Anthropic from '@anthropic-ai/sdk'
import { calculateMacros, formatMacros, formatCalories } from '@/lib/macros'
import {
  ALLOWED_SURNAMES,
  buildScienceFoundationBlock,
  normalizePhaseForRules,
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

  const { profile, phase, energy, cookingMood, kitchen, excludeMeal, pastEntries, preferences } = await request.json()

  const cookTimeMap = {
    quick: 'under 15 minutes',
    medium: '15–30 minutes',
    therapy: '30–45+ minutes',
  }

  const phaseForRules = normalizePhaseForRules(phase?.name)
  const scienceFoundation = buildScienceFoundationBlock(phaseForRules)

  const systemPrompt = `You are Ruhi, a personal health system grounded in the work of 10 women's-health practitioners. The SCIENCE FOUNDATION block below lists the rules — derived from those practitioners — that ground every recommendation you generate.

${scienceFoundation}

CARB RULES — universal (apply in every mode):
- "Complex carbs" means LOW-GI, fiber-rich whole grains and legumes ONLY:
  ✓ ALLOWED: lentils, chickpeas, black beans, mung beans, quinoa, oats, barley, buckwheat, brown rice (small portion), wild rice, steamed sweet potato, sprouted grain bread, sourdough
  ✗ FORBIDDEN: white rice (including basmati), white pasta, white bread, white flour, refined grains, sugar
- White basmati rice is HIGH-GI even when freshly cooked — never call it a complex carb.

CARB STRICTNESS — driven by user's profile.carbStrictness setting:
- "gentle" mode (DEFAULT for most users — building discipline, easing in):
  Include moderate complex carbs (~30–40g) at every meal in every phase.
  Sourdough, oats, quinoa, farro, brown rice (small portion), steamed sweet potato welcome at any meal.
  Glucose-flattening sequencing (vegetables → protein+fat → carbs) is still strict.
- "standard" mode (full cycle-syncing, phase-aware):
  Days 1–13 (menstrual + follicular): lower carb, focus on protein + healthy fats. Carbs 15–25g per meal.
  Days 14–28 (ovulatory + luteal): complex carbs welcome (30–45g per meal). Luteal especially benefits from complex carbs for progesterone support and serotonin.

ADDITIONAL MEAL CONSTRAINTS:
- Sweet potato: NEVER roast — microwave or steam only.
- Pair fruit with protein or fat, never alone.
- Prioritize anti-inflammatory ingredients (turmeric+black pepper, ginger, fatty fish, berries).

⚠️ CALORIE + PROTEIN TARGET — THE SINGLE MOST IMPORTANT RULE ⚠️

The meal card MUST land inside this range:
- Target: 350–430 kcal · ≥35g protein (HARD floor) · always warm

This is a HARD range. The user's USDA macro pipeline computes calories from your actual listed ingredient quantities — if you write "200g salmon + 1 whole avocado + 2 eggs + sourdough", the user will SEE 950 kcal regardless of what number you claim. The math is enforced after you submit.

PLAN PORTIONS BACKWARD from the target. USDA-verified portions — "2 eggs" alone is ~12g protein, NOT 35g. Combine multiple protein sources to hit the floor.

DIET — HARD RULE (overrides every other rule including pantry):
The user's "diet" setting is the ONLY source of truth for what proteins they eat. Never let pantry items override diet.
- VEGETARIAN: NO meat (beef/pork/chicken/turkey/lamb/etc.), NO fish or seafood. Eggs, dairy (cheese/yogurt/milk/butter/ghee/paneer/kefir) ✓.
- VEGAN: NO animal products. NO meat, NO fish, NO eggs, NO dairy, NO honey. Anchor on tofu/tempeh/seitan/lentils/chickpeas/hemp seeds/nutritional yeast.
- PESCATARIAN: NO meat. Fish + dairy + eggs ✓.
- EVERYTHING: no restrictions.
- IF the pantry contains a forbidden ingredient → IGNORE it. Diet > pantry, ALWAYS.

PROTEIN-SOURCE STRATEGY by diet:
- Omnivore/pescatarian: 100-150g cooked chicken/salmon/fish/eggs anchors easily at 35g protein.
- Vegetarian: 200g Greek yogurt (~20g) + 2 eggs (~12g) + paneer or cottage cheese hits 35g.
- Vegan: 150-200g extra-firm tofu (~24-32g) OR 100-150g tempeh (~20-30g) OR combine 2-3 plant proteins. Often need to push portions to hit 35g — that's fine.

PORTION GUARDRAILS (use these as anchors — exceeding them blows the budget):
- Animal protein: 100–150g cooked. NOT 180g+, NOT a whole filet.
- Plant protein as SIDE: 60–100g cooked legumes.
- Plant protein as MAIN (vegan only): 150–200g max.
- Grains (cooked): 60–90g (~⅓ cup cooked). NOT 1 full cup.
- Avocado: 50–100g (¼ to ½ fruit). NEVER a whole avocado in one meal.
- Eggs: 1–2 large per meal. NOT 3 or 4.
- Olive oil / ghee / butter: 1 tbsp (15g / ~120 kcal) max.
- Tahini / nut butter: 1–2 tbsp (15–30g / ~100–200 kcal) max.
- Cheese / paneer: 30–50g per meal.
- Coconut milk: 60-100ml max (~120-200 kcal — easy to overdo in stews).

CONCRETE WORKED EXAMPLE (this hits target):
  120g pan-seared salmon         → 280 kcal · 25g pro
  80g cooked brown rice          → 90 kcal · 2g pro
  60g sautéed spinach            → 15 kcal · 2g pro
  1 tsp olive oil                → 40 kcal
  ½ lemon                        → 5 kcal
  TOTAL: 430 kcal · 29g pro ← right at the edge, OK

If any single component is >200 kcal you're probably blowing the budget. CHECK YOUR TOTAL before finalizing. Use grams in the ingredients list — that's what makes the math enforceable. "1 whole avocado" with no gram count gets defaulted to 200g and blows the budget. Write "½ avocado (100g)" or "100g avocado" instead.

If the user is in luteal/menstrual, lean toward the upper protein bound (35g+).

VOICE / WRITING RULES:
- Card body copy ("description", "tip", "steps") stays in Ruhi's voice — direct, warm, embodied; first person where natural. Do NOT name-drop practitioners inside body copy ("Vitti says…", "per Pelz…"). The practitioner attribution lives ONLY in the structured \`practitioners\` field on each card; the UI surfaces it separately.
- Avoid the phrases "scientifically proven" or "clinically proven" anywhere in card copy.

PAST JOURNAL ENTRIES (when provided):
- The user may include 1–2 past journal entries from the same phase + day. Use them as silent context to make today's cards feel known — adjust tone, energy framing, or specific suggestions based on what she's said before.
- NEVER quote the entries directly. NEVER say "last cycle you said…" or "you mentioned…". The retrieval is silent — it shapes the cards, it does not narrate itself.
- If the past entry mentions a specific challenge (e.g. low energy, sleep trouble, a craving), let today's tip or movement subtly address it — without surfacing the entry.
- If past entries don't fit naturally, ignore them. Forced relevance is worse than no relevance.

INGREDIENT QUANTITY RULES (critical for macro accuracy):
- For non-liquid ingredients, prefer GRAMS: "150g chicken breast", "60g spinach", "100g cooked lentils".
- For liquids, ml or cups are fine: "240ml broth" or "1 cup broth".
- For naturally-counted items, use counts with size: "1 large egg", "2 medium tomatoes", "3 garlic cloves".
- For tiny amounts (spices, salt, lemon squeeze), keep them human ("1 tsp turmeric", "salt to taste").
- Avoid vague volumes like "1 cup chickpeas" — write "150g cooked chickpeas" instead, since cup-to-gram conversions differ wildly by ingredient density.

PANTRY SHORTCUT HINTS — APPLY AT EVERY ENERGY LEVEL:
- Scan the user's kitchen for pre-cooked, canned, frozen, or pre-prepped versions of ingredients your meal uses. When one matches, surface it inline as a shortcut tip — don't force the substitution, offer it.
- Examples:
  - meal calls for "cooked lentils" + pantry has "canned lentils" → in the \`tip\` field or as the first \`steps\` item: "you have canned lentils on hand — drain and use those instead of cooking from dry."
  - meal calls for "spinach" + pantry has "frozen spinach" → "frozen spinach in your pantry works — defrost and squeeze dry."
  - meal calls for "rice" + pantry has "microwave rice pouches" → "your pantry has microwave rice — skip the stove."
  - meal calls for "chicken" + pantry has "rotisserie chicken" → "rotisserie chicken from your pantry — pull and use cold."
- Surface the hint in the \`tip\` field (preferred) or as the first \`steps\` entry. NOT in the title. One short sentence, conversational.
- Skip the hint when no pantry shortcut applies — silence is fine.

Generate personalized daily wellness cards based on the user's profile, cycle phase, energy level, and what's in their kitchen.`

  const pastEntriesBlock = formatPastEntries(pastEntries)
  const preferencesBlock = formatPreferences(preferences)
  const lowEnergyShortcuts = (typeof energy === 'number' && energy <= 2)
    ? `\nLOW-ENERGY SHORTCUTS — ACTIVELY USE (the user's energy is ${energy}/5; treat these as first-class ingredients, not cop-outs):
- Frozen vegetables (frozen spinach, broccoli florets, cauliflower rice, riced broccoli, peas, edamame, stir-fry mixes) — microwave or steam-in-bag straight into the dish. Nutritionally equivalent to fresh and zero prep.
- Pre-cooked grains (microwave rice / quinoa pouches, pre-cooked lentil pouches, frozen pre-cooked brown rice).
- Canned legumes (rinsed chickpeas / black beans / lentils) — drain + go.
- Pre-washed bagged greens, pre-chopped vegetables, rotisserie chicken (diet permitting), frozen fish fillets baked from frozen.
Prefer a dish built from these over the fresh-prep equivalent. Use grams from the package as listed.`
    : ''

  const userMessage = `Generate my daily cards.

PROFILE:
- Age: ${profile?.age || 'not specified'}
- Diet: ${profile?.diet || 'everything'}
- Carb strictness: ${profile?.carbStrictness || 'gentle'}
- Cuisines: ${profile?.cuisines?.join(', ') || 'any'}
- Avoidances: ${profile?.avoidances || 'none'}
- Movement preferences: ${profile?.movements?.join(', ') || 'any'}
- Movement frequency: ${profile?.movementFrequency || 'moderate'}
- Goals: ${profile?.goals?.join(', ') || 'general wellness'}

TODAY:
- Cycle phase: ${phase?.name || 'unknown'} (Day ${phase?.day || '?'})
- Energy level: ${energy}/5
- Cooking mood: ${cookTimeMap[cookingMood] || '15–30 minutes'}
- What's in my kitchen: ${kitchen || 'general pantry staples'}
${excludeMeal ? `- Do NOT suggest "${excludeMeal}" — give me something different.` : ''}
${preferencesBlock}${lowEnergyShortcuts}${pastEntriesBlock}

⚠️ REMINDER — the meal card must hit 350–430 kcal · 30–35g protein. The math is enforced by USDA on the user's side. NEVER include a whole avocado or 200g+ of any single protein source. BEFORE finalizing the meal: do a quick mental sum of (protein kcal + grain kcal + fat kcal + vegetable kcal). If the total exceeds 430 kcal, REDUCE PORTIONS until it fits.

Use the return_cards tool to deliver your three cards.`

  // Schema enforced via tool_use. The model must return valid structured JSON
  // matching this shape — eliminates the parse-fragility we hit when the model
  // emitted free-form text JSON with stray characters or unescaped quotes.
  const cardsSchema = {
    type: 'object',
    properties: {
      meal: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Meal name' },
          cookTime: { type: 'string', description: 'e.g. "12 min"' },
          calories: { type: 'string', description: 'e.g. "~480 cal"' },
          macros: { type: 'string', description: 'e.g. "28g protein · 38g carbs · 22g fat"' },
          ingredients: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          imageQuery: {
            type: 'string',
            description: 'A 2-3 word stock-photo search query for this meal that would surface a beautiful, achievable bowl/plate photo. Examples: "lentil dal bowl", "salmon spinach plate", "chickpea curry bowl". Avoid brand names or specific cuisines unless central to the dish.',
          },
          practitioners: practitionersFieldSchema('this meal'),
        },
        required: ['title', 'cookTime', 'calories', 'macros', 'ingredients', 'steps', 'imageQuery', 'practitioners'],
      },
      movement: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          duration: { type: 'string', description: 'e.g. "20 min"' },
          description: { type: 'string', description: 'What to do and why it fits today.' },
          videoSearch: {
            type: 'string',
            description: 'A YouTube search query (3-6 words) that would surface a good follow-along video for this movement at the suggested duration. For yoga, prefer Yoga with Kassandra (use "Yoga with Kassandra" in the query). Example: "Yoga with Kassandra 20 min luteal" or "10 minute walking workout".',
          },
          practitioners: practitionersFieldSchema('this movement recommendation'),
        },
        required: ['title', 'duration', 'description', 'videoSearch', 'practitioners'],
      },
      energy: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Mindset card title' },
          description: { type: 'string', description: 'Phase-appropriate energy and work guidance.' },
          tip: { type: 'string', description: 'One specific actionable tip for tonight.' },
          practitioners: practitionersFieldSchema('this energy/mindset guidance'),
        },
        required: ['title', 'description', 'tip', 'practitioners'],
      },
    },
    required: ['meal', 'movement', 'energy'],
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [
        {
          name: 'return_cards',
          description: 'Return the three personalized daily wellness cards (meal, movement, energy) for the user.',
          input_schema: cardsSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'return_cards' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse) {
      console.error('Claude did not call return_cards. Stop reason:', message.stop_reason)
      return Response.json({ error: 'Failed to generate cards' }, { status: 500 })
    }

    // Replace the model's macro guess with calculated values from USDA
    // FoodData Central. The model is bad at math; this is a real lookup.
    // Falls through to the model's values if USDA_API_KEY is missing or
    // the lookup fails.
    const cards = toolUse.input
    if (cards.meal?.ingredients?.length) {
      const calculated = await calculateMacros(cards.meal.ingredients)
      if (calculated) {
        cards.meal.macros = formatMacros(calculated)
        cards.meal.calories = formatCalories(calculated)
        cards.meal.macrosSource = 'usda'
      } else {
        // USDA couldn't price the meal — hide macros instead of falling
        // back to Haiku's guess. Trust call: misleading numbers labeled
        // "EST" worse than no number. Display layer renders 'Macros pending'
        // when macros is null.
        cards.meal.macros = null
        cards.meal.calories = null
        cards.meal.macrosSource = 'unverified'
      }
    }

    // Allowlist-enforce the practitioners field on each card. The prompt asks
    // for surname-only from a fixed 10-name set; this is the runtime backstop
    // against drift (typos, "Dr. Vitti", first names, hallucinated names).
    if (cards.meal) cards.meal.practitioners = sanitizePractitioners(cards.meal.practitioners)
    if (cards.movement) cards.movement.practitioners = sanitizePractitioners(cards.movement.practitioners)
    if (cards.energy) cards.energy.practitioners = sanitizePractitioners(cards.energy.practitioners)

    // Macro validation pass for the daily meal card — same path as
    // generate-week. The meal card uses 'meal' as the meal-type key (350-430
    // kcal · 30-35g protein, dinner-equivalent). Severe failures trigger
    // a single Haiku retry with phase + diet aware constraints.
    if (cards.meal) {
      const validationCtx = {
        diet: profile?.diet || 'everything',
        carbStrictness: profile?.carbStrictness || 'gentle',
        phaseName: phase?.name || 'unknown',
        cuisines: profile?.cuisines || [],
        pantry: kitchen || '',
        allowedSurnames: ALLOWED_SURNAMES,
      }
      const dishes = [cards.meal]
      const { audit } = await validateAndRetryAll(client, dishes, 'meal', validationCtx, { maxRetries: 1 })
      cards.meal = dishes[0]
      console.log('[generate-cards] meal validation', JSON.stringify(audit, null, 2))
      // Re-sanitize practitioners after retry (Haiku may have reshuffled them)
      cards.meal.practitioners = sanitizePractitioners(cards.meal.practitioners)
    }

    // Observability — distribution audit hook. After two weeks, compare
    // citation frequency across the 10; if any are never cited, expand or
    // tune the rule corpus.
    console.log('[generate-cards] practitioners cited', {
      phase: phaseForRules,
      meal: cards.meal?.practitioners ?? [],
      movement: cards.movement?.practitioners ?? [],
      energy: cards.energy?.practitioners ?? [],
    })

    return Response.json(cards)
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json(
      { error: 'Failed to generate cards' },
      { status: 500 }
    )
  }
}

// Tool-use schema fragment for the per-card `practitioners` field. Repeated
// across meal/movement/energy so each card carries its own attribution.
function practitionersFieldSchema(target) {
  return {
    type: 'array',
    items: { type: 'string', enum: ALLOWED_SURNAMES },
    minItems: 0,
    maxItems: 3,
    description: `Surnames (0–3) of the practitioners whose rules ground ${target}. Use ONLY surnames from the allowlist above. Empty array is valid — better silent than fabricated.`,
  }
}

// Render past journal entries (if any) into a block of plain prose for the
// user message. Returns '' when no usable entries — keeps the prompt clean
// and avoids signaling "this section is empty" to the model.
function formatPastEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return ''
  const lines = entries
    .filter((e) => e && typeof e.note === 'string' && e.note.trim())
    .slice(0, 2)
    .map((e) => {
      const dayLabel = typeof e.day === 'number' ? `Day ${e.day}` : 'past'
      const energyLabel = typeof e.energy === 'number' ? `${e.energy}/5` : '?'
      // Hard-cap each note at 240 chars so a runaway entry can't dominate the
      // prompt budget. Voice-journal entries are typically 30s of speech, ~80
      // words / ~450 chars — keep the most recent slice.
      const note = e.note.trim().slice(0, 240)
      return `- (${dayLabel}, energy ${energyLabel}): "${note}"`
    })
  if (lines.length === 0) return ''
  return `\nPAST NOTES from same phase + day (silent context — do not quote, never say "you mentioned"):\n${lines.join('\n')}`
}

// Soft preferences extracted from typed prose (persisted in EditPantry).
// Only used in the meal card — variety constraints don't apply to a single
// dish. Honor where reasonable; HARD rules (diet, macro target) win.
function formatPreferences(preferences) {
  if (!Array.isArray(preferences) || preferences.length === 0) return ''
  const cleaned = preferences
    .filter((p) => typeof p === 'string' && p.trim())
    .map((p) => `- ${p.trim()}`)
  if (cleaned.length === 0) return ''
  return `\nUSER PREFERENCES (honor where reasonable — soft rules, hard rules win on conflict):\n${cleaned.join('\n')}`
}

// Drop anything outside the canonical allowlist; cap at 3 names; preserve order.
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
