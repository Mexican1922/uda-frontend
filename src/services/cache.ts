/**
 * Lightweight TTL-based in-memory cache shared across the entire app.
 *
 * Why: Multiple pages (HomePage, ProfilePage, ArtistPage…) independently
 * fetch the same endpoints within the same session. This module gives them
 * a single shared store so the second caller gets an instant cache hit
 * instead of a duplicate network round-trip.
 *
 * Usage:
 *   import { clientCache } from "./cache";
 *
 *   const data = clientCache.get<MyType>("key");
 *   if (!data) {
 *     const fresh = await fetchSomething();
 *     clientCache.set("key", fresh, 5 * 60_000); // 5 min TTL
 *   }
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Date.now() ms timestamp
}

class ClientCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /** Returns the cached value if it exists and hasn't expired, else null. */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Stores a value with a TTL in milliseconds (default: 5 minutes). */
  set<T>(key: string, value: T, ttlMs = 5 * 60_000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Removes a specific key. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Removes all keys that start with a prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Wipes everything — use when the user logs out. */
  clear(): void {
    this.store.clear();
  }
}

// Singleton — same instance across all imports in the module graph.
export const clientCache = new ClientCache();

// ── Convenience TTL constants ─────────────────────────────────────────────────
export const TTL = {
  SHORT:   2 * 60_000,   //  2 min — search results
  MEDIUM:  5 * 60_000,   //  5 min — history, library
  LONG:   15 * 60_000,   // 15 min — trending, artist pages
} as const;
