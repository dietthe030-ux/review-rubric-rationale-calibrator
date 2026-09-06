export type Metric = { row: string; source: "network" | "in-flight"; key: string };
const inflight = new Map<string, Promise<unknown>>();
const metrics: Metric[] = [];
export async function deduped<T>(row: string, key: string, call: () => Promise<T>): Promise<T> {
  const active = inflight.get(key);
  if (active) { metrics.push({ row, key, source: "in-flight" }); return active as Promise<T>; }
  metrics.push({ row, key, source: "network" });
  const operation = call();
  inflight.set(key, operation);
  try { return await operation; } finally { if (inflight.get(key) === operation) inflight.delete(key); }
}
export function rpcMetrics() { return metrics.slice(); }
