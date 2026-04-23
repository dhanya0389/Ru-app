'use client'

import { useState, useEffect, useRef } from 'react'
import { THEMES, getTheme, setTheme } from '@/lib/themes'

export default function ThemePicker() {
  const [active, setActive] = useState('earth')
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    setActive(getTheme())
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
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
  }, [open])

  function pick(key) {
    setActive(key)
    setTheme(key)
    setOpen(false)
  }

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
      {/* Expanded menu */}
      {open && (
        <div
          id="theme-menu"
          role="menu"
          className="absolute bottom-14 right-0 bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-xl
                        border border-white/50 screen-enter" style={{ minWidth: '180px' }}
        >
          <p className="text-xs text-ruhi-earth mb-3 font-medium">Pick your vibe</p>
          <div className="flex flex-col gap-2">
            {Object.entries(THEMES).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => pick(key)}
                role="menuitemradio"
                aria-checked={active === key}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200
                  ${active === key
                    ? 'bg-ruhi-warm/60 shadow-sm'
                    : 'hover:bg-white/60'
                  }`}
              >
                <div
                  aria-hidden="true"
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                  style={{ backgroundColor: theme.swatch }}
                />
                <span className="text-sm text-ruhi-deep">{theme.label}</span>
                {active === key && (
                  <span aria-hidden="true" className="text-xs text-ruhi-earth ml-auto">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paint brush icon button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Change color palette"
        aria-expanded={open}
        aria-controls="theme-menu"
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg
                    transition-all duration-300 hover:scale-110
                    ${open
                      ? 'bg-ruhi-deep text-ruhi-cream rotate-12'
                      : 'bg-white/80 backdrop-blur-sm text-ruhi-earth border border-white/50 hover:bg-white'
                    }`}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.1 2.5-.3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51" />
          <circle cx="7.5" cy="10" r="1.5" fill="currentColor" />
          <circle cx="12" cy="7" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="10" r="1.5" fill="currentColor" />
          <circle cx="10" cy="14" r="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
