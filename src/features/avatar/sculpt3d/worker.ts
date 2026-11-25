/// <reference lib="webworker" />
import { pack, runJob, type Job } from './jobs';

/** Sculpting runs here, off the UI thread. */
self.onmessage = (e: MessageEvent<{ id: number; job: Job }>) => {
  const { id, job } = e.data;
  try {
    const buf = pack(runJob(job));
    (self as unknown as Worker).postMessage({ id, buf }, [buf]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};
