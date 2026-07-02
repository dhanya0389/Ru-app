import Anthropic from '@anthropic-ai/sdk'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// Sanity caps. The client compresses each image to a ~300-700 KB JPEG
// before upload (see compressImage in PantryImageUpload.js) so these
// limits assume post-compression payloads. The PER-IMAGE cap is a
// generous safety net in case compression somehow produces an oversized
// blob (e.g., a multi-megapixel photo of pure noise that doesn't shrink).
// The TOTAL cap is the load-bearing one — Vercel rejects serverless
// request bodies above ~4.5 MB, so the sum of all base64 payloads must
// stay below that across however many images the user uploads.
const MAX_BASE64_LENGTH = 1_600_000        // ~1.2 MB raw per image (post-compression)
const MAX_TOTAL_BASE64_LENGTH = 4_000_000  // ~3 MB raw total across all images
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
// Cap at 5 photos per upload — covers fridge-from-multiple-angles or pantry +
// fridge in one go without runaway token costs (~$0.05/upload at 5 images).
const MAX_IMAGES = 5

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

  // Accept either the new `images: [{ base64, mediaType }]` array shape or
  // the legacy single-image `imageBase64` shape (so a stale client doesn't
  // 400 mid-rollout). Internally everything is the array path.
  let images
  if (Array.isArray(body?.images)) {
    images = body.images
  } else if (body?.imageBase64) {
    images = [{ base64: body.imageBase64, mediaType: body.mediaType }]
  } else {
    return Response.json({ error: 'missing_images' }, { status: 400 })
  }

  if (images.length === 0) {
    return Response.json({ error: 'missing_images' }, { status: 400 })
  }
  if (images.length > MAX_IMAGES) {
    return Response.json(
      { error: 'too_many_images', message: `Up to ${MAX_IMAGES} photos at a time.` },
      { status: 413 }
    )
  }

  // Validate each image; coerce media type to a safe default. Track total
  // payload size so we can reject combos that would blow past Vercel's
  // request body cap even when each individual image is under the per-
  // image limit.
  const sanitized = []
  let totalBase64Length = 0
  for (const img of images) {
    const base64 = typeof img?.base64 === 'string' ? img.base64 : null
    if (!base64) {
      return Response.json({ error: 'bad_image' }, { status: 400 })
    }
    if (base64.length > MAX_BASE64_LENGTH) {
      return Response.json(
        {
          error: 'image_too_large',
          message: 'One of your photos is too large even after compression. Try uploading one at a time.',
        },
        { status: 413 }
      )
    }
    totalBase64Length += base64.length
    if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
      return Response.json(
        {
          error: 'payload_too_large',
          message: 'Too many photos at once. Try uploading fewer at a time.',
        },
        { status: 413 }
      )
    }
    sanitized.push({
      base64,
      mediaType: ALLOWED_MEDIA_TYPES.has(img.mediaType) ? img.mediaType : 'image/jpeg',
    })
  }

  const photoCount = sanitized.length
  const photoNoun = photoCount === 1 ? 'photo' : `${photoCount} photos`

  const systemPrompt = `You are Ruhi's pantry vision. The user has uploaded ${photoNoun} of their fridge, pantry shelf, counter, or grocery haul. Your job is to identify the food ingredients visible across all of them — nothing else.

Hard rules:
- Output ingredient names a home cook would type into a pantry list. Examples: "spinach", "chickpeas", "salmon fillet", "Greek yogurt", "tahini", "lemons", "sourdough bread".
- Use lowercase except for proper-noun brand names ("Greek yogurt" is fine; "TRADER JOE'S" is not — return "trader joe's almonds" or just "almonds").
- Combine variants and DEDUPE across photos — if "spinach" appears in two photos, return it once. If you see three apples, return "apples" once.
- Skip non-food: dish soap, paper towels, tupperware, utensils, hands. Skip prepared takeout containers (we can't parse what's inside).
- Skip if you genuinely can't tell. Better to return fewer items confidently than to guess.
- Don't include quantities — the pantry is a what-they-have list, not how-much.
- Don't include brand-specific SKUs — "almond milk" not "Califia Farms unsweetened vanilla almond milk".
- If the photos show nothing food-related, return an empty array.

Return via the return_pantry_items tool.`

  // Build the message content: all images first, then a single text prompt
  // referencing them collectively. Anthropic dedupes attention across image
  // blocks naturally — one categorization pass covers the whole set.
  const userContent = [
    ...sanitized.map((img) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    })),
    {
      type: 'text',
      text: photoCount === 1
        ? 'What food ingredients can you see? Use the return_pantry_items tool.'
        : `What food ingredients can you see across these ${photoCount} photos? Combine and dedupe — list each item once even if it appears in multiple photos. Use the return_pantry_items tool.`,
    },
  ]

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [
        {
          name: 'return_pantry_items',
          description: 'Return the deduped list of food ingredients identified across the photo(s).',
          input_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'string' },
                description: 'Identified food ingredients, deduped across all photos. Empty if nothing food-related is visible.',
              },
              note: {
                type: ['string', 'null'],
                description: 'Optional 1-sentence note ONLY if a photo is hard to read or suspicious — e.g. "blurry; recheck the bottom shelf". Null otherwise.',
              },
            },
            required: ['items', 'note'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'return_pantry_items' },
      messages: [{ role: 'user', content: userContent }],
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

    return Response.json({ items, note, photosProcessed: photoCount })
  } catch (error) {
    console.error('parse-pantry-image error:', error)
    return Response.json({ error: 'vision_failed' }, { status: 500 })
  }
}
