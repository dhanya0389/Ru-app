'use client'

import { useEffect, useRef, useState } from 'react'
import { printPlan, emailPlan, sharePlan } from '@/lib/exportPlan'

/**
 * Bottom-sheet for plan-level actions on Weekly Mode. Replaces the prior
 * scattering of buttons (Regenerate at the bottom of the plan, Send to
 * grocery inside Shopping tab) with one consolidated action set behind a
 * "..." button in the header. Cuts header clutter while keeping every
 * action one tap away.
 *
 * Actions:
 *   - Print / Save as PDF — window.print() with the print stylesheet
 *   - Email plan          — mailto: launcher with formatted text body
 *   - Share               — navigator.share (mobile only)
 *   - Regenerate          — clears the plan, returns to the planning form
 *
 * Props:
 *   open          — boolean
 *   onClose       — () => void
 *   plan          — current WeeklyPlan
 *   onRegenerate  — () => void, called when user picks Regenerate
 *   onOpenPrep    — () => void, called when user picks Plan Sunday prep
 */
export default function PlanActionsSheet({ open, onClose, plan, onRegenerate, onOpenPrep }) {
  const sheetRef = useRef(null)
  const [shareSupported, setShareSupported] = useState(false)
  const [shareError, setShareError] = useState(null)

  // Feature-detect navigator.share on mount (client-only).
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setShareSupported(true)
    }
  }, [])

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

  // Reset transient state on open.
  useEffect(() => {
    if (open) setShareError(null)
  }, [open])

  if (!open) return null

  function handlePrint() {
    onClose()
    // Defer to next tick so the sheet is gone before the print dialog
    // captures the page (otherwise the sheet would show up in the PDF).
    setTimeout(printPlan, 50)
  }

  function handleEmail() {
    emailPlan(plan)
    onClose()
  }

  async function handleShare() {
    const result = await sharePlan(plan)
    if (result.ok || result.reason === 'cancelled') {
      onClose()
    } else {
      setShareError('Sharing failed on this device. Try Email instead.')
    }
  }

  function handleRegenerate() {
    onClose()
    onRegenerate?.()
  }

  function handleOpenPrep() {
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

        <div className="px-5 pb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-ruhi-earth mb-2">
            Export
          </h3>
          <div className="flex flex-col gap-2">
            <ActionRow
              icon={<PrintIcon />}
              label="Print / Save as PDF"
              hint="Opens your browser's print dialog. Pick 'Save as PDF' from there."
              onClick={handlePrint}
            />
            <ActionRow
              icon={<MailIcon />}
              label="Email plan"
              hint="Opens your mail app with the plan in the body."
              onClick={handleEmail}
            />
            {shareSupported && (
              <ActionRow
                icon={<ShareIcon />}
                label="Share..."
                hint="Send via your phone's share sheet."
                onClick={handleShare}
              />
            )}
          </div>
          {shareError && (
            <p role="alert" className="text-xs text-ruhi-deep bg-ruhi-rose/30 rounded-md px-3 py-2 mt-2">
              {shareError}
            </p>
          )}
        </div>

        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[10px] uppercase tracking-widest text-ruhi-earth mb-2">
            Prep
          </h3>
          <ActionRow
            icon={<ChefIcon />}
            label="Plan Sunday prep"
            hint="AI batches across this week's menu — what to cook in parallel, how to store, when to use what."
            onClick={handleOpenPrep}
          />
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

function ActionRow({ icon, label, hint, onClick, destructive = false }) {
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
    </button>
  )
}

function PrintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="11.49" />
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
