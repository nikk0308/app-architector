const cache = new Map<string, string>();

export function readCache(key: string): string | undefined {
  return cache.get(key);
}

export function writeCache(key: string, value: string): void {
  cache.set(key, value);
}
