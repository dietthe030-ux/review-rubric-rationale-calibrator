import type { Address } from "./wallet";
import { assertSuccessful, readClient, terminal } from "./contract";
import { removeUnsigned, reserve, updateRecord, type JournalRecord } from "./journal";
import { invalidateRpc } from "./rpc";

export type Phase = "IDLE" | "WAITING_FOR_WALLET" | "SUBMITTED" | "WAITING_FOR_FINALITY" | "VERIFYING_EXECUTION" | "VERIFYING_READBACK" | "SUCCESS" | "REJECTED" | "FAILED" | "RECONCILIATION_REQUIRED";
export type Progress = { phase: Phase; hash?: string; message?: string };
export const FINALITY_DELAYS_MS = [2000, 4000, 8000, 12000, 16000] as const;
export function classifyTransaction(transaction: unknown): { state: "PENDING" | "SUCCESS" | "FAILED"; message?: string } {
  if (!terminal(transaction)) return { state: "PENDING" };
  try { assertSuccessful(transaction); return { state: "SUCCESS" }; }
  catch (cause) { return { state: "FAILED", message: cause instanceof Error ? cause.message : "Execution failed." }; }
}
const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException("Operation cancelled.", "AbortError")); return; }
  const aborted = () => { clearTimeout(timer); reject(new DOMException("Operation cancelled.", "AbortError")); };
  const timer = setTimeout(() => { signal?.removeEventListener("abort", aborted); resolve(); }, ms);
  signal?.addEventListener("abort", aborted, { once: true });
});
export function createConcurrencyGate(limit: number) {
  let active = 0;
  return { tryEnter() {
    if (active >= limit) return;
    active += 1;
    let released = false;
    return () => { if (!released) { released = true; active -= 1; } };
  }, active: () => active };
}
export const transportJson = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
function rejected(cause: unknown) { return !!cause && typeof cause === "object" && Number((cause as { code?: unknown }).code) === 4001; }
function revertedEnvelope(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  const match = message.match(/Transaction reverted:\s*EVM tx\s*(0x[0-9a-fA-F]{64})/i);
  return match ? { hash: match[1].toLowerCase(), message } : undefined;
}
export async function submitWithEstimatedFees(input: {
  estimate: () => Promise<{ distribution: unknown; messageAllocations?: unknown[]; feeValue: bigint }>;
  write: (fees: { distribution: unknown; messageAllocations?: unknown[]; feeValue: bigint }) => Promise<unknown>;
}) {
  const estimate = await input.estimate();
  if (estimate.feeValue <= 0n) throw new Error("The network returned a zero transaction fee estimate.");
  return input.write({ distribution: estimate.distribution, messageAllocations: estimate.messageAllocations, feeValue: estimate.feeValue });
}
export async function executeWrite(input: {
  chain: string; contract: Address; account: Address; method: string; intent: string; args: unknown[];
  preRevision: string; preHash: string; submit: () => Promise<unknown>;
  verify: (record: JournalRecord) => Promise<void>; progress: (value: Progress) => void; signal?: AbortSignal;
}) {
  const record = await reserve({ chain: input.chain, contract: input.contract, account: input.account, method: input.method,
    intent: input.intent, args_json: transportJson(input.args), pre_revision: input.preRevision, pre_hash: input.preHash });
  input.progress({ phase: "WAITING_FOR_WALLET" });
  let hash: string;
  try {
    hash = String(await input.submit());
  } catch (cause) {
    if (rejected(cause)) { await removeUnsigned(record.reservation); input.progress({ phase: "REJECTED" }); return; }
    const reverted = revertedEnvelope(cause);
    if (reverted) {
      await updateRecord(record.reservation, { tx_hash: reverted.hash, status: "FINALIZED_ERROR" });
      input.progress({ phase: "FAILED", hash: reverted.hash, message: reverted.message });
      return;
    }
    await updateRecord(record.reservation, { status: "RECONCILE" });
    input.progress({ phase: "RECONCILIATION_REQUIRED", message: "Wallet outcome is uncertain. Do not submit again." }); throw cause;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    await updateRecord(record.reservation, { status: "RECONCILE" });
    input.progress({ phase: "RECONCILIATION_REQUIRED", message: "The wallet did not return a valid transaction hash." }); return;
  }
  await updateRecord(record.reservation, { tx_hash: hash.toLowerCase(), status: "SUBMITTED" });
  input.progress({ phase: "SUBMITTED", hash });
  try {
    let transaction: unknown;
    for (const delay of FINALITY_DELAYS_MS) {
      input.progress({ phase: "WAITING_FOR_FINALITY", hash }); await wait(delay, input.signal);
      input.signal?.throwIfAborted();
      transaction = await readClient.getTransaction({ hash: hash as never });
      if (terminal(transaction)) break;
    }
    const result = classifyTransaction(transaction);
    if (result.state === "PENDING") { await updateRecord(record.reservation, { status: "RECONCILE" }); input.progress({ phase: "RECONCILIATION_REQUIRED", hash }); return; }
    input.progress({ phase: "VERIFYING_EXECUTION", hash });
    if (result.state === "FAILED") { await updateRecord(record.reservation, { status: "FINALIZED_ERROR" }); input.progress({ phase: "FAILED", hash, message: result.message }); return; }
    input.signal?.throwIfAborted();
    input.progress({ phase: "VERIFYING_READBACK", hash });
    await input.verify({ ...record, tx_hash: hash, status: "SUBMITTED" });
    input.signal?.throwIfAborted();
    invalidateRpc("write", `${input.chain}:${input.contract}:${input.method}`);
    await updateRecord(record.reservation, { status: "VERIFIED" }); input.progress({ phase: "SUCCESS", hash });
  } catch (cause) {
    await updateRecord(record.reservation, { status: "RECONCILE" });
    input.progress({ phase: "RECONCILIATION_REQUIRED", hash, message: cause instanceof Error ? cause.message : "Polling or readback stopped." });
  }
}
