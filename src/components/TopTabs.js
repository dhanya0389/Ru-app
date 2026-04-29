'use client'

/**
 * Two-tab switcher visible at the top of Daily Check-in and Weekly Mode.
 * Lets users flip between the two views without going through NavMenu.
 *
 * Props:
 *   active     — 'today' | 'weekly'
 *   onSelect   — function called with the new tab key
 */
export default function TopTabs({ active, onSelect }) {
  return (
    <div
      role="tablist"
      aria-label="Switch between Today and This week"
      className="w-full max-w-md mx-auto flex gap-1 mb-6 bg-white/40 rounded-full p-1"
    >
      <Tab
        active={active === 'today'}
        onClick={() => active !== 'today' && onSelect('today')}
      >
        Today
      </Tab>
      <Tab
        active={active === 'weekly'}
        onClick={() => active !== 'weekly' && onSelect('weekly')}
      >
        This week
      </Tab>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`flex-1 py-2 rounded-full text-sm transition-all duration-200
        ${active
          ? 'bg-ruhi-deep text-ruhi-cream shadow-sm'
          : 'text-ruhi-earth hover:text-ruhi-deep hover:bg-white/30'
        }`}
    >
      {children}
    </button>
  )
}
