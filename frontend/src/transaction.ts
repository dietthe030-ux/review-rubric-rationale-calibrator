import type { Address } from "./wallet";
import { assertSuccessful, readClient, terminal } from "./contract";
import { removeUnsigned, reserve, updateRecord, type JournalRecord } from "./journal";

export type Phase = "IDLE" | "WAITING_FOR_WALLET" | "SUBMITTED" | "WAITING_FOR_FINALITY" | "VERIFYING_EXECUTION" | "VERIFYING_READBACK" | "SUCCESS" | "REJECTED" | "FAILED" | "RECONCILIATION_REQUIRED";
export type Progress = { phase: Phase; hash?: string; message?: string };
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
    for (const delay of [2000, 4000, 8000]) {
      input.progress({ phase: "WAITING_FOR_FINALITY", hash }); await wait(delay, input.signal);
      input.signal?.throwIfAborted();
      transaction = await readClient.getTransaction({ hash: hash as never });
      if (terminal(transaction)) break;
    }
    if (!terminal(transaction)) { await updateRecord(record.reservation, { status: "RECONCILE" }); input.progress({ phase: "RECONCILIATION_REQUIRED", hash }); return; }
    input.progress({ phase: "VERIFYING_EXECUTION", hash });
    try { assertSuccessful(transaction); }
    catch (cause) { await updateRecord(record.reservation, { status: "FINALIZED_ERROR" }); input.progress({ phase: "FAILED", hash, message: cause instanceof Error ? cause.message : "Execution failed." }); return; }
    input.signal?.throwIfAborted();
    input.progress({ phase: "VERIFYING_READBACK", hash });
    await input.verify({ ...record, tx_hash: hash, status: "SUBMITTED" });
    input.signal?.throwIfAborted();
    await updateRecord(record.reservation, { status: "VERIFIED" }); input.progress({ phase: "SUCCESS", hash });
  } catch (cause) {
    await updateRecord(record.reservation, { status: "RECONCILE" });
    input.progress({ phase: "RECONCILIATION_REQUIRED", hash, message: cause instanceof Error ? cause.message : "Polling or readback stopped." });
  }
}
