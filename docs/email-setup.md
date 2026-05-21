# Email setup — `hello@tryruhi.ai`

The privacy page (PR #32) and the in-app sign-in CTA both surface
`hello@tryruhi.ai` as the contact address. We don't run a mail server —
we forward incoming email to a personal Gmail. Total setup time: ~5 min.

The cheapest, easiest path is **Cloudflare Email Routing** (free, no
limits for small volume). If your DNS is hosted elsewhere, ImprovMX is
the equivalent free option for any registrar — steps are similar.

---

## Option A — Cloudflare Email Routing (recommended)

### Prerequisites

You need `tryruhi.ai`'s nameservers pointing at Cloudflare. Check:

```
dig +short NS tryruhi.ai
```

If the answer includes `*.cloudflare.com` lines, you're set. If not, you'll
need to either move DNS to Cloudflare (free) or use Option B below.

### Steps

1. Cloudflare dashboard → pick the `tryruhi.ai` zone → **Email** →
   **Email Routing**.
2. **Enable Email Routing**. Cloudflare adds three DNS records (MX × 2
   + TXT) automatically. Accept.
3. **Destination addresses** → **Add destination address** → enter your
   personal Gmail. Cloudflare emails it a verification link; click the
   link to confirm.
4. **Routes** → **Create address** →
   - Custom address: `hello`
   - Domain: `tryruhi.ai`
   - Action: **Send to an email** → pick the Gmail you verified
5. Save.

That's it. Send a test email from your phone to `hello@tryruhi.ai` — it
should land in your Gmail inbox within ~1 minute.

### Optional: also add `feedback@tryruhi.ai`

The existing footer link uses `feedback@tryruhi.ai`. If that's not
already wired up, repeat step 4 with `feedback` as the custom address
pointing at the same Gmail.

---

## Option B — ImprovMX (any DNS provider)

Use this if your DNS isn't on Cloudflare and you don't want to move it.

1. Sign up at <https://improvmx.com> (free tier covers our use).
2. Add the domain `tryruhi.ai`.
3. ImprovMX shows you two MX records to add. Go to your DNS provider's
   dashboard (Namecheap, GoDaddy, Vercel DNS, etc.) and add them:
   ```
   tryruhi.ai.  MX  10  mx1.improvmx.com.
   tryruhi.ai.  MX  20  mx2.improvmx.com.
   ```
4. Add the recommended SPF TXT record ImprovMX shows you (improves
   inbox delivery).
5. Back on ImprovMX → add an alias: `hello@tryruhi.ai` → your Gmail.
6. Save.

Test the same way — send to `hello@tryruhi.ai` from your phone.

---

## Replying as `hello@tryruhi.ai` (optional, recommended)

Forwarding only handles inbound mail. If you reply from Gmail, the
recipient sees your personal `@gmail.com` address — not super
professional for a privacy contact.

To send AS `hello@tryruhi.ai` from Gmail:

1. Gmail → Settings (gear) → **See all settings** → **Accounts and
   Import** → **Send mail as** → **Add another email address**.
2. Name: `Dhanya · Ruhi` · Email: `hello@tryruhi.ai` · uncheck "Treat
   as alias" → Next.
3. Gmail asks for an SMTP server. Two options:
   - **Cloudflare doesn't provide outbound SMTP** for the free tier.
     For Option A users, route outbound through Gmail's SMTP using
     [Gmail SMTP relay](https://support.google.com/a/answer/2956491)
     — but this typically needs a Workspace account. The free
     workaround for cohort-scale: just reply from `@gmail.com` and
     mention the forward in your sig.
   - **ImprovMX** provides SMTP credentials on a paid plan ($9/mo).
4. Verification: Gmail sends a code to `hello@tryruhi.ai` → check your
   Gmail inbox (the forward route delivers it) → enter the code.

For now, replying from your `@gmail.com` is fine — most users won't
notice, and you can upgrade later if it bothers you.

---

## Verifying it works

Send a test email to `hello@tryruhi.ai`. Within ~1 minute it should
appear in the destination Gmail. If it doesn't:

- Cloudflare → **Email Routing** → **Activity** tab shows recent
  deliveries and any errors.
- ImprovMX → Dashboard shows recent forwards.
- Make sure the destination address was verified (Cloudflare) or
  confirmed by clicking the welcome email (ImprovMX).

If a sender gets an SPF/DKIM bounce, recheck the TXT records.
