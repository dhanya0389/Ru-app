'use client'

import { useEffect, useState } from 'react'
import { getProfile, getPantry } from '@/lib/storage'
import { getWeeklyPlan } from '@/lib/weeklyPlan'
import NavMenu from '@/components/NavMenu'

// Full-page prep planner screen. Reachable from the Weekly Mode "..." actions
// sheet → "Plan Sunday prep". Generates a single batched cook session
// timeline (active / between / assembly / storage) on demand from the saved
// weekly plan. No persistence — each visit regenerates so the prep plan
// always matches the current weekly plan.
//
// Why on-demand vs. saved alongside the weekly plan: prep plans only matter
// when the user is about to cook. Caching them risks showing stale plans
// when the user has regenerated the weekly menu but not the prep. Cost:
// one Sonnet call per visit (~$0.05). Worth it for accuracy.

const TIPS_DURING_GENERATION = [
  'Reading your week\'s menu...',
  'Finding ingredients used in multiple meals...',
  'Sequencing what cooks while what chops...',
  'Building your storage map...',
  'Almost there.',
]

export default function PrepPlanScreen({ onBack, menuOpen, setMenuOpen, onNavigate }) {
  const [plan, setPlan] = useState(null)
  const [prep, setPrep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const wp = getWeeklyPlan()
    if (!wp) {
      setError('No weekly plan to prep against. Plan a week first.')
      setLoading(false)
      return
    }
    setPlan(wp)
    // Read the time picker value the user selected in PlanActionsSheet.
    // Read-once + clear so a stale value doesn't get reused if the user
    // opens the prep page another way later.
    let availableMinutes = null
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('ruhi_prep_minutes')
      if (raw) {
        const parsed = parseInt(raw, 10)
        if (Number.isFinite(parsed)) availableMinutes = parsed
        localStorage.removeItem('ruhi_prep_minutes')
      }
    }
    generate(wp, availableMinutes)
  }, [])

  // Rotate tips while generating — same UX rhythm as Weekly Mode's noPlan
  // generation, so the wait feels intentional.
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS_DURING_GENERATION.length)
    }, 4000)
    return () => clearInterval(id)
  }, [loading])

  async function generate(wp, availableMinutes = null) {
    setLoading(true)
    setError(null)
    setTipIndex(0)
    try {
      const res = await fetch('/api/generate-prep-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan: wp,
          profile: getProfile(),
          pantry: getPantry(),
          // Energy comes from the saved plan (set when the user planned the
          // week). The API also defaults gracefully if missing.
          energy: typeof wp?.energy === 'number' ? wp.energy : 3,
          // availableMinutes: user's time picker selection. API defaults by
          // energy if not provided.
          availableMinutes,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setPrep(data)
    } catch (err) {
      console.error('Prep plan generation failed:', err)
      setError(err.message || 'Couldn\'t build the prep plan. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="ruhi-bg min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
        <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div aria-hidden="true" className="w-12 h-12 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
          <p className="font-display text-xl text-ruhi-deep animate-pulse">Building your prep plan...</p>
          <p key={tipIndex} className="text-sm text-ruhi-earth leading-relaxed screen-enter">
            {TIPS_DURING_GENERATION[tipIndex]}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ruhi-bg min-h-screen flex flex-col px-6 py-6 max-w-md mx-auto relative z-10">
        <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />
        <button
          onClick={onBack}
          className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start"
        >
          <span aria-hidden="true">←</span> Back to weekly
        </button>
        <h1 className="font-display text-2xl text-ruhi-deep mb-2">Prep planner</h1>
        <p role="alert" className="text-sm text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-2 mt-4">
          {error}
        </p>
        {plan && (
          <button
            onClick={() => generate(plan)}
            className="mt-4 py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-sm
                       hover:bg-ruhi-earth transition-all shadow-md"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (!prep) return null

  return (
    <div className="ruhi-bg min-h-screen flex flex-col px-6 py-6 max-w-md mx-auto relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

      <button
        onClick={onBack}
        className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start"
      >
        <span aria-hidden="true">←</span> Back to weekly
      </button>

      <h1 className="font-display text-3xl text-ruhi-deep mb-1">Sunday prep</h1>
      <p className="text-sm text-ruhi-earth mb-6 leading-relaxed">{prep.summary}</p>

      <div className="bg-ruhi-deep/8 border border-ruhi-deep/15 rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-ruhi-earth">Total time</p>
          <p className="font-display text-2xl text-ruhi-deep">
            ~{formatMinutes(prep.totalMinutes)}
          </p>
        </div>
        <div aria-hidden="true" className="w-12 h-12 rounded-full bg-ruhi-warm flex items-center justify-center">
          <ClockIcon />
        </div>
      </div>

      {prep.active?.length > 0 && (
        <Section
          dotClass="bg-ruhi-terracotta"
          label="Active cooking"
          subtitle="Heat is on. Run things in parallel where you can."
        >
          <ol className="space-y-4">
            {prep.active.map((step) => (
              <li key={step.order}>
                <StepCard
                  numberBadge={
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ruhi-terracotta/15 border border-ruhi-terracotta/40 text-ruhi-deep text-xs font-medium flex items-center justify-center">
                      {step.order}
                    </span>
                  }
                  title={step.title}
                  rightMeta={
                    <span className="flex items-center gap-1.5 text-[11px] text-ruhi-earth tabular-nums">
                      {step.temp && <Tag>{step.temp}</Tag>}
                      <span>{step.minutes} min</span>
                    </span>
                  }
                  parallelBadge={step.parallel}
                  portions={step.portions}
                  coversDishes={step.coversDishes}
                  steps={step.steps}
                  accentColor="ruhi-terracotta"
                />
              </li>
            ))}
          </ol>
        </Section>
      )}

      {prep.between?.length > 0 && (
        <Section
          dotClass="bg-ruhi-sage"
          label="Between cooking"
          subtitle="Fill the gaps while the heat is doing its work."
          count={prep.between.length}
          collapsible
          defaultOpen={false}
        >
          <ul className="space-y-4">
            {prep.between.map((task, i) => (
              <li key={i}>
                <StepCard
                  numberBadge={
                    <span aria-hidden="true" className="flex-shrink-0 w-2 h-2 rounded-full bg-ruhi-sage mt-2" />
                  }
                  title={task.title}
                  portions={task.portions}
                  coversDishes={task.coversDishes}
                  steps={task.steps}
                  accentColor="ruhi-sage"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {prep.assembly?.length > 0 && (
        <Section
          dotClass="bg-ruhi-peach"
          label="Assembly"
          subtitle="Cold steps at the end — jars, salads, dressings."
          count={prep.assembly.length}
          collapsible
          defaultOpen={false}
        >
          <ul className="space-y-4">
            {prep.assembly.map((task, i) => (
              <li key={i}>
                <StepCard
                  numberBadge={
                    <span aria-hidden="true" className="flex-shrink-0 w-2 h-2 rounded-full bg-ruhi-peach mt-2" />
                  }
                  title={task.title}
                  portions={task.portions}
                  coversDishes={task.coversDishes}
                  steps={task.steps}
                  accentColor="ruhi-peach"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {prep.storage?.length > 0 && (
        <Section
          dotClass="bg-ruhi-earth"
          label="Storage"
          subtitle="Where things go and how long they last."
          count={prep.storage.length}
          collapsible
          defaultOpen={false}
        >
          <ul className="space-y-2.5">
            {prep.storage.map((s, i) => (
              <li key={i} className="bg-white/60 rounded-xl p-3 border border-white/60">
                <p className="text-sm font-medium text-ruhi-deep mb-0.5">{s.item}</p>
                <p className="text-xs text-ruhi-earth leading-relaxed">
                  <span className="text-ruhi-deep">{s.where}</span> · {s.lasts}
                </p>
                {s.useBy && (
                  <p className="text-[11px] text-ruhi-earth/80 italic mt-1">{s.useBy}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {prep.tips?.length > 0 && (
        <Section
          dotClass="bg-ruhi-deep"
          label="Notes"
          subtitle={null}
          count={prep.tips.length}
          collapsible
          defaultOpen={false}
        >
          <ul className="space-y-2">
            {prep.tips.map((tip, i) => (
              <li key={i} className="text-xs text-ruhi-deep leading-relaxed bg-ruhi-warm/40 rounded-md px-3 py-2">
                {tip}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <button
        onClick={() => plan && generate(plan)}
        className="mt-2 mb-6 text-xs text-ruhi-earth hover:text-ruhi-deep transition-colors text-center"
      >
        Regenerate prep plan
      </button>
    </div>
  )
}

function Section({ dotClass, label, subtitle, count, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  if (!collapsible) {
    return (
      <section className="mb-6">
        <header className="mb-3 flex items-center gap-2">
          <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
          <h3 className="text-sm uppercase tracking-widest text-ruhi-deep font-medium">{label}</h3>
        </header>
        {subtitle && <p className="text-xs text-ruhi-earth/80 mb-3 px-1">{subtitle}</p>}
        {children}
      </section>
    )
  }

  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-1 py-2 rounded-lg
                   hover:bg-white/40 transition-colors text-left"
      >
        <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
        <h3 className="text-sm uppercase tracking-widest text-ruhi-deep font-medium flex-1">{label}</h3>
        {typeof count === 'number' && (
          <span className="text-[11px] text-ruhi-earth/70 tabular-nums">({count})</span>
        )}
        <span aria-hidden="true" className={`text-ruhi-earth/70 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="mt-2 mb-3">
          {subtitle && <p className="text-xs text-ruhi-earth/80 mb-3 px-1">{subtitle}</p>}
          {children}
        </div>
      )}
    </section>
  )
}

// Unified step card used by Active / Between / Assembly. Renders title +
// optional meta (time, temp) + portions chips + coversDishes line + a
// short numbered/bulleted step list. Replaces the previous prose `detail`
// field with a scannable layout.
function StepCard({ numberBadge, title, rightMeta, parallelBadge, portions, coversDishes, steps, accentColor = 'ruhi-earth' }) {
  return (
    <div className="flex gap-3">
      {numberBadge}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-medium text-ruhi-deep leading-tight">
            {title}
            {parallelBadge && (
              <span className="ml-2 inline-flex items-center text-[10px] uppercase tracking-wide text-ruhi-terracotta whitespace-nowrap">
                ↺ in parallel
              </span>
            )}
          </h4>
          {rightMeta && <div className="flex-shrink-0">{rightMeta}</div>}
        </div>

        {coversDishes && (
          <p className="text-[11px] text-ruhi-earth/80 italic mb-2">
            <span className="not-italic text-ruhi-earth/70">covers:</span> {coversDishes}
          </p>
        )}

        {portions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {portions.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/70 border border-ruhi-earth/20 text-[11px] text-ruhi-deep tabular-nums"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {steps?.length > 0 && (
          <ul className="space-y-1">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ruhi-earth leading-snug">
                <span aria-hidden="true" className="text-ruhi-earth/50 flex-shrink-0 mt-0.5">→</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Tag({ children }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-ruhi-warm/60 text-ruhi-deep tabular-nums">
      {children}
    </span>
  )
}

function formatMinutes(m) {
  if (!Number.isFinite(m) || m <= 0) return '—'
  if (m < 60) return `${Math.round(m)} min`
  const h = Math.floor(m / 60)
  const rem = Math.round(m % 60)
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ruhi-deep">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
