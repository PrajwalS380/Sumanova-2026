# UI v2 — implementation plan (owner-approved 2026-11-25 IST)

Approved wireframes: https://claude.ai/artifact/YRvWos2boF7mhEDoAcfJqP (17 screens + Face/Figure/Dock parts).
Layout follows familiar camera-first social-app alignment, but the look stays SUMANOVA's own (Pearl: light
surfaces, navy ink, indigo accent `ember-flame`, Manrope + Instrument Serif, own icons, no yellow, no copied art).
This supersedes the earlier "no tab bar / widget dashboard / drawer" decision.

Tick each box when done (commit after each phase; keep CI green; deploy to Vercel after each phase).

## Phase 1 — Navigation shell
- [x] `components/BottomDock.tsx`: 5 tabs Map `/map` · Chat `/chat` · Camera `/` · Stories `/stories` · Spotlight `/spotlight`.
      Active tab = indigo icon in a pale pill + label; dark translucent variant on camera/spotlight.
- [x] `/` = camera (CameraScreen) inside the shell with the dock; widget HomeScreen + Drawer + MenuButton removed
      (old routes such as /home redirect to /). Memories reachable from the camera (grid button left of shutter).
- [x] (TopBar component done and used on Chat; adopt it on Stories/Map/Spotlight in phase 3. MeButton face replaces the old menu button in ScreenHeader, Camera, Map, Spotlight) `components/TopBar.tsx`: left = my avatar FACE button (→ /profile) + search circle; centred title;
      right = add-friend (→ /friends/add or existing add screen) + one screen-specific action.
      Used on Chat, Stories, Map (floating, white buttons), Spotlight/Camera (dark translucent buttons).
- [x] Notifications reachable: bell on the camera top bar.
- [x] Update nav tests.

## Phase 2 — Avatar faces everywhere
- [x] Saving in the avatar studio ALWAYS publishes two PNGs: face/bust → `profiles.avatar_url`,
      full body → new `profiles.avatar_body_url` (migration, nullable text; RLS unchanged).
- [x] `components/Avatar.tsx`: shows the face image in a circle on a soft tint; optional indigo story ring
      (`ringed`); initials fallback. Drop the aura conic ring as default.
- [x] `components/AvatarFigure.tsx`: full-body image (avatar_body_url) with face fallback.
- [x] New users: after sign-up go straight to the studio ("design your avatar"), starter characters first.

## Phase 3 — Screens (match wireframes)
- [x] Chat list (camera reply button skipped until the camera can send straight to a chat): filter chips (All / Unread / Groups / Streaks); rows = face 52, name, status line with small
      square (filled indigo = new snap, teal = new chat, outlined = sent/opened, grey = received) + time + streak
      with flame; camera button on the right (quick snap reply).
- [x] Chat thread: header face + name + streak line, voice & video buttons; bubbles (mine indigo right, theirs
      grey left with small face); snap card "New snap · tap to view"; composer = camera button, field, mic, stickers.
- [x] Stories: "Friends" row of faces (indigo ring = unseen, "My story" with +), "For you" 2-column tall tiles.
- [x] Spotlight (no sound line: videos have no sound metadata): full-screen player, top bar (face, search, Following / For you, more), right action rail,
      creator row with Follow, caption, sound line, progress bar, dark dock.
- [x] Map (Places → "Find me"; place/weather chip → sharing status, since there's no free place/weather service): friends as full-body avatar pins with name · time tags; "You" centred; floating top bar with
      place chip; bottom card: My status · Friends · Places · Ghost mode.
- [x] My profile (exactly as wireframe 6; Notifications stays on the camera bell, Calls via friend profiles): pale hero with full-body avatar (tap → studio), serif name, @username · friends · best streak,
      Edit avatar / Edit profile, cards: My stories, Friends (faces), Memories, Notifications.
- [x] Friend profile: both full-body avatars side by side, streak pill, Chat / Snap / Call / Video, facts card, their story.
- [x] Add friends ("Quick add" shown as "My friends": no suggestion engine; no scan-code button): search, Share my code card, Added me (Accept / ignore), Quick add.
- [x] Notifications: Today / Earlier with face + coloured badge icon, unread dot.
- [ ] Snap editor: right tool rail, caption bar, bottom = Save, "Story" (my face), "Send to →".
- [ ] Send to: My story / Close friends / recents with tick circles; indigo bottom bar listing picks + send.
- [ ] Story viewer: segmented progress, header face + name + place, reply bar (camera, field, react).
- [ ] Memories: tabs Snaps / Stories / Camera roll / Private, "1 year ago today" card, month grids.
- [ ] Welcome: wordmark, tagline, three full-body avatars, Create account / Log in.
- [x] Settings (privacy choices stay as segmented controls so they can be changed in place): grouped cards (Account, Privacy, Look & feel with theme colour dots, Support/Log out).

## Phase 4 — Finish
- [ ] typecheck + vitest + build green; screenshots via scratch harness; commit; push (APK build); Vercel deploy.
- [ ] Update CLAUDE.md (navigation + avatar-face decisions) and docs/OWNER_HANDBOOK.txt.
