// Naive cache with a few review-worthy bugs.
const cache = new Map<string, string>();

export function getCached(key: string): string | undefined {
  // BUG: unbounded growth, never evicts
  return cache.get(key);
}

export function setCached(key: string, value: string): void {
  // BUG: no size cap; also stores the raw value uncloned (mutation risk)
  cache.set(key, value);
}

// BUG: swallows all errors
export async function safeFetch(url: string): Promise<any> {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch (e) {}
}

// BUG: race — concurrent sets can lose writes
export async function warm(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => setCached(k, k.toUpperCase())));
}

// BUG: blocking fs call on the hot path
export function flushToDisk(data: string): void {
  require("fs").writeFileSync("/tmp/cache.txt", data);
}

// BUG: unbounded concurrency in warmAll
export async function warmAll(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => safeFetch(u)));
}

// BUG: caches falsy values incorrectly
export function memoize(fn) {
  const memo = {};
  return (k) => (k in memo ? memo[k] : (memo[k] = fn(k)));
}
