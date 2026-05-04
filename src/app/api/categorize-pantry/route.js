import Anthropic from '@anthropic-ai/sdk'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// 9 buckets — same set used by the UI. The "other" bucket is the
// model's escape hatch for anything genuinely off-list (e.g. ice cream),
// kept intentionally narrow so common items go to a real category.
const BUCKETS = [
  'protein',
  'carbs',
  'vegetables',
  'fruits',
  'fats',
  'spices',
  'condiments',
  'drinks',
  'other',
]

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

  const items = Array.isArray(body?.items)
    ? body.items.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
    : []
  if (items.length === 0) {
    return Response.json({ categories: {} })
  }

  const systemPrompt = `You are Ruhi's pantry categorizer. Classify each food item into EXACTLY ONE of these buckets.

BUCKET RULES (apply in this priority order — first match wins):
- protein: meats, fish, shellfish, eggs, tofu, tempeh, lentils, chickpeas, beans, mung beans, dairy proteins (yogurt, paneer, cottage cheese, milk, kefir, cheese)
- carbs: rice, oats, quinoa, barley, buckwheat, bread, pasta, noodles, tortillas, sweet potato, regular potato, corn, polenta
- vegetables: leafy greens (spinach, kale, lettuce), cruciferous (broccoli, cauliflower, brussels sprouts), alliums (onion, garlic, leek, scallion), peppers, tomatoes, mushrooms, cucumber, zucchini, carrots, beets, celery, eggplant, asparagus, green beans
- fruits: berries, apples, citrus (lemon, lime, orange), banana, melon, grapes, mango, pineapple, peach, pear, avocado (avocado is a fruit even though it's high-fat)
- fats: cooking oils (olive, avocado, coconut, sesame), ghee, butter, nuts (almonds, walnuts, cashews), nut butters, tahini, seeds (flax, pumpkin, sesame, sunflower, chia, hemp), seed butters
- spices: dry spices, fresh herbs (cilantro, basil, parsley, mint, dill), salt, pepper, ginger root, fresh turmeric, chili
- condiments: vinegars (apple cider, balsamic, rice), soy sauce, tamari, fish sauce, hot sauce, mustard, ketchup, miso, broth, stock, bone broth, honey, maple syrup, jams, dressings, mayonnaise
- drinks: teas (green, black, herbal, matcha), coffee, drink mixes, supplement powders (collagen, creatine, magnesium powder, electrolyte mixes), kombucha
- other: only if it genuinely doesn't fit any of the above

Edge cases:
- yogurt, kefir, paneer, cottage cheese → protein (their protein content is the reason they're tracked)
- avocado → fruits (despite high fat, it's a fruit)
- sweet potato → carbs (a starchy carb, not a vegetable for cycle-aware planning)
- broth/stock → condiments (a cooking liquid + flavor, not a drink)
- honey → condiments (a sweetener used like a topping, not a wellness drink)
- ginger root, fresh turmeric → spices (used as flavor)
- supplement pills/capsules (e.g. "vitamin D", "omega 3") → drinks (the wellness bucket)

Always return a category for every item. Never skip. If truly unclassifiable, use "other" — but try hard to find a real bucket.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [
        {
          name: 'return_categories',
          description: 'Return the bucket assignment for each pantry item.',
          input_schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item: { type: 'string', description: 'The exact input item string (preserve casing).' },
                    category: { type: 'string', enum: BUCKETS },
                  },
                  required: ['item', 'category'],
                },
                description: 'One entry per input item — every input must appear in the output.',
              },
            },
            required: ['results'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'return_categories' },
      messages: [
        {
          role: 'user',
          content: `Categorize these pantry items:\n${items.map((it, i) => `${i + 1}. ${it}`).join('\n')}\n\nUse return_categories.`,
        },
      ],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse) {
      console.error('categorize-pantry: model did not call tool', message.stop_reason)
      return Response.json({ error: 'categorize_failed' }, { status: 500 })
    }

    // Build a map from item name → bucket. Allowlist-enforce buckets so a
    // model drift can't introduce a category the UI doesn't know about.
    const categories = {}
    const results = Array.isArray(toolUse.input.results) ? toolUse.input.results : []
    for (const row of results) {
      if (!row || typeof row.item !== 'string') continue
      const bucket = BUCKETS.includes(row.category) ? row.category : 'other'
      categories[row.item.trim()] = bucket
    }

    return Response.json({ categories })
  } catch (error) {
    console.error('categorize-pantry error:', error)
    return Response.json({ error: 'categorize_failed' }, { status: 500 })
  }
}
