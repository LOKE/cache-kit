import { Cache, Key, Record } from "./cache";

export class RedisCache<T> implements Cache<T> {
  constructor(private client: any, private prefix: string) {}

  async get(key: Key): Promise<Record<T> | undefined> {
    const rawData = await this.client.get(`${this.prefix}:${key}`);

    if (rawData === null) return undefined;

    return JSON.parse(rawData);
  }

  async set(key: string, record: Record<T>): Promise<void> {
    await this.client.set(
      key,
      JSON.stringify(record),
      "PX",
      record.expiresAt - Date.now()
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
