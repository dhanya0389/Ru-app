'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/storage'
import { getCurrentPhase, phaseInfo } from '@/lib/phases'
import VoiceInput from '@/components/VoiceInput'
import CardView from '@/components/CardView'
import NavMenu from '@/components/NavMenu'

const COOKING_MOODS = [
  { key: 'quick', label: 'Quick & done', time: 'Under 15 min' },
  { key: 'medium', label: "I've got a minute", time: '15–30 min' },
  { key: 'therapy', label: 'Cooking is therapy', time: '30–45+ min' },
]

const ENERGY_LABELS = {
  1: 'running on empty',
  2: 'taking it slow',
  3: 'steady',
  4: 'feeling good',
  5: 'fabulous',
}

export default function DailyCheckin({ menuOpen, setMenuOpen, onNavigate }) {
  const [profile, setProfile] = useState(null)
  const [phase, setPhase] = useState(null)
  const [energy, setEnergy] = useState(3)
  const [cookingMood, setCookingMood] = useState(null)
  const [kitchen, setKitchen] = useState('')
  const [showCards, setShowCards] = useState(false)

  useEffect(() => {
    const p = getProfile()
    setProfile(p)
    if (p?.lastPeriodStart) {
      const cycleLengthMap = { '24–26': 25, '27–29': 28, '30–32': 31, 'It varies': 28 }
      const len = cycleLengthMap[p.cycleLength] || 28
      const ph = getCurrentPhase(p.lastPeriodStart, len)
      setPhase(ph)
      if (ph) {
        setEnergy(ph.energy)
        setCookingMood(phaseInfo[ph.name]?.cookingDefault || 'medium')
      }
    }
  }, [])

  if (showCards) {
    return (
      <CardView
        profile={profile}
        phase={phase}
        energy={energy}
        cookingMood={cookingMood}
        kitchen={kitchen}
        onBack={() => setShowCards(false)}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={onNavigate}
      />
    )
  }

  const phaseLabel = phase ? `${phase.name} · Day ${phase.day}` : null

  return (
    <div className="ruhi-bg min-h-screen flex flex-col items-center px-6 py-12 max-w-md mx-auto relative z-10">
      <NavMenu open={menuOpen} setOpen={setMenuOpen} onNavigate={onNavigate} />

      {/* Phase indicator */}
      {phaseLabel && (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ruhi-warm/60 text-sm text-ruhi-earth mb-8 screen-enter">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ruhi-sage" />
          {phaseLabel}
        </div>
      )}

      <h2 className="font-display text-2xl text-ruhi-deep mb-8 screen-enter">What's today?</h2>

      {/* Energy — first-person; the phase pill above already names the phase */}
      <div className="w-full mb-8 screen-enter">
        <p id="energy-label" className="text-base text-ruhi-earth mb-2">
          I am{' '}
          <span className="font-semibold text-ruhi-deep">{ENERGY_LABELS[energy]}</span>.
        </p>
        <input
          type="range"
          min="1"
          max="5"
          value={energy}
          onChange={e => setEnergy(Number(e.target.value))}
          aria-labelledby="energy-label"
          aria-valuetext={ENERGY_LABELS[energy]}
          className="w-full accent-ruhi-deep"
        />
        <div aria-hidden="true" className="flex justify-between text-xs text-ruhi-earth mt-1">
          <span>Running on empty</span>
          <span>Fabulous</span>
        </div>
      </div>

      {/* Cooking mood */}
      <div className="w-full mb-8 screen-enter" role="radiogroup" aria-label="Cooking mood">
        <p className="text-base text-ruhi-earth mb-3">Today feels like...</p>
        <div className="flex flex-col gap-2">
          {COOKING_MOODS.map(m => (
            <button
              key={m.key}
              onClick={() => setCookingMood(m.key)}
              role="radio"
              aria-checked={cookingMood === m.key}
              className={`flex justify-between items-center px-4 py-3 rounded-xl border-2 transition-all duration-200
                ${cookingMood === m.key
                  ? 'border-ruhi-deep bg-ruhi-deep/5 shadow-sm'
                  : 'border-ruhi-earth/40 hover:border-ruhi-deep'
                }`}
            >
              <span className="text-ruhi-deep">{m.label}</span>
              <span className="text-xs text-ruhi-earth">{m.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Kitchen input — voice + text */}
      <div className="w-full mb-10 screen-enter">
        <p className="text-base text-ruhi-earth mb-2">What's in your kitchen?</p>
        <VoiceInput
          label="What's in your kitchen"
          placeholder="e.g. chickpeas, spinach, rice, chicken thighs..."
          onResult={(text) => setKitchen(text)}
        />
        <p className="text-sm text-ruhi-earth mt-1">Type, use voice, or leave blank — I'll work with what I know.</p>
      </div>

      {/* CTA */}
      <button
        onClick={() => setShowCards(true)}
        className="w-full py-3 rounded-full bg-ruhi-deep text-ruhi-cream text-lg
                   hover:bg-ruhi-earth transition-all duration-300 hover:scale-[1.02]
                   shadow-lg shadow-ruhi-deep/20"
      >
        Show me my day
      </button>
    </div>
  )
}
