'use client'

// SessionProvider wrapper — required by next-auth v5's client-side hooks
// (useSession, signIn, signOut). Wraps the entire app at the layout level
// so any descendant client component can read the current session.
//
// Pattern: a thin client wrapper around an otherwise-server layout, lets
// us keep app/layout.js as a server component while still providing the
// auth context to client components like NavMenu.

import { SessionProvider } from 'next-auth/react'

export default function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
