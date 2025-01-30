export type StoreEntity<V> = {
  value: V;
  expiresAt: number;
};

export type CacheStore<V> = {
  setKeyTemplate: (keyTemplate: string) => void;
  get: (key: string) => Promise<StoreEntity<V> | undefined>;
  set: (key: string, entity: StoreEntity<V>) => Promise<void>;
  delete: (key: string) => Promise<void>;
};
