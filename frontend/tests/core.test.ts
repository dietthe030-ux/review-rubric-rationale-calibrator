import { beforeEach, describe, expect, it, vi } from "vitest";
import { deduped, rpcMetrics } from "../src/rpc";
import { loadJournal, reserve, updateRecord } from "../src/journal";
import { assertSuccessful, readClient, terminal } from "../src/contract";
import { createConcurrencyGate, executeWrite, transportJson, type Progress } from "../src/transaction";
import { providerOptions, startDiscovery, wallet, walletHeaderAction, type Provider, type WalletOption } from "../src/wallet";

class StorageMock {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

beforeEach(() => {
  wallet.disconnect();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new StorageMock() });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (_name: string, callback: () => unknown) => callback() } } });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: (bytes: Uint8Array) => { bytes.fill(7); return bytes; } } });
});

class ProviderMock implements Provider {
  listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  chain = "0x1";
  account = `0x${"2".repeat(40)}`;
  async request({ method }: { method: string }) {
    if (method === "eth_requestAccounts") return [this.account];
    if (method === "eth_chainId") return this.chain;
    if (method === "eth_accounts") return [this.account];
    if (method === "wallet_switchEthereumChain") { this.chain = "0xf22f"; return null; }
    return null;
  }
  on(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener); this.listeners.set(event, listeners);
  }
  removeListener(event: string, listener: (...args: unknown[]) => void) { this.listeners.get(event)?.delete(listener); }
  emit(event: string, value?: unknown) { this.listeners.get(event)?.forEach((listener) => listener(value)); }
  count(event: string) { return this.listeners.get(event)?.size ?? 0; }
}

it("discovers exact unique providers, rejects ambiguity, and replaces legacy identity late", async () => {
  const legacy = new ProviderMock(); Object.assign(legacy, { isMetaMask: true });
  const events = new Map<string, ((event: unknown) => void)[]>();
  const fakeWindow = {
    ethereum: legacy,
    okxwallet: undefined,
    addEventListener(event: string, listener: (event: unknown) => void) { events.set(event, [...(events.get(event) ?? []), listener]); },
    dispatchEvent(event: { type: string; detail?: unknown }) { (events.get(event.type) ?? []).forEach((listener) => listener(event)); return true; },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  startDiscovery();
  await Promise.resolve();
  expect(providerOptions()).toHaveLength(1);
  expect(providerOptions()[0]).toMatchObject({ id: "metamask", legacy: true, provider: legacy });
  await wallet.connect(providerOptions()[0], "0x1");
  expect(wallet.snapshot().writeClient).toBeDefined();

  const modern = new ProviderMock(); Object.assign(modern, { isMetaMask: true });
  fakeWindow.dispatchEvent({ type: "eip6963:announceProvider", detail: { info: { uuid: "modern-meta", rdns: "io.metamask" }, provider: modern } });
  expect(wallet.snapshot().phase).toBe("DISCONNECTED");
  expect(wallet.snapshot().writeClient).toBeUndefined();
  const ambiguous = new ProviderMock(); Object.assign(ambiguous, { isMetaMask: true, isRabby: true });
  fakeWindow.dispatchEvent({ type: "eip6963:announceProvider", detail: { info: { uuid: "ambiguous", rdns: "io.rabby" }, provider: ambiguous } });
  const unsupported = new ProviderMock();
  fakeWindow.dispatchEvent({ type: "eip6963:announceProvider", detail: { info: { uuid: "unsupported", rdns: "com.unknown.wallet" }, provider: unsupported } });
  const okx = new ProviderMock(); Object.assign(okx, { isOkxWallet: true });
  const rabby = new ProviderMock(); Object.assign(rabby, { isRabby: true });
  fakeWindow.dispatchEvent({ type: "eip6963:announceProvider", detail: { info: { uuid: "okx", rdns: "com.okx.wallet" }, provider: okx } });
  fakeWindow.dispatchEvent({ type: "eip6963:announceProvider", detail: { info: { uuid: "rabby", rdns: "io.rabby" }, provider: rabby } });
  expect(providerOptions().map(({ id, provider, legacy: isLegacy }) => ({ id, provider, legacy: isLegacy }))).toEqual([
    { id: "metamask", provider: modern, legacy: false }, { id: "okx", provider: okx, legacy: false }, { id: "rabby", provider: rabby, legacy: false },
  ]);
});

it("keeps the rendered wallet action invariant explicit", () => {
  expect(walletHeaderAction("CONNECTED")).toBe("CONNECTED");
  expect(walletHeaderAction("WRONG_CHAIN")).toBe("WRONG_CHAIN");
  expect(walletHeaderAction("DISCONNECTED")).toBe("CONNECT");
});

it("binds and synchronizes the selected provider after wrong-chain switching", async () => {
  const provider = new ProviderMock();
  const selected: WalletOption = { id: "metamask", name: "MetaMask", provider, uuid: "test" };
  await wallet.connect(selected, "0xf22f");
  expect(wallet.snapshot().phase).toBe("WRONG_CHAIN");
  expect(provider.count("accountsChanged")).toBe(1);
  const wrongChainAccount = `0x${"3".repeat(40)}`;
  provider.account = wrongChainAccount;
  provider.emit("accountsChanged", [wrongChainAccount]);
  expect(wallet.snapshot()).toMatchObject({ phase: "WRONG_CHAIN", account: wrongChainAccount, writeClient: undefined });

  await wallet.switchNetwork({ chainId: "0xf22f", chainName: "Studionet", nativeCurrency: {}, rpcUrls: [] });
  expect(wallet.snapshot()).toMatchObject({ phase: "CONNECTED", account: wrongChainAccount, selected });
  expect(wallet.snapshot().writeClient).toBeDefined();
  expect(["accountsChanged", "chainChanged", "disconnect"].map((event) => provider.count(event))).toEqual([1, 1, 1]);

  const nextAccount = `0x${"4".repeat(40)}`;
  const firstClient = wallet.snapshot().writeClient;
  provider.emit("accountsChanged", [nextAccount]);
  expect(wallet.snapshot()).toMatchObject({ phase: "CONNECTED", account: nextAccount, selected });
  expect(wallet.snapshot().writeClient).toBeDefined();
  expect(wallet.snapshot().writeClient).not.toBe(firstClient);
  provider.emit("chainChanged", "0x1");
  expect(wallet.snapshot().phase).toBe("WRONG_CHAIN");
  expect(wallet.snapshot().writeClient).toBeUndefined();
  provider.emit("accountsChanged", [provider.account]);
  expect(wallet.snapshot().phase).toBe("WRONG_CHAIN");
  provider.emit("chainChanged", "0xf22f");
  expect(wallet.snapshot().phase).toBe("CONNECTED");
  provider.emit("disconnect");
  expect(wallet.snapshot().phase).toBe("DISCONNECTED");
  expect(wallet.snapshot().writeClient).toBeUndefined();
  expect(["accountsChanged", "chainChanged", "disconnect"].map((event) => provider.count(event))).toEqual([0, 0, 0]);
});

it("deduplicates identical in-flight RPC reads", async () => {
  let resolve!: (value: number) => void;
  const call = vi.fn(() => new Promise<number>((done) => { resolve = done; }));
  const first = deduped("detail", "same", call);
  const second = deduped("detail", "same", call);
  resolve(4);
  expect(await Promise.all([first, second])).toEqual([4, 4]);
  expect(call).toHaveBeenCalledOnce();
  expect(rpcMetrics().at(-1)?.source).toBe("in-flight");
});

it("reserves immutable journal entries and blocks a same-case conflict", async () => {
  const input = {
    chain: "61999", contract: `0x${"1".repeat(40)}`, account: `0x${"2".repeat(40)}`,
    method: "lock_rubric", intent: "lock_rubric:1:1", args_json: "[]", pre_revision: "1", pre_hash: "a".repeat(64),
  };
  const record = await reserve(input);
  await updateRecord(record.reservation, { tx_hash: `0x${"b".repeat(64)}`, status: "SUBMITTED" });
  expect(loadJournal()[0].tx_hash).toBe(`0x${"b".repeat(64)}`);
  await expect(updateRecord(record.reservation, { tx_hash: `0x${"c".repeat(64)}` })).rejects.toThrow(/immutable/i);
  await expect(reserve({ ...input, method: "put_review", intent: "put_review:1:1" })).rejects.toThrow(/pending/i);
});

it("keeps independent create intents separate by nonce", async () => {
  const base = {
    chain: "61999", contract: `0x${"1".repeat(40)}`, account: `0x${"2".repeat(40)}`,
    method: "create_rubric", args_json: "[]", pre_revision: "0", pre_hash: "a".repeat(64),
  };
  await reserve({ ...base, intent: "create:account:nonce-a" });
  await expect(reserve({ ...base, intent: "create:account:nonce-b" })).resolves.toMatchObject({ status: "SIGNING" });
});

describe("transaction classifier", () => {
  it("requires finality and semantic return", () => {
    expect(terminal({ statusName: "FINALIZED" })).toBe(true);
    expect(terminal({ statusName: "ACCEPTED" })).toBe(false);
    expect(() => assertSuccessful({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })).toThrow(/did not execute/i);
    expect(() => assertSuccessful({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toThrow(/not finalized/i);
    expect(() => assertSuccessful({ statusName: "FINALIZED", consensus_data: { leader_receipt: { execution_result: "SUCCESS", result: { status: "return" } } } })).not.toThrow();
  });
});

it("serializes bigint calldata as canonical decimal transport values", () => {
  expect(transportJson([1n, "x"])).toBe('["1","x"]');
});

it("cancels polling and leaves the submitted record recoverable", async () => {
  const controller = new AbortController();
  const getTransaction = vi.spyOn(readClient, "getTransaction");
  const progress: Progress[] = [];
  await executeWrite({
    chain: "61999", contract: `0x${"1".repeat(40)}`, account: `0x${"2".repeat(40)}`,
    method: "lock_rubric", intent: "lock_rubric:1:1", args: [], preRevision: "1", preHash: "a".repeat(64),
    submit: async () => { controller.abort(); return `0x${"b".repeat(64)}`; },
    verify: vi.fn(), progress: (value) => progress.push(value), signal: controller.signal,
  });
  expect(getTransaction).not.toHaveBeenCalled();
  expect(progress.at(-1)?.phase).toBe("RECONCILIATION_REQUIRED");
  expect(loadJournal()[0].status).toBe("RECONCILE");
  getTransaction.mockRestore();
});

it("does not display success from a readback completed after context cancellation", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const getTransaction = vi.spyOn(readClient, "getTransaction").mockResolvedValue({
    statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN",
  } as never);
  const progress: Progress[] = [];
  const execution = executeWrite({
    chain: "61999", contract: `0x${"1".repeat(40)}`, account: `0x${"2".repeat(40)}`,
    method: "lock_rubric", intent: "lock_rubric:1:1", args: [], preRevision: "1", preHash: "a".repeat(64),
    submit: async () => `0x${"b".repeat(64)}`,
    verify: async () => { controller.abort(); }, progress: (value) => progress.push(value), signal: controller.signal,
  });
  await vi.runAllTimersAsync();
  await execution;
  expect(progress.some(({ phase }) => phase === "SUCCESS")).toBe(false);
  expect(progress.at(-1)?.phase).toBe("RECONCILIATION_REQUIRED");
  expect(loadJournal()[0].status).toBe("RECONCILE");
  getTransaction.mockRestore();
  vi.useRealTimers();
});

it("limits explicit reconciliation work to two concurrent entries", () => {
  const gate = createConcurrencyGate(2);
  const first = gate.tryEnter();
  const second = gate.tryEnter();
  expect(first).toBeTypeOf("function");
  expect(second).toBeTypeOf("function");
  expect(gate.tryEnter()).toBeUndefined();
  expect(gate.active()).toBe(2);
  first?.();
  expect(gate.tryEnter()).toBeTypeOf("function");
});
