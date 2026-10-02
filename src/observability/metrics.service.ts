import { Injectable } from '@nestjs/common';

export type MetricName =
  | 'messagesReceived'
  | 'messagesCompleted'
  | 'messagesAbandoned'
  | 'dlqPeeked'
  | 'retries'
  | 'serviceBusPublishFailures'
  | 'outboxPublishFailures'
  | 'duplicateEvents'
  | 'cacheHits'
  | 'cacheMisses';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly samples = new Map<string, number[]>();

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observe(name: string, value: number): void {
    const current = this.samples.get(name) ?? [];
    current.push(value);
    this.samples.set(name, current.slice(-100));
  }

  snapshot(): {
    counters: Record<string, number>;
    latency: Record<string, { count: number; avgMs: number }>;
  } {
    const counters: Record<string, number> = {};
    for (const [key, value] of this.counters) {
      counters[key] = value;
    }
    const latency: Record<string, { count: number; avgMs: number }> = {};
    for (const [key, values] of this.samples) {
      const avg =
        values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
      latency[key] = { count: values.length, avgMs: avg };
    }
    return { counters, latency };
  }
}
