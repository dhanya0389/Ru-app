'use client'

import { useEffect, useMemo, useState } from 'react'
import { getProfile } from '@/lib/storage'
import { getCurrentPhase } from '@/lib/phases'
import { getEntries } from '@/lib/journal'
import VoiceJournal from '@/components/VoiceJournal'
import NavMenu from '@/components/NavMenu'

// ── Journal redesign (PR #27) ───────────────────────────────────────────
//
// Earlier the journal was a flat reverse-chronological list — every entry
// expanded, all on one page. Two problems:
//   1. As entries pile up, the page becomes a long unscrollable wall.
//   2. The journal was implicitly "for Ruhi only" — no real way for the
//      user to come back, find a particular day, and reread their thinking.
//
// The new structure treats the journal like a calendar artifact:
//   - Week navigator at the top: prev / next arrows + week range label
//   - Day strip: 7 pills with entry counts and phase color
//   - Below: the selected day's entries, each collapsed to a one-line
//     preview by default, expand to show the full transcript + reflection
//
// The data layer (lib/journal.js) is unchanged — same entry shape, same
// localStorage backing. This is purely a presentation refactor. Once
// Phase 2 swaps localStorage for Supabase, the same components work.

const ENERGY_LABELS = {
  1: 'running on empty',
  2: 'taking it slow',
  3: 'steady',
  4: 'feeling good',
  5: 'fabulous',
}

const PHASE_COLORS = {
  Menstrual: { dot: 'bg-ruhi-rose', border: 'border-ruhi-rose/60', tint: 'bg-ruhi-rose/15' },
  Follicular: { dot: 'bg-ruhi-sage', border: 'border-ruhi-sage/60', tint: 'bg-ruhi-sage/15' },
  Ovulatory: { dot: 'bg-ruhi-peach', border: 'border-ruhi-peach/60', tint: 'bg-ruhi-peach/15' },
  Luteal: { dot: 'bg-ruhi-terracotta', border: 'border-ruhi-terracotta/60', tint: 'bg-ruhi-terracotta/15' },
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const FULL_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── Date helpers ───────────────────────────────────────────────────────
// All date math is local-time to avoid UTC drift (matches WeeklyMode's
// pattern). ISO strings used as map keys are local-zone YYYY-MM-DD.

function toLocalISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Week starts on Sunday — Western-default that matches most US-facing apps.
// If users want Monday-start later, this is the only function to change.
function startOfWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function sameDay(a, b) {
  return toLocalISO(a) === toLocalISO(b)
}

function formatWeekRange(weekStart) {
  const weekEnd = addDays(weekStart, 6)
  const startMonth = weekStart.toLocaleString(undefined, { month: 'short' })
  const endMonth = weekEnd.toLocaleString(undefined, { month: 'short' })
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()}–${weekEnd.getDate()}`
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}`
}

function formatDayHeader(date, entries) {
  const dayLabel = FULL_DAY_LABELS[date.getDay()]
  const monthDay = date.toLocaleString(undefined, { month: 'long', day: 'numeric' })
  const sample = entries[0]
  if (sample?.phase && typeof sample.day === 'number') {
    return `${dayLabel} · ${monthDay} · ${sample.phase} day ${sample.day}`
  }
  return `${dayLabel} · ${monthDay}`
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function preview(text, n = 60) {
  const s = String(text || '').trim()
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

// Group all entries by their local-ISO calendar date. Returns
// { 'YYYY-MM-DD': [entry, entry, ...] } sorted oldest→newest within each
// day so the day view reads chronologically.
function groupByDay(entries) {
  const out = {}
  for (const e of entries) {
    const iso = toLocalISO(new Date(e.timestamp))
    if (!out[iso]) out[iso] = []
    out[iso].push(e)
  }
  for (const iso of Object.keys(out)) {
    out[iso].sort((a, b) => a.timestamp - b.timestamp)
  }
  return out
}

// ── Main screen ────────────────────────────────────────────────────────

export default function JournalScreen({ onBack, menuOpen, setMenuOpen, onNavigate }) {
  const [entries, setEntries] = useState([])
  const [phase, setPhase] = useState(null)
  const [energy, setEnergy] = useState(3)
  const [showCapture, setShowCapture] = useState(false)
  // Selected day for the journal view. Default: today. Changes when user
  // taps a different day pill.
  const [selectedISO, setSelectedISO] = useState(() => toLocalISO(new Date()))
  // Anchor for the week-navigator. Always Sunday-aligned. Moving prev/next
  // re-anchors here; selecting a day inside the visible week leaves it.
  const [weekStartISO, setWeekStartISO] = useState(() => toLocalISO(startOfWeek(new Date())))

  useEffect(() => {
    refresh()
    const p = getProfile()
    if (p?.lastPeriodStart) {
      const cycleLengthMap = { '24–26': 25, '27–29': 28, '30–32': 31, 'It varies': 28 }
      const len = cycleLengthMap[p.cycleLength] || 28
      const ph = getCurrentPhase(p.lastPeriodStart, len)
      setPhase(ph)
      if (ph) setEnergy(ph.energy)
    }
  }, [])

  function refresh() {
    setEntries(getEntries())
  }

  function handleCaptureClose() {
    setShowCapture(false)
    refresh()
  }

  // Memoize the heavy lift (group by day, count per day in current week)
  // so changing `selectedISO` doesn't re-walk all entries.
  const entriesByDay = useMemo(() => groupByDay(entries), [entries])
  const weekStart = useMemo(() => {
    const [y, m, d] = weekStartISO.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [weekStartISO])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const todayISO = toLocalISO(new Date())
  const onCurrentWeek = weekStartISO === toLocalISO(startOfWeek(new Date()))
  const selectedDayEntries = entriesByDay[selectedISO] || []

  function goPrevWeek() {
    setWeekStartISO(toLocalISO(addDays(weekStart, -7)))
  }
  function goNextWeek() {
    setWeekStartISO(toLocalISO(addDays(weekStart, 7)))
  }
  function goToday() {
    const today = new Date()
    setWeekStartISO(toLocalISO(startOfWeek(today)))
    setSelectedISO(toLocalISO(today))
  }
  function selectDay(date) {
    setSelectedISO(toLocalISO(date))
  }

  return (
    <div className="ruhi-bg min-h-screen flex flex-col px-6 py-6 max-w-md mx-auto relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

      <button
        onClick={onBack}
        className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start"
      >
        <span aria-hidden="true">←</span> Back
      </button>

      <h2 className="font-display text-2xl text-ruhi-deep mb-1 screen-enter">Journal</h2>
      <p className="text-sm text-ruhi-earth mb-6 screen-enter">
        Your own pages to come back to. Ruhi reads them silently when planning your day.
      </p>

      {/* Week navigator + day strip — always shown so the structure is
          discoverable even when the current week has no entries. */}
      <WeekNavigator
        weekStart={weekStart}
        onPrev={goPrevWeek}
        onNext={goNextWeek}
        onToday={goToday}
        showToday={!onCurrentWeek}
      />
      <DayStrip
        weekDays={weekDays}
        selectedISO={selectedISO}
        todayISO={todayISO}
        entriesByDay={entriesByDay}
        onSelect={selectDay}
      />

      {/* Selected day section */}
      <DaySection
        date={(() => {
          const [y, m, d] = selectedISO.split('-').map(Number)
          return new Date(y, m - 1, d)
        })()}
        entries={selectedDayEntries}
        isToday={selectedISO === todayISO}
      />

      {/* Add a note — sticky at the bottom of the column so capture is
          always one tap away regardless of how far the user has scrolled. */}
      <button
        onClick={() => setShowCapture(true)}
        className="mt-6 mb-2 w-full py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-base
                   hover:bg-ruhi-earth transition-all duration-300 hover:scale-[1.02]
                   shadow-lg shadow-ruhi-deep/20 screen-enter"
      >
        Add a note
      </button>

      {showCapture && (
        <VoiceJournal
          phase={phase}
          energy={energy}
          onClose={handleCaptureClose}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────

function WeekNavigator({ weekStart, onPrev, onNext, onToday, showToday }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3 px-1">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous week"
        className="w-8 h-8 rounded-full text-ruhi-earth hover:bg-white/60 hover:text-ruhi-deep
                   flex items-center justify-center transition-colors"
      >
        <ChevronLeft />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-sm text-ruhi-deep font-medium tabular-nums">
          {formatWeekRange(weekStart)}
        </span>
        {showToday && (
          <button
            type="button"
            onClick={onToday}
            className="text-[11px] text-ruhi-earth hover:text-ruhi-deep underline underline-offset-2"
          >
            Today
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next week"
        className="w-8 h-8 rounded-full text-ruhi-earth hover:bg-white/60 hover:text-ruhi-deep
                   flex items-center justify-center transition-colors"
      >
        <ChevronRight />
      </button>
    </div>
  )
}

function DayStrip({ weekDays, selectedISO, todayISO, entriesByDay, onSelect }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 mb-6">
      {weekDays.map((d) => {
        const iso = toLocalISO(d)
        const dayEntries = entriesByDay[iso] || []
        const count = dayEntries.length
        const phaseName = dayEntries[0]?.phase
        const phaseColor = phaseName ? PHASE_COLORS[phaseName] : null
        const isSelected = iso === selectedISO
        const isToday = iso === todayISO
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelect(d)}
            aria-label={`${FULL_DAY_LABELS[d.getDay()]} ${d.getDate()}${count ? `, ${count} entr${count === 1 ? 'y' : 'ies'}` : ', no entries'}`}
            aria-current={isSelected ? 'date' : undefined}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all
              ${isSelected
                ? 'bg-ruhi-deep text-ruhi-cream shadow-sm'
                : count > 0
                  ? 'bg-white/70 text-ruhi-deep hover:bg-white'
                  : 'text-ruhi-earth/70 hover:bg-white/40'}
              ${isToday && !isSelected ? 'ring-1 ring-ruhi-deep/40' : ''}
            `}
          >
            <span className={`text-[10px] uppercase tracking-wide ${isSelected ? 'text-ruhi-cream/80' : 'text-ruhi-earth/70'}`}>
              {DAY_LABELS[d.getDay()]}
            </span>
            <span className="text-sm tabular-nums font-medium">{d.getDate()}</span>
            {/* Entry count dot — single dot for any count, with a number
                overlay for 2+. Tiny enough to not crowd the date number. */}
            {count > 0 ? (
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  isSelected
                    ? 'bg-ruhi-cream'
                    : phaseColor?.dot || 'bg-ruhi-deep'
                }`}
              />
            ) : (
              <span aria-hidden="true" className="w-1.5 h-1.5" />
            )}
          </button>
        )
      })}
    </div>
  )
}

function DaySection({ date, entries, isToday }) {
  if (entries.length === 0) {
    return (
      <div className="bg-white/60 rounded-2xl p-6 text-center screen-enter">
        <p className="text-xs uppercase tracking-widest text-ruhi-earth/70 mb-2">
          {FULL_DAY_LABELS[date.getDay()]} · {date.toLocaleString(undefined, { month: 'long', day: 'numeric' })}
        </p>
        <p className="text-sm text-ruhi-earth leading-relaxed">
          {isToday
            ? 'Nothing yet for today. Add a note below — Ruhi brings it back next time you\'re in this phase.'
            : 'No entries this day.'}
        </p>
      </div>
    )
  }
  return (
    <div className="screen-enter">
      <div className="mb-3 px-1">
        <p className="text-[10px] uppercase tracking-widest text-ruhi-earth/70 mb-0.5">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
        <h3 className="text-sm text-ruhi-deep font-medium">
          {formatDayHeader(date, entries)}
        </h3>
      </div>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <EntryCard entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function EntryCard({ entry }) {
  const [open, setOpen] = useState(false)
  const phaseColor = entry.phase ? PHASE_COLORS[entry.phase] : null

  return (
    <article
      className={`rounded-2xl border-l-4 ${phaseColor?.border || 'border-ruhi-earth/30'}
                  border-y border-r border-white/60 bg-white/70 backdrop-blur-sm shadow-sm
                  overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/40 transition-colors"
      >
        <span className="text-xs text-ruhi-earth tabular-nums flex-shrink-0 mt-0.5 w-12">
          {formatTime(entry.timestamp)}
        </span>
        {/* Header shows the preview only when collapsed. When expanded,
            the body owns the full note — leave the header line empty so
            the body content is the focus. The flex-1 keeps the chevron
            anchored on the right. */}
        <span className="flex-1 min-w-0 text-sm text-ruhi-deep truncate">
          {open ? ' ' : preview(entry.note, 70)}
        </span>
        <span aria-hidden="true" className={`text-ruhi-earth/60 flex-shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`}>
          <Chevron />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 screen-enter">
          {typeof entry.energy === 'number' && (
            <p className="text-[11px] text-ruhi-earth mb-2">
              I was{' '}
              <span className="text-ruhi-deep">{ENERGY_LABELS[entry.energy] || `${entry.energy}/5`}</span>.
            </p>
          )}
          <p className="text-ruhi-deep leading-relaxed text-sm whitespace-pre-wrap">{entry.note}</p>
          {entry.reflection && (
            <div className="mt-3 pt-3 border-t border-ruhi-earth/15">
              <p className="text-[10px] uppercase tracking-widest text-ruhi-earth/70 mb-1">
                Ruhi reflected
              </p>
              <p className="text-sm text-ruhi-deep italic leading-relaxed">{entry.reflection}</p>
            </div>
          )}
          {entry.phase && typeof entry.day === 'number' && (
            <div className="mt-3 flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${phaseColor?.dot || 'bg-ruhi-earth/40'}`}
              />
              <span className="text-[10px] uppercase tracking-wide text-ruhi-earth/80">
                {entry.phase} · Day {entry.day}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function ChevronLeft() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}
function ChevronRight() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}
function Chevron() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
