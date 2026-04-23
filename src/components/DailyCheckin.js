'use client'

import { useState, useEffect } from 'react'
import { getProfile } from '@/lib/storage'
import { getCurrentPhase, phaseInfo } from '@/lib/phases'
import VoiceInput from '@/components/VoiceInput'
import CardView from '@/components/CardView'

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
  5: 'on fire',
}

export default function DailyCheckin({ onEditProfile }) {
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
      />
    )
  }

  const phaseLabel = phase ? `${phase.name} · Day ${phase.day}` : null

  return (
    <div className="ruhi-bg min-h-screen flex flex-col items-center px-6 py-12 max-w-md mx-auto relative z-10">
      {/* Edit profile — goes back to onboarding with data pre-filled */}
      <button
        onClick={onEditProfile}
        className="self-end text-xs text-ruhi-earth/40 hover:text-ruhi-earth/70 transition-colors mb-4"
      >
        Edit profile
      </button>

      {/* Phase indicator */}
      {phaseLabel && (
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ruhi-warm/60 text-sm text-ruhi-earth/70 mb-8 screen-enter">
          <span className="w-2 h-2 rounded-full bg-ruhi-sage" />
          {phaseLabel}
        </div>
      )}

      <h2 className="font-display text-2xl text-ruhi-deep mb-1 screen-enter">What's tonight?</h2>
      <p className="text-ruhi-earth/60 mb-8 screen-enter">Check in, and I'll build your evening.</p>

      {/* Energy — phase-aware language */}
      <div className="w-full mb-8 screen-enter">
        <p className="text-sm text-ruhi-earth/70 mb-2">
          {phase
            ? `Based on your ${phase.name.toLowerCase()} phase, you're probably `
            : "Right now you're probably "}
          <span className="font-semibold text-ruhi-deep">{ENERGY_LABELS[energy]}</span>.
          {' '}Adjust if that's off.
        </p>
        <input
          type="range"
          min="1"
          max="5"
          value={energy}
          onChange={e => setEnergy(Number(e.target.value))}
          className="w-full accent-ruhi-deep"
        />
        <div className="flex justify-between text-xs text-ruhi-earth/40 mt-1">
          <span>Running on empty</span>
          <span>On fire</span>
        </div>
      </div>

      {/* Cooking mood */}
      <div className="w-full mb-8 screen-enter">
        <p className="text-sm text-ruhi-earth/70 mb-3">Tonight feels like...</p>
        <div className="flex flex-col gap-2">
          {COOKING_MOODS.map(m => (
            <button
              key={m.key}
              onClick={() => setCookingMood(m.key)}
              className={`flex justify-between items-center px-4 py-3 rounded-xl border-2 transition-all duration-200
                ${cookingMood === m.key
                  ? 'border-ruhi-deep bg-ruhi-deep/5 shadow-sm'
                  : 'border-ruhi-earth/15 hover:border-ruhi-earth/40'
                }`}
            >
              <span className="text-ruhi-deep">{m.label}</span>
              <span className="text-xs text-ruhi-earth/50">{m.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Kitchen input — voice + text */}
      <div className="w-full mb-10 screen-enter">
        <p className="text-sm text-ruhi-earth/70 mb-2">What's in your kitchen?</p>
        <VoiceInput
          placeholder="e.g. chickpeas, spinach, rice, chicken thighs..."
          onResult={(text) => setKitchen(text)}
        />
        <p className="text-xs text-ruhi-earth/40 mt-1">Type, use voice, or leave blank — I'll work with what I know.</p>
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
