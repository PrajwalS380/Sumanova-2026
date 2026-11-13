# Avatar studio

- **Original, procedural 3D** (Three.js + React Three Fiber + Drei). Every part is built from primitives in
  `src/features/avatar/AvatarFigure.tsx` — no downloaded or proprietary models.
- **Stored as structured data** (`public.avatars.config`, validated by `normalizeAvatar`), never only as an image.
- **Customisation:** face shape/width/height/jaw/cheeks/chin/forehead · skin tone + undertone · eye shape/size/colour,
  brows, lashes · nose shape/size/width · lip shape/size/colour, smile · 11 hairstyles + colours · facial hair ·
  height/build/posture · tops (T-shirt, shirt, hoodie, jacket, kurta, saree, blazer), bottoms (trousers, jeans, shorts,
  skirt, dhoti), shoes · glasses/sunglasses, cap/beanie, earrings, necklace, watch, bag, bindi.
- **Expressions:** neutral, happy, sad, angry, surprised, laughing, crying, winking, blushing, sleeping.
- **Poses (animated):** standing, sitting, dancing, waving, walking, thumbs up, celebrating.
- **Studio:** 360° drag rotation, live preview, randomiser, reset, outfit presets, up to 20 saved outfits, export PNG,
  "use as profile photo" (renders a bust shot to the public avatars bucket — so the avatar shows everywhere in chats).
- **Duo stickers:** your avatar + a friend's in 8 scenes, sent into your chat as an image.
- **Performance:** loaded only on the studio screens (code-split), low-poly geometry, DPR capped at 1.75.
- **2D fallback:** `Avatar2D.tsx` renders the same config as SVG when WebGL isn't available.
