import Anthropic from '@anthropic-ai/sdk'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// Sanity caps. Anthropic's vision API accepts up to ~5MB per image; we send
// base64 from the client so the encoded payload is ~33% larger than raw bytes.
// Keep the raw under 4MB to stay under the JSON body limit comfortably.
const MAX_BASE64_LENGTH = 6_000_000  // ~4.5MB raw
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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

  const { imageBase64, mediaType } = body || {}
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return Response.json({ error: 'missing_image' }, { status: 400 })
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return Response.json(
      { error: 'image_too_large', message: 'Image is too large. Try a smaller photo.' },
      { status: 413 }
    )
  }
  const safeMediaType = ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType : 'image/jpeg'

  const systemPrompt = `You are Ruhi's pantry vision. The user has uploaded a photo of their fridge, pantry shelf, counter, or grocery haul. Your job is to identify the food ingredients visible — nothing else.

Hard rules:
- Output ingredient names a home cook would type into a pantry list. Examples: "spinach", "chickpeas", "salmon fillet", "Greek yogurt", "tahini", "lemons", "sourdough bread".
- Use lowercase except for proper-noun brand names ("Greek yogurt" is fine; "TRADER JOE'S" is not — return "trader joe's almonds" or just "almonds").
- Combine variants — if you see three apples, return "apples" once, not "apple, apple, apple".
- Skip non-food: dish soap, paper towels, tupperware, utensils, hands. Skip prepared takeout containers (we can't parse what's inside).
- Skip if you genuinely can't tell. Better to return fewer items confidently than to guess.
- Don't include quantities — the pantry is a what-they-have list, not how-much.
- Don't include brand-specific SKUs — "almond milk" not "Califia Farms unsweetened vanilla almond milk".
- If the image shows nothing food-related, return an empty array.

Return via the return_pantry_items tool.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [
        {
          name: 'return_pantry_items',
          description: 'Return the list of food ingredients identified in the photo.',
          input_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'string' },
                description: 'Identified food ingredients, deduped. Empty if nothing food-related is visible.',
              },
              note: {
                type: ['string', 'null'],
                description: 'Optional 1-sentence note ONLY if the photo is hard to read or suspicious — e.g. "blurry; recheck the bottom shelf". Null otherwise.',
              },
            },
            required: ['items', 'note'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'return_pantry_items' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: safeMediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'What food ingredients can you see? Use the return_pantry_items tool.',
            },
          ],
        },
      ],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse) {
      console.error('parse-pantry-image: model did not call tool', message.stop_reason)
      return Response.json({ error: 'parse_failed' }, { status: 500 })
    }

    const items = Array.isArray(toolUse.input.items)
      ? toolUse.input.items
          .filter((s) => typeof s === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const note = typeof toolUse.input.note === 'string' ? toolUse.input.note.trim() : null

    return Response.json({ items, note })
  } catch (error) {
    console.error('parse-pantry-image error:', error)
    return Response.json({ error: 'vision_failed' }, { status: 500 })
  }
}
