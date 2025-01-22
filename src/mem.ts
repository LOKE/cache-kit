import { Cache, Key } from "./cache";

type Record<T> = {
  value: Promise<T | undefined>;
  expiresAt: number;
  timer: number;
};

export class MemCache<T> implements Cache<T> {
  constructor(private cache: Map<Key, Record<T>>) {}

  get(key: Key): Promise<T | undefined> | undefined {
    const record = this.cache.get(key);

    if (record === undefined) return undefined;

    if (record.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return record.value;
  }

  set(key: Key, value: Promise<T | undefined>, ttl: number): Promise<void> {
    const expiresAt = Date.now() + ttl;
    const timer = setTimeout(() => this.cache.delete(key), ttl);

    this.cache.set(key, { value, expiresAt, timer });

    return Promise.resolve();
  }

  delete(key: Key): Promise<void> {
    const record = this.cache.get(key);

    if (record !== undefined) {
      clearTimeout(record.timer);
    }

    this.cache.delete(key);

    return Promise.resolve();
  }
}
