export function safeErr(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function getMemoryStats() {
  const m = process.memoryUsage();
  return {
    rssMB: Math.round(m.rss / 1e6),
    heapUsedMB: Math.round(m.heapUsed / 1e6)
  };
}
