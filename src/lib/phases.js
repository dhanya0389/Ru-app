// Cycle phase calculation + phase-based defaults

export function getCurrentPhase(lastPeriodStart, cycleLength = 28) {
  if (!lastPeriodStart) return null

  // Parse YYYY-MM-DD as LOCAL midnight (not UTC) so the comparison against
  // "today" (which is local time) doesn't drift across timezones. The bug:
  // new Date("2026-03-29") parses as UTC midnight, but new Date() returns
  // local time — comparing them adds the timezone offset to the day count
  // and can flip a user from "luteal day 31" to "menstrual day 1" overnight.
  const [y, m, d] = lastPeriodStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfCycle = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1
  const adjustedDay = ((dayOfCycle - 1) % cycleLength) + 1

  // Phase boundaries (approximate, based on standard cycle science)
  if (adjustedDay <= 5) return { name: 'Menstrual', day: adjustedDay, energy: 2 }
  if (adjustedDay <= 13) return { name: 'Follicular', day: adjustedDay, energy: 4 }
  if (adjustedDay <= 16) return { name: 'Ovulatory', day: adjustedDay, energy: 5 }
  return { name: 'Luteal', day: adjustedDay, energy: 3 }
}

export const phaseInfo = {
  Menstrual: {
    color: 'rose',
    cookingDefault: 'quick',
    movement: 'Gentle stretching, walking, restorative yoga',
    mindset: 'Rest and reflect. Your body is doing important work.',
  },
  Follicular: {
    color: 'sage',
    cookingDefault: 'medium',
    movement: 'Strength training, HIIT, trying new things',
    mindset: 'Your brain is wired for creativity and new projects.',
  },
  Ovulatory: {
    color: 'gold',
    cookingDefault: 'medium',
    movement: 'High intensity, group classes, cardio',
    mindset: 'Peak communication energy. Tackle the hard conversations.',
  },
  Luteal: {
    color: 'earth',
    cookingDefault: 'quick',
    movement: 'Pilates, swimming, moderate strength, long walks',
    mindset: 'Detail work and completion. Finish what you started.',
  },
}
