import { env } from './env.js';

// Replace with a real worker loop, e.g. BullMQ consumer or scheduled task.
console.log('Worker started');
console.log(`NODE_ENV=${env.NODE_ENV}`);

// Keep process alive in dev so --watch behaves predictably.
setInterval(() => {
  // Heartbeat. Replace with real work.
}, 60_000);
