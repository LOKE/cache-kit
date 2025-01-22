import { Cache, Key } from "./cache";

export class RedisCache<T> implements Cache<T> {
  constructor(private client: any, prefix: string) {}

  async get(key: Key): Promise<T | undefined> {
    const rawData = await this.client.get(key);

    if (rawData === null) return undefined;

    return JSON.parse(rawData);
  }

  async set(
    key: string,
    valueP: Promise<T | undefined>,
    ttl: number
  ): Promise<void> {
    const value = await valueP;

    if (value === undefined) return;

    await this.client.set(key, JSON.stringify(value), "PX", ttl);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
