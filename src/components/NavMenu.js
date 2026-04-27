'use client'

import { useEffect, useRef, useState } from 'react'

const PROFILE_SECTIONS = [
  { step: 1, label: 'Life stage' },
  { step: 2, label: 'Diet' },
  { step: 3, label: 'Cuisines' },
  { step: 4, label: 'Foods to avoid' },
  { step: 5, label: 'Movement' },
  { step: 6, label: 'Goals' },
  { step: 7, label: 'Cycle tracking' },
  { step: 8, label: 'Cycle details' },
]

/**
 * Floating top-right menu giving one-click access to:
 *   - Today (Daily Check-in)
 *   - Welcome (Landing)
 *   - Any individual profile section (jumps Onboarding to that single screen)
 *   - Reset everything (with inline confirmation)
 *
 * Mirrors the visual pattern of ThemePicker (bottom-right). Controlled component:
 * the parent owns `open` so the menu can be re-opened automatically after a
 * single-section save returns to Daily Check-in.
 *
 * Props:
 *   open       — boolean, whether the panel is shown
 *   setOpen    — setter for `open`
 *   onNavigate — function called with one of:
 *                  'today' | 'welcome' | 'reset' | { type: 'edit', step: number }
 *                The parent is responsible for routing and for closing the menu.
 */
export default function NavMenu({ open, setOpen, onNavigate }) {
  const menuRef = useRef(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setConfirmingReset(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [open, setOpen])

  // Reset the confirm state when the menu closes
  useEffect(() => {
    if (!open) setConfirmingReset(false)
  }, [open])

  function handleConfirmReset() {
    setConfirmingReset(false)
    onNavigate('reset')
  }

  return (
    <div ref={menuRef} className="fixed top-6 right-6 z-50">
      {open && (
        <div
          id="nav-menu"
          role="menu"
          className="absolute top-14 right-0 bg-white/85 backdrop-blur-md rounded-2xl p-3 shadow-xl
                     border border-white/50 screen-enter"
          style={{ minWidth: '220px' }}
        >
          {/* Top-level destinations */}
          <MenuItem onClick={() => onNavigate('today')} label="Today" />
          <MenuItem onClick={() => onNavigate('welcome')} label="Welcome" />

          <Divider />
          <SectionLabel>Edit profile</SectionLabel>
          {PROFILE_SECTIONS.map((s) => (
            <MenuItem
              key={s.step}
              onClick={() => onNavigate({ type: 'edit', step: s.step })}
              label={s.label}
              indent
              compact
            />
          ))}

          <Divider />
          {confirmingReset ? (
            <div className="px-3 py-2">
              <p className="text-xs text-ruhi-deep mb-2 leading-snug">
                Reset everything? This clears your profile and starts you over.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 text-xs py-1.5 rounded-full border border-ruhi-earth/40
                             text-ruhi-earth hover:bg-white/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="flex-1 text-xs py-1.5 rounded-full bg-ruhi-deep text-ruhi-cream
                             hover:bg-ruhi-earth transition-colors"
                >
                  Yes, reset
                </button>
              </div>
            </div>
          ) : (
            <MenuItem
              onClick={() => setConfirmingReset(true)}
              label="Reset everything"
              destructive
            />
          )}
        </div>
      )}

      {/* Menu icon button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="nav-menu"
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg
                    transition-all duration-300 hover:scale-110
                    ${open
                      ? 'bg-ruhi-deep text-ruhi-cream'
                      : 'bg-white/80 backdrop-blur-sm text-ruhi-earth border border-white/50 hover:bg-white'
                    }`}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
    </div>
  )
}

function MenuItem({ onClick, label, indent = false, compact = false, destructive = false }) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`w-full text-left rounded-xl transition-all duration-150
        ${compact ? 'px-3 py-1.5' : 'px-3 py-2'}
        ${indent ? 'pl-6' : ''}
        ${destructive
          ? 'text-ruhi-earth hover:bg-ruhi-rose/20'
          : 'text-ruhi-deep hover:bg-white/70'
        }`}
    >
      <span className={compact ? 'text-[13px]' : 'text-sm'}>{label}</span>
    </button>
  )
}

function Divider() {
  return <div role="separator" aria-hidden="true" className="my-2 h-px bg-ruhi-earth/15" />
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pb-1 text-[10px] uppercase tracking-widest text-ruhi-earth/70">
      {children}
    </p>
  )
}
