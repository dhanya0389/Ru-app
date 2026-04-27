'use client'

import { useEffect, useState } from 'react'
import { isOnboardingComplete, getProfile, clearProfile } from '@/lib/storage'
import Landing from '@/components/Landing'
import Onboarding from '@/components/Onboarding'
import TransitionScreen from '@/components/TransitionScreen'
import DailyCheckin from '@/components/DailyCheckin'

export default function Home() {
  const [screen, setScreen] = useState('loading')
  const [editStep, setEditStep] = useState(null)
  // NavMenu open state lives here so we can re-open it after a single-section
  // save returns to Daily Check-in (chained-edit flow).
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (isOnboardingComplete()) {
      setScreen('checkin')
    } else {
      setScreen('landing')
    }
  }, [])

  // Centralized navigation entrypoint shared with NavMenu.
  // target: 'today' | 'welcome' | 'reset' | { type: 'edit', step: number }
  function goTo(target) {
    setMenuOpen(false)
    if (target === 'today') {
      setScreen('checkin')
      return
    }
    if (target === 'welcome') {
      setScreen('landing')
      return
    }
    if (target === 'reset') {
      clearProfile()
      setScreen('landing')
      return
    }
    if (target && target.type === 'edit') {
      setEditStep(target.step)
      setScreen('edit-section')
    }
  }

  // After single-section save or cancel, return to Daily Check-in with the
  // menu re-opened so the user can chain another edit.
  function exitEditSection() {
    setScreen('checkin')
    setMenuOpen(true)
  }

  if (screen === 'loading') {
    return <div className="min-h-screen bg-ruhi-cream" />
  }

  if (screen === 'landing') {
    return (
      <Landing
        onStart={() => setScreen('onboarding')}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onComplete={() => setScreen('transition')}
      />
    )
  }

  if (screen === 'edit-section') {
    return (
      <Onboarding
        initialProfile={getProfile()}
        editSection={editStep}
        onSaveSection={exitEditSection}
        onCancelSection={exitEditSection}
      />
    )
  }

  if (screen === 'transition') {
    return (
      <TransitionScreen
        onContinue={() => setScreen('checkin')}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }

  if (screen === 'checkin') {
    return (
      <DailyCheckin
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onNavigate={goTo}
      />
    )
  }
}
