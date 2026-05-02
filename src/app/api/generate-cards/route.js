import Anthropic from '@anthropic-ai/sdk'
import { calculateMacros, formatMacros, formatCalories } from '@/lib/macros'
import {
  ALLOWED_SURNAMES,
  buildScienceFoundationBlock,
  normalizePhaseForRules,
} from '@/lib/practitioners'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

export async function POST(request) {
  if (!client) {
    return Response.json(
      { error: 'missing_api_key', message: 'ANTHROPIC_API_KEY not set. See .env.local.example.' },
      { status: 503 }
    )
  }

  const { profile, phase, energy, cookingMood, kitchen, excludeMeal, pastEntries } = await request.json()

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

Generate personalized daily wellness cards based on the user's profile, cycle phase, energy level, and what's in their kitchen.`

  const pastEntriesBlock = formatPastEntries(pastEntries)

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
${pastEntriesBlock}

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
      }
    }

    // Allowlist-enforce the practitioners field on each card. The prompt asks
    // for surname-only from a fixed 10-name set; this is the runtime backstop
    // against drift (typos, "Dr. Vitti", first names, hallucinated names).
    if (cards.meal) cards.meal.practitioners = sanitizePractitioners(cards.meal.practitioners)
    if (cards.movement) cards.movement.practitioners = sanitizePractitioners(cards.movement.practitioners)
    if (cards.energy) cards.energy.practitioners = sanitizePractitioners(cards.energy.practitioners)

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
