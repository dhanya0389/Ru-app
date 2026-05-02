'use client'

import { useEffect, useState } from 'react'
import { getProfile } from '@/lib/storage'
import { getCurrentPhase } from '@/lib/phases'
import { getEntries } from '@/lib/journal'
import VoiceJournal from '@/components/VoiceJournal'
import NavMenu from '@/components/NavMenu'

const ENERGY_LABELS = {
  1: 'running on empty',
  2: 'taking it slow',
  3: 'steady',
  4: 'feeling good',
  5: 'fabulous',
}

function formatEntryDate(timestamp) {
  const d = new Date(timestamp)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const wasYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  if (wasYesterday) return `Yesterday, ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function JournalScreen({ onBack, menuOpen, setMenuOpen, onNavigate }) {
  const [entries, setEntries] = useState([])
  const [phase, setPhase] = useState(null)
  const [energy, setEnergy] = useState(3)
  const [showCapture, setShowCapture] = useState(false)

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

  return (
    <div className="ruhi-bg min-h-screen flex flex-col px-6 py-6 max-w-md mx-auto relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

      <button
        onClick={onBack}
        className="text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors mb-4 self-start"
      >
        <span aria-hidden="true">←</span> Back
      </button>

      <h2 className="font-display text-2xl text-ruhi-deep mb-2 screen-enter">Journal</h2>
      <p className="text-sm text-ruhi-earth mb-6 screen-enter">
        Notes from past phases. Ruhi reads these silently when planning your day.
      </p>

      <button
        onClick={() => setShowCapture(true)}
        className="w-full py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-base mb-8
                   hover:bg-ruhi-earth transition-all duration-300 hover:scale-[1.02]
                   shadow-lg shadow-ruhi-deep/20 screen-enter"
      >
        Add a note
      </button>

      {entries.length === 0 ? (
        <div className="bg-white/60 rounded-2xl p-6 text-center screen-enter">
          <p className="text-sm text-ruhi-earth leading-relaxed">
            No entries yet. The first one starts the loop —
            next time you're in this phase, Ruhi brings it back.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="screen-enter rounded-2xl border border-white/60 shadow-sm bg-white/70 backdrop-blur-sm p-5"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-ruhi-earth">{formatEntryDate(entry.timestamp)}</span>
                {entry.phase && typeof entry.day === 'number' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ruhi-warm/60 text-[11px] text-ruhi-earth">
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ruhi-sage" />
                    {entry.phase} · Day {entry.day}
                  </span>
                )}
              </div>
              {typeof entry.energy === 'number' && (
                <p className="text-xs text-ruhi-earth mb-2">
                  I was{' '}
                  <span className="text-ruhi-deep">{ENERGY_LABELS[entry.energy] || `${entry.energy}/5`}</span>.
                </p>
              )}
              <p className="text-ruhi-deep leading-relaxed">{entry.note}</p>
              {entry.reflection && (
                <div className="mt-3 pt-3 border-t border-ruhi-earth/15">
                  <p className="text-[11px] uppercase tracking-widest text-ruhi-earth/70 mb-1">Ruhi reflected</p>
                  <p className="text-sm text-ruhi-deep italic leading-relaxed">{entry.reflection}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

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
