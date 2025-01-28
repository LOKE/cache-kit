export type KeyParams<T extends string> =
  T extends `${string}{${infer Param}}${infer Rest}`
    ? Record<Param, string | number> & KeyParams<Rest>
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

export function parseKeyTemplate<const T extends string>(keyTemplate: T) {
  return (params: KeyParams<T>): string => {
    return keyTemplate.replace(/{([^{}]+)}/g, (_, key) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      encodeURIComponent((params as any)[key]),
    );
  };
}

export type Entity<V> = {
  value: V;
  expiresAt: number;
};

export type Cache<V> = {
  setKeyTemplate: (keyTemplate: string) => void;
  get: (key: string) => Promise<Entity<V> | undefined>;
  set: (key: string, entity: Entity<V>) => Promise<void>;
  delete: (key: string) => Promise<void>;
};
