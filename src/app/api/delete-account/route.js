// POST /api/delete-account — irreversible account + data deletion (PR #32).
//
// Backs the "Delete my data" button in NavMenu. The browser sends its
// Supabase access token; we verify it server-side, then use the Supabase
// service_role key to delete the auth.users row. The schema's
//   on delete cascade
// foreign keys take care of profiles/journals/weekly_plans/pantry —
// the user's data evaporates atomically with the auth row.
//
// The service_role key is the unrestricted admin key for the Supabase
// project. It must NEVER be exposed to the browser — that's why this
// runs server-side. The env var name is intentionally NOT prefixed with
// NEXT_PUBLIC_ so Next.js refuses to bundle it client-side.

import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    // Misconfigured environment — likely SUPABASE_SERVICE_ROLE_KEY missing
    // from .env.local or Vercel. The user-facing error stays vague; the
    // server log is specific so it's debuggable.
    console.error(
      '[delete-account] missing env vars — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
    )
    return Response.json(
      { error: 'server_misconfigured' },
      { status: 500 }
    )
  }

  // Pull the user's access token from the Authorization header. The
  // client (lib/cloudProfile.js → deleteAccount) sends it explicitly so
  // we don't depend on cookie parsing.
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Admin client — service_role bypasses RLS, lets us call auth.admin.* ,
  // and is the only key that can delete auth.users rows.
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the bearer token is a real, non-expired Supabase session and
  // resolve it to a user id. This is the gate: without a valid token we
  // never reach the deleteUser call below.
  const { data: userData, error: verifyErr } = await admin.auth.getUser(token)
  if (verifyErr || !userData?.user) {
    return Response.json({ error: 'invalid_token' }, { status: 401 })
  }

  const userId = userData.user.id

  // Atomic delete. The FK cascades wipe all four data tables; Supabase
  // also revokes refresh tokens so the now-deleted user can't keep
  // reading via their old access token until it expires.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)
  if (deleteErr) {
    console.error('[delete-account] delete failed:', deleteErr.message)
    return Response.json(
      { error: 'delete_failed', message: deleteErr.message },
      { status: 500 }
    )
  }

  return Response.json({ ok: true })
}
