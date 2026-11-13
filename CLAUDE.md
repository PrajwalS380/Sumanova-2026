# SUMANOVA — project memory

Read this first in every session. Keep it updated when decisions change.

## What this is
SUMANOVA: a real-time social app (chat, calls, snaps, stories, 3D avatar studio, streaks, memories,
Spotlight, social map, notifications). Original requirement doc: "MASTER BUILD PROMPT — PROJECT SNAPVERSE"
(28 sections, phases 0–10). Owner's goal: a complete, beautiful, smooth app they and invited friends use on
Android (APK) and iPhone.

## Non-negotiable rules from the owner
- **₹0 budget.** Free tiers / open source only. Never add a paid service, card requirement or billing without asking.
  Track every service in `docs/ZERO_COST_REGISTER.md`.
- **Original UI — never copy Snapchat** (no logos, layouts, Bitmoji assets). Must look *better* than Snapchat.
- **Smooth, never laggy**: transform/opacity animations only, no live blur on large areas, code-split routes,
  release camera/mic when backgrounded, paginate everything, respect reduce-motion.
- No fake data, no non-functional buttons, no claiming something works until tested.
- Never expose secrets; never put the Supabase service-role key in frontend; never commit signing keys.
- Ask before connecting new services. Commit logical milestones.

## Infrastructure (IDs are not secrets)
- GitHub: `PrajwalS380/Sumanova-2026` (public). Owner login `PrajwalS380`.
- Branches: `main`, `develop`, `release/1.0.0`, `SUM-202601`. **Work on `SUM-202601`**; later PR `SUM-202601 → develop`.
  Do not create PRs unless asked.
- Supabase project `sumanova`, ref `wssfbcscijpwfohhkerz`, region `ap-south-1` (Mumbai), free plan, org `wfpbjkxzutkdqtzeprsw`.
  URL `https://wssfbcscijpwfohhkerz.supabase.co`, publishable key in `.env.example`/workflow (public by design).
- Vercel: team `team_Ek6eQ7uK5m4FsWWMw9NRpZO7`, project `sumanova` (`prj_KJCcMMkZrHPOYLtGdE31p93qwJ5r`),
  production URL **https://sumanova.vercel.app**. Vercel production branch is `main`; deploy SUM-202601 to production
  manually via the Vercel MCP `create_deployment` (target production, gitSource ref SUM-202601) after each milestone.
- Mobile: Capacitor 8, appId `com.sumanova.app`. `.github/workflows/apps.yml` builds web + signed APK + unsigned IPA on
  push and publishes a GitHub pre-release `build-N`. Signing via repo secrets `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (=sumanova), `ANDROID_KEY_PASSWORD` (owner adds them; key file was
  delivered privately, never commit it).
- iPhone at ₹0: Safari "Add to Home Screen" web app, or sideload unsigned IPA (SideStore, 7-day). App Store needs
  $99/yr — not approved.

## Stack & conventions
React 18 + TS + Vite 5 + Tailwind 3 + Framer Motion + Lucide + Zod, Supabase JS v2, vite-plugin-pwa (web only),
Capacitor plugins (status-bar, splash, haptics, share, filesystem, app). Path alias `@/` → `src/`.
- Design system "Aurora Glass": tokens in `tailwind.config.ts` (night, aurora.*, ink.*), `.glass`, `.glass-strong`,
  fonts Unbounded (display) + Plus Jakarta Sans. Components in `src/components/ui`. Floating `NovaDock`, camera home.
- Features live in `src/features/<feature>`. Shared libs in `src/lib`. Auth state in `src/providers/AuthProvider.tsx`.
- Auth uses **6-digit email OTP** (`verifyOtp` types `signup`/`recovery`) so it works in APK/iOS/web without deep links.
- DB: migrations in `supabase/migrations/` (timestamped). Apply via Supabase MCP `apply_migration` with the same SQL.
  RLS on every table; verify with rolled-back SQL tests in `supabase/tests/`. Statements that delete from `auth.users`
  trigger an approval prompt the owner often misses — keep such statements in separate small migrations.
- Tests: Vitest + Testing Library (`npm test`), `npm run typecheck`, `npm run build`. CI must stay green.
- Commit as `PrajwalS380 <181549311+PrajwalS380@users.noreply.github.com>`; no model names in commits.

## Sandbox limits (this cloud environment)
Outbound network to supabase.co / vercel.app is blocked from the shell; use Supabase MCP (`execute_sql`) and Vercel
MCP (`web_fetch_vercel_url`) to verify. No Android SDK locally — Android builds run on GitHub Actions.

## Status (all phases built)
- Built & pushed: foundation, chat, calls, snaps/editor/filters, avatar studio, stories/streaks/friendship, memories,
  Spotlight, map, AR lenses (MediaPipe), notifications + web push (Edge Function `push`, VAPID in Vault), hardening.
- Migrations 0100–1500 applied EXCEPT pending owner approval: `20261113000300_account_deletion.sql`,
  `20261113000500_social_and_chat_removals.sql` (contain DELETE → approval card times out; owner can paste them in the SQL editor).
  Never put DELETE statements in new migrations; use soft-delete columns. Avoid UPDATE without WHERE in test SQL.
- Edge Function `push` (verify_jwt=false by design; validates by id + freshness with service role).
- Cron jobs: `sumanova-housekeeping` (*/10), `sumanova-streak-reminders` (16:00 UTC).
- Owner handbook with every manual step: `docs/OWNER_HANDBOOK.txt`.
- Owner to-dos: Supabase Site URL/redirects, Gmail SMTP + templates, GitHub signing secrets, apply 2 pending SQL files,
  optional Firebase for closed-app Android push, optional TURN for strict networks.
