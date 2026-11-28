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
- Owner (2026-11-26): after every update, give BOTH download links from the latest `build-N` release —
  Android `SUMANOVA.apk` and iPhone `SUMANOVA-unsigned.ipa` (check the release lists both assets).
- iPhone at ₹0: Safari "Add to Home Screen" web app, or sideload unsigned IPA (SideStore, 7-day). App Store needs
  $99/yr — not approved.

## Stack & conventions
React 18 + TS + Vite 5 + Tailwind 3 + Framer Motion + Lucide + Zod, Supabase JS v2, vite-plugin-pwa (web only),
Capacitor plugins (status-bar, splash, haptics, share, filesystem, app). Path alias `@/` → `src/`.
- Design system **"Bento"** (owner-approved 2026-11-25, round 4; canvas https://claude.ai/artifact/YRvWos2boF7mhEDoAcfJqP —
  Option 3 Bento + Option 10 "ghost" layer, on Snapchat-familiar layouts): soft grey canvas `bg-noir` (#ECECEF), rounded white /
  black / colour tiles (`rounded-tile` = 26px), near-black ink, Inter (heavy, tight `font-display`), black accent by default
  (Settings → Theme colour: Ink/Pink/Blue/Green/Violet/Orange, solid), black floating bottom bar with a white rounded-square
  camera. Every list row / card gets a big faint copy of its avatar or icon behind it: `components/ui/Ghost` + `GHOST_HOST`.
  Profile: full-body avatar in the person's scene (`components/Scene`, `profiles.profile_scene`) → tap → /avatar/home → studio;
  picture = avatar face or selfie (/profile/photo; `avatar_face_url` keeps the face, `photo_mode`). Birthdays & zodiac
  (/birthdays, `friend_birthdays()` = day+month only, `privacy_settings.show_birthday`, `lib/zodiac.ts`), profile code
  (/profile/code, QR + BarcodeDetector scan), saved accounts (/accounts, `lib/savedAccounts.ts`, tokens only, never passwords),
  streak Restore pill in the chat list. Logo (owner asked for a Snapchat-level iconic mark, original): "Nova" — white four-point
  star mascot with bold black outline and a face, on a hot-pink #FF4F9A tile (`components/Logo.tsx`, `public/favicon.svg`,
  `assets/*` → Android res via `npx @capacitor/assets generate --android`). Auth/welcome pages: logo + SUMANOVA wordmark, no slogans.
  Avatar onboarding (/onboarding/avatar after sign-up/log-in, Skip remembered per account): "Make it from a selfie" (/avatar/selfie)
  or one of 11 pre-rendered starter characters (public/presets). Selfie → avatar runs fully on-device, ₹0: MediaPipe Face
  Landmarker bundled in public/mediapipe (wasm + face_landmarker.task, CDN only as fallback) → `selfie/analyze.ts` (skin/hair/
  eye/lip colour, hair length/volume, beard, face/eye/nose/mouth shape) → `selfie/generate.ts` (6 editable Looks) → studio
  (?from=selfie via sessionStorage). Live framing guide + live trait chips; upload-a-photo and pick-a-character fallbacks. Earlier design (superseded): Design system **"Pearl"** (owner-approved from 5 wireframe options; canvas
  https://claude.ai/artifact/QeBwqyGdk5sy2xz7PHFneG). Light theme: milky glass over blue/pink/mint pearl sheen, navy
  ink, indigo accent, Instrument Serif display + Manrope. Token names are legacy: `noir.*` = light surfaces,
  `ink.*` = navy text, `ember.*` = accents (`ember-flame` indigo, `ember-cream` = navy active capsule with `text-noir`),
  `bg-ember-gradient` = indigo→violet (white text). Media screens (camera, editor, story/snap viewers, call, Spotlight
  player) keep white-on-dark overlays; everything else uses `ink/…` overlays, never `white/…`.
  UI v2 (owner-approved 2026-11-25, wireframes https://claude.ai/artifact/YRvWos2boF7mhEDoAcfJqP, plan docs/UI_V2_PLAN.md;
  owner wants screens to match the wireframes EXACTLY — colours, fields, layout): camera-first home `/`, five-tab
  `BottomDock` (Map · Chat · Camera · Stories · Spotlight; dark on camera/Spotlight), `TopBar`/`MeButton` = my avatar FACE
  top-left opens /profile. Everyone's picture is their rendered 3D avatar: studio save publishes face → `profiles.avatar_url`
  and full body → `profiles.avatar_body_url`. Spotlight opens straight into the player (Following / For you).
  Signed-out landing `/auth/welcome` (pre-rendered starter figures in public/welcome). No widget dashboard, no drawer.
  Accent colour is user-selectable (Settings → Theme colour, `lib/accent.ts`): `ember-flame`/`ember-amber`/`bg-ember-gradient`
  read CSS vars `--accent`/`--accent-from`/`--accent-to` (RGB channels). Never hard-code #3D4FE0 in new UI. Familiar camera-first alignment is owner-approved, but never copy Snapchat artwork, logos, names or yellow.
- Avatar v2 (owner wants Snapchat-level depth, ~100 variants per category, all original & free, no brands):
  `features/avatar/look/` = data (`config.ts` Look v2 + v1 migration, `face.ts`/`hair.ts`/`fashion.ts`/`extras.ts`
  100-variant catalogues as families × params, `palettes.ts`, `tube.ts` tapered-strand builder);
  `render/` = `Figure` (body/poses), `Face` (eyes/lids/lashes/brows/nose/lips/ears/beard/makeup), `Hair` (scalp cap +
  hundreds of tapered locks, ombré tips), `Clothes` (lathed garments, `patterns.ts` canvas fabrics), `Accessories`
  (glasses/hats/head add-ons), `Jewelry` (piercings). Editor `AvatarStudio.tsx` (Style / Face & body / Saved tabs,
  lazy variant thumbnails via one hidden GL canvas in `editor/thumbs.tsx`, persisted in Cache Storage `snv-thumbs-vN`
  (bump the version when the renderer's look changes), colour rail, undo/redo).
  Cartoon-real style (owner refs: friendly 3D cartoon people, but original): adult proportions (`LEG`, `HEAD_SCALE`,
  `SHOE` in `Figure.tsx`), sculpted hair (smooth cap + few broad clumps, `sculpt` in `Hair.tsx`), soft three-point light.
  12 original starter characters in `look/presets.ts` (Looks tab → "Start from a character"); random = wearable outfits.
  Visual check: `npx vite --config vite.avatar-test.config.ts` (`?presets=1&n=8`) (port 5199, `?slot=hair&ids=1,2&frame=head`, `?random=8`).
  Keep ≤8 canvases per harness page (swiftshader). Python/sed multi-file edits get blocked by the sandbox classifier — use Edit.
  **Sculpted avatars (owner, 2026-11-25: "no assembled-primitive characters")** — `features/avatar/sculpt3d/`:
  `sdf.ts` (signed-distance volumes: round cones, ellipsoids, boxes, tori, `loft` profiles, `fn`; smooth "clay" unions,
  per-part `kAt` blend, clips, subtract, displacement; rotations = three.js Euler XYZ), `mesh.ts` (narrow-band surface nets
  + projection, skin weights that respect part ownership, UV/colour callbacks), `anatomy.ts` (36-bone skeleton, lofted
  trunk, arms/legs/feet, 5-finger hands), `rig.ts` (Skeleton, gestures open/fist/point/peace/thumbsup/wave/pocket),
  `garments.ts` (tops/jackets/bottoms/dresses/socks/shoes as the body puffed out by ease, cut at hems; trims with tones;
  tops drape over the widest trousers), `hair.ts` (cap + flattened lock lobes / helical curls / plaits / buns / tails as
  one mesh; vertex colour = (shade, root→tip), mixed in `render/SculptHair` shader). Built off the UI thread
  (`async.ts` + `worker.ts`, `useSculpt`), cached in memory + Cache Storage `snv-sculpt-vN` (bump `SCULPT_VERSION` in
  `jobs.ts` when any builder output changes). `render/Figure.tsx` = SculptBody (skinned body+hands, head via portal on
  the head bone) + SculptClothes + SculptHair; `render/lookParts.ts` `prepareLook()` must be awaited before stills
  (thumbnails, captures). Poses incl. pointing/peace/crossed/pockets. Starter pictures: `e2e/preset-images.e2e.cjs`.
  Harness views: `&turns=0,1.57`, `&cam=x,y,z,tx,ty,tz`, `&poses=a,b`. Head: `sculpt3d/head.ts` sculpts skull + nose (bridge,
  tip, alae, carved nostrils) + ears (shell, rim, bowl, lobe) as one mesh (job `head`); eyes/brows/mouth/expressions are still
  the `render/Face.tsx` rig (head.ts adds only faint cheek/chin fullness — strong landmarks clash with the floating
  cartoon features; smooth-union `k` bulges ≈ k/4, so keep landmark prims inset). Base body v2 (2026-11-26): every body
  comes masculine (ids x1–x5) or feminine (x6–x10) via `BodyP.fem`; trunk = `loft2` (separate front/back depth: chest,
  upper back, lumbar, seat), pecs / soft chest, shoulder blades, collarbones, neck muscles, biceps/triceps, elbow,
  flattened wrist, quads/hamstrings, kneecap, two-headed calf. Muscle detail fades under clothing (`inf`). Hands = 3
  phalanges + pads + knuckles + nails (job `hands` → main + trim nails, glossy `SkinMat nail`); bare feet = own fine
  mesh with 5 toes, ankle bones (job `feet`, only when no socks/shoes). Hand/foot meshes join the body through a
  "sleeve" that follows the limb's own taper a hair outside it (a flaring sleeve shows a light seam). Wide hips push
  hanging arms out (`hipArmClearance`). Bare review: harness `&bare=1` (`&hair=1` keeps hair), `&frame=head|feet`.
  HAIR (2026-11-26, owner refs = Snapchat avatar hair grids): `look/hair.ts` = 110 named groom recipes in 6 categories
  (cat, region lengths, vol, tex straight/wavy/curly/coily/textured, flow, part, fringe, fade, tie, braid, loc, afro, paint)
  + `HairTune` per avatar (`look.hair`: length, volume, tex, part, fringe, paint, gloss; `hairControls()` decides which
  apply; `tuneHair()`), colour keys hair / hairTip / hairHi. `sculpt3d/groom.ts` GROWS hair: roots inside an anatomical
  hairline (table in `lineAt`), comb field, lift layering, gravity, face (rotate to ±0.82 rad) / neck / shoulder avoidance,
  textures, then STYLISED SCULPTED LOCKS (few, broad, thick ribbons, full at the root, pointed tips — the Bitmoji-like look;
  hundreds of thin strands read stringy/scaly), scalp cap under them, stubble fades (density gradient), ties/buns/plaits
  (3-strand), cornrows, locs/twists, afros (wobble volume + coils). `render/SculptHair.tsx` material: paint modes,
  groove shading by uv.x faded in toward tips, 2-lobe Kajiya-Kay along `hairT`, spring sway (uSway). Editor:
  `editor/HairControls.tsx` (controls, favourites in localStorage, search). Legacy `Hair.tsx` / `sculpt3d/hair.ts` deleted.
  `sculpt3d/watertight.test.ts` guards against see-through holes (mesher `lipschitz` margin). Old primitive `Hair.tsx` / garment parts of `Clothes.tsx` are no longer used by Figure.
  Wardrobe uniqueness (owner, 2026-11-25: "no duplicates"): in `look/fashion.ts` every cut's 10 items have different, bold
  patterns and rotating trim colours (the colour rail only replaces c1, so plain-colour-only variants collapse into copies).
  Duplicate checker: harness `?dupes=<slot>&frame=<thumb frame>&color=6f7680` renders every item like the studio grid and
  greedily lists look-alikes at full thumbnail resolution; results go into `look/hidden.ts` (hidden from grids/random, ids
  stay valid for saved avatars). `?thumbs=<slot>&frame=..&ids=1,2` shows real thumbnails. Re-run after renderer changes and
  bump `snv-thumbs-vN`. Materials whose `map` can toggle must be keyed (`Cloth`), or three.js drops the pattern (plain white).
  Restart the harness vite server if a change doesn't show (its watcher sometimes serves a stale module).
- **Nova emoji** (owner: "don't just use prebuilt emojis"): our own SVG emoji set in `components/emoji/novaEmoji.ts`
  (squircle faces, bold #111 outline; `NovaEmoji` component, `novaEmojiImage` for canvas). Used for badges (`badgeArt`),
  streak flame/hourglass, lens tray icons, chat + editor stickers (stored as `nova:<id>`). Face lenses in
  `features/camera/lenses.ts` draw with it; visual check: `npx vite --config vite.lens-test.config.ts` then
  `?photo=/portrait.jpg` (put any frontal photo in e2e/lens-harness, git-ignored). New UI: prefer Nova emoji over system emoji.
- Features live in `src/features/<feature>`. Shared libs in `src/lib`. Auth state in `src/providers/AuthProvider.tsx`.
- Sign-up is **instant** (owner chose, 2026-11-24): Edge Function `signup` (verify_jwt=false) re-validates input, caps 30
  sign-ups/hour, and creates a confirmed user via the service role; the client then signs in with the password. The free
  built-in mailer only reaches team emails, so password reset uses 6-digit email OTP (`verifyOtp` type `recovery`) and
  only works for everyone once custom SMTP is set (owner step, optional). Owner declined adding api.supabase.com to the
  session network; don't re-propose it.
- DB: migrations in `supabase/migrations/` (timestamped). Apply via Supabase MCP `apply_migration` with the same SQL.
  RLS on every table; verify with rolled-back SQL tests in `supabase/tests/`. Statements that delete from `auth.users`
  trigger an approval prompt the owner often misses — keep such statements in separate small migrations.
- Tests: Vitest + Testing Library (`npm test`), `npm run typecheck`, `npm run build`. CI must stay green.
- Commit as `PrajwalS380 <181549311+PrajwalS380@users.noreply.github.com>`; no model names in commits.

## Feature checklist build (owner said "approve all", 2026-11-25; then "finish all batches end to end without asking")
All 7 batches done (2026-11-25): batch 1 (contacts/phone/PYMK/badges), Nova emoji + lenses, batch 2 (polls, live
location, scheduled msgs, avatar stickers, screenshot alerts), batch 3 (group calls, mesh ≤6), batch 4 camera (lens
browser, MediaPipe segmenters, night/flash, video speed/reverse/voice FX, synthesized music, templates), batch 5 (group/
private stories, @mentions, Places via Overpass, heat map, travel/battery, vault memories, search, hashtags, remix),
batch 6 (score, trophies, TOTP 2FA + `mfa_ok()` RLS gate, login alerts, data download, birthdays), batch 7 B1–B13
(hangouts, chat games, secret e2e chats `lib/e2e.ts`, avatar reactions, cutout stickers, offline chat cache, dictation,
reels + shared albums, Avatar Cam, map mood + safety check-in, canvas themes `--canvas` + Android app icons via
activity-aliases + `AppIconPlugin`). Only open item: closed-app Android push (owner Firebase) — see
`docs/PENDING_OWNER_ACTIONS.md`.

## 33-feature build (owner: "Implement all", 2026-11-27) — batches A–F done
- A privacy/look: `lib/display.ts` (Light/Dark/Phone via `html.dark` + CSS vars `--ink*`/`--surface*`/`--cream`; index.css
  remaps `.bg-white`/`.bg-ink`/`#111111`/`#F1F1F4` in dark; inline head script in index.html avoids a flash), text size
  (root font-size), data saver (`saveData()`), app lock `lib/appLock.ts` + `components/AppLockGate.tsx` (PBKDF2 PIN,
  Android `BiometricPlugin.java` / web passkey), hidden chats `lib/hiddenChats.ts`, block screenshots
  (`screenProtection.setAlways`, FLAG_SECURE refcount), new-device approval (`device_ok()` restrictive RLS on
  messages/memories/snap_recipients/location_shares, `components/DeviceGate.tsx`, approve in Settings → Security).
- B chat: voice 1/1.5/2×, seek, listen-before-send; pins (`message_pins`, soft unpin), reminders (`message_reminders` +
  cron `sumanova-message-reminders`), to-do kind `todo` (`todo_items`), Edge Function `link-preview` (public IPs only,
  cache `link_previews`), on-device translation (browser Translator API only; hidden elsewhere — no free server
  translator connected, owner approval needed for one), per-chat wallpapers on the phone (Cache Storage).
- C camera: collage (`camera/collage.ts`), dual camera (sequential), "My photo behind me" + Touch-up lenses, 4×/8×
  time-lapse and ¼× slow-mo, text-to-sticker (`chat/more/textSticker.tsx`).
- D social: question of the day (`daily_answers`, list in `lib/social/fun.ts`), quizzes (`quizzes` + unreadable
  `quiz_keys`), chat puzzles kind `puzzle` (only via `start_puzzle`; `puzzle_secrets` unreadable), countdown sticker
  (`media_meta.countdown`), `/recap` (`my_year_recap`), anniversaries cron `sumanova-friend-anniversaries`.
- E map: `MyMap.tsx` (trip mode `trips`/`trip_points`, favourite places, memories with `media_meta.place`).
- F: offline runtime caching (public media + OSM tiles), idle-deferred startup work + tab prefetch, settings
  backup/restore (`lib/backup.ts`, never secrets), languages en/hi/kn/ta/te: `lib/i18n.ts` (`t()`/`useT()` for nav) +
  `lib/i18nDom.ts` whole-screen translator (MutationObserver swaps exact English UI strings, placeholders, aria-labels,
  titles; `{n}` number patterns) from `src/i18n/<lang>.json`, built by `node tools/i18n/build.cjs` from `tools/i18n/*.tsv`
  (English, hi, kn, ta, te). Mark user content (messages, names, captions, answers) `translate="no"`. New UI text →
  add a TSV line and rebuild. Name-like single words (Leo, Sky…) are deliberately left English.
- plpgsql gotcha: wrap `case … then … end` in parentheses inside `if … then`; avoid the `?` jsonb operator in MCP
  migrations; never count the same table inside its own RLS policy (use a trigger).

## User stories (owner, 2026-11-28)
From build-106 on, work follows the avatar user stories in `docs/user-stories/sumanova-us-NNN.txt` (one file per story,
index in README.txt), in order. Put the story id (`sumanova-us-NNN`) in the commit message: the release workflow names
each download after the newest story id in non-docs commits ("SUMANOVA us-NNN · build-N"). Docs-only pushes don't build.
Use `[skip ci]` for in-progress pushes — but the final story commit must change at least one non-docs file (an
empty commit changes no paths, so `paths-ignore` skips the build; then run the workflow by hand). Hair edges/parting (us-107): `HairP.edges`, `HairTune.line/edges`; hairline
regions are found in head space with `skullDir`/`skullDistDir` (x/|p| is centimetres off on the forehead).
Harness: `&htune=<json>` / `&htunes=<json>|<json>` / `&skin=<hex>` / `&hc=<hex>`.
Hair motion (us-108): groom writes per-vertex `hairPivot` (swing point) + `hairGrp` (0 fringe, 1/2 sides, 3 back,
4 top, 5/6 tails, 7 plaits, −1 still) via `Groomer.mo` / `withMotion()`; `render/hairMotion.ts` = fixed-step
pendulum solver (50 ms latency buffer → same at any fps), shader rotates each lock about its pivot + neck/shoulder
push-out. `withHairAtRest()` for captures; reduce-motion → `uMotion` 0. Contact sheets: `node e2e/hair-motion.e2e.cjs
<out> dancing|shake=yaw <ids> [turn]` (frames in `<out>.frames/`). Harness `&shake=yaw`, `window.__hairMotion()`.
Hair types (us-109): 140 styles (110–139 appended; never reorder 0–109, `look/hairNames.v1.json` guards them). Curl
pattern scale `HairP.pattern` / `HairTune.pattern` (1, 2A–4C) via `PATTERN_SPEC` (shrink, volume, clump, wave / spiral /
zig-zag in `Groomer.texture`); no pattern = the old code path, byte-identical (hash test in `hairTypes.test.ts`). New
recipe flags: sleek, bevel, looped, knotless, goddess, puff, deco (paranda / gajra / ribbon / beads → `GroomOut.deco/
decoW/decoC`, colour key `hairDeco`), tags (indian / textured / braids / short / long → studio filter chips). New ties
topknot / bantu / pineapple / bubble / halfspace, braids sideplait / flattwist / fulani, locs micro.

## Sandbox limits (this cloud environment)
Outbound network to supabase.co / vercel.app is blocked from the shell; use Supabase MCP (`execute_sql`) and Vercel
MCP (`web_fetch_vercel_url`) to verify. No Android SDK locally — Android builds run on GitHub Actions.

## Status (all phases built)
- Built & pushed: foundation, chat, calls, snaps/editor/filters, avatar studio, stories/streaks/friendship, memories,
  Spotlight, map, AR lenses (MediaPipe), notifications + web push (Edge Function `push`, VAPID in Vault), hardening.
- All migrations applied (incl. `20261113000300_account_deletion.sql`, `20261113000500_social_and_chat_removals.sql`, 2026-11-24).
  Never put DELETE statements in new migrations; use soft-delete columns. Avoid UPDATE without WHERE in test SQL.
- Edge Function `push` (verify_jwt=false by design; validates by id + freshness with service role).
- Cron jobs: `sumanova-housekeeping` (*/10), `sumanova-streak-reminders` (16:00 UTC).
- Owner handbook with every manual step: `docs/OWNER_HANDBOOK.txt`.
- Owner to-dos (all optional for testing): Gmail SMTP + templates (password reset for everyone), Site URL, GitHub signing secrets,
  optional Firebase for closed-app Android push, optional TURN for strict networks.
