import { useEffect, useRef, useState } from 'react';
import { jobKey, pack, runJob, unpack, SCULPT_VERSION, type Job, type Result } from './jobs';

/**
 * Sculpted geometry on demand: built in a Web Worker (the UI never freezes), kept in memory,
 * and saved in Cache Storage so each body / garment / hairstyle is sculpted once per device.
 */

const mem = new Map<string, Result>();
const pending = new Map<string, Promise<Result>>();
const MEM_MAX = 160;
const STORE = `snv-sculpt-v${SCULPT_VERSION}`;

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { ok: (b: ArrayBuffer) => void; fail: (e: Error) => void }>();
function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; buf?: ArrayBuffer; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.buf) w.ok(e.data.buf);
      else w.fail(new Error(e.data.error ?? 'sculpt failed'));
    };
    worker.onerror = () => {
      // worker can't start (old browser / CSP): fall back to building on the main thread
      for (const [, w] of waiting) w.fail(new Error('worker'));
      waiting.clear();
      worker = null;
      noWorker = true;
    };
  } catch {
    worker = null;
  }
  return worker;
}
let noWorker = false;

async function fromStore(key: string): Promise<Result | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const res = await (await caches.open(STORE)).match(`/__sculpt/${encodeURIComponent(key)}`);
    return res ? unpack(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
function toStore(key: string, buf: ArrayBuffer) {
  try {
    if (typeof caches === 'undefined') return;
    void caches.open(STORE).then((c) => c.put(`/__sculpt/${encodeURIComponent(key)}`, new Response(buf.slice(0)))).catch(() => undefined);
  } catch {
    /* storage unavailable */
  }
}
let pruned = false;
function prune() {
  if (pruned || typeof caches === 'undefined') return;
  pruned = true;
  void caches.keys().then((ks) => ks.filter((k) => k.startsWith('snv-sculpt-') && k !== STORE).forEach((k) => void caches.delete(k))).catch(() => undefined);
}

function remember(key: string, r: Result) {
  mem.set(key, r);
  if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value as string);
}

/** Synchronous peek (already built in this session). */
export function peekSculpt(job: Job): Result | null {
  return mem.get(jobKey(job)) ?? null;
}

/** Build (or fetch) one sculpted piece. */
export function sculpt(job: Job): Promise<Result> {
  const key = jobKey(job);
  const hit = mem.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  prune();
  const run = (async () => {
    const stored = await fromStore(key);
    if (stored) return stored;
    const w = noWorker ? null : getWorker();
    let buf: ArrayBuffer;
    if (w) {
      try {
        buf = await new Promise<ArrayBuffer>((ok, fail) => {
          const id = nextId++;
          waiting.set(id, { ok, fail });
          w.postMessage({ id, job });
        });
      } catch {
        buf = pack(runJob(job));
      }
    } else {
      buf = pack(runJob(job));
    }
    toStore(key, buf);
    return unpack(buf);
  })();
  pending.set(key, run);
  return run.then(
    (r) => {
      pending.delete(key);
      remember(key, r);
      return r;
    },
    (e) => {
      pending.delete(key);
      throw e;
    },
  );
}

/** React: the piece for `job` (null while it's being sculpted). */
export function useSculpt(job: Job | null): Result | null {
  const key = job ? jobKey(job) : '';
  const [, bump] = useState(0);
  const ready = job ? mem.get(key) ?? null : null;
  // while a new version is being built, keep showing the last one (no blank flash on edits)
  const last = useRef<Result | null>(null);
  if (ready) last.current = ready;
  useEffect(() => {
    if (!job || ready) return;
    let alive = true;
    void sculpt(job).then(() => alive && bump((n) => n + 1)).catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!ready]);
  return ready ?? (job ? last.current : null);
}
