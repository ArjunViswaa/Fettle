import { statSync } from 'node:fs';

const CHECK_EVERY = 3_000;
const STALE_AFTER = 10_000;

/**
 * When started by scripts/run.mjs, exit cleanly once the launcher's heartbeat stops,
 * so nothing is left running in the background after the launcher dies.
 * Does nothing when the process was started on its own.
 */
export function watchLauncher(onOrphaned: () => void | Promise<void>) {
  const file = process.env.FETTLE_HEARTBEAT;
  if (!file) return;

  let lastCheck = Date.now();
  const timer = setInterval(async () => {
    const now = Date.now();
    const delayed = now - lastCheck > CHECK_EVERY * 2;
    lastCheck = now;
    // After sleep/hibernate every timer is late; give the launcher a chance to beat again.
    if (delayed) return;

    let beatAt = 0;
    try {
      beatAt = statSync(file).mtimeMs;
    } catch {
      // file removed: the launcher is stopping
    }
    if (now - beatAt > STALE_AFTER) {
      clearInterval(timer);
      await onOrphaned();
    }
  }, CHECK_EVERY);
  timer.unref();
}
