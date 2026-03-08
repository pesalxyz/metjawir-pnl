const windowMs = 60_000;
const maxPerWindow = 20;

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const found = store.get(key);

  if (!found || now > found.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (found.count >= maxPerWindow) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((found.resetAt - now) / 1000)
    };
  }

  found.count += 1;
  store.set(key, found);
  return { allowed: true };
}
