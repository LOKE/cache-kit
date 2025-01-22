import { Cache, Key } from "./cache";

export class CompositeCache<T> implements Cache<T> {
  constructor(private caches: Cache<T>[]) {}

  async get(key: string): Promise<T | undefined> {
    for (const cache of this.caches) {
      const value = await cache.get(key);
      if (value !== undefined) return value;
    }

    return undefined;
  }

  async set(
    key: string,
    value: Promise<T | undefined>,
    ttl: number
  ): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.set(key, value, ttl)));
  }

  async delete(key: string): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.delete(key)));
  }

  async apply(key: Key, ttl: number, promiseFn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < this.caches.length; i++) {
      const valueP = this.caches[i].get(key);
      if (valueP == undefined) continue;

      for (let j = 0; j < i; j++) {
        // TODO: TTL here gets a bit tricky
        // TODO: catch and log
        this.caches[j].set(key, valueP, ttl);
      }

      const value = await valueP;

      if (value !== undefined) return value;
    }

    const valueP = promiseFn();

    for (const cache of this.caches) {
      cache.set(key, valueP, ttl);
    }

    return await valueP;
  }
}
