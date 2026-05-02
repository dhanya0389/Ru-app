'use client'

import { useState } from 'react'
import VoiceInput from '@/components/VoiceInput'
import { addEntry } from '@/lib/journal'

// Modal/sheet for capturing a voice journal entry. Opened from the Energy
// card in CardView, also reachable from the Journal screen. On save: persists
// to localStorage with phase/day/energy metadata, fetches a 1–2 sentence
// embodied reflection from /api/journal-reflect, then shows the reflection
// before closing. Reflection failure is non-fatal — entry still saves.
export default function VoiceJournal({ phase, energy, onClose, onSaved }) {
  const [note, setNote] = useState('')
  const [stage, setStage] = useState('write') // 'write' | 'saving' | 'reflection'
  const [reflection, setReflection] = useState(null)
  const [savedEntry, setSavedEntry] = useState(null)

  const phaseLabel = phase ? `${phase.name} · Day ${phase.day}` : null
  const canSave = note.trim().length > 0 && stage === 'write'

  async function handleSave() {
    if (!canSave) return
    setStage('saving')

    let reflectionText = null
    try {
      const res = await fetch('/api/journal-reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note.trim(),
          phase: phase?.name ?? null,
          day: phase?.day ?? null,
          energy,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        reflectionText = data.reflection || null
      }
    } catch {
      // Non-fatal — entry still saves below
    }

    const entry = addEntry({
      note: note.trim(),
      energy,
      phase: phase?.name ?? null,
      day: phase?.day ?? null,
      reflection: reflectionText,
    })
    setSavedEntry(entry)
    setReflection(reflectionText)
    setStage('reflection')
    onSaved?.(entry)
  }

  function handleDone() {
    onClose?.(savedEntry)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-ruhi-cream fullscreen-card-enter"
      role="dialog"
      aria-modal="true"
      aria-label="Voice journal entry"
    >
      <div className="h-full overflow-y-auto">
        <div className="max-w-md mx-auto px-6 py-8">
          <button
            onClick={() => onClose?.(null)}
            className="mb-6 text-sm text-ruhi-earth hover:text-ruhi-deep transition-colors flex items-center gap-1"
          >
            <span aria-hidden="true">←</span> Back
          </button>

          <div aria-hidden="true" className="w-12 h-12 rounded-full bg-ruhi-warm/60 flex items-center justify-center mb-5">
            <span className="text-xl">📝</span>
          </div>

          <h2 className="font-display text-2xl text-ruhi-deep mb-2">
            {stage === 'reflection' ? 'Saved.' : 'A note for today'}
          </h2>

          {phaseLabel && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ruhi-warm/60 text-xs text-ruhi-earth mb-6">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ruhi-sage" />
              {phaseLabel}
            </div>
          )}

          {stage === 'write' && (
            <>
              <p className="text-sm text-ruhi-earth mb-3 leading-relaxed">
                How does today actually feel? Speak or type — a sentence is enough.
                Ruhi remembers and brings it back when the same day comes around again.
              </p>
              <VoiceInput
                label="Journal entry"
                placeholder="e.g. tired but focused, craving warmth, slept well..."
                initialValue={note}
                onResult={(text) => setNote(text)}
              />
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="w-full mt-6 py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-base
                           hover:bg-ruhi-earth transition-all duration-300 hover:scale-[1.02]
                           shadow-lg shadow-ruhi-deep/20
                           disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-ruhi-deep"
              >
                Save entry
              </button>
            </>
          )}

          {stage === 'saving' && (
            <div className="flex flex-col items-center gap-4 mt-8" role="status" aria-live="polite">
              <div aria-hidden="true" className="w-10 h-10 border-[3px] border-ruhi-warm border-t-ruhi-deep rounded-full animate-spin" />
              <p className="text-sm text-ruhi-earth animate-pulse">Saving and reflecting...</p>
            </div>
          )}

          {stage === 'reflection' && (
            <>
              <div className="bg-white/70 rounded-2xl p-5 mb-4">
                <p className="text-xs uppercase tracking-widest text-ruhi-earth/70 mb-2">Your note</p>
                <p className="text-ruhi-deep leading-relaxed">{note.trim()}</p>
              </div>

              {reflection ? (
                <div className="bg-ruhi-warm/40 rounded-2xl p-5 border border-ruhi-warm mb-6">
                  <p className="text-xs uppercase tracking-widest text-ruhi-earth/70 mb-2">Ruhi reflects</p>
                  <p className="text-ruhi-deep italic leading-relaxed">{reflection}</p>
                </div>
              ) : (
                <p className="text-xs text-ruhi-earth bg-ruhi-rose/30 rounded-md px-3 py-2 mb-6">
                  Saved. Reflection is offline right now — your entry is safe.
                </p>
              )}

              <button
                onClick={handleDone}
                className="w-full py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-base
                           hover:bg-ruhi-earth transition-all duration-300 hover:scale-[1.02]
                           shadow-lg shadow-ruhi-deep/20"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
