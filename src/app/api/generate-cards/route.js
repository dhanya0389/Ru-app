import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request) {
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
- Menstrual: iron-rich foods critical, warming foods, bone broth, root vegetables, gentle movement only
- Follicular: cruciferous vegetables, fermented foods, lighter proteins, creative energy — try new things
- Ovulatory: raw vegetables OK, high-intensity movement, peak social energy, lighter meals
- Luteal: progesterone-supporting foods (tropical fruits ESSENTIAL per Pelz), complex carbs, magnesium-rich, comfort without junk

MEAL RULES:
- Always follow Inchauspé sequencing: vegetables first, protein+fat second, carbs last
- Every meal must have adequate protein (minimum 25g)
- Sweet potato: NEVER roast — microwave or steam only
- Pair fruit with protein or fat, never alone
- Prioritize anti-inflammatory ingredients (turmeric+black pepper, ginger, fatty fish, berries)

Generate personalized daily wellness cards based on the user's profile, cycle phase, energy level, and what's in their kitchen.`

  const userMessage = `Generate my daily cards.

PROFILE:
- Age: ${profile?.age || 'not specified'}
- Diet: ${profile?.diet || 'everything'}
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

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "meal": {
    "title": "Meal name",
    "cookTime": "X min",
    "calories": "~XXX cal",
    "macros": "Xg protein · Xg carbs · Xg fat",
    "ingredients": ["item1", "item2"],
    "steps": ["Step 1.", "Step 2.", "Step 3."]
  },
  "movement": {
    "title": "Movement name",
    "duration": "X min",
    "description": "What to do and why it fits today."
  },
  "energy": {
    "title": "Mindset card title",
    "description": "Phase-appropriate energy and work guidance.",
    "tip": "One specific actionable tip for tonight."
  }
}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: userMessage },
      ],
      system: systemPrompt,
    })

    const text = message.content[0].text
    const cards = JSON.parse(text)
    return Response.json(cards)
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json(
      { error: 'Failed to generate cards' },
      { status: 500 }
    )
  }
}
