# SUMANOVA

A real-time social app — camera-first, aurora-themed, installable on Android as a PWA, and built entirely on free tiers.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Lucide · Supabase (Postgres, Auth, Realtime, Storage) · Capacitor 8 (Android & iOS) · vite-plugin-pwa · Vitest

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0–1 | Inspection, foundation, design system, auth (email codes), profiles, settings, PWA, Android/iOS shells, CI | ✅ |
| 2 | Friends, real-time 1:1 + group chat, receipts, typing, presence, media, voice notes, disappearing messages | ✅ (block/remove/delete-message functions pending approval) |
| 3 | 1:1 voice & video calls (WebRTC), call history | ✅ (group calls: not enabled, see docs/CALLS.md) |
| 4 | Snaps, camera filters, editor, one-time viewing, screenshot protection (Android) | ✅ |
| 5 | 3D avatar studio, outfits, expressions, poses, duo stickers | ✅ |
| 6–7 | Stories, highlights, streaks, friendship profiles, Memories, Spotlight | ✅ |
| 8–9 | Social map, AR face lenses, notifications + web push, hardening | ✅ |
| 10 | Live validation on real devices | owner testing |

## Design — "Ember Noir"

Original visual language (no third-party brand assets): warm near-black base lit by slow amber/rose "ember light",
fine film grain, matte card-stock surfaces with cream hairlines, an editorial serif (Fraunces, italic accents) over
Manrope text, a floating dock whose active tab opens into a cream capsule around a glowing ember camera orb, and
stories shown as tilted cream "prints". The avatar is an original sculpted 3D character (smooth deformed head,
blinking eyes with lids and lashes, shaped hair and lathed clothing), built entirely in code. Performance rules: transform/opacity-only animation,
pre-blurred gradients instead of live blur on large areas, code-split routes, camera released when the app is backgrounded,
`prefers-reduced-motion` + in-app "Reduce motion" respected.

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev
npm test                     # unit tests
npm run build                # typecheck + production build (PWA)
```

Database migrations live in `supabase/migrations/` and are applied in filename order.
`supabase/tests/phase1_rls.sql` verifies RLS and the sign-up trigger (rolls back, leaves no data).

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Production releases |
| `develop` | Integration branch; feature branches merge here through PRs |
| `release/1.0.0` | Stabilisation for the 1.0.0 release |
| `SUM-202601` | Current feature work (merges into `develop`) |

## Get the app

- **Android:** download `SUMANOVA.apk` from the latest [release](../../releases) — see [docs/MOBILE.md](docs/MOBILE.md).
- **iPhone:** open https://sumanova.vercel.app in Safari → Share → Add to Home Screen (native options in docs/MOBILE.md).
- **Web:** https://sumanova.vercel.app

## Docs

- [Zero-cost dependency register](docs/ZERO_COST_REGISTER.md)
- [Security checklist](docs/SECURITY.md)
- [Android & iPhone apps](docs/MOBILE.md)
- [Email setup](docs/EMAIL.md)
- [Calls](docs/CALLS.md)
- [Avatars](docs/AVATARS.md)
- [Owner handbook](docs/OWNER_HANDBOOK.txt)
