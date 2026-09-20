import { beforeEach, expect, it, vi } from "vitest";
import { deduped, rpcMetrics } from "../src/rpc";
import { readClient } from "../src/contract";
import { loadJournal, reserve, updateRecord } from "../src/journal";
import { executeWrite } from "../src/transaction";
import { wallet, type Provider } from "../src/wallet";

class StorageMock {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const contract = `0x${"1".repeat(40)}` as `0x${string}`;
const account = `0x${"2".repeat(40)}` as `0x${string}`;
const txHash = (prefix: string) => `0x${prefix}${"b".repeat(64 - prefix.length)}`;

beforeEach(() => {
  wallet.disconnect();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new StorageMock() });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (_name: string, callback: () => unknown) => callback() } } });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: (bytes: Uint8Array) => { bytes.fill(7); return bytes; } } });
});

type LedgerRow = {
  workflow: string; trigger: string; requestSource: string; rpcMethod: string;
  requests: number; polling: number; pollingIntervalMs: number[]; pollingAttempts: number;
  readbacks: number; submissions: number; transactionCount: number; retryCount: number; retryDelayMs: number;
  cacheHits: number; cacheMisses: number; deduplicated: number; invalidations: number;
  authoritativeReadback: boolean; terminal: string | undefined; method?: string; providerRequests?: string[];
};

function metricSlice(start: number) { return rpcMetrics().slice(start); }

async function measureWrite(method: string, ordinal: number): Promise<LedgerRow> {
  vi.useFakeTimers();
  const timers = vi.spyOn(globalThis, "setTimeout");
  const metricStart = rpcMetrics().length;
  const poll = vi.spyOn(readClient, "getTransaction").mockResolvedValue({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" } as never);
  const readback = vi.spyOn(readClient, "readContract").mockResolvedValue('"authoritative"' as never);
  let submissions = 0;
  const progress: string[] = [];
  const observedReadbacks: string[] = [];
  const verifyReads = method === "create_rubric" ? 2 : 1;
  const execution = executeWrite({
    chain: "61997", contract, account, method, intent: `${method}:evidence:${ordinal}`, args: [], preRevision: String(ordinal), preHash: "a".repeat(64),
    submit: async () => { submissions += 1; return txHash(String(ordinal).padStart(2, "0")); },
    verify: async () => {
      for (let index = 0; index < verifyReads; index += 1) {
        const value = await readClient.readContract({ address: contract, functionName: "get_version", args: [] } as never);
        observedReadbacks.push(String(value));
      }
    },
    progress: (value) => progress.push(value.phase),
  });
  await vi.runAllTimersAsync();
  await execution;
  const metrics = metricSlice(metricStart);
  const pollingIntervalMs = timers.mock.calls.map((call) => Number(call[1])).filter((value) => [2000, 4000, 8000].includes(value));
  expect(observedReadbacks).toEqual(Array.from({ length: verifyReads }, () => '"authoritative"'));
  expect(progress.at(-1)).toBe("SUCCESS");
  expect(submissions).toBe(1);
  expect(metrics.filter((item) => item.source === "invalidation")).toHaveLength(1);
  const result: LedgerRow = {
    workflow: method, trigger: "explicit submit", requestSource: "shared readClient + executeWrite coordinator",
    rpcMethod: "getTransaction + get_version", method,
    requests: poll.mock.calls.length + readback.mock.calls.length,
    polling: poll.mock.calls.length, pollingIntervalMs, pollingAttempts: poll.mock.calls.length,
    readbacks: observedReadbacks.length, submissions, transactionCount: submissions,
    retryCount: progress.filter((phase) => phase === "RETRYING").length, retryDelayMs: 0,
    cacheHits: metrics.filter((item) => item.source === "cache-hit").length,
    cacheMisses: metrics.filter((item) => item.source === "cache-miss").length,
    deduplicated: metrics.filter((item) => item.source === "in-flight").length,
    invalidations: metrics.filter((item) => item.source === "invalidation").length,
    authoritativeReadback: observedReadbacks.length === verifyReads && observedReadbacks.every((value) => value === '"authoritative"'),
    terminal: progress.at(-1),
  };
  timers.mockRestore(); poll.mockRestore(); readback.mockRestore(); vi.useRealTimers();
  return result;
}

it("emits exact-release frontend RPC budget evidence from observed coordinator and journal state", async () => {
  const ledger: LedgerRow[] = [{
    workflow: "Landing", trigger: "route load", requestSource: "static React render", rpcMethod: "none",
    requests: 0, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 0, submissions: 0, transactionCount: 0,
    retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 0, deduplicated: 0, invalidations: 0,
    authoritativeReadback: false, terminal: "static render",
  }];

  const connectRequests: string[] = [];
  const connectMetricStart = rpcMetrics().length;
  const connectProvider: Provider = {
    async request({ method }) {
      connectRequests.push(method);
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
      if (method === "eth_chainId") return "0xf22d";
      return null;
    },
    on: () => undefined,
    removeListener: () => undefined,
  };
  await wallet.connect({ id: "metamask", name: "MetaMask", provider: connectProvider, uuid: "rpc-evidence-connect" }, "0xf22d");
  const connectMetrics = metricSlice(connectMetricStart);
  const chainReads = connectRequests.filter((method) => method === "eth_chainId").length;
  expect(connectRequests).toEqual(["eth_requestAccounts", "eth_chainId"]);
  expect(chainReads).toBe(1);
  ledger.push({
    workflow: "Connect wallet", trigger: "explicit provider choice", requestSource: "selected EIP-1193 provider", rpcMethod: "eth_chainId",
    providerRequests: connectRequests, requests: chainReads, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 0,
    submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 0,
    deduplicated: connectMetrics.filter((item) => item.source === "in-flight").length,
    invalidations: connectMetrics.filter((item) => item.source === "invalidation").length,
    authoritativeReadback: connectRequests.includes("eth_chainId"), terminal: "chain/account synchronized",
  });
  wallet.disconnect();

  const detailMetricStart = rpcMetrics().length;
  const detailCall = vi.fn(async () => "case");
  const detailValues = await Promise.all([
    deduped("case detail", "evidence:detail", detailCall),
    deduped("case detail", "evidence:detail", detailCall),
  ]);
  const detailMetrics = metricSlice(detailMetricStart);
  expect(detailValues).toEqual(["case", "case"]);
  expect(detailCall).toHaveBeenCalledTimes(1);
  ledger.push({
    workflow: "Case detail", trigger: "explicit selection", requestSource: "deduped shared read helper", rpcMethod: "get_case",
    requests: detailCall.mock.calls.length, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 1,
    submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: detailMetrics.filter((item) => item.source === "cache-hit").length,
    cacheMisses: detailMetrics.filter((item) => item.source === "cache-miss").length,
    deduplicated: detailMetrics.filter((item) => item.source === "in-flight").length,
    invalidations: detailMetrics.filter((item) => item.source === "invalidation").length,
    authoritativeReadback: detailValues.every((value) => value === "case"), terminal: "authoritative case returned",
  });

  const historyMetricStart = rpcMetrics().length;
  const historyCall = vi.fn(async () => "revision");
  const historyValue = await deduped("historical revision", "evidence:history", historyCall);
  const historyMetrics = metricSlice(historyMetricStart);
  expect(historyValue).toBe("revision");
  ledger.push({
    workflow: "Historical revision", trigger: "explicit revision click", requestSource: "deduped shared read helper", rpcMethod: "get_version",
    requests: historyCall.mock.calls.length, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 1,
    submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: historyMetrics.filter((item) => item.source === "cache-hit").length,
    cacheMisses: historyMetrics.filter((item) => item.source === "cache-miss").length, deduplicated: historyMetrics.filter((item) => item.source === "in-flight").length,
    invalidations: historyMetrics.filter((item) => item.source === "invalidation").length,
    authoritativeReadback: historyValue === "revision", terminal: "authoritative version returned",
  });

  for (const [index, method] of ["create_rubric", "replace_rubric", "lock_rubric", "put_review", "freeze_review", "calibrate_review", "retry_review"].entries()) {
    ledger.push(await measureWrite(method, index + 1));
  }

  vi.useFakeTimers();
  const cancelledPoll = vi.spyOn(readClient, "getTransaction");
  const cancelledRead = vi.spyOn(readClient, "readContract");
  const cancelledProgress: string[] = [];
  const controller = new AbortController();
  const cancelled = executeWrite({
    chain: "61997", contract, account, method: "lock_rubric", intent: "lock_rubric:evidence:cancel", args: [], preRevision: "1", preHash: "c".repeat(64),
    submit: async () => { controller.abort(); return txHash("cc"); }, verify: async () => undefined,
    progress: (value) => cancelledProgress.push(value.phase), signal: controller.signal,
  });
  await cancelled;
  expect(cancelledPoll).not.toHaveBeenCalled();
  expect(cancelledRead).not.toHaveBeenCalled();
  expect(cancelledProgress.at(-1)).toBe("RECONCILIATION_REQUIRED");
  expect(loadJournal().at(-1)?.status).toBe("RECONCILE");
  ledger.push({
    workflow: "Hidden or disconnected", trigger: "abort before first poll", requestSource: "executeWrite cancellation boundary",
    rpcMethod: "getTransaction / readback not called", requests: cancelledPoll.mock.calls.length + cancelledRead.mock.calls.length,
    polling: cancelledPoll.mock.calls.length, pollingIntervalMs: [], pollingAttempts: cancelledPoll.mock.calls.length,
    readbacks: cancelledRead.mock.calls.length, submissions: 1, transactionCount: 1, retryCount: 0, retryDelayMs: 0,
    cacheHits: 0, cacheMisses: 0, deduplicated: 0, invalidations: 0, authoritativeReadback: false,
    terminal: cancelledProgress.at(-1),
  });
  cancelledPoll.mockRestore(); cancelledRead.mockRestore(); vi.useRealTimers();

  const resumePoll = vi.spyOn(readClient, "getTransaction").mockResolvedValue({ statusName: "FINALIZED" } as never);
  const resumeRead = vi.spyOn(readClient, "readContract").mockResolvedValue('"resume"' as never);
  const journalRecord = await reserve({ chain: "61997", contract, account, method: "lock_rubric", intent: "lock_rubric:resume", args_json: "[]", pre_revision: "1", pre_hash: "d".repeat(64) });
  await updateRecord(journalRecord.reservation, { tx_hash: txHash("dd"), status: "RECONCILE" });
  const pending = loadJournal().find((item) => item.reservation === journalRecord.reservation);
  expect(pending?.status).toBe("RECONCILE");
  const transaction = await readClient.getTransaction({ hash: txHash("dd") } as never);
  const authoritative = await readClient.readContract({ address: contract, functionName: "get_version", args: [] } as never);
  expect(String(transaction.statusName)).toBe("FINALIZED");
  expect(String(authoritative)).toBe('"resume"');
  await updateRecord(journalRecord.reservation, { status: "VERIFIED" });
  const reconciled = loadJournal().find((item) => item.reservation === journalRecord.reservation);
  expect(reconciled?.status).toBe("VERIFIED");
  ledger.push({
    workflow: "Resume journal storage/reconciliation boundary", trigger: "explicit Resume per entry", requestSource: "journal storage plus read client",
    rpcMethod: "getTransaction + get_version", requests: resumePoll.mock.calls.length + resumeRead.mock.calls.length,
    polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: resumeRead.mock.calls.length,
    submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 0, deduplicated: 0, invalidations: 0,
    authoritativeReadback: String(authoritative) === '"resume"' && reconciled?.status === "VERIFIED", terminal: reconciled?.status,
  });
  resumePoll.mockRestore(); resumeRead.mockRestore();

  expect(ledger.every((row) => row.requests <= (row.workflow === "Landing" || row.workflow.includes("Hidden") ? 0 : row.workflow === "Connect wallet" ? 1 : 6))).toBe(true);
  expect(ledger.every((row) => row.submissions <= 1)).toBe(true);
  expect(ledger.every((row) => row.authoritativeReadback || row.workflow === "Landing" || row.workflow.includes("Hidden"))).toBe(true);
  const release = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FRONTEND_RPC_EVIDENCE_RELEASE ?? "UNBOUND_RELEASE";
  console.log(`FRONTEND_RPC_BUDGET_EVIDENCE_JSON=${JSON.stringify({ release, network: "Studio Next 61997", source: "exact-release automated coordinator and journal-boundary instrumentation", browserTelemetry: "NOT_STARTED_BY_USER_BOUNDARY", rows: ledger })}`);
});
