// Auth.js v5 catch-all route. Just re-exports the handlers from the central
// auth config — every /api/auth/* request (sign-in, sign-out, callback,
// session) is dispatched here.

import { handlers } from '@/auth'

export const { GET, POST } = handlers
