import { useEffect, useMemo, useRef, useState } from "react";
import { contractAddress, chain, chainHex, explorerUrl, readCase, writeClient, type CaseRecord } from "./contract";
import { loadJournal, type JournalRecord } from "./journal";
import { deduped } from "./rpc";
import { executeWrite, type Progress } from "./transaction";
import { useProviders, useWallet, wallet } from "./wallet";

const blank: Progress = { phase: "IDLE" };
function hashText(text: string) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((b) => [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, "0")).join("")); }
function defaultRubric() { return JSON.stringify({ dimensions: [{ id: "clarity", min: 0, max: 2, anchors: [{ score: 0, text: "Unclear" }, { score: 1, text: "Partly clear" }, { score: 2, text: "Clear and specific" }] }] }, null, 2); }

export function App() {
  const providers = useProviders(); const session = useWallet();
  const [caseId, setCaseId] = useState("1"); const [record, setRecord] = useState<CaseRecord | null>(null);
  const [rubric, setRubric] = useState(defaultRubric); const [review, setReview] = useState('{"reviews":[{"dimension_id":"clarity","score":2,"rationale":"The explanation is clear and specific."}]}');
  const [reviewer, setReviewer] = useState(""); const [progress, setProgress] = useState(blank); const [error, setError] = useState("");
  const [journal, setJournal] = useState<JournalRecord[]>(() => loadJournal());
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => wallet.providers(providers), [providers]);
  useEffect(() => { session.phase === "CHOOSER_OPEN" ? dialog.current?.showModal() : dialog.current?.close(); }, [session.phase]);
  const connected = session.phase === "CONNECTED" && session.account && session.selected;
  const canWrite = Boolean(connected && contractAddress && progress.phase !== "WAITING_FOR_WALLET" && progress.phase !== "SUBMITTED" && progress.phase !== "WAITING_FOR_FINALITY");
  const role = useMemo(() => !record || !session.account ? "reader" : record.primary === session.account ? "owner" : record.secondary === session.account ? "reviewer" : "evaluator", [record, session.account]);
  async function load() { setError(""); try { setRecord(await deduped("detail", `${chain.id}:${contractAddress}:get_case:${caseId}`, () => readCase(caseId))); } catch (cause) { setError(cause instanceof Error ? cause.message : "Read failed."); } }
  async function write(method: string, args: unknown[], intent: string, expectedPhase?: string) {
    if (!connected || !contractAddress) return;
    const address = contractAddress;
    const before = record; const preRevision = before?.revision ?? "0"; const preHash = await hashText(JSON.stringify(before));
    setError("");
    try {
      const client = writeClient(session.selected!.provider, session.account!);
      await executeWrite({ chain: String(chain.id), contract: address, account: session.account!, method, intent, args, preRevision, preHash,
        submit: () => client.writeContract({ address, functionName: method, args: args as never[], value: 0n }), progress: setProgress,
        verify: async () => { const next = await readCase(method === "create_rubric" ? String(await client.readContract({ address, functionName: "get_id_by_nonce", args: [session.account!, args[0] as string] })) : caseId); if (!next) throw new Error("Expected case was not found."); if (method !== "create_rubric" && BigInt(next.revision) !== BigInt(preRevision) + 1n) throw new Error("Revision readback mismatch."); if (expectedPhase && next.phase !== expectedPhase) throw new Error("Phase readback mismatch."); setCaseId(next.id); setRecord(next); },
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Write failed."); }
    finally { setJournal(loadJournal()); }
  }
  function create() {
    const nonce = crypto.getRandomValues(new Uint8Array(16)).reduce((s, v) => s + v.toString(16).padStart(2, "0"), "");
    return write("create_rubric", [nonce, reviewer, rubric, 0n], `create:${session.account}:${nonce}`);
  }
  const active = progress.phase !== "IDLE";
  return <main>
    <header><div><span className="eyebrow">GenLayer calibration record</span><h1>Rubric Rationale Calibrator</h1></div>{connected ? <button onClick={() => wallet.disconnect()}>{session.selected!.name} · {session.account!.slice(0, 6)}…{session.account!.slice(-4)} · Disconnect</button> : session.phase === "WRONG_CHAIN" ? <button onClick={() => wallet.switchNetwork(chainHex)}>Switch network</button> : <button onClick={() => wallet.open()}>Connect wallet</button>}</header>
    <section className="hero"><h2>Does the written rationale actually support the score?</h2><p>Freeze integer anchors before review, then record an independent rationale-to-anchor consistency assessment. Submission quality and external facts are not verified.</p><div className="boundary">All submitted text is public and permanent. Do not include private information, credentials or personal records.</div></section>
    {!contractAddress && <p role="alert" className="notice">Read-only preview: configure <code>VITE_CONTRACT_ADDRESS</code> with this Task’s verified deployment before enabling chain actions.</p>}
    <section className="workspace"><aside><h2>Open a record</h2><label>Case ID<input value={caseId} onChange={(e) => setCaseId(e.target.value)} inputMode="numeric" /></label><button onClick={load} disabled={!contractAddress}>Load exact case</button><dl><dt>Wallet role</dt><dd>{role}</dd><dt>Phase</dt><dd>{record?.phase ?? "No case loaded"}</dd><dt>Revision</dt><dd>{record?.revision ?? "—"}</dd><dt>Outcome</dt><dd>{record?.outcome || "—"}</dd></dl></aside>
      <div className="actions"><h2>Role actions</h2><label>Assigned reviewer address<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="0x…" /></label><label>Rubric JSON<textarea rows={12} value={rubric} onChange={(e) => setRubric(e.target.value)} /></label><button disabled={!canWrite} onClick={create}>Create rubric</button>
      {record && <><button disabled={!canWrite || role !== "owner" || record.phase !== "BASE_DRAFT"} onClick={() => write("replace_rubric", [BigInt(caseId), rubric, BigInt(record.revision)], `replace_rubric:${caseId}:${record.revision}`, "BASE_DRAFT")}>Replace rubric</button><button disabled={!canWrite || role !== "owner" || record.phase !== "BASE_DRAFT"} onClick={() => write("lock_rubric", [BigInt(caseId), BigInt(record.revision)], `lock_rubric:${caseId}:${record.revision}`, "BASE_LOCKED")}>Lock rubric</button>
      <label>Review JSON<textarea rows={8} value={review} onChange={(e) => setReview(e.target.value)} /></label><button disabled={!canWrite || role !== "reviewer" || !["BASE_LOCKED", "RESPONSE_DRAFT"].includes(record.phase)} onClick={() => write("put_review", [BigInt(caseId), review, BigInt(record.revision)], `put_review:${caseId}:${record.revision}`, "RESPONSE_DRAFT")}>Save review</button><button disabled={!canWrite || role !== "reviewer" || record.phase !== "RESPONSE_DRAFT"} onClick={() => write("freeze_review", [BigInt(caseId), BigInt(record.revision)], `freeze_review:${caseId}:${record.revision}`, "FROZEN")}>Freeze review</button><button disabled={!canWrite || record.phase !== "FROZEN"} onClick={() => write("calibrate_review", [BigInt(caseId), BigInt(record.revision)], `calibrate_review:${caseId}:${record.revision}`)}>Calibrate rationale</button><button disabled={!canWrite || record.phase !== "UNRESOLVED"} onClick={() => write("retry_review", [BigInt(caseId), BigInt(record.revision)], `retry_review:${caseId}:${record.revision}`)}>Retry unresolved assessment</button></>}</div></section>
    {active && <section className="progress" data-transaction-phase={progress.phase} role={progress.phase === "FAILED" || progress.phase === "REJECTED" ? "alert" : "status"} aria-live="polite"><span className={["WAITING_FOR_WALLET", "SUBMITTED", "WAITING_FOR_FINALITY", "VERIFYING_EXECUTION", "VERIFYING_READBACK"].includes(progress.phase) ? "spinner" : "dot"} /><div><strong>{progress.phase.replaceAll("_", " ")}</strong>{progress.hash && <p className="hash"><code>{progress.hash}</code><button onClick={() => navigator.clipboard.writeText(progress.hash!)}>Copy hash</button>{explorerUrl && <a href={`${explorerUrl}/transactions/${progress.hash}`} target="_blank" rel="noreferrer">Open explorer</a>}</p>}<p>{progress.message}</p></div></section>}
    {error && <p role="alert" className="error">{error}</p>}
    <section id="docs"><h2>How it works</h2><ol><li>The rubric owner defines every integer anchor and locks the rubric.</li><li>The assigned reviewer submits one score and rationale per dimension, then freezes the review.</li><li>GenLayer validators independently classify rationale support for each selected anchor.</li><li>The contract stores calibrated, needs-revision, or unresolved state with exact revision history.</li></ol><p>Assessment of this exact submitted material only; not verification of external facts.</p></section>
    <section id="journal"><h2>Local transaction journal</h2><p>Latest four of {journal.length} records. Reconcile means: do not submit again until the exact transaction is checked.</p>{journal.slice(-4).reverse().map((item) => <article key={item.reservation}><strong>{item.method}</strong> · {item.status}<small>{item.tx_hash || "Awaiting wallet hash"}</small></article>)}<button disabled={!journal.length} onClick={() => { const blob = new Blob([JSON.stringify(journal, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "genlayer-transaction-journal.json"; link.click(); URL.revokeObjectURL(link.href); }}>Export journal</button></section>
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); wallet.close(); }}><h2>Select a detected wallet</h2>{providers.length === 0 ? <p>No supported wallet was detected.</p> : providers.map((option) => <button key={option.id} onClick={() => wallet.connect(option, chainHex)}>{option.name}</button>)}<button onClick={() => wallet.close()}>Cancel</button></dialog>
  </main>;
}
