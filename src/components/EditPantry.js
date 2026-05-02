'use client'

import { useEffect, useState } from 'react'
import { getPantry, savePantry } from '@/lib/storage'
import VoiceInput from '@/components/VoiceInput'
import NavMenu from '@/components/NavMenu'

// Direct-access editor for the persistent pantry. Reachable from NavMenu →
// "Edit pantry". Same free-text shape as the Daily Check-in / Weekly Mode
// kitchen fields — the AI reads it however the user writes it.

export default function EditPantry({ onBack, menuOpen, setMenuOpen, onNavigate }) {
  const [text, setText] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setText(getPantry())
  }, [])

  function handleSave() {
    savePantry(text)
    setSavedFlash(true)
    setTimeout(() => {
      setSavedFlash(false)
      onBack()
    }, 600)
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

      <h1 className="font-display text-3xl text-ruhi-deep mb-2">
        Your pantry
      </h1>
      <p className="text-sm text-ruhi-earth leading-relaxed mb-6">
        Everything you have on hand. Used by Daily Check-in and Weekly mode.
        Add or remove anytime.
      </p>

      <div className="mb-6">
        <VoiceInput
          label="Pantry contents"
          placeholder="e.g. chickpeas, spinach, rice, chicken thighs, tahini, lemon..."
          initialValue={text}
          onResult={(t) => setText(t)}
        />
        <p className="text-xs text-ruhi-earth mt-1">
          Free text — type, paste, or use voice. The AI parses it on the fly.
        </p>
      </div>

      <div className="flex gap-3 mt-auto">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-full border border-ruhi-earth/40 text-ruhi-earth
                     hover:bg-white/60 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-sm
                     hover:bg-ruhi-earth transition-all shadow-md"
        >
          {savedFlash ? 'Saved ✓' : 'Save pantry'}
        </button>
      </div>
    </div>
  )
}
