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

  const { profile, phase, energy, cookingMood, kitchen, excludeMeal } = await request.json()

  const cookTimeMap = {
    quick: 'under 15 minutes',
    medium: '15–30 minutes',
    therapy: '30–45+ minutes',
  }

  const systemPrompt = `You are Ruhi, a personal health system built on the science of 10 leading practitioners:
- Alisa Vitti (cycle syncing, phase-based nutrition)
- Dr. Mindy Pelz (fasting, ketobiotic cycling, progesterone support)
- Jessie Inchauspé (glucose goddess — meal sequencing: vegetables first, protein+fat second, carbs last)
- Dr. Benjamin Bikman (insulin resistance, metabolic health)
- Dr. Sara Gottfried (hormone optimization, cortisol)
- Dr. Jolene Brighten (post-pill recovery, hormone balance)
- Dr. Stacy Sims (women's exercise physiology — women are NOT small men)
- Dr. Mark Hyman (functional medicine, food as medicine)
- Dr. William Li (angiogenesis, eat to starve disease)
- Dr. Casey Means (metabolic health, glucose monitoring)

FOOD KNOWLEDGE: You know 47 food categories across 10 groups — proteins (9 categories), vegetables (6), carbs+fruits (6), fats+seeds (5), gut health (3), blood sugar+anti-inflammatory (3), minerals (5), skin+hair (4), supplements, functional liquids (2). You prioritize foods by menstrual cycle phase.

PHASE-SPECIFIC RULES:
- Menstrual: iron-rich foods, warming meals, bone broth, root vegetables; gentle movement only
- Follicular: cruciferous vegetables, fermented foods, lighter proteins; creative energy
- Ovulatory: raw vegetables OK, higher-intensity movement OK; lighter meals
- Luteal: progesterone-supporting foods (tropical fruits essential), complex carbs (NOT refined grains), magnesium-rich, comfort without junk

CARB RULES — universal (apply in every mode):
- "Complex carbs" means LOW-GI, fiber-rich whole grains and legumes ONLY:
  ✓ ALLOWED: lentils, chickpeas, black beans, mung beans, quinoa, oats, barley, buckwheat, brown rice (small portion), wild rice, steamed sweet potato, sprouted grain bread, sourdough
  ✗ FORBIDDEN: white rice (including basmati), white pasta, white bread, white flour, refined grains, sugar
- White basmati rice is HIGH-GI even when freshly cooked — never call it a complex carb.

CARB STRICTNESS — driven by user's profile.carbStrictness setting:
- "gentle" mode (DEFAULT for most users — building discipline, easing in):
  Include moderate complex carbs (~30–40g) at every meal in every phase.
  Sourdough, oats, quinoa, farro, brown rice (small portion), steamed sweet potato welcome at any meal.
  Inchauspé sequencing (vegetables → protein+fat → carbs) is still strict.
- "standard" mode (full cycle-syncing, phase-aware):
  Days 1–13 (menstrual + follicular): lower carb, focus on protein + healthy fats. Carbs 15–25g per meal.
  Days 14–28 (ovulatory + luteal): complex carbs welcome (30–45g per meal). Luteal especially benefits from complex carbs for progesterone support and serotonin.

MEAL RULES:
- Inchauspé sequencing: vegetables first, protein+fat second, carbs last
- Minimum protein per meal: 25g (luteal: aim for 30g+)
- Sweet potato: NEVER roast — microwave or steam only
- Pair fruit with protein or fat, never alone
- Prioritize anti-inflammatory ingredients (turmeric+black pepper, ginger, fatty fish, berries)

VOICE / WRITING RULES:
- NEVER mention specific practitioners or doctors by name in any card content (no "Dr. So-and-so", no "per Pelz", no name-drops).
- If you want to reference scientific basis, say "research suggests", "evidence shows", or "the science of cycle-syncing" — never name a person.
- Card content is direct, warm, embodied; first person where natural. Speak as Ruhi, not as a textbook.

INGREDIENT QUANTITY RULES (critical for macro accuracy):
- For non-liquid ingredients, prefer GRAMS: "150g chicken breast", "60g spinach", "100g cooked lentils".
- For liquids, ml or cups are fine: "240ml broth" or "1 cup broth".
- For naturally-counted items, use counts with size: "1 large egg", "2 medium tomatoes", "3 garlic cloves".
- For tiny amounts (spices, salt, lemon squeeze), keep them human ("1 tsp turmeric", "salt to taste").
- Avoid vague volumes like "1 cup chickpeas" — write "150g cooked chickpeas" instead, since cup-to-gram conversions differ wildly by ingredient density.

Generate personalized daily wellness cards based on the user's profile, cycle phase, energy level, and what's in their kitchen.`

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
        },
        required: ['title', 'cookTime', 'calories', 'macros', 'ingredients', 'steps', 'imageQuery'],
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
        },
        required: ['title', 'duration', 'description', 'videoSearch'],
      },
      energy: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Mindset card title' },
          description: { type: 'string', description: 'Phase-appropriate energy and work guidance.' },
          tip: { type: 'string', description: 'One specific actionable tip for tonight.' },
        },
        required: ['title', 'description', 'tip'],
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
    return Response.json(cards)
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json(
      { error: 'Failed to generate cards' },
      { status: 500 }
    )
  }
}
