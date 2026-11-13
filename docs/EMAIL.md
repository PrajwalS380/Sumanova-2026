# Reliable sign-up & password-reset email (₹0)

The app sends a **6-digit code** by email for sign-up and password reset. Codes work identically in the
Android app, iPhone app and website (no links that open the wrong app).

## Why not Supabase's built-in email?
It's for testing only: a handful of emails per hour, and messages often land in spam.

## Why not a self-hosted open-source mail server?
Running one (Postal, Mailu, docker-mailserver…) needs an always-on server with port 25 open, your own
domain, and months of IP reputation. A fresh free server's mail goes straight to spam, and most free VMs
block port 25. It would be slower and less reliable than the options below.

## Recommended: a dedicated Gmail account over SMTP (free, fast, lands in inbox)
- ~500 emails/day, delivered in seconds, real Gmail reputation.
- Create a new Gmail just for the app (e.g. `sumanova.app@gmail.com`) so your personal address isn't the sender.

1. Sign in to the new Gmail → **myaccount.google.com/security** → turn on **2-Step Verification**.
2. Open **myaccount.google.com/apppasswords** → create an app password named `Supabase` → copy the 16 letters.
3. Supabase Dashboard → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**:
   - Sender email: the new Gmail address · Sender name: `SUMANOVA`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: the new Gmail address · Password: the 16-letter app password
4. **Authentication → Rate Limits** → "Rate limit for sending emails" → e.g. `100` per hour.

Alternative with no Gmail: **Brevo** free plan (300 emails/day, no card) → SMTP host `smtp-relay.brevo.com`,
port `587`, login + SMTP key from Brevo's "SMTP & API" page. A verified sender address is required.

## Email templates (show the code)
Supabase Dashboard → **Authentication → Emails → Templates**:
- **Confirm signup** → subject `Your SUMANOVA code: {{ .Token }}`, body = `supabase/templates/confirm-signup.html`
- **Reset Password** → subject `Your SUMANOVA reset code: {{ .Token }}`, body = `supabase/templates/reset-password.html`

Also check **Authentication → Sign In / Providers → Email**: *Confirm email* ON, *Email OTP length* = **6**.
