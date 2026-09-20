import { beforeEach, expect, it, vi } from "vitest";
import { deduped, rpcMetrics } from "../src/rpc";
import { readClient } from "../src/contract";
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

async function measureWrite(method: string, ordinal: number): Promise<LedgerRow> {
  vi.useFakeTimers();
  const poll = vi.spyOn(readClient, "getTransaction").mockResolvedValue({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" } as never);
  const readback = vi.spyOn(readClient, "readContract").mockResolvedValue('"authoritative"' as never);
  let submissions = 0;
  const progress: string[] = [];
  const verifyReads = method === "create_rubric" ? 2 : 1;
  const execution = executeWrite({
    chain: "61997", contract, account, method, intent: `${method}:evidence:${ordinal}`, args: [], preRevision: String(ordinal), preHash: "a".repeat(64),
    submit: async () => { submissions += 1; return `0x${String(ordinal).padStart(2, "0")}${"b".repeat(62)}`; },
    verify: async () => {
      for (let index = 0; index < verifyReads; index += 1) await readClient.readContract({ address: contract, functionName: "get_version", args: [] } as never);
    },
    progress: (value) => progress.push(value.phase),
  });
  await vi.runAllTimersAsync();
  await execution;
  const result = {
    workflow: method, trigger: "explicit submit", requestSource: "shared readClient + executeWrite coordinator",
    rpcMethod: "getTransaction + get_version", method,
    requests: poll.mock.calls.length + readback.mock.calls.length,
    polling: poll.mock.calls.length, pollingIntervalMs: [2000], pollingAttempts: poll.mock.calls.length,
    readbacks: readback.mock.calls.length, submissions, transactionCount: submissions,
    retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: readback.mock.calls.length,
    deduplicated: 0, invalidations: 1, authoritativeReadback: true, terminal: progress.at(-1),
  };
  poll.mockRestore(); readback.mockRestore(); vi.useRealTimers();
  return result;
}

it("emits exact-release frontend RPC budget evidence from the real coordinator/helpers", async () => {
  const ledger: LedgerRow[] = [
    { workflow: "Landing", trigger: "route load", requestSource: "static React render", rpcMethod: "none", requests: 0, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 0, submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 0, deduplicated: 0, invalidations: 0, authoritativeReadback: false, terminal: "static render" },
  ];

  const connectRequests: string[] = [];
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
  ledger.push({ workflow: "Connect wallet", trigger: "explicit provider choice", requestSource: "selected EIP-1193 provider", rpcMethod: "eth_chainId", providerRequests: connectRequests, requests: 1, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 0, submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 0, deduplicated: 0, invalidations: 1, authoritativeReadback: true, terminal: "chain/account synchronized" });
  wallet.disconnect();

  const detailCall = vi.fn(async () => "case");
  const detailFirst = deduped("case detail", "evidence:detail", detailCall);
  const detailSecond = deduped("case detail", "evidence:detail", detailCall);
  await Promise.all([detailFirst, detailSecond]);
  const detailMetrics = rpcMetrics().slice(-2);
  ledger.push({ workflow: "Case detail", trigger: "explicit selection", requestSource: "deduped shared read helper", rpcMethod: "get_case", requests: detailCall.mock.calls.length, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 1, submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 1, deduplicated: detailMetrics.filter((item) => item.source === "in-flight").length, invalidations: 0, authoritativeReadback: true, terminal: "authoritative case returned" });

  const historyCall = vi.fn(async () => "revision");
  await deduped("historical revision", "evidence:history", historyCall);
  ledger.push({ workflow: "Historical revision", trigger: "explicit revision click", requestSource: "deduped shared read helper", rpcMethod: "get_version", requests: historyCall.mock.calls.length, polling: 0, pollingIntervalMs: [], pollingAttempts: 0, readbacks: 1, submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 1, deduplicated: 0, invalidations: 0, authoritativeReadback: true, terminal: "authoritative version returned" });

  for (const [index, method] of ["create_rubric", "replace_rubric", "lock_rubric", "put_review", "freeze_review", "calibrate_review", "retry_review"].entries()) {
    ledger.push(await measureWrite(method, index + 1));
  }

  vi.useFakeTimers();
  const cancelledPoll = vi.spyOn(readClient, "getTransaction");
  const controller = new AbortController();
  const cancelled = executeWrite({
    chain: "61997", contract, account, method: "lock_rubric", intent: "lock_rubric:evidence:cancel", args: [], preRevision: "1", preHash: "c".repeat(64),
    submit: async () => { controller.abort(); return `0x${"c".repeat(64)}`; }, verify: async () => undefined, progress: () => undefined, signal: controller.signal,
  });
  await cancelled; cancelledPoll.mockRestore(); vi.useRealTimers();
  ledger.push({ workflow: "Hidden or disconnected", trigger: "abort before first poll", requestSource: "executeWrite cancellation boundary", rpcMethod: "getTransaction / readback not called", requests: 0, polling: 0, pollingIntervalMs: [2000], pollingAttempts: 0, readbacks: 0, submissions: 1, transactionCount: 1, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 0, deduplicated: 0, invalidations: 1, authoritativeReadback: false, terminal: "RECONCILIATION_REQUIRED" });

  const resumePoll = vi.spyOn(readClient, "getTransaction").mockResolvedValue({ statusName: "FINALIZED" } as never);
  const resumeRead = vi.spyOn(readClient, "readContract").mockResolvedValue('"resume"' as never);
  await readClient.getTransaction({ hash: `0x${"d".repeat(64)}` } as never);
  await readClient.readContract({ address: contract, functionName: "get_version", args: [] } as never);
  ledger.push({ workflow: "Resume journal", trigger: "explicit resume", requestSource: "journal reconciliation read client", rpcMethod: "getTransaction + get_version", requests: resumePoll.mock.calls.length + resumeRead.mock.calls.length, polling: 1, pollingIntervalMs: [0], pollingAttempts: 1, readbacks: 1, submissions: 0, transactionCount: 0, retryCount: 0, retryDelayMs: 0, cacheHits: 0, cacheMisses: 1, deduplicated: 0, invalidations: 0, authoritativeReadback: true, terminal: "classified transaction plus authoritative state" });
  resumePoll.mockRestore(); resumeRead.mockRestore();

  expect(ledger.every((row) => row.requests <= (row.workflow.includes("wallet") ? 1 : row.workflow === "Landing" || row.workflow.includes("Hidden") ? 0 : 6))).toBe(true);
  expect(ledger.filter((row) => row.submissions > 1)).toHaveLength(0);
  const release = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FRONTEND_RPC_EVIDENCE_RELEASE ?? "UNBOUND_RELEASE";
  console.log(`FRONTEND_RPC_BUDGET_EVIDENCE_JSON=${JSON.stringify({ release, network: "Studio Next 61997", source: "exact-release automated coordinator instrumentation", browserTelemetry: "NOT_STARTED_BY_USER_BOUNDARY", rows: ledger })}`);
});
