import { Metric, Registry } from "prom-client";

export const metrics: Metric[] = [];

export function registerMetrics(registry: Registry): void {
  for (const metric of metrics) {
    registry.registerMetric(metric);
  }
}
