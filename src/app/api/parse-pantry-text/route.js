import Anthropic from '@anthropic-ai/sdk'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// Smart text parser. The pantry input + Weekly Mode "anything new to add"
// textbox accept three kinds of input from one box:
//
//   1. Pantry additions     "eggs, kefir, sourdough"           → items
//   2. Soft preferences     "I want eggs every morning"        → preferences
//   3. Hard variety caps    "just 2 proteins this week"        → constraints
//
// Mixed input is normal: "I have salmon, and limit to 2 proteins" should
// produce one item, zero preferences, one constraint. The shape-based
// router in src/lib/pantryParse.js skips this route for trivial comma
// lists (≤4 words per fragment) — so by the time we get here, prose is
// likely involved.

const KNOWN_CAP_KEYS = [
  'maxProteins',
  'maxCarbs',
  'maxVegetables',
  'maxFruits',
  'maxFats',
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

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return Response.json({ items: [], preferences: [], constraints: {} })
  }

  // Hard cap on input length — pantry textbox shouldn't be a journal entry.
  if (text.length > 2000) {
    return Response.json(
      { error: 'text_too_long', message: 'Keep it under ~2000 characters.' },
      { status: 413 }
    )
  }

  const systemPrompt = `You are Ruhi's pantry-text parser. The user is typing into a textbox that handles THREE input types — possibly mixed in one input:

1. PANTRY ITEMS — concrete foods they have on hand. Examples: "eggs", "Greek yogurt", "tahini", "sourdough bread".
2. PREFERENCES — soft, qualitative preferences for the AI to honor where reasonable. Examples: "I want eggs every morning", "prefers tahini-lemon dressings", "loves Mediterranean", "no spicy food please".
3. CONSTRAINTS — HARD numeric variety caps for the week's menu. Examples: "limit to 2 proteins this week", "use just 2 carbs", "max 3 different vegetables".

Extract each into its own bucket via the parse_pantry_text tool. Rules:

ITEMS:
- Concrete food ingredients only. Lowercase except proper nouns ("Greek yogurt" stays).
- Don't include quantities ("2 eggs" → "eggs"). Don't include brand SKUs.
- If the user says "I have eggs and salmon", extract ["eggs", "salmon"].
- If the user only states a preference or constraint, items can be empty.

PREFERENCES:
- One natural-language sentence per preference, written from the user's POV ("wants eggs every morning", "prefers warm breakfasts", "no spicy food").
- Capture qualitative wishes. Don't capture numeric caps here — those are constraints.
- "I want eggs every morning" → preferences: ["wants eggs every morning"]; items: ["eggs"]
- "I prefer Mediterranean" → preferences: ["prefers Mediterranean cuisine"]; items: []

CONSTRAINTS — numeric variety caps for the week:
- maxProteins, maxCarbs, maxVegetables, maxFruits, maxFats — each is a single integer for "max distinct sources of this nutrient across the menu". The downstream meal generator interprets "distinct" in the full context of the user's preferences (casual intent, not strict taxonomy). Your job here is to capture the user's number cleanly.

WHEN TO USE A CAP vs. WHEN TO USE A PREFERENCE:
The cap field and the preferences array are NOT mutually exclusive — input can produce both simultaneously when the user gives multiple signals.
- BARE NUMBER ("just 2 proteins", "max 3 veggies", "only 2 carbs", "i need 3 protein options") → set the cap.
- NUMBER SCOPED PER MEAL SEGMENT ("1 carb for breakfast, 2 for lunch and dinner") → do NOT set the cap field. Capture the full scoped intent as a preference instead, e.g. preferences: ["wants 1 distinct carb at breakfast and 2 across lunch + dinner"]. The downstream prompt honors scoped preferences literally.
- NAMED ITEM TO INCLUDE ("Mahi Mahi must be one of the proteins", "eggs every morning") → preference. Item-level locks belong in preferences.
- FROZEN / PREP-STYLE ("one frozen vegetable", "include rotisserie chicken") → preference.
- QUALITATIVE ("keep it simple", "more variety") → preference.

When inputs combine multiple signals (e.g. "Mahi Mahi must be one of the proteins and i need 3 protein options"), capture EACH signal in its appropriate field — the named item as a preference, the bare number as a cap. Both signals reinforce each other downstream.

- ONLY set a cap if the user states a bare integer (no scope, can be combined with named items). NEVER guess.
- Omit (null) any cap the user didn't mention.

Definitions to keep in mind while parsing (the downstream generator uses these too):
- "Proteins" in casual user speech = meat-style mains (chicken, salmon, fish, beef, pork, turkey, lamb, tofu, tempeh, seitan). Eggs, dairy proteins (yogurt, cottage cheese, paneer, kefir), and legumes (lentils, chickpeas, beans) are NOT counted by default.
- Snacks count separately and are deliberately unconstrained.

OUTPUT GUARANTEES:
- items, preferences, constraints are ALL required (return empty array / empty object if none).
- Never invent items or constraints that aren't in the text.
- When uncertain, prefer preferences over constraints (preferences are soft, constraints are hard).`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [
        {
          name: 'parse_pantry_text',
          description: 'Return the structured parse of the pantry textbox input.',
          input_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'string' },
                description: 'Concrete food ingredients to add to the pantry.',
              },
              preferences: {
                type: 'array',
                items: { type: 'string' },
                description: 'Soft, natural-language preferences for the AI to honor where reasonable.',
              },
              constraints: {
                type: 'object',
                properties: {
                  maxProteins: {
                    type: ['integer', 'null'],
                    description: 'Max distinct protein sources across the week. Null if not specified.',
                  },
                  maxCarbs: {
                    type: ['integer', 'null'],
                    description: 'Max distinct carb sources. Null if not specified.',
                  },
                  maxVegetables: {
                    type: ['integer', 'null'],
                    description: 'Max distinct vegetables. Null if not specified.',
                  },
                  maxFruits: {
                    type: ['integer', 'null'],
                    description: 'Max distinct fruits. Null if not specified.',
                  },
                  maxFats: {
                    type: ['integer', 'null'],
                    description: 'Max distinct fat sources (oils, nuts, seeds). Null if not specified.',
                  },
                },
                required: ['maxProteins', 'maxCarbs', 'maxVegetables', 'maxFruits', 'maxFats'],
              },
            },
            required: ['items', 'preferences', 'constraints'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'parse_pantry_text' },
      messages: [
        {
          role: 'user',
          content: `Parse this pantry textbox input. Use the parse_pantry_text tool.\n\n${text}`,
        },
      ],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse) {
      console.error('parse-pantry-text: model did not call tool', message.stop_reason)
      return Response.json({ error: 'parse_failed' }, { status: 500 })
    }

    const items = Array.isArray(toolUse.input.items)
      ? toolUse.input.items
          .filter((s) => typeof s === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const preferences = Array.isArray(toolUse.input.preferences)
      ? toolUse.input.preferences
          .filter((s) => typeof s === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    // Allowlist + sanity-cap the constraint values. The schema allows null,
    // and we drop nulls here. Caps below 1 are nonsensical (max 0 of anything
    // breaks the menu); caps above 10 are effectively no-cap and wasteful.
    const rawConstraints = (toolUse.input.constraints && typeof toolUse.input.constraints === 'object')
      ? toolUse.input.constraints
      : {}
    const constraints = {}
    for (const key of KNOWN_CAP_KEYS) {
      const value = rawConstraints[key]
      if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10) {
        constraints[key] = value
      }
    }

    return Response.json({ items, preferences, constraints })
  } catch (error) {
    console.error('parse-pantry-text error:', error)
    return Response.json({ error: 'parse_failed' }, { status: 500 })
  }
}
