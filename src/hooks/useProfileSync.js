'use client'

import { useEffect, useState } from 'react'
import { useSession } from './useSession'
import {
  setActiveUserId,
  getProfile,
  replaceLocalProfile,
} from '@/lib/storage'
import { loadProfileFromCloud, saveProfileToCloud } from '@/lib/cloudProfile'

// Top-level reconcile between localStorage and the user's cloud profile
// row. Mount this once near the root so the wiring is global.
//
// Behavior (Phase 2 locked decisions in docs/roadmap.md):
//   • Loading / unauthenticated → activeUserId is null. Every saveProfile
//     stays local-only. localStorage is never wiped on sign-out.
//   • Authenticated, cloud row exists → cloud wins. Overwrite local with
//     the cloud blob (no mirror back, since we just read it).
//   • Authenticated, no cloud row, local profile present → auto-import.
//     Silently upload local to cloud. No prompt, no friction.
//   • Authenticated, neither side has data → no-op. Onboarding-then-save
//     will create the row via the dual-write in saveProfile.
//
// Returns a `synced` flag the parent can use as an effect dep to re-pull
// getProfile() after the reconcile lands. The flag flips back to false
// while a new sign-in is reconciling so consumers can show a loading
// state if they need one (today nobody does — sync is fast enough that
// the existing render uses local data immediately).
export function useProfileSync() {
  const { user, status } = useSession()
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated' || !user?.id) {
      setActiveUserId(null)
      setSynced(true)
      return
    }

    let cancelled = false
    setSynced(false)
    setActiveUserId(user.id)

    ;(async () => {
      try {
        const cloud = await loadProfileFromCloud(user.id)
        if (cancelled) return

        if (cloud) {
          // Cloud is the source of truth. Overwrite local without
          // re-mirroring (we just read this exact blob from the server).
          replaceLocalProfile(cloud)
        } else {
          // First time on this device — auto-import any local data.
          const local = getProfile()
          if (local && Object.keys(local).length > 0) {
            await saveProfileToCloud(user.id, local)
          }
        }
      } catch (err) {
        console.warn('[profile-sync] reconcile failed:', err?.message || err)
      } finally {
        if (!cancelled) setSynced(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, status])

  return { synced, status }
}
