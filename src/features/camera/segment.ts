import type { ImageSegmenter } from '@mediapipe/tasks-vision';

/**
 * Person / hair masks for background and hair-colour lenses — MediaPipe Image Segmenter
 * (Apache-2.0 models bundled in public/mediapipe, runs on the phone, ₹0).
 * Frames are scaled down before segmenting and the mask is returned as a small alpha canvas
 * that the lens scales up with smoothing (soft edges, cheap).
 */
export type MaskKind = 'selfie' | 'hair';
const MODELS: Record<MaskKind, string> = { selfie: 'selfie_segmenter.tflite', hair: 'hair_segmenter.tflite' };
const segmenters: Partial<Record<MaskKind, Promise<ImageSegmenter>>> = {};

export function loadSegmenter(kind: MaskKind): Promise<ImageSegmenter> {
  if (!segmenters[kind]) {
    segmenters[kind] = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/mediapipe');
      const opts = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: `/mediapipe/${MODELS[kind]}`, delegate },
        runningMode: 'VIDEO' as const,
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      try {
        return await ImageSegmenter.createFromOptions(files, opts('GPU'));
      } catch {
        return await ImageSegmenter.createFromOptions(files, opts('CPU'));
      }
    })().catch((e) => {
      delete segmenters[kind];
      throw e;
    });
  }
  return segmenters[kind]!;
}

const SIDE = 256;

export class MaskTracker {
  private small = document.createElement('canvas');
  readonly mask = document.createElement('canvas');
  private img: ImageData | null = null;
  private lastTs = -1;
  constructor(private seg: ImageSegmenter, private kind: MaskKind) {}

  /** Updates and returns the mask canvas (alpha = confidence) for this frame. */
  update(source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; width?: number; height?: number }, ts: number): HTMLCanvasElement | null {
    const sw = (source.videoWidth || (source.width as number)) ?? 0;
    const sh = (source.videoHeight || (source.height as number)) ?? 0;
    if (!sw || !sh) return null;
    const scale = SIDE / Math.max(sw, sh);
    const w = Math.max(16, Math.round(sw * scale)), h = Math.max(16, Math.round(sh * scale));
    if (this.small.width !== w || this.small.height !== h) {
      this.small.width = this.mask.width = w;
      this.small.height = this.mask.height = h;
      this.img = new ImageData(w, h);
    }
    this.small.getContext('2d')!.drawImage(source, 0, 0, w, h);
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const res = this.seg.segmentForVideo(this.small, ts);
    const masks = res.confidenceMasks ?? [];
    const m = this.kind === 'hair' && masks.length > 1 ? masks[1] : masks[0];
    if (!m || !this.img) {
      res.close?.();
      return null;
    }
    const data = m.getAsFloat32Array();
    const px = this.img.data;
    for (let i = 0; i < data.length && i * 4 < px.length; i++) {
      const a = data[i];
      // Gentle contrast curve: firm inside, soft edge.
      const v = a < 0.2 ? 0 : a > 0.8 ? 1 : (a - 0.2) / 0.6;
      px[i * 4 + 3] = v * 255;
    }
    this.mask.getContext('2d')!.putImageData(this.img, 0, 0);
    res.close?.();
    return this.mask;
  }
}
