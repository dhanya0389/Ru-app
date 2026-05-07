'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

const PROFILE_SECTIONS = [
  { step: 1, label: 'Life stage' },
  { step: 2, label: 'Diet' },
  { step: 3, label: 'Carb strictness' },
  { step: 4, label: 'Cuisines' },
  { step: 5, label: 'Foods to avoid' },
  { step: 6, label: 'Movement' },
  { step: 7, label: 'Goals' },
  { step: 8, label: 'Cycle tracking' },
  { step: 9, label: 'Cycle details' },
]

/**
 * Floating top-right menu giving one-click access to:
 *   - Today (Daily Check-in)
 *   - This week (Weekly Mode)
 *   - Journal (voice journal screen)
 *   - Pantry (chip-list editor)
 *   - Sources (practitioner attribution)
 *   - Welcome (Landing)
 *   - Edit profile › (drills into the 9 profile sections + Reset)
 *
 * Two-level drill-down (Pattern B per PR #17 design):
 *   view = 'main'    → shows top-level destinations + Edit profile ›
 *   view = 'profile' → ← Back · 9 profile sections · Reset everything
 *
 * Reset moved INSIDE the Edit profile drill-down so the user can't fat-
 * finger it from the top level. Three taps to reach: open menu → Edit
 * profile → Reset → confirm. Inline confirmation prompt is unchanged.
 *
 * Props:
 *   open       — boolean, whether the panel is shown
 *   setOpen    — setter for `open`
 *   onNavigate — function called with one of:
 *                  'today' | 'weekly' | 'journal' | 'pantry' | 'sources' |
 *                  'welcome' | 'reset' | { type: 'edit', step: number }
 *                The parent is responsible for routing and for closing the
 *                menu. NavMenu resets its own internal view state to 'main'
 *                whenever `open` flips to false.
 */
export default function NavMenu({ open, setOpen, onNavigate }) {
  const menuRef = useRef(null)
  const [view, setView] = useState('main')
  const [confirmingReset, setConfirmingReset] = useState(false)
  // Auth.js session — `status` is 'loading' | 'authenticated' | 'unauthenticated'.
  // Phase 2 first slice: identity-only sign-in (Google). Used to display the
  // user's name/avatar in the menu. Once Supabase lands, this same identity
  // will key persisted journal/plan/pantry data across devices.
  const { data: session, status } = useSession()

  // Close on outside click
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

  // When the menu closes, reset internal view state so reopening starts
  // at the top level (not stuck inside Edit profile).
  useEffect(() => {
    if (!open) {
      setView('main')
      setConfirmingReset(false)
    }
  }, [open])

  function handleConfirmReset() {
    setConfirmingReset(false)
    onNavigate('reset')
  }

  return (
    <div ref={menuRef} data-no-print className="fixed top-6 right-6 z-50">
      {open && (
        <div
          id="nav-menu"
          role="menu"
          className="absolute top-14 right-0 bg-white/85 backdrop-blur-md rounded-2xl p-3 shadow-xl
                     border border-white/50 screen-enter"
          style={{ minWidth: '220px' }}
        >
          {view === 'main' ? (
            <>
              {/* Account block — top of menu so it's the first thing a new
                  user sees. Three states: loading (skeleton), signed-in
                  (avatar + name + Sign out), signed-out (Sign in with
                  Google CTA). Sign-in is identity-only for now; backend
                  persistence comes with Supabase. */}
              <AccountBlock status={status} session={session} />
              <Divider />

              {/* Top-level destinations */}
              <MenuItem onClick={() => onNavigate('today')} label="Today" />
              <MenuItem onClick={() => onNavigate('weekly')} label="This week" />
              <MenuItem onClick={() => onNavigate('journal')} label="Journal" />
              <MenuItem onClick={() => onNavigate('pantry')} label="Pantry" />
              <MenuItem onClick={() => onNavigate('sources')} label="Sources" />
              <MenuItem onClick={() => onNavigate('welcome')} label="Welcome" />

              <Divider />

              {/* Drill-down into profile editing + Reset (kept off the top
                  level so Reset is harder to hit by accident). */}
              <MenuItem
                onClick={() => setView('profile')}
                label="Edit profile"
                trailing={<Chevron />}
              />
            </>
          ) : (
            <>
              {/* Back to top-level */}
              <button
                type="button"
                onClick={() => {
                  setView('main')
                  setConfirmingReset(false)
                }}
                className="w-full text-left rounded-xl px-3 py-2 text-sm text-ruhi-earth
                           hover:bg-white/70 hover:text-ruhi-deep transition-colors flex items-center gap-2"
              >
                <span aria-hidden="true">←</span>
                <span>Back</span>
              </button>

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
                  <p className="text-xs text-ruhi-deep mb-1.5 leading-snug">
                    Reset everything?
                  </p>
                  <p className="text-[11px] text-ruhi-earth/80 mb-2 leading-snug">
                    Clears your profile, journal, and weekly plan. Pantry stays.
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
            </>
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

function MenuItem({ onClick, label, indent = false, compact = false, destructive = false, trailing = null }) {
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
        }
        flex items-center justify-between gap-2`}
    >
      <span className={compact ? 'text-[13px]' : 'text-sm'}>{label}</span>
      {trailing}
    </button>
  )
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ruhi-earth/60 flex-shrink-0"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

function Divider() {
  return <div role="separator" aria-hidden="true" className="my-2 h-px bg-ruhi-earth/15" />
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-widest text-ruhi-earth/70">
      {children}
    </p>
  )
}

// Account / auth block — top of the nav menu. Three render states:
//   - loading: small skeleton row (avoids layout flash on cold load)
//   - authenticated: avatar + name + Sign out row
//   - unauthenticated: "Sign in with Google" CTA
//
// signIn('google') hands off to Auth.js's Google flow; on return the user
// lands back at the same URL with a session cookie. signOut() clears it.
function AccountBlock({ status, session }) {
  if (status === 'loading') {
    return (
      <div className="px-3 py-2 flex items-center gap-2">
        <span aria-hidden="true" className="w-7 h-7 rounded-full bg-ruhi-earth/10" />
        <span aria-hidden="true" className="h-3 flex-1 rounded bg-ruhi-earth/10" />
      </div>
    )
  }

  if (status === 'authenticated' && session?.user) {
    const name = session.user.name || session.user.email || 'You'
    const initial = (name[0] || '?').toUpperCase()
    return (
      <div className="px-2 py-1">
        <div className="flex items-center gap-2 px-1 py-1">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full flex-shrink-0 bg-ruhi-warm"
            />
          ) : (
            <span
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-ruhi-deep text-ruhi-cream
                         text-xs font-medium flex items-center justify-center flex-shrink-0"
            >
              {initial}
            </span>
          )}
          <span className="text-sm text-ruhi-deep truncate">{name}</span>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          role="menuitem"
          className="w-full text-left rounded-xl px-3 py-1.5 text-[13px]
                     text-ruhi-earth hover:bg-white/70 hover:text-ruhi-deep transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

  // unauthenticated
  return (
    <button
      type="button"
      onClick={() => signIn('google')}
      role="menuitem"
      className="w-full text-left rounded-xl px-3 py-2 text-sm text-ruhi-deep
                 hover:bg-white/70 transition-colors flex items-center gap-2"
    >
      <GoogleGlyph />
      <span>Sign in with Google</span>
    </button>
  )
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
