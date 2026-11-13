# SUMANOVA

A real-time social app — camera-first, aurora-themed, installable on Android as a PWA, and built entirely on free tiers.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Lucide · Supabase (Postgres, Auth, Realtime, Storage) · Capacitor 8 (Android & iOS) · vite-plugin-pwa · Vitest

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Inspection, planning | ✅ |
| 1 | Foundation: design system, navigation, auth, profiles, settings, migrations, RLS, PWA | ✅ (account deletion pending migration approval) |
| 2 | Friends + real-time chat | next |
| 3 | Voice & video calls (WebRTC) | |
| 4 | Snaps: editor, delivery, expiry | |
| 5 | 3D avatar studio | |
| 6 | Stories, streaks, friendship profiles | |
| 7 | Memories, Spotlight | |
| 8 | Map, filters, AR | |
| 9 | Push notifications, hardening | |
| 10 | Deployment & live validation | |

## Design — "Aurora Glass"

Original visual language (no third-party brand assets): midnight base, slowly drifting violet/teal/coral aurora,
frosted-glass surfaces, a floating pill dock with a glowing central camera orb, spring-based motion,
Unbounded display type + Plus Jakarta Sans text. Performance rules: transform/opacity-only animation,
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
