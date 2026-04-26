'use client'

import { useEffect, useState } from 'react'
import { isOnboardingComplete, getProfile } from '@/lib/storage'
import Landing from '@/components/Landing'
import Onboarding from '@/components/Onboarding'
import TransitionScreen from '@/components/TransitionScreen'
import DailyCheckin from '@/components/DailyCheckin'

export default function Home() {
  const [screen, setScreen] = useState('loading')

  useEffect(() => {
    if (isOnboardingComplete()) {
      setScreen('checkin')
    } else {
      setScreen('landing')
    }
  }, [])

  // Edit profile — go back to onboarding starting at the LAST screen
  function handleEditProfile() {
    setScreen('editing')
  }

  if (screen === 'loading') {
    return <div className="min-h-screen bg-ruhi-cream" />
  }

  if (screen === 'landing') {
    return <Landing onStart={() => setScreen('onboarding')} />
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onComplete={() => setScreen('transition')}
      />
    )
  }

  // Editing mode — opens onboarding at the last screen with existing data;
  // skip the transition screen since they're already set up.
  if (screen === 'editing') {
    return (
      <Onboarding
        initialProfile={getProfile()}
        startAtEnd
        onComplete={() => setScreen('checkin')}
      />
    )
  }

  if (screen === 'transition') {
    return <TransitionScreen onContinue={() => setScreen('checkin')} />
  }

  if (screen === 'checkin') {
    return <DailyCheckin onEditProfile={handleEditProfile} />
  }
}
