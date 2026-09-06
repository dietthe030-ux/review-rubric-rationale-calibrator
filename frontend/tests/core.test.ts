import { beforeEach, describe, expect, it, vi } from "vitest";
import { deduped, rpcMetrics } from "../src/rpc";
import { loadJournal, reserve, updateRecord } from "../src/journal";
import { assertSuccessful, terminal } from "../src/contract";
import { transportJson } from "../src/transaction";

class StorageMock {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new StorageMock() });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (_name: string, callback: () => unknown) => callback() } } });
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: (bytes: Uint8Array) => { bytes.fill(7); return bytes; } } });
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
