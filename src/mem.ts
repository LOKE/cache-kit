import { Cache, Key, Record } from "./cache";

type MapLike<T> = {
  get(key: Key): T | undefined;
  set(key: Key, value: T): void;
  delete(key: Key): void;
};

export class MemCache<T> implements Cache<T> {
  private timers = new Map<Key, number>();

  constructor(private cache: MapLike<Record<T>> = new Map()) {}

  async get(key: Key): Promise<Record<T> | undefined> {
    const record = this.cache.get(key);

    if (record === undefined) return undefined;

    if (record.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return record;
  }

  set(key: Key, record: Record<T>): Promise<void> {
    const ttl = record.expiresAt - Date.now();
    const timer = setTimeout(() => {
      if (this.cache.get(key) === record) {
        this.cache.delete(key);
      }
    }, ttl);

    this.timers.set(key, timer);

    this.cache.set(key, record);

    return Promise.resolve();
  }

  delete(key: Key): Promise<void> {
    const timer = this.timers.get(key);
    if (timer !== undefined) {
      this.timers.delete(key);
      clearTimeout(timer);
    }

    this.cache.delete(key);

    return Promise.resolve();
  }
}
