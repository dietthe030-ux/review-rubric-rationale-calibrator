export type JournalStatus = "SIGNING" | "SUBMITTED" | "RECONCILE" | "FINALIZED_ERROR" | "VERIFIED";
export interface JournalRecord {
  v: 1; reservation: string; chain: string; contract: string; account: string; method: string;
  intent: string; args_json: string; pre_revision: string; pre_hash: string; tx_hash: string;
  status: JournalStatus; created_ms: string;
}
const INDEX = "glj1:index";
const LOCK = "genlayer-journal-v1";
function validate(value: unknown): value is JournalRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<JournalRecord>;
  return item.v === 1 && /^[0-9a-f]{32}$/.test(item.reservation ?? "") && /^0x[0-9a-f]{40}$/.test(item.contract ?? "") &&
    /^0x[0-9a-f]{40}$/.test(item.account ?? "") && typeof item.method === "string" && typeof item.intent === "string" &&
    typeof item.args_json === "string" && typeof item.pre_revision === "string" && /^[0-9a-f]{64}$/.test(item.pre_hash ?? "") &&
    typeof item.tx_hash === "string" && ["SIGNING", "SUBMITTED", "RECONCILE", "FINALIZED_ERROR", "VERIFIED"].includes(item.status ?? "");
}
export function loadJournal(): JournalRecord[] {
  const found: JournalRecord[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith("glj1:") || key === INDEX) continue;
    try { const value: unknown = JSON.parse(localStorage.getItem(key)!); if (!validate(value)) throw new Error(); found.push(value); }
    catch { throw new Error("Journal storage is malformed. Export and reconcile it before signing."); }
  }
  return found.sort((a, b) => Number(a.created_ms) - Number(b.created_ms));
}
function requireLock(): Navigator["locks"] {
  if (!navigator.locks || typeof localStorage === "undefined") throw new Error("Journal lock unavailable");
  return navigator.locks;
}
function saveIndex(records: JournalRecord[]) { localStorage.setItem(INDEX, JSON.stringify(records.map((r) => `glj1:${r.reservation}`))); }
function conflictKey(intent: string) {
  const [method, target] = intent.split(":");
  return method === "create" ? intent : target;
}
export async function reserve(input: Omit<JournalRecord, "v" | "reservation" | "tx_hash" | "status" | "created_ms">): Promise<JournalRecord> {
  return requireLock().request(LOCK, async () => {
    const records = loadJournal();
    if (records.length >= 32) throw new Error("Journal capacity reached");
    if (records.some((r) => r.chain === input.chain && r.contract === input.contract && conflictKey(r.intent) === conflictKey(input.intent) && !["VERIFIED", "FINALIZED_ERROR"].includes(r.status))) throw new Error("This case already has a pending write.");
    const reservation = [...crypto.getRandomValues(new Uint8Array(16))].map((v) => v.toString(16).padStart(2, "0")).join("");
    const record: JournalRecord = { v: 1, reservation, ...input, tx_hash: "", status: "SIGNING", created_ms: String(Date.now()) };
    localStorage.setItem(`glj1:${reservation}`, JSON.stringify(record));
    saveIndex([...records, record]);
    return record;
  });
}
export async function updateRecord(reservation: string, update: Partial<Pick<JournalRecord, "tx_hash" | "status">>) {
  await requireLock().request(LOCK, async () => {
    const records = loadJournal();
    const current = records.find((r) => r.reservation === reservation);
    if (!current) throw new Error("Journal reservation is missing.");
    if (current.tx_hash && update.tx_hash && current.tx_hash !== update.tx_hash) throw new Error("Transaction hash is immutable.");
    const next = { ...current, ...update };
    localStorage.setItem(`glj1:${reservation}`, JSON.stringify(next));
    saveIndex(records.map((r) => r.reservation === reservation ? next : r));
  });
}
export async function removeUnsigned(reservation: string) {
  await requireLock().request(LOCK, async () => {
    const records = loadJournal(); const current = records.find((r) => r.reservation === reservation);
    if (!current || current.tx_hash) throw new Error("Only an unsigned reservation can be removed.");
    localStorage.removeItem(`glj1:${reservation}`); saveIndex(records.filter((r) => r.reservation !== reservation));
  });
}
