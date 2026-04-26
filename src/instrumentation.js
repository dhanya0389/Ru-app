export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.ANTHROPIC_API_KEY) return

  const yellow = '\x1b[33m'
  const bold = '\x1b[1m'
  const reset = '\x1b[0m'
  const line = '─'.repeat(64)

  console.warn(
    `\n${yellow}${line}\n` +
    `${bold}⚠  ANTHROPIC_API_KEY is not set.${reset}${yellow}\n` +
    `   The /api/generate-cards route will return 503 and the app\n` +
    `   will fall back to sample cards (same meals regardless of\n` +
    `   cooking mood, energy, phase, or kitchen input).\n\n` +
    `   Fix: create ${bold}.env.local${reset}${yellow} in the project root:\n` +
    `       ANTHROPIC_API_KEY=sk-ant-...\n` +
    `   Then restart the dev server.\n` +
    `${line}${reset}\n`
  )
}
