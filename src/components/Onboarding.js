'use client'

import { useState } from 'react'
import { saveProfile, getProfile } from '@/lib/storage'
import VoiceInput from '@/components/VoiceInput'

// ── Screen definitions ──────────────────────────────────────────────

const CUISINES = [
  'Indian', 'Mexican', 'Mediterranean', 'Thai', 'Japanese',
  'Korean', 'Middle Eastern', 'Italian', 'Chinese', 'Ethiopian',
  'Vietnamese', 'American', 'French', 'Caribbean',
]

const MOVEMENTS = [
  'Walking', 'Yoga', 'Strength training', 'Running', 'Pilates',
  'Dance', 'Swimming', 'HIIT', 'Cycling', 'Martial arts',
  'Still figuring it out',
]

const GOALS = [
  'Make food decisions easy',
  'More energy',
  'Better gut health',
  'Beat the 3pm slump',
  'Tame midnight cravings',
  'Move more',
  'Eat more intentionally',
  'All of the above',
]

const CYCLE_LENGTHS = ['24–26', '27–29', '30–32', 'It varies']

const LIFE_STAGES = [
  'Twenties or younger',
  'Thirties',
  'Forties',
  'Fifties',
  'Sixties and beyond',
]

const DEFAULT_PROFILE = {
  diet: null,
  cuisines: [],
  avoidances: '',
  movements: [],
  movementFrequency: null,
  goals: [],
  tracksCycle: null,
  lastPeriodStart: '',
  cycleLength: null,
  age: '',
}

// ── Onboarding component ────────────────────────────────────────────

export default function Onboarding({ initialProfile, startAtEnd, onComplete }) {
  const isEditing = !!initialProfile
  // If startAtEnd, open at the last screen the user completed
  // (cycle details if they track, cycle question if they don't, or last screen)
  const [step, setStep] = useState(() => {
    if (startAtEnd && initialProfile) {
      if (initialProfile.tracksCycle && initialProfile.lastPeriodStart) return 8
      if (initialProfile.tracksCycle === false) return 7
      return 7
    }
    if (isEditing) return 1
    return 0
  })
  const [profile, setProfile] = useState(() => {
    if (initialProfile) {
      return { ...DEFAULT_PROFILE, ...initialProfile }
    }
    return { ...DEFAULT_PROFILE }
  })

  function update(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  function toggleInArray(field, value) {
    setProfile(prev => {
      const arr = prev[field]
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(v => v !== value) }
      }
      return { ...prev, [field]: [...arr, value] }
    })
  }

  function handleGoalTap(goal) {
    if (goal === 'All of the above') {
      const allGoals = GOALS.filter(g => g !== 'All of the above')
      const alreadyAll = profile.goals.length === allGoals.length
      update('goals', alreadyAll ? [] : allGoals)
    } else {
      toggleInArray('goals', goal)
    }
  }

  function next() {
    if (step === 7 && profile.tracksCycle === false) {
      finish()
      return
    }
    if (step === screens.length - 1) {
      finish()
      return
    }
    setStep(s => s + 1)
  }

  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  function finish() {
    saveProfile({ ...profile, onboardingComplete: true })
    onComplete()
  }

  // ── Screen renderers ────────────────────────────────────────────

  const screens = [
    // 0: Welcome
    () => (
      <Screen
        greeting="Hey. I'm Ruhi."
        subtitle="I'm here to help you build a health system that's actually yours — based on your body, your cycle, and your life."
        onNext={next}
        nextLabel="Let's go"
        showBack={false}
      />
    ),

    // 1: Life stage (was: age)
    () => (
      <Screen title="What stage of life are you in?" subtitle="So I can tailor nutrition to your body's stage." onNext={next} onBack={back} canProceed={profile.age !== ''}>
        <div className="flex flex-col gap-3">
          {LIFE_STAGES.map(opt => (
            <OptionButton key={opt} label={opt} selected={profile.age === opt} onTap={() => update('age', opt)} />
          ))}
        </div>
      </Screen>
    ),

    // 2: Diet type
    () => (
      <Screen title="What does food look like for you?" onNext={next} onBack={back} canProceed={!!profile.diet}>
        <div className="flex flex-col gap-3">
          {['Everything', 'Everything but red meat', 'Pescatarian', 'Vegetarian', 'Vegan'].map(opt => (
            <OptionButton key={opt} label={opt} selected={profile.diet === opt} onTap={() => update('diet', opt)} />
          ))}
        </div>
      </Screen>
    ),

    // 3: Cuisines (up to 3)
    () => (
      <Screen title="What cuisines feel like home?" subtitle="Pick up to 3" onNext={next} onBack={back} canProceed={profile.cuisines.length > 0}>
        <p className="text-center text-base text-ruhi-earth mb-4" aria-live="polite">
          {profile.cuisines.length} of 3 selected
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {CUISINES.map(c => {
            const isSelected = profile.cuisines.includes(c)
            const atLimit = profile.cuisines.length >= 3 && !isSelected
            return (
              <OptionButton
                key={c}
                label={c}
                selected={isSelected}
                disabled={atLimit}
                onTap={() => {
                  if (isSelected || profile.cuisines.length < 3) {
                    toggleInArray('cuisines', c)
                  }
                }}
                small
              />
            )
          })}
        </div>
      </Screen>
    ),

    // 4: Avoidances (voice + text)
    () => (
      <Screen title="Anything your body says no to?" subtitle="Allergies, intolerances, foods you avoid" onNext={next} onBack={back} canProceed>
        <VoiceInput
          label="Foods to avoid"
          placeholder="e.g. gluten, dairy, shellfish..."
          initialValue={profile.avoidances}
          onResult={(text) => update('avoidances', text)}
        />
        <button
          onClick={() => { update('avoidances', ''); next(); }}
          className="block mx-auto mt-5 px-6 py-2.5 rounded-full border border-ruhi-earth/40
                     text-sm text-ruhi-earth hover:bg-ruhi-warm/50 hover:border-ruhi-earth
                     transition-colors"
        >
          Skip — no restrictions
        </button>
      </Screen>
    ),

    // 5: Movement + frequency
    () => (
      <Screen title="What's your movement vibe?" subtitle="Pick all that apply" onNext={next} onBack={back} canProceed={profile.movements.length > 0}>
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {MOVEMENTS.map(m => (
            <OptionButton
              key={m}
              label={m}
              selected={profile.movements.includes(m)}
              onTap={() => {
                if (m === 'Still figuring it out') {
                  update('movements', ['Still figuring it out'])
                } else {
                  const filtered = profile.movements.filter(v => v !== 'Still figuring it out')
                  if (filtered.includes(m)) {
                    update('movements', filtered.filter(v => v !== m))
                  } else {
                    update('movements', [...filtered, m])
                  }
                }
              }}
              small
              highlight={m === 'Still figuring it out'}
            />
          ))}
        </div>
        <p className="text-base text-ruhi-earth mb-2">How often?</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {['1–2x/week', '3–4x/week', '5+/week', 'Still figuring it out'].map(f => (
            <OptionButton key={f} label={f} selected={profile.movementFrequency === f} onTap={() => update('movementFrequency', f)} small
              highlight={f === 'Still figuring it out'}
            />
          ))}
        </div>
      </Screen>
    ),

    // 6: Goals (pick any number, or "all of the above")
    () => (
      <Screen title="If Ruhi could help with one thing — what would it be?" subtitle="Pick as many as you'd like" onNext={next} onBack={back} canProceed={profile.goals.length > 0}>
        <div className="flex flex-col gap-3">
          {GOALS.map(g => (
            <OptionButton
              key={g}
              label={g}
              selected={
                g === 'All of the above'
                  ? profile.goals.length === GOALS.length - 1
                  : profile.goals.includes(g)
              }
              onTap={() => handleGoalTap(g)}
              highlight={g === 'All of the above'}
            />
          ))}
        </div>
      </Screen>
    ),

    // 7: Cycle tracking
    () => (
      <Screen title="Do you track your cycle?" onNext={next} onBack={back} canProceed={profile.tracksCycle !== null}>
        <div className="flex flex-col gap-3">
          <OptionButton label="Yes" selected={profile.tracksCycle === true} onTap={() => update('tracksCycle', true)} />
          <OptionButton label="Skip" selected={profile.tracksCycle === false} onTap={() => update('tracksCycle', false)} />
        </div>
      </Screen>
    ),

    // 8: Cycle details (only shown if tracksCycle === true)
    () => (
      <Screen title="A little more about your cycle" onNext={next} onBack={back} canProceed={profile.lastPeriodStart !== ''}>
        <label htmlFor="lastPeriodStart" className="block text-base text-ruhi-earth mb-1">When did your last period start?</label>
        <input
          id="lastPeriodStart"
          type="date"
          value={profile.lastPeriodStart}
          onChange={e => update('lastPeriodStart', e.target.value)}
          className="w-full p-3 rounded-xl bg-white/60 border border-ruhi-earth/40
                     focus:border-ruhi-deep mb-6"
        />
        <p className="text-base text-ruhi-earth mb-2">Typical cycle length?</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {CYCLE_LENGTHS.map(cl => (
            <OptionButton key={cl} label={cl} selected={profile.cycleLength === cl} onTap={() => update('cycleLength', cl)} small />
          ))}
        </div>
      </Screen>
    ),
  ]

  return (
    <div className="ruhi-bg min-h-screen flex flex-col relative z-10">
      <div className="flex-1 flex flex-col">
        {screens[step]()}
      </div>
      {/* Progress dots — one per screen, filled as the user advances. Sits at
          the bottom of the screen as a quiet pagination cue. */}
      <div
        className="flex items-center justify-center gap-1.5 pt-2 pb-6"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={screens.length}
        aria-label={`Step ${step + 1} of ${screens.length}`}
      >
        {screens.map((_, i) => {
          const isDone = i < step
          const isCurrent = i === step
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`block h-1.5 rounded-full transition-all duration-400 ease-out
                ${isCurrent
                  ? 'w-6 bg-ruhi-deep'
                  : isDone
                    ? 'w-1.5 bg-ruhi-deep/70'
                    : 'w-1.5 bg-ruhi-warm'}
              `}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Shared UI pieces ────────────────────────────────────────────────

function Screen({ title, greeting, subtitle, children, onNext, onBack, nextLabel = 'Continue', showBack = true, canProceed = true }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto w-full screen-enter">
      {greeting && (
        <h2 className="font-display text-3xl text-ruhi-deep mb-3 text-center">{greeting}</h2>
      )}
      {title && !greeting && (
        <h2 className="font-display text-2xl text-ruhi-deep mb-2 text-center">{title}</h2>
      )}
      {subtitle && <p className="text-ruhi-earth mb-8 text-center leading-relaxed max-w-xs">{subtitle}</p>}
      {!subtitle && <div className="mb-8" />}
      <div className="w-full mb-10">{children}</div>
      <div className="flex gap-4 w-full">
        {showBack && onBack && (
          <button onClick={onBack} className="flex-1 py-3 rounded-full border border-ruhi-earth/40 text-ruhi-earth
                                               hover:bg-ruhi-warm/50 transition-colors">
            Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`flex-1 py-3 rounded-full text-ruhi-cream transition-all duration-300
            ${canProceed
              ? 'bg-ruhi-deep hover:bg-ruhi-earth hover:scale-[1.02] shadow-md shadow-ruhi-deep/15'
              : 'bg-ruhi-earth/50 cursor-not-allowed'}`}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

function OptionButton({ label, selected, onTap, small = false, highlight = false, disabled = false }) {
  return (
    <button
      onClick={onTap}
      aria-pressed={selected}
      disabled={disabled}
      className={`rounded-full border-2 transition-all duration-200
        ${small ? 'px-4 py-2 text-sm' : 'px-6 py-3'}
        ${disabled
          ? 'border-ruhi-earth/20 text-ruhi-earth/40 cursor-not-allowed'
          : selected
            ? 'border-ruhi-deep bg-ruhi-deep text-ruhi-cream scale-[1.03] shadow-md'
            : highlight
              ? 'border-ruhi-sage text-ruhi-deep hover:border-ruhi-deep bg-ruhi-sage/20'
              : 'border-ruhi-earth/40 text-ruhi-earth hover:border-ruhi-earth hover:bg-white/40'
        }`}
    >
      {label}
    </button>
  )
}
