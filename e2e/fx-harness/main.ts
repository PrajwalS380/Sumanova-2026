// Browser check for music synthesis and video effects (see e2e/fx.e2e.cjs).
import { renderTrack, TRACKS } from '@/lib/music/tracks';
import { processVideo } from '@/lib/media/videoFx';
const w = window as unknown as Record<string, unknown>;

async function makeClip(seconds: number): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const g = c.getContext('2d')!;
  const ac = new AudioContext();
  const osc = ac.createOscillator();
  const dest = ac.createMediaStreamDestination();
  osc.connect(dest); osc.start();
  const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(100);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      g.fillStyle = `hsl(${t * 120},80%,50%)`; g.fillRect(0, 0, 320, 240);
      g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText(t.toFixed(1), 100, 130);
      if (t >= seconds) return resolve();
      requestAnimationFrame(draw);
    };
    draw();
  });
  rec.stop(); await done; osc.stop(); void ac.close();
  return new Blob(chunks, { type: 'video/webm' });
}
const durationOf = (b: Blob) => new Promise<number>((resolve) => {
  const v = document.createElement('video');
  v.src = URL.createObjectURL(b);
  v.onloadedmetadata = () => {
    if (Number.isFinite(v.duration)) return resolve(v.duration);
    v.currentTime = 1e6; // webm from MediaRecorder: force duration
    v.ontimeupdate = () => { v.ontimeupdate = null; resolve(v.duration); };
  };
});

w.run = async () => {
  const out: Record<string, unknown> = {};
  const buf = await renderTrack(TRACKS[0], 4);
  const d = buf.getChannelData(0);
  let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  out.musicRms = Math.sqrt(sum / d.length);
  out.musicSeconds = buf.duration;
  const clip = await makeClip(3);
  out.clipSeconds = await durationOf(clip);
  const fast = await processVideo(clip, { speed: 2, reverse: false, voice: 'robot', music: 'hype' });
  out.fastSeconds = await durationOf(fast);
  const rev = await processVideo(clip, { speed: 1, reverse: true, voice: 'chipmunk', music: null });
  out.reverseSeconds = await durationOf(rev);
  out.reverseBytes = rev.size;
  return out;
};

// Visual check of snap templates: ?templates=1
if (new URLSearchParams(location.search).has('templates')) {
  void import('@/lib/snaps/templates').then(({ TEMPLATES }) => {
    for (const t of TEMPLATES) {
      const c = document.createElement('canvas');
      c.width = 240; c.height = 420;
      c.style.margin = '4px';
      const g = c.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 240, 420);
      grad.addColorStop(0, '#6aa3ff'); grad.addColorStop(1, '#ff8fc0');
      g.fillStyle = grad; g.fillRect(0, 0, 240, 420);
      t.draw(g, 240, 420, new Date('2026-11-25'));
      document.body.appendChild(c);
    }
    w.done = true;
  });
}
