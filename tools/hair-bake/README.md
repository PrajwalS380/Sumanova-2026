# Offline hair bake (free: Node + Blender)

Turns a hairstyle into a finished `.glb` asset that the app loads from `public/hair/<id>.glb`
(see `src/features/avatar/render/bakedHair.ts`; enabled per style via `BAKED_STYLES` in
`src/features/avatar/look/bakedHair.ts`).

1. `npx vite-node tools/hair-bake/export.ts` — lock guides + scalp layer for the reference head
   (`tools/hair-bake/guides/`, git-ignored).
2. `pip install bpy` (Blender as a Python module, free) then
   `python -I tools/hair-bake/bake.py tools/hair-bake/guides/<id>.json public/hair/<id>.glb`.
3. Optional: `npx gltfpack -i in.glb -o out.glb -cc -kv` (meshopt compression; the loader decodes it).

Status (2026-11-26): automatic bakes from our own guides fuse into a crumpled clay mass — not better
than the live groom — so `BAKED_STYLES` is empty. The pipeline is the route for hand-sculpted
assets (sculpt in Blender on top of an exported style, keep the `_HAIRT` and colour attributes).
