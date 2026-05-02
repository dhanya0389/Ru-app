// Science Foundation: 10 women's-health practitioners + 50 attributed rules
// that ground every recommendation Ruhi generates.
//
// The IDs are unaccented for safe string handling; `surname` is the canonical
// display form used in user-facing attribution and in the prompt allowlist.
//
// `rulesForPhase(phase, domain)` returns the rules that apply to a given
// (phase, domain) tuple plus the cross-cutting ('all') rules for that domain.
// Pass `phase: 'unknown'` for users without a tracked cycle (postmenopausal,
// on hormonal birth control, irregular, just-onboarded) — only cross-cutting
// rules are returned, so phase-specific claims never leak.

export const practitioners = [
  {
    id: 'vitti',
    name: 'Alisa Vitti',
    surname: 'Vitti',
    credential: 'HHC',
    work: 'In the FLO',
    contribution: 'Cycle-syncing framework; phase-specific food prioritization; seed cycling.',
  },
  {
    id: 'pelz',
    name: 'Mindy Pelz',
    surname: 'Pelz',
    credential: 'DC',
    work: 'Fast Like a Girl',
    contribution: 'Cycle-aware fasting; ketobiotic vs hormone-feasting carb structure.',
  },
  {
    id: 'inchauspe',
    name: 'Jessie Inchauspé',
    surname: 'Inchauspé',
    credential: 'MS Biochem',
    work: 'Glucose Revolution',
    contribution: 'Glucose curve flattening; food-order sequencing; vinegar-before-carbs.',
  },
  {
    id: 'bikman',
    name: 'Benjamin Bikman',
    surname: 'Bikman',
    credential: 'PhD',
    work: 'Why We Get Sick',
    contribution: 'Insulin resistance; metabolic flexibility; meal-spacing for insulin sensitivity.',
  },
  {
    id: 'gottfried',
    name: 'Sara Gottfried',
    surname: 'Gottfried',
    credential: 'MD',
    work: 'The Hormone Cure',
    contribution: 'Hormone testing literacy; cortisol/estrogen/progesterone interventions.',
  },
  {
    id: 'brighten',
    name: 'Jolene Brighten',
    surname: 'Brighten',
    credential: 'NMD',
    work: 'Beyond the Pill',
    contribution: 'Post-pill recovery; hormonal birth control side effects; nutrient depletion.',
  },
  {
    id: 'sims',
    name: 'Stacy Sims',
    surname: 'Sims',
    credential: 'PhD',
    work: 'ROAR, Next Level',
    contribution: 'Female-specific exercise physiology; protein timing; perimenopause training.',
  },
  {
    id: 'hyman',
    name: 'Mark Hyman',
    surname: 'Hyman',
    credential: 'MD',
    work: 'Food Fix, Young Forever',
    contribution: 'Functional medicine; food-as-medicine framework; nutrient density.',
  },
  {
    id: 'li',
    name: 'William Li',
    surname: 'Li',
    credential: 'MD',
    work: 'Eat to Beat Disease',
    contribution: 'Angiogenesis-supporting foods; longevity through everyday eating.',
  },
  {
    id: 'means',
    name: 'Casey Means',
    surname: 'Means',
    credential: 'MD',
    work: 'Good Energy',
    contribution: 'Metabolic health; mitochondrial function; CGM-informed eating.',
  },
]

// Canonical surname allowlist — exposed for both prompt and runtime validation.
export const ALLOWED_SURNAMES = practitioners.map((p) => p.surname)

export const rules = [
  // ───────── MEAL · Menstrual ─────────
  { id: 'menstrual-iron',           phase: 'Menstrual',  domain: 'meal',       rule: 'Prioritize iron-rich foods (red meat, lentils, beets, dark leafy greens) to replenish blood loss.', practitionerIds: ['vitti', 'sims'] },
  { id: 'menstrual-warming',        phase: 'Menstrual',  domain: 'meal',       rule: 'Favor warm, cooked, soupy meals over raw and cold; supports digestion when energy is low.', practitionerIds: ['vitti'] },
  { id: 'menstrual-magnesium',      phase: 'Menstrual',  domain: 'meal',       rule: 'Include magnesium-rich foods (pumpkin seeds, dark chocolate, leafy greens) to ease cramping.', practitionerIds: ['gottfried', 'brighten'] },

  // ───────── MEAL · Follicular ─────────
  { id: 'follicular-fresh',         phase: 'Follicular', domain: 'meal',       rule: 'Lighter, fresher foods — sprouts, fermented veg, lean proteins — match rising estrogen and energy.', practitionerIds: ['vitti'] },
  { id: 'follicular-seedcycle1',    phase: 'Follicular', domain: 'meal',       rule: 'Seed cycling: 1 tbsp ground flax + 1 tbsp ground pumpkin daily to support estrogen production.', practitionerIds: ['vitti', 'brighten'] },
  { id: 'follicular-fermented',     phase: 'Follicular', domain: 'meal',       rule: 'Fermented foods (sauerkraut, kimchi, kefir) support gut health and estrogen metabolism.', practitionerIds: ['gottfried', 'hyman'] },

  // ───────── MEAL · Ovulatory ─────────
  { id: 'ovulatory-antioxidant',    phase: 'Ovulatory',  domain: 'meal',       rule: 'Antioxidant-dense raw foods (berries, citrus, peppers) support liver clearance of estrogen.', practitionerIds: ['vitti', 'li'] },
  { id: 'ovulatory-fiber',          phase: 'Ovulatory',  domain: 'meal',       rule: 'High fiber (cruciferous veg, lentils) supports estrogen detoxification through the gut.', practitionerIds: ['gottfried', 'inchauspe'] },
  { id: 'ovulatory-light-meals',    phase: 'Ovulatory',  domain: 'meal',       rule: 'Smaller, more frequent meals match peak digestive efficiency and avoid sluggishness.', practitionerIds: ['vitti'] },

  // ───────── MEAL · Luteal ─────────
  { id: 'luteal-complex-carb',      phase: 'Luteal',     domain: 'meal',       rule: 'Increase complex carbs (sweet potato, squash, root veg) to support progesterone and serotonin.', practitionerIds: ['pelz', 'vitti'] },
  { id: 'luteal-protein-floor',     phase: 'Luteal',     domain: 'meal',       rule: 'Push protein to 30g+ per meal; satiety and mood need extra support pre-menstrual.', practitionerIds: ['sims', 'pelz'] },
  { id: 'luteal-seedcycle2',        phase: 'Luteal',     domain: 'meal',       rule: 'Seed cycling: 1 tbsp ground sesame + 1 tbsp ground sunflower daily to support progesterone.', practitionerIds: ['vitti', 'brighten'] },

  // ───────── MOVEMENT · Menstrual ─────────
  { id: 'menstrual-rest',           phase: 'Menstrual',  domain: 'movement',   rule: 'Restorative movement only: walks, gentle yoga, stretching. Avoid HIIT and heavy lifting.', practitionerIds: ['sims', 'vitti'] },
  { id: 'menstrual-walking',        phase: 'Menstrual',  domain: 'movement',   rule: 'Daily 20–30 min walks support circulation and mood without taxing recovery.', practitionerIds: ['sims'] },
  { id: 'menstrual-low-impact',     phase: 'Menstrual',  domain: 'movement',   rule: 'Low-impact mobility work (yin yoga, gentle stretching) over high-intensity sessions; nervous system needs downshift.', practitionerIds: ['sims', 'vitti'] },

  // ───────── MOVEMENT · Follicular ─────────
  { id: 'follicular-build',         phase: 'Follicular', domain: 'movement',   rule: 'Best window for new workouts and skill acquisition. Cardio and strength both well tolerated.', practitionerIds: ['sims'] },
  { id: 'follicular-cardio',        phase: 'Follicular', domain: 'movement',   rule: 'Endurance training is well supported; metabolism is primed and recovery is fast.', practitionerIds: ['sims'] },
  { id: 'follicular-strength-volume', phase: 'Follicular', domain: 'movement', rule: 'Higher-volume strength work tolerated well; tissue recovery capacity is at its highest in the cycle.', practitionerIds: ['sims'] },

  // ───────── MOVEMENT · Ovulatory ─────────
  { id: 'ovulatory-peak',           phase: 'Ovulatory',  domain: 'movement',   rule: 'Peak strength and power window. Heavy lifting, HIIT, and PRs align with elevated testosterone and estrogen.', practitionerIds: ['sims'] },
  { id: 'ovulatory-explosive',      phase: 'Ovulatory',  domain: 'movement',   rule: 'Sprints and plyometrics align with peak power output; great window for explosive work.', practitionerIds: ['sims'] },
  { id: 'ovulatory-social-workout', phase: 'Ovulatory',  domain: 'movement',   rule: 'Group classes, team sports, partner workouts — peak social and verbal energy supports group settings.', practitionerIds: ['vitti', 'sims'] },

  // ───────── MOVEMENT · Luteal ─────────
  { id: 'luteal-zone2',             phase: 'Luteal',     domain: 'movement',   rule: 'Zone 2 cardio and moderate strength; skip max-effort sessions as recovery slows.', practitionerIds: ['sims'] },
  { id: 'luteal-strength-maintain', phase: 'Luteal',     domain: 'movement',   rule: 'Keep lifting but reduce intensity by 10–15%; maintenance over PRs.', practitionerIds: ['sims'] },
  { id: 'luteal-mobility',          phase: 'Luteal',     domain: 'movement',   rule: 'Lower-impact strength and mobility (Pilates, flow yoga); reserve max effort for follicular/ovulatory.', practitionerIds: ['sims', 'vitti'] },

  // ───────── ENERGY · Menstrual ─────────
  { id: 'menstrual-reflect',        phase: 'Menstrual',  domain: 'energy',     rule: 'Reflective work over output; brain is wired for review, synthesis, and big-picture thinking.', practitionerIds: ['vitti'] },
  { id: 'menstrual-rest-permission', phase: 'Menstrual', domain: 'energy',     rule: 'Schedule lighter days when possible; honoring rest now prevents downstream burnout.', practitionerIds: ['gottfried'] },
  { id: 'menstrual-sleep-priority', phase: 'Menstrual',  domain: 'energy',     rule: '8+ hours of sleep is critical; cortisol clearance and progesterone recovery depend on it.', practitionerIds: ['gottfried', 'brighten'] },

  // ───────── ENERGY · Follicular ─────────
  { id: 'follicular-create',        phase: 'Follicular', domain: 'energy',     rule: 'Best window for new projects, brainstorming, and learning — dopamine and estrogen rising together.', practitionerIds: ['vitti', 'gottfried'] },
  { id: 'follicular-detail',        phase: 'Follicular', domain: 'energy',     rule: 'Detail-oriented and analytical work is well supported by rising estrogen.', practitionerIds: ['vitti'] },
  { id: 'follicular-social-light',  phase: 'Follicular', domain: 'energy',     rule: 'Social energy is returning but not yet peak; 1:1 conversations land better than large groups.', practitionerIds: ['vitti'] },

  // ───────── ENERGY · Ovulatory ─────────
  { id: 'ovulatory-communicate',    phase: 'Ovulatory',  domain: 'energy',     rule: 'Schedule big meetings, presentations, and hard conversations now — peak verbal and social energy.', practitionerIds: ['vitti'] },
  { id: 'ovulatory-collaborate',    phase: 'Ovulatory',  domain: 'energy',     rule: 'Peak collaboration and persuasion energy; ideal for team work, pitches, and negotiations.', practitionerIds: ['vitti'] },
  { id: 'ovulatory-network',        phase: 'Ovulatory',  domain: 'energy',     rule: 'Best window for networking and relationship-building — read rooms more accurately.', practitionerIds: ['vitti'] },

  // ───────── ENERGY · Luteal ─────────
  { id: 'luteal-execute',           phase: 'Luteal',     domain: 'energy',     rule: 'Execution and finishing tasks; brain is wired for completion and closing loops.', practitionerIds: ['vitti'] },
  { id: 'luteal-detail-work',       phase: 'Luteal',     domain: 'energy',     rule: 'Detail-oriented and admin work is well supported; great window for inbox zero, planning, organizing.', practitionerIds: ['vitti'] },
  { id: 'luteal-mood-support',      phase: 'Luteal',     domain: 'energy',     rule: 'Mood dips are physiological, not personal. Protein, magnesium, B6, and sleep cushion this.', practitionerIds: ['gottfried', 'brighten'] },

  // ───────── CROSS-CUTTING (always apply) ─────────
  { id: 'glucose-sequencing',       phase: 'all',        domain: 'sequencing', rule: 'Eat in order: vegetables/fiber first, protein and fat second, carbs/sugar last. Flattens glucose curve.', practitionerIds: ['inchauspe'] },
  { id: 'vinegar-before-carbs',     phase: 'all',        domain: 'sequencing', rule: '1 tbsp apple cider vinegar diluted in water before a carb-heavy meal further blunts the glucose response.', practitionerIds: ['inchauspe'] },
  { id: 'protein-floor',            phase: 'all',        domain: 'meal',       rule: 'Minimum 25g protein per meal; 30g+ in luteal phase. Supports muscle, satiety, blood sugar.', practitionerIds: ['sims', 'pelz', 'bikman'] },
  { id: 'ketobiotic-feasting',      phase: 'all',        domain: 'meal',       rule: 'First half of cycle (roughly days 1–13) lean lower carb (ketobiotic); second half (roughly 14–28) increase complex carbs (hormone feasting) to support progesterone.', practitionerIds: ['pelz'] },
  { id: 'seed-cycling-cadence',     phase: 'all',        domain: 'meal',       rule: 'Flax + pumpkin seeds days 1–14 (estrogen support); sesame + sunflower days 15–28 (progesterone support).', practitionerIds: ['vitti', 'brighten'] },
  { id: 'fasting-window-women',     phase: 'all',        domain: 'meal',       rule: 'Fasting windows for women should be shorter than men\'s and shift by phase. Avoid extended fasts in luteal.', practitionerIds: ['pelz', 'sims'] },
  { id: 'mitochondrial-support',    phase: 'all',        domain: 'meal',       rule: 'Colorful plants, healthy fats, and polyphenols feed mitochondria — the foundation of metabolic health.', practitionerIds: ['means', 'hyman'] },
  { id: 'angiogenesis-foods',       phase: 'all',        domain: 'meal',       rule: 'Green tea, berries, dark chocolate, turmeric, and cruciferous veg support vascular and immune health.', practitionerIds: ['li'] },
  { id: 'nutrient-density',         phase: 'all',        domain: 'meal',       rule: 'Every meal should hit four marks: protein, fiber, color, and healthy fat. No empty plates.', practitionerIds: ['hyman'] },
  { id: 'blood-sugar-stability',    phase: 'all',        domain: 'sequencing', rule: 'Never eat carbs alone; always pair with protein or fat to blunt glucose spike.', practitionerIds: ['bikman', 'inchauspe'] },
  { id: 'hydration-electrolytes',   phase: 'all',        domain: 'energy',     rule: 'Sodium, potassium, and magnesium matter as much as water — especially for active women and in luteal phase.', practitionerIds: ['sims'] },

  // ───────── MEAL-PREP / SEQUENCING ─────────
  { id: 'batch-cook-luteal',        phase: 'Luteal',     domain: 'meal-prep',  rule: 'Luteal phase is the best window for batch cooking; execution energy is high and brain is wired for finishing.', practitionerIds: ['vitti'] },
  { id: 'phase-transition-prep',    phase: 'all',        domain: 'meal-prep',  rule: '2 days before a phase change, prep ingredients aligned with the upcoming phase\'s needs.', practitionerIds: ['vitti'] },
  { id: 'pantry-rotation',          phase: 'all',        domain: 'meal-prep',  rule: 'Rotate the pantry around the current phase\'s priorities, not a generic stockpile.', practitionerIds: ['vitti'] },
]

/**
 * Return the rules that apply to a given (phase, domain) combination plus the
 * cross-cutting ('all') rules for that domain.
 *
 * @param {'Menstrual'|'Follicular'|'Ovulatory'|'Luteal'|'unknown'|'all'} phase
 * @param {'meal'|'movement'|'energy'|'sequencing'|'meal-prep'} domain
 */
export function rulesForPhase(phase, domain) {
  if (phase === 'unknown') {
    return rules.filter((r) => r.phase === 'all' && r.domain === domain)
  }
  if (phase === 'all') {
    return rules.filter((r) => r.domain === domain)
  }
  return rules.filter((r) => (r.phase === phase || r.phase === 'all') && r.domain === domain)
}

/**
 * Resolve practitioner IDs to surname strings; unknown IDs are dropped.
 *
 * @param {string[]} ids
 * @returns {string[]}
 */
export function practitionerNames(ids) {
  const byId = Object.fromEntries(practitioners.map((p) => [p.id, p.surname]))
  return ids.map((id) => byId[id]).filter(Boolean)
}

/**
 * Format a (phase, domain) rule subset as a bulleted prompt block, with the
 * matching practitioner surnames in parentheses for the model to mirror.
 *
 * @param {ReturnType<typeof rulesForPhase>} ruleList
 */
export function formatRulesForPrompt(ruleList) {
  return ruleList
    .map((r) => {
      const names = practitionerNames(r.practitionerIds).join(', ')
      return `- ${r.rule}  (${names})`
    })
    .join('\n')
}

/**
 * Build the full SCIENCE FOUNDATION block injected into the system prompt.
 * Pass the user's current phase (capitalized: 'Menstrual'|'Follicular'|...)
 * or 'unknown' for users without a tracked cycle.
 *
 * @param {'Menstrual'|'Follicular'|'Ovulatory'|'Luteal'|'unknown'} phase
 */
export function buildScienceFoundationBlock(phase) {
  const phaseLabel = phase === 'unknown' ? 'PHASE UNKNOWN' : phase.toUpperCase()
  const sections = [
    {
      heading: `${phaseLabel} · MEAL`,
      rules: rulesForPhase(phase, 'meal'),
    },
    {
      heading: `${phaseLabel} · MOVEMENT`,
      rules: rulesForPhase(phase, 'movement'),
    },
    {
      heading: `${phaseLabel} · ENERGY`,
      rules: rulesForPhase(phase, 'energy'),
    },
    {
      heading: 'CROSS-CUTTING SEQUENCING (apply always)',
      rules: rulesForPhase('all', 'sequencing'),
    },
    {
      heading: 'CROSS-CUTTING MEAL-PREP (apply always)',
      rules: rulesForPhase('all', 'meal-prep'),
    },
  ]
    .filter((s) => s.rules.length > 0)
    .map((s) => `${s.heading}\n${formatRulesForPrompt(s.rules)}`)
    .join('\n\n')

  const allowlist = ALLOWED_SURNAMES.join(', ')
  const phaseUnknownNote =
    phase === 'unknown'
      ? '\n\nPHASE-UNKNOWN MODE: the user does not have a tracked cycle yet (postmenopausal, on hormonal birth control, irregular, or just-onboarded). Do NOT make phase-specific claims in card copy. Use a softer line such as "we\'ll personalize as your phase becomes clearer."'
      : ''

  return `SCIENCE FOUNDATION — these rules ground every recommendation. Follow them.

Each generated card SHOULD trace to 1–3 of the rules below and list the matching practitioner surnames in the \`practitioners\` field. If no rule cleanly applies to a card you generate, set \`practitioners: []\` — better to be silent than to fabricate a citation.

${sections}

ALLOWLIST: practitioner surnames you may cite — ${allowlist}. Use surname only (no "Dr.", no first name). You MUST NOT cite anyone outside this allowlist.

DIVERSITY: When generating multiple cards in a single response (meal + movement + energy), prefer citation diversity. Do NOT cite the same practitioner across all three cards if alternative rules exist — aim for at least 2 different practitioners per generation.${phaseUnknownNote}`
}

// Capitalize phase name for prompt usage. Accepts the lowercase phase strings
// the rest of the app uses ('menstrual', 'follicular', 'ovulatory', 'luteal',
// 'unknown') and returns the canonical Capitalized form expected by the rule
// table.
export function normalizePhaseForRules(phase) {
  if (!phase) return 'unknown'
  const p = String(phase).toLowerCase()
  if (p === 'menstrual') return 'Menstrual'
  if (p === 'follicular') return 'Follicular'
  if (p === 'ovulatory') return 'Ovulatory'
  if (p === 'luteal') return 'Luteal'
  return 'unknown'
}

/**
 * Build the SCIENCE FOUNDATION block for the WEEKLY planner — covers every
 * phase that appears in the planning window plus the cross-cutting rules.
 *
 * @param {Array<'menstrual'|'follicular'|'ovulatory'|'luteal'|'unknown'>} phasesLowercase
 *   The unique phases that appear across the week (from weekDays[i].phase).
 */
export function buildWeeklyScienceFoundationBlock(phasesLowercase) {
  const phasesUnique = Array.from(new Set(phasesLowercase.map(normalizePhaseForRules)))
  const phaseSpecific = phasesUnique.filter((p) => p !== 'unknown')

  const phaseSections = phaseSpecific.flatMap((phase) =>
    [
      { heading: `${phase.toUpperCase()} · MEAL`,     rules: rulesForPhase(phase, 'meal') },
      { heading: `${phase.toUpperCase()} · MOVEMENT`, rules: rulesForPhase(phase, 'movement') },
      { heading: `${phase.toUpperCase()} · ENERGY`,   rules: rulesForPhase(phase, 'energy') },
    ].filter((s) => s.rules.length > 0),
  )

  const crossCutting = [
    { heading: 'CROSS-CUTTING SEQUENCING (apply always)', rules: rulesForPhase('all', 'sequencing') },
    { heading: 'CROSS-CUTTING MEAL-PREP (apply always)',  rules: rulesForPhase('all', 'meal-prep') },
  ]

  const blocks = [...phaseSections, ...crossCutting]
    .filter((s) => s.rules.length > 0)
    .map((s) => `${s.heading}\n${formatRulesForPrompt(s.rules)}`)
    .join('\n\n')

  const allowlist = ALLOWED_SURNAMES.join(', ')
  return `SCIENCE FOUNDATION — these rules ground every dish, drink, and snack you generate. Follow them.

Each generated menu item SHOULD trace to 1–3 of the rules below and list the matching practitioner surnames in the \`practitioners\` field. If no rule cleanly applies, set \`practitioners: []\` — better to be silent than to fabricate a citation.

${blocks}

ALLOWLIST: practitioner surnames you may cite — ${allowlist}. Use surname only (no "Dr.", no first name). You MUST NOT cite anyone outside this allowlist.

DIVERSITY: Across the full week of dishes, prefer citation diversity. Do NOT cite the same practitioner across every meal — aim for at least 4 different practitioners across the full week.`
}
