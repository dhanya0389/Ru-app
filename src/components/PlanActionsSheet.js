'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Bottom-sheet for state-changing plan actions: Plan Sunday prep + Regenerate.
 * Passive output (Print / Email / Share) lives in the sibling
 * ExportPlanSheet so the two cognitive buckets (export vs. modify) don't
 * mix in one menu.
 *
 * Actions:
 *   - Plan Sunday prep — expands to a time picker, then navigates to PrepPlanScreen
 *   - Regenerate       — clears the plan, returns to the planning form
 *
 * Props:
 *   open          — boolean
 *   onClose       — () => void
 *   plan          — current WeeklyPlan (used for the energy default on prep time)
 *   onRegenerate  — () => void, called when user picks Regenerate
 *   onOpenPrep    — () => void, called when user picks Plan Sunday prep
 */
// Time picker pill options for the prep planner. Defaults are chosen by the
// user's saved energy (low → 30, steady → 60, high → 90). User can override
// any pill — energy is a hint, time is the binding constraint.
const PREP_TIME_OPTIONS = [30, 45, 60, 90, 120]
function defaultPrepTimeFor(energy) {
  if (typeof energy !== 'number') return 60
  if (energy <= 2) return 30
  if (energy === 3) return 60
  return 90
}

export default function PlanActionsSheet({ open, onClose, plan, onRegenerate, onOpenPrep }) {
  const sheetRef = useRef(null)
  // Prep section expansion + selected time. When expanded, the row swaps
  // from a single tap-to-navigate button into a small inline panel with
  // time pills + continue button. NOT a popup — popups can be blocked.
  const [prepExpanded, setPrepExpanded] = useState(false)
  const [prepMinutes, setPrepMinutes] = useState(() => defaultPrepTimeFor(plan?.energy))

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return
    function onPointer(e) {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) {
        onClose()
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Reset transient state on open. Default the time picker to whatever
  // matches the user's saved energy each time the sheet reopens — they
  // may have re-planned the week with different energy since last open.
  useEffect(() => {
    if (open) {
      setPrepExpanded(false)
      setPrepMinutes(defaultPrepTimeFor(plan?.energy))
    }
  }, [open, plan?.energy])

  if (!open) return null

  function handleRegenerate() {
    onClose()
    onRegenerate?.()
  }

  function handlePrepRowClick() {
    // First tap expands the row (shows time picker). Second tap on the same
    // row collapses. The Continue button below confirms + navigates.
    setPrepExpanded((v) => !v)
  }

  function handleContinueToPrep() {
    // Stash the selected time where PrepPlanScreen can read it on mount.
    // We use localStorage instead of routing it through page.js because
    // navigation goes via onNavigate('prep') which doesn't carry props,
    // and adding a query-string param means a heavier router refactor.
    // The key is read-once and cleared by PrepPlanScreen so no stale value.
    if (typeof window !== 'undefined') {
      localStorage.setItem('ruhi_prep_minutes', String(prepMinutes))
    }
    onClose()
    onOpenPrep?.()
  }

  return (
    <div
      data-no-print
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-actions-title"
    >
      <div
        ref={sheetRef}
        className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-ruhi-cream shadow-2xl
                   border-t sm:border border-white/60 max-h-[88vh] overflow-y-auto screen-enter"
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 id="plan-actions-title" className="text-base text-ruhi-deep font-medium">
            Plan actions
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ruhi-earth hover:text-ruhi-deep w-8 h-8 rounded-full
                       hover:bg-white/60 flex items-center justify-center transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-1 pb-3">
          <h3 className="text-[10px] uppercase tracking-widest text-ruhi-earth mb-2">
            Prep
          </h3>
          <ActionRow
            icon={<ChefIcon />}
            label="Plan Sunday prep"
            hint="AI batches across this week's menu — what to cook in parallel, how to store, when to use what."
            onClick={handlePrepRowClick}
            trailing={<Chevron expanded={prepExpanded} />}
          />
          {prepExpanded && (
            <div className="mt-2 px-3 py-3 rounded-xl bg-ruhi-warm/30 border border-ruhi-warm screen-enter">
              <p className="text-xs text-ruhi-deep font-medium mb-2">
                How much time do you have today?
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3" role="radiogroup" aria-label="Available prep time">
                {PREP_TIME_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={prepMinutes === m}
                    onClick={() => setPrepMinutes(m)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all
                      ${prepMinutes === m
                        ? 'bg-ruhi-deep text-ruhi-cream shadow-sm'
                        : 'bg-white/80 border border-ruhi-earth/30 text-ruhi-deep hover:bg-white'}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ruhi-earth/80 mb-3 leading-snug">
                {plan?.energy != null && (
                  <>Default for energy {plan.energy}: {defaultPrepTimeFor(plan.energy)} min. </>
                )}
                Tap a different pill if today&apos;s time differs.
              </p>
              <button
                type="button"
                onClick={handleContinueToPrep}
                className="w-full py-2.5 rounded-full bg-ruhi-deep text-ruhi-cream text-sm
                           hover:bg-ruhi-earth transition-all shadow-sm"
              >
                Continue to prep →
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pt-2 pb-5">
          <h3 className="text-[10px] uppercase tracking-widest text-ruhi-earth mb-2">
            Plan
          </h3>
          <ActionRow
            icon={<RefreshIcon />}
            label="Regenerate this week"
            hint="Clears this plan and returns to the planning form."
            onClick={handleRegenerate}
            destructive
          />
        </div>
      </div>
    </div>
  )
}

function ActionRow({ icon, label, hint, onClick, destructive = false, trailing = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all
        ${destructive
          ? 'bg-white/70 border border-white/60 hover:bg-ruhi-rose/15 hover:border-ruhi-deep/30'
          : 'bg-white/70 border border-white/60 hover:bg-white hover:shadow-sm'}`}
    >
      <span aria-hidden="true" className={`flex-shrink-0 mt-0.5 ${destructive ? 'text-ruhi-earth' : 'text-ruhi-deep'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium ${destructive ? 'text-ruhi-earth' : 'text-ruhi-deep'}`}>{label}</span>
        {hint && <span className="block text-[11px] text-ruhi-earth/80 mt-0.5 leading-snug">{hint}</span>}
      </span>
      {trailing && <span className="flex-shrink-0 mt-0.5">{trailing}</span>}
    </button>
  )
}

function Chevron({ expanded }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-ruhi-earth/70 transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ChefIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14h12v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6z" />
      <path d="M8 14V9.5a4 4 0 0 1 .5-2A3 3 0 0 1 12 4a3 3 0 0 1 3.5 3.5A4 4 0 0 1 16 9.5V14" />
      <path d="M5 14h14" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
