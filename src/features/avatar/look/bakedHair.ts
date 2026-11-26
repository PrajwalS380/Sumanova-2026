/**
 * Headline hairstyles that ship as finished, offline-sculpted assets (tools/hair-bake → public/hair/<id>.glb):
 * locks fused into one sculpt, strand grooves and occlusion baked into a normal map. Every other style
 * (and any baked style whose length / volume / texture / parting / fringe is adjusted) is grown live.
 */
// Empty for now: automatically baked assets (from our own guides) came out as a crumpled clay mass —
// no better than the live groom. The pipeline (tools/hair-bake) stays ready for hand-sculpted assets.
export const BAKED_STYLES: string[] = [];
/** Candidates once hand-finished assets exist. */
export const BAKE_CANDIDATES = [
  'Classic short', 'Textured crop', 'Side-parted short', 'Short quiff', 'Undercut', 'Messy short', 'Mid fade',
  'Curtains', 'Medium wavy', 'Wolf cut', 'Pompadour',
  'Long straight', 'Long wavy', 'Long layered', 'Butterfly cut',
  'High ponytail', 'Messy bun', 'Shoulder bob', 'Pixie cut',
  'Loose curls',
];
/** The head proportions the assets were baked on (they are scaled to other heads). */
export const BAKE_HEAD_ID = 0;
