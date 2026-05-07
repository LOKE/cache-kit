import { exponentialBuckets, Histogram, linearBuckets } from "prom-client";
import type {
  Redis as IORedisClient,
  Cluster as IORedisCluster,
} from "ioredis";

import type { CacheStore, StoreEntity } from "./store";
import { metrics } from "./metrics";
import { brotliCompress, brotliDecompress, constants } from "node:zlib";
import { promisify } from "node:util";

/*
Did benchmarking of the compression algorithms available in NodeJS.
Zstd was the fastest to decompress, but is still experimental in the latest versions of Node.
Brotli was the second contender, and is available in the versions of NodeJS used in our stack currently.

Given that the data is going to be read far more than it's going to be written to, the cost of compression wasn't considered.
*/

const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

const cacheValueSize = new Histogram({
  name: "cache_compressed_redis_value_size_bytes",
  help: "Size of bytes sent to Redis after compression",
  labelNames: ["key"],
  buckets: exponentialBuckets(100, 10, 5),
  registers: [],
});

const cacheCompressionRatio = new Histogram({
  name: "cache_compressed_ratio",
  help: "Ratio of uncompressed:compressed data",
  labelNames: ["key"],
  buckets: linearBuckets(0, 0.1, 11),
  registers: [],
});

metrics.push(cacheValueSize, cacheCompressionRatio);

type Client = Pick<IORedisClient | IORedisCluster, "getBuffer" | "set" | "del">;

// Brotli looks like all the interesting options are on the compressor,
// which wouldn't change the format of the stored data. But version the magic bytes just in case.
// Br 26-03
const brotli2603MagicBytes = Buffer.from([0x42, 0x72, 0x26, 0x03]);

export class CompressedRedisCacheStore<T> implements CacheStore<T> {
  private keyTemplate: string | null = null;

  constructor(private client: Client) {}

  setKeyTemplate(keyTemplate: string) {
    if (this.keyTemplate !== null) {
      throw new Error("Cannot change key template");
    }

    this.keyTemplate = keyTemplate;
  }

  async get(key: string): Promise<StoreEntity<T> | undefined> {
    const rawData = await this.client.getBuffer(key);

    if (rawData === null) return undefined;

    try {
      if (
        rawData
          .subarray(0, brotli2603MagicBytes.length)
          .equals(brotli2603MagicBytes)
      ) {
        return JSON.parse(
          (
            await brotliDecompressAsync(
              rawData.subarray(brotli2603MagicBytes.length),
            )
          ).toString("utf8"),
        );
      }

      return JSON.parse(rawData.toString("utf8"));
    } catch {
      return undefined;
    }
  }

  async set(key: string, record: StoreEntity<T>): Promise<void> {
    const ttl = record.expiresAt - Date.now();
    if (ttl <= 0) return;

    const jsonBuffer = Buffer.from(JSON.stringify(record), "utf8");
    const buf = Buffer.concat([
      brotli2603MagicBytes,
      await brotliCompressAsync(jsonBuffer, {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_SIZE_HINT]: jsonBuffer.length,
      }),
    ]);

    if (this.keyTemplate !== null) {
      cacheValueSize.observe({ key: this.keyTemplate }, buf.length);
      cacheCompressionRatio.observe(
        { key: this.keyTemplate },
        buf.length / jsonBuffer.length,
      );
    }

    await this.client.set(key, buf, "PX", ttl);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
