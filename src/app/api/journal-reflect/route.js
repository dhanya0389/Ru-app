import Anthropic from '@anthropic-ai/sdk'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

export async function POST(request) {
  if (!client) {
    return Response.json(
      { error: 'missing_api_key', message: 'ANTHROPIC_API_KEY not set.' },
      { status: 503 }
    )
  }

  const { note, phase, day, energy } = await request.json()
  const trimmed = String(note || '').trim()
  if (!trimmed) {
    return Response.json({ error: 'empty_note' }, { status: 400 })
  }

  const phaseLabel = phase && typeof day === 'number' ? `${phase} · Day ${day}` : 'unknown phase'

  const systemPrompt = `You are Ruhi reading a journal entry from the woman whose body you are supporting.

Reflect back in 1–2 short sentences. Direct, warm, embodied — like a wise friend who knows her cycle. First person where natural ("I hear you", not "Ruhi hears you"). Acknowledge what she said. If her note matches the phase/energy, name that gently.

Hard rules:
- 1–2 sentences. No more.
- No "scientifically proven" / "clinically proven" / "studies show".
- Don't name-drop practitioners or cite sources.
- Don't prescribe — no "you should", no "try doing X". This is reflection, not advice.
- No emojis.
- No therapy clichés ("I hear that you're feeling...", "It sounds like...").`

  const userMessage = `Cycle phase: ${phaseLabel}
Energy: ${typeof energy === 'number' ? `${energy}/5` : 'unspecified'}

Her note:
"${trimmed}"

Reflect.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = message.content.find((b) => b.type === 'text')
    const reflection = block?.text?.trim()
    if (!reflection) {
      return Response.json({ error: 'empty_reflection' }, { status: 500 })
    }
    return Response.json({ reflection })
  } catch (error) {
    console.error('journal-reflect error:', error)
    return Response.json({ error: 'reflect_failed' }, { status: 500 })
  }
}
