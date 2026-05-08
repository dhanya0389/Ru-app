# Ruhi roadmap

Source-controlled so it survives across devices and sessions.
Treat this as the canonical "what's next" list. Update via PR.

## In progress

### Phase 2 — backend migration (Supabase)

- ✅ **PR #28** — Auth.js → Supabase Auth swap. Sign-in works on localhost + production. Identity layer only; no data persistence yet.
- 📋 **PR #29** — This doc (roadmap.md). Just paperwork.
- 🔜 **PR #30** — Database schema + RLS + profile sync. The slice that actually delivers cross-device sync. Each RLS policy explained in plain English in the PR description. **Auto-import on first sign-in:** if user has localStorage data and no cloud row, silently upload local → cloud. No prompt, no friction.
- 🔜 **PR #31** — Sign-in discoverability UX (Option A + C from design pass):
  - **A — Conditional banner**: when user has saved local content (journal entry, plan, pantry) and isn't signed in, show a thin dismissible banner near top: *"Save your data across devices — Sign in with Google"*
  - **C — Footer link**: small *"Sign in to sync"* link in the existing site footer next to *"Got feedback?"*. Always visible, low friction.
- 🔜 **PR #32** — Migrate journal + weekly_plans + pantry surfaces to use `lib/storage.js` cloud abstraction (same pattern as profile in PR #30).
- 🔜 **PR #33** — Cleanup: remove unused env-var docs, drop the AUTH_* placeholders from `.env.example` if any survive.

## Locked design decisions for Phase 2 (do NOT re-litigate)

- **Hybrid model: Option A → A+B over time.** Anonymous users keep working via localStorage. Sign-in is optional and unlocks cross-device sync as the value-add. Future paid features will gate behind sign-in (A+B hybrid) but the free tier stays anonymous-friendly.
- **Auto-import on first sign-in.** No prompt asking *"sync your local data?"*. If user has local data and no cloud row when they sign in, silently upload. Avoids confusing-modal-on-first-sign-in.
- **Cloud is source of truth once signed in.** On sign-in with both local and cloud data, cloud wins. (Cloud will have been overwriting local on every save anyway, so they should be in sync.)
- **localStorage stays untouched on sign-out.** Anonymous use after sign-out continues seamlessly. Privacy trade-off accepted: shared devices may leak data — addressable later with an explicit "clear local data on sign-out" toggle if needed.

## Parked feature ideas (Phase 2/3, not yet scheduled)

These are good ideas captured during the May 7 design discussion. **Park, don't bundle into the in-flight migration PRs.**

### A. Pantry expiry dates + shelf-life hints

**Why it's valuable:** reduces food waste, real differentiator vs. typical pantry apps. Users see what's about to spoil; Ruhi can suggest meals that use those items first.

**Scope (substantial):**
- Schema: add `expires_at`, `storage_tip`, `shelf_life_days` columns to pantry items
- Vision-based parsing: extend `/api/parse-pantry-image` to OCR printed expiry dates from milk cartons, yogurt tubs, packaged proteins (Anthropic Vision can do this — already proven in pantry-image route)
- Knowledge base: typical shelf life for unprinted items (herbs ~5 days, leafy greens ~7, root veggies ~3 weeks, etc.) plus storage tips ("rinse, pat dry, roll in paper towel")
- UI: surface expiring-soon items in pantry view; sort/group by expiry; highlight in red within ~2 days
- Optional: notification reminders ("3 items expire this week — here are dishes that use them")

**Where to land it:** Phase 3, item already on roadmap as #9 ("Manual shelf-life / expiry tracking"). Vision-based capture upgrades that from manual to automatic.

**Estimated effort:** 2-3 days for full feature including knowledge base seed data.

### B. "I made this" / favorites / Ruhi suggesting favorites back

**Why it's valuable:** closes the loop. Right now Ruhi suggests dishes but never knows what users actually cooked or liked. Adding a "made it" tap (with optional notes) builds longitudinal preference data and makes Ruhi feel like a relationship, not just a generator.

**Scope:**
- Schema: `cooked_meals` table with dish reference, cooked_at timestamp, optional notes, optional rating, favorite flag
- UI on every meal card: small "I made this" button → opens lightweight modal (rating 1-5, notes, favorite toggle)
- "My favorites" view: list of saved dishes, filterable by phase
- Ruhi loop: when generating a weekly plan, if user has favorites that fit the phase + diet + pantry, surface them as "you loved this last time" pills in the menu
- Eventual extension: Sunday review uses cooked-meal history to suggest patterns ("you cooked salmon 4× this cycle — try a swap?")

**Where to land it:** Phase 2, items already on roadmap as #7 ("Auto-logging picked meals — history schema + aggregation") and #8 ("Sunday review — depends on #7"). The favorites angle is a slight extension.

**Dependencies:** Supabase migration must be done first (no point storing history in localStorage that disappears between devices).

**Estimated effort:** 1-2 days for the basic "made it + favorite" loop; another 2-3 days for the Sunday review.

### C. Native grocery-service API for shopping list (Target, Instacart, etc.)

**Why it's valuable:** the current "send to grocery" deep-link generates a search URL but the user still has to add items one-by-one in the grocery app. A native API would let users push the entire list to a cart in one click.

**Scope (per service):**
- OAuth flow with the grocery service (each service has its own approval process)
- Map Ruhi shopping list items to the service's product catalog (fuzzy matching, since "100g spinach" needs to become a specific Target SKU)
- Error handling: out-of-stock, unavailable, substitutions
- Fallback to deep-link when API is down

**Where to land it:** Phase 2, item #5 ("Real Instacart Connect API"). Pick ONE service first (Instacart probably, since it's the most widely used), prove the pattern, then add Target / Walmart / Kroger.

**Estimated effort:** 1 week per service for the first one (longer because building the abstraction); ~2-3 days each for subsequent services.

## Older notes that still apply

See `~/.claude/projects/-Users-benucova-dhanya-ruhi/memory/project-ruhi-cohort.md` for:
- Locked design decisions from cohort (diet, macro thresholds, USDA hide-on-fail, energy gating, etc.)
- Trust factor philosophy (Dhanya's "load-bearing concern")
- Phase 3+ items (DEXA, bloodwork, supplements, wearables — funded + clinical-advisor gated)
