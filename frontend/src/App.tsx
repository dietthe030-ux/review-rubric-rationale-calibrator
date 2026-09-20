import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { assertSuccessful, contractAddress, chain, chainHex, explorerUrl, readCase, readClient, readVersion, terminal, walletChain, type CaseRecord } from "./contract";
import { loadJournal, updateRecord, type JournalRecord } from "./journal";
import { deduped } from "./rpc";
import { createConcurrencyGate, executeWrite, type Progress } from "./transaction";
import { useProviders, useWallet, wallet, walletHeaderAction, type WalletOption } from "./wallet";

const blank: Progress = { phase: "IDLE" };
function journalSnapshot() {
  try {
    return { records: loadJournal(), error: "" };
  } catch (cause) {
    return { records: [] as JournalRecord[], error: cause instanceof Error ? cause.message : "Journal storage is unavailable." };
  }
}
function hashText(text: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((b) => [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, "0")).join(""));
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function normalizedArgs(method: string, args: unknown[]) {
  return args.map((value, index) =>
    (method === "create_rubric" && index === 2) || (method === "replace_rubric" && index === 1) || (method === "put_review" && index === 1)
      ? JSON.parse(String(value))
      : typeof value === "bigint"
        ? value.toString()
        : typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
          ? value.toLowerCase()
          : value
  );
}
type DimensionDraft = { id: string; min: number; max: number; anchors: Record<number, string> };
const initialDimensions: DimensionDraft[] = [{ id: "clarity", min: 0, max: 2, anchors: { 0: "Unclear", 1: "Partly clear", 2: "Clear and specific" } }];

export function WalletAction({ phase, name, account, onDisconnect, onSwitch, onConnect }: { phase: "CONNECTED" | "WRONG_CHAIN" | "CONNECT"; name?: string; account?: string; onDisconnect: () => void; onSwitch: () => void; onConnect: () => void }) {
  if (phase === "CONNECTED") return <button className="wallet-button connected" onClick={onDisconnect} title={`Connected as ${account}`}><span className="wallet-name-badge">{name}</span><span className="account-address">{account?.slice(0, 6)}…{account?.slice(-4)}</span><span className="disconnect-affordance">Disconnect</span></button>;
  if (phase === "WRONG_CHAIN") return <button className="wallet-button warning" onClick={onSwitch}>Switch network</button>;
  return <button className="wallet-button primary" onClick={onConnect}>Connect wallet</button>;
}

function humanOutcome(outcome?: string): string {
  if (!outcome) return "—";
  if (outcome === "CALIBRATED") return "Rationale matches the selected rubric anchors";
  if (outcome === "RATIONALE_SCORE_CONFLICT" || outcome === "ANCHOR_MISSING") return "Review needs revision";
  return "Unresolved";
}

function BrandMark() {
  return (
    <svg className="brand-mark" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="6" x2="9" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="9" y1="14" x2="16" y2="14" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="20" x2="13" y2="20" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="19.5" cy="14" r="2.5" fill="var(--color-accent)" />
    </svg>
  );
}

function WalletIcon({ id }: { id: string }) {
  if (id === "metamask") {
    return (
      <svg className="wallet-card-icon" width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M27.2 5.5L17.5 12.6L19.4 8.2L27.2 5.5Z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.8 5.5L12.5 12.7L10.6 8.2L4.8 5.5Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23.5 21.6L20.8 25.8L26.5 27.4L28.1 21.7L23.5 21.6Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.9 21.7L5.5 27.4L11.2 25.8L8.5 21.6L3.9 21.7Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.9 14.2L9.3 16.7L15 16.9L14.8 10.8L10.9 14.2Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21.1 14.2L17.1 10.7L16.9 16.9L22.7 16.7L21.1 14.2Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.2 25.8L14.5 24.2L11.7 21.8L11.2 25.8Z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20.8 25.8L20.3 21.8L17.5 24.2L20.8 25.8Z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 24.2L11.2 25.8L12.2 29.1L15.9 29.1L16 23.3L14.5 24.2Z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17.5 24.2L16 23.3L16.1 29.1L19.8 29.1L20.8 25.8L17.5 24.2Z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "okx") {
    return (
      <svg className="wallet-card-icon" width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#000000" />
        <rect x="7" y="7" width="5.5" height="5.5" fill="#FFFFFF" />
        <rect x="19.5" y="7" width="5.5" height="5.5" fill="#FFFFFF" />
        <rect x="13.25" y="13.25" width="5.5" height="5.5" fill="#FFFFFF" />
        <rect x="7" y="19.5" width="5.5" height="5.5" fill="#FFFFFF" />
        <rect x="19.5" y="19.5" width="5.5" height="5.5" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg className="wallet-card-icon" width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#7084FF" />
      <path d="M8 20C8 14 11 11 16 11C21 11 24 14 24 20C24 22 22 23 20 23C18.5 23 17.5 22.5 16 21.5C14.5 22.5 13.5 23 12 23C10 23 8 22 8 20Z" fill="#FFFFFF" />
      <circle cx="13" cy="16" r="1.5" fill="#7084FF" />
      <circle cx="19" cy="16" r="1.5" fill="#7084FF" />
      <path d="M12 11C11 7 13 6 14 7C15 8 14.5 10 14 11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 11C21 7 19 6 18 7C17 8 17.5 10 18 11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function App() {
  const initialJournal = useMemo(journalSnapshot, []);
  const providers = useProviders();
  const session = useWallet();
  const [caseId, setCaseId] = useState("1");
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [dimensions, setDimensions] = useState<DimensionDraft[]>(initialDimensions);
  const [reviews, setReviews] = useState<Record<string, { score: number; rationale: string }>>({});
  const [reviewer, setReviewer] = useState("");
  const [progress, setProgress] = useState(blank);
  const [error, setError] = useState(initialJournal.error);
  const [journal, setJournal] = useState<JournalRecord[]>(initialJournal.records);
  const [visible, setVisible] = useState(document.visibilityState !== "hidden");
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef(new AbortController());
  const reconciliations = useRef(createConcurrencyGate(2));

  useEffect(() => wallet.providers(providers), [providers]);
  useEffect(() => {
    session.phase === "CHOOSER_OPEN" ? dialog.current?.showModal() : dialog.current?.close();
  }, [session.phase]);
  useLayoutEffect(() => {
    operation.current.abort();
    operation.current = new AbortController();
    if (!visible || session.phase !== "CONNECTED") operation.current.abort();
    return () => operation.current.abort();
  }, [visible, session.phase, session.account, session.selected]);
  useEffect(() => {
    const change = () => {
      const next = document.visibilityState !== "hidden";
      setVisible(next);
      if (!next) operation.current.abort();
    };
    document.addEventListener("visibilitychange", change);
    return () => { document.removeEventListener("visibilitychange", change); operation.current.abort(); };
  }, []);

  const connected = session.phase === "CONNECTED" && session.account && session.selected && session.writeClient;
  const canWrite = Boolean(
    connected &&
      contractAddress &&
      navigator.locks &&
      visible &&
      !initialJournal.error &&
      !["WAITING_FOR_WALLET", "SUBMITTED", "WAITING_FOR_FINALITY", "VERIFYING_EXECUTION", "VERIFYING_READBACK"].includes(progress.phase)
  );

  const role = useMemo(
    () => (!record || !session.account ? "reader" : record.primary === session.account ? "owner" : record.secondary === session.account ? "reviewer" : "evaluator"),
    [record, session.account]
  );

  const rubric = useMemo(
    () =>
      JSON.stringify({
        dimensions: dimensions.map((item) => ({
          id: item.id,
          min: item.min,
          max: item.max,
          anchors: Array.from({ length: item.max - item.min + 1 }, (_, offset) => ({ score: item.min + offset, text: item.anchors[item.min + offset] ?? "" })),
        })),
      }),
    [dimensions]
  );

  const review = useMemo(
    () =>
      JSON.stringify({
        reviews: (record?.base.dimensions ?? []).map((item) => ({
          dimension_id: item.id,
          score: reviews[item.id]?.score ?? item.min,
          rationale: reviews[item.id]?.rationale ?? ""
        })),
      }),
    [record, reviews]
  );

  function showRecord(next: CaseRecord) {
    setRecord(next);
    setDimensions(
      next.base.dimensions.map((item) => ({
        id: item.id,
        min: item.min,
        max: item.max,
        anchors: Object.fromEntries(item.anchors.map((anchor) => [anchor.score, anchor.text])),
      }))
    );
    setReviews(Object.fromEntries((next.response.reviews ?? []).map((item) => [item.dimension_id, { score: item.score, rationale: item.rationale }])));
  }

  async function load() {
    setError("");
    try {
      const next = await deduped("detail", `${chain.id}:${contractAddress}:get_case:${caseId}`, () => readCase(caseId));
      next ? showRecord(next) : setRecord(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Read failed.");
    }
  }

  async function write(method: string, args: unknown[], intent: string, expectedPhase?: string) {
    if (!connected || !contractAddress) return;
    const address = contractAddress;
    const before = record;
    const preRevision = before?.revision ?? "0";
    const preHash = await hashText(JSON.stringify(before));
    setError("");
    try {
      const client = session.writeClient!;
      await executeWrite({
        chain: String(chain.id),
        contract: address,
        account: session.account!,
        method,
        intent,
        args,
        preRevision,
        preHash,
        submit: () => client.writeContract({ address, functionName: method, args: args as never[], value: 0n }),
        progress: setProgress,
        verify: async () => {
          const id = method === "create_rubric" ? String(await client.readContract({ address, functionName: "get_id_by_nonce", args: [session.account!, args[0] as string] })) : caseId;
          const revision = method === "create_rubric" ? "1" : String(BigInt(preRevision) + 1n);
          const next = await readVersion(id, revision);
          if (!next) throw new Error("Expected historical revision was not found.");
          const argsHash = await hashText(canonical(normalizedArgs(method, args)));
          if (next.last_operation.method !== method || next.last_operation.caller !== session.account || next.last_operation.args_hash !== argsHash)
            throw new Error("Authoritative operation readback mismatch.");
          if (expectedPhase && next.phase !== expectedPhase) throw new Error("Phase readback mismatch.");
          setCaseId(next.id);
          showRecord(next);
        },
        signal: operation.current.signal,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Write failed.");
    } finally {
      const snapshot = journalSnapshot();
      setJournal(snapshot.records);
      if (snapshot.error) setError(snapshot.error);
    }
  }

  async function reconcile(item: JournalRecord) {
    const leave = reconciliations.current.tryEnter();
    if (!leave) { setError("At most two journal reconciliations can run at once."); return; }
    const signal = operation.current.signal;
    if (!item.tx_hash) {
      setError("No transaction hash is available. Check wallet history; this attempt cannot be resubmitted automatically.");
      leave();
      return;
    }
    setProgress({ phase: "VERIFYING_EXECUTION", hash: item.tx_hash });
    setError("");
    try {
      signal.throwIfAborted();
      const transaction = await readClient.getTransaction({ hash: item.tx_hash as never });
      signal.throwIfAborted();
      if (!terminal(transaction)) {
        setProgress({ phase: "RECONCILIATION_REQUIRED", hash: item.tx_hash, message: "The exact transaction is not finalized yet." });
        return;
      }
      assertSuccessful(transaction);
      setProgress({ phase: "VERIFYING_READBACK", hash: item.tx_hash });
      const args = JSON.parse(item.args_json) as unknown[];
      const id =
        item.method === "create_rubric"
          ? String(await readClient.readContract({ address: item.contract as `0x${string}`, functionName: "get_id_by_nonce", args: [item.account as `0x${string}`, args[0] as string] }))
          : item.intent.split(":")[1];
      const revision = item.method === "create_rubric" ? "1" : String(BigInt(item.pre_revision) + 1n);
      const next = await readVersion(id, revision);
      signal.throwIfAborted();
      if (!next || next.last_operation.method !== item.method || next.last_operation.caller !== item.account || next.last_operation.args_hash !== (await hashText(canonical(normalizedArgs(item.method, args)))))
        throw new Error("Authoritative historical readback mismatch.");
      await updateRecord(item.reservation, { status: "VERIFIED" });
      showRecord(next);
      setCaseId(next.id);
      setProgress({ phase: "SUCCESS", hash: item.tx_hash });
      setJournal(loadJournal());
    } catch (cause) {
      await updateRecord(item.reservation, { status: "RECONCILE" });
      setProgress({ phase: "RECONCILIATION_REQUIRED", hash: item.tx_hash });
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Reconciliation failed.");
    } finally { leave(); }
  }

  function create() {
    const nonce = crypto.getRandomValues(new Uint8Array(16)).reduce((s, v) => s + v.toString(16).padStart(2, "0"), "");
    return write("create_rubric", [nonce, reviewer, rubric, 0n], `create:${session.account}:${nonce}`);
  }

  const active = progress.phase !== "IDLE";
  const isPending = ["WAITING_FOR_WALLET", "SUBMITTED", "WAITING_FOR_FINALITY", "VERIFYING_EXECUTION", "VERIFYING_READBACK"].includes(progress.phase);

  return (
    <div className="instrument-shell">
      {/* Navigation (Archetype N1b hybrid · SaaS three-section instrument header) */}
      <header className="instrument-header" role="banner">
        <div className="header-brand-group">
          <BrandMark />
          <div className="brand-text-block">
            <span className="brand-eyebrow">GenLayer Studio Next · Contract Calibrator</span>
            <h1 className="brand-title">Rubric Rationale Calibrator</h1>
          </div>
        </div>

        <nav className="header-nav-links" aria-label="Section navigation">
          <a href="#workspace" className="nav-anchor">Workspace</a>
          <a href="#journal" className="nav-anchor">Evidence Journal</a>
          <a href="#docs" className="nav-anchor">How it works</a>
        </nav>

        <div className="header-action-group">
          <div className="chain-pill" title="GenLayer Studio Next">
            <span className="chain-name">{chain.name}</span>
          </div>

          <WalletAction phase={walletHeaderAction(session.phase)} name={session.selected?.name} account={session.account} onDisconnect={() => wallet.disconnect()} onSwitch={() => wallet.switchNetwork(walletChain)} onConnect={() => wallet.open()} />
        </div>
      </header>

      <main className="instrument-main" id="main-content">
        {/* Introduction & Public Boundary (Narrative Workflow 14 Opening) */}
        <section className="hero-boundary-section" aria-labelledby="hero-heading">
          <div className="hero-content">
            <h2 id="hero-heading" className="hero-headline">Does the written rationale actually support the score?</h2>
            <p className="hero-lede">
              Freeze integer anchors before review, then record an independent rationale-to-anchor consistency assessment.
              Submission quality and external facts are not verified.
            </p>
          </div>

          <div className="boundary-warning-callout" role="note">
            <div className="callout-icon" aria-hidden="true">§</div>
            <div className="callout-text">
              <strong>Mandatory public data warning:</strong> All submitted text will be public and permanent.
              Do not include private information, credentials or personal records.
            </div>
          </div>
        </section>

        {!contractAddress && (
          <aside role="alert" className="notice-banner">
            <span className="notice-badge">Read-only preview</span>
            <span>Configure <code>VITE_CONTRACT_ADDRESS</code> with this Task’s verified deployment before enabling chain actions.</span>
          </aside>
        )}

        {/* Primary Case Inspector & Workspace */}
        <div className="workspace-layout" id="workspace">
          {/* Case Inspector Sidebar (Inspection before Action) */}
          <aside className="case-inspector-pane" aria-labelledby="case-inspector-title">
            <div className="pane-header">
              <span className="pane-kicker">00 · Inspection</span>
              <h2 id="case-inspector-title" className="pane-title">Open a record</h2>
            </div>

            <div className="case-lookup-controls">
              <label htmlFor="case-id-input" className="field-label">
                Case ID
              </label>
              <div className="lookup-input-cluster">
                <input
                  id="case-id-input"
                  className="instrument-input"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  inputMode="numeric"
                  placeholder="1"
                />
                <button className="action-button primary" onClick={load} disabled={!contractAddress}>
                  Load exact case
                </button>
              </div>
            </div>

            <div className="case-status-spec-sheet">
              <h3 className="spec-sheet-heading">Authoritative Status</h3>
              <dl className="spec-dl">
                <div className="spec-row">
                  <dt>Wallet role</dt>
                  <dd><span className={`role-badge role-${role}`}>{role}</span></dd>
                </div>
                <div className="spec-row">
                  <dt>Phase</dt>
                  <dd>
                    <span className={`phase-badge ${record?.phase ? `phase-${record.phase.toLowerCase()}` : "phase-none"}`}>
                      {record?.phase ?? "No case loaded"}
                    </span>
                  </dd>
                </div>
                <div className="spec-row">
                  <dt>Revision</dt>
                  <dd><code className="tabular-code">{record?.revision ?? "—"}</code></dd>
                </div>
                <div className="spec-row spec-verdict-row">
                  <dt>Public verdict</dt>
                  <dd>
                    {record?.outcome ? (
                      <span className={`verdict-badge verdict-${record.outcome.toLowerCase()}`}>
                        {humanOutcome(record.outcome)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </dd>
                </div>
                <div className="spec-row spec-technical-row">
                  <dt>Contract outcome</dt>
                  <dd>
                    {record?.outcome ? (
                      <code className="tabular-code">{record.outcome}</code>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </dd>
                </div>
                {record && (
                  <>
                    <div className="spec-row">
                      <dt>Primary (Owner)</dt>
                      <dd><code className="tabular-address" title={record.primary}>{record.primary.slice(0, 6)}…{record.primary.slice(-4)}</code></dd>
                    </div>
                    <div className="spec-row">
                      <dt>Secondary (Reviewer)</dt>
                      <dd><code className="tabular-address" title={record.secondary}>{record.secondary.slice(0, 6)}…{record.secondary.slice(-4)}</code></dd>
                    </div>
                    <div className="spec-row">
                      <dt>Accepted attempts</dt>
                      <dd><code className="tabular-code">{record.accepted_attempts}</code></dd>
                    </div>
                  </>
                )}
              </dl>
            </div>
          </aside>

          {/* Workflow Workspace (Role Actions) */}
          <section className="workflow-actions-pane" aria-labelledby="workflow-actions-title">
            <div className="pane-header">
              <span className="pane-kicker">Stage Actions</span>
              <h2 id="workflow-actions-title" className="pane-title">Role actions</h2>
            </div>

            {/* Stage 1 · Owner Rubric Configuration */}
            <div className="stage-block stage-owner">
              <div className="stage-header">
                <span className="stage-number">Stage 1.0</span>
                <h3 className="stage-title">Rubric Definition & Anchor Locking (Owner)</h3>
              </div>

              <div className="field-group">
                <label htmlFor="reviewer-input" className="field-label">
                  Assigned reviewer address
                </label>
                <input
                  id="reviewer-input"
                  name="reviewer"
                  className="instrument-input font-mono"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                />
              </div>

              <fieldset className="rubric-fieldset">
                <legend className="fieldset-legend">Rubric dimensions and complete integer anchors</legend>
                <p className="fieldset-helper-text">
                  Define 1 to 4 dimensions. Integer interval must satisfy 0 &lt;= max - min &lt;= 10, with all integer scores mapped to an anchor text.
                </p>

                <div className="dimensions-list">
                  {dimensions.map((item, dimensionIndex) => (
                    <div className="dimension-spec-card" key={dimensionIndex}>
                      <div className="dimension-card-header">
                        <span className="dimension-index-tag">Dimension {dimensionIndex + 1}</span>
                        {dimensions.length > 1 && (
                          <button
                            type="button"
                            className="text-action-button danger"
                            onClick={() => setDimensions((all) => all.filter((_, index) => index !== dimensionIndex))}
                          >
                            Remove dimension
                          </button>
                        )}
                      </div>

                      <div className="dimension-inputs-grid">
                        <div className="field-group">
                          <label htmlFor={`dim-id-${dimensionIndex}`} className="field-label">Dimension ID</label>
                          <input
                            id={`dim-id-${dimensionIndex}`}
                            name={`dimension-${dimensionIndex}`}
                            className="instrument-input"
                            value={item.id}
                            placeholder="e.g. clarity, evidence, rigor"
                            onChange={(e) =>
                              setDimensions((all) =>
                                all.map((value, index) => (index === dimensionIndex ? { ...value, id: e.target.value } : value))
                              )
                            }
                          />
                        </div>

                        <div className="range-bounds-cluster">
                          <div className="field-group">
                            <label htmlFor={`dim-min-${dimensionIndex}`} className="field-label">Minimum</label>
                            <input
                              id={`dim-min-${dimensionIndex}`}
                              type="number"
                              min="-100"
                              max="100"
                              className="instrument-input font-mono"
                              value={item.min}
                              onChange={(e) =>
                                setDimensions((all) =>
                                  all.map((value, index) => (index === dimensionIndex ? { ...value, min: Number(e.target.value) } : value))
                                )
                              }
                            />
                          </div>
                          <div className="field-group">
                            <label htmlFor={`dim-max-${dimensionIndex}`} className="field-label">Maximum</label>
                            <input
                              id={`dim-max-${dimensionIndex}`}
                              type="number"
                              min="-100"
                              max="100"
                              className="instrument-input font-mono"
                              value={item.max}
                              onChange={(e) =>
                                setDimensions((all) =>
                                  all.map((value, index) => (index === dimensionIndex ? { ...value, max: Number(e.target.value) } : value))
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {item.max >= item.min && item.max - item.min <= 10 && (
                        <div className="anchors-grid">
                          <span className="anchors-subheading">Complete Integer Anchors</span>
                          {Array.from({ length: item.max - item.min + 1 }, (_, offset) => item.min + offset).map((score) => (
                            <label key={score} className="anchor-entry-row">
                              <span className="anchor-score-chip">{score}</span>
                              <input
                                name={`anchor-${dimensionIndex}-${score}`}
                                className="instrument-input anchor-text-input"
                                value={item.anchors[score] ?? ""}
                                maxLength={96}
                                placeholder={`Anchor definition for score ${score}`}
                                onChange={(e) =>
                                  setDimensions((all) =>
                                    all.map((value, index) =>
                                      index === dimensionIndex ? { ...value, anchors: { ...value.anchors, [score]: e.target.value } } : value
                                    )
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rubric-card-actions">
                  <button
                    type="button"
                    className="action-button secondary"
                    disabled={dimensions.length >= 4}
                    onClick={() => setDimensions((all) => [...all, { id: "", min: 0, max: 2, anchors: {} }])}
                  >
                    Add dimension
                  </button>
                </div>
              </fieldset>

              <div className="stage-button-row">
                <button className="action-button primary" disabled={!canWrite} onClick={create}>
                  Create rubric
                </button>
                {record && (
                  <>
                    <button
                      className="action-button secondary"
                      disabled={!canWrite || role !== "owner" || record.phase !== "BASE_DRAFT"}
                      onClick={() =>
                        write("replace_rubric", [BigInt(caseId), rubric, BigInt(record.revision)], `replace_rubric:${caseId}:${record.revision}`, "BASE_DRAFT")
                      }
                    >
                      Replace rubric
                    </button>
                    <button
                      className="action-button accent"
                      disabled={!canWrite || role !== "owner" || record.phase !== "BASE_DRAFT"}
                      onClick={() =>
                        write("lock_rubric", [BigInt(caseId), BigInt(record.revision)], `lock_rubric:${caseId}:${record.revision}`, "BASE_LOCKED")
                      }
                    >
                      Lock rubric
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stage 2 · Reviewer Score & Rationale Submission */}
            {record && (
              <div className="stage-block stage-reviewer">
                <div className="stage-header">
                  <span className="stage-number">Stage 2.0</span>
                  <h3 className="stage-title">Reviewer Scores and Separate Rationales (Reviewer)</h3>
                </div>

                <fieldset className="review-fieldset">
                  <legend className="fieldset-legend">Reviewer scores and separate rationales</legend>
                  <p className="fieldset-helper-text">
                    Select exactly one integer score corresponding to a locked anchor, and supply a rationale (up to 768 characters).
                  </p>

                  <div className="review-dimensions-list">
                    {record.base.dimensions.map((item) => (
                      <div className="review-dimension-card" key={item.id}>
                        <div className="review-dimension-header">
                          <span className="review-dim-name">{item.id}</span>
                          <span className="review-dim-range">[{item.min} … {item.max}]</span>
                        </div>

                        <div className="field-group">
                          <label htmlFor={`score-${item.id}`} className="field-label">
                            {item.id} score
                          </label>
                          <select
                            id={`score-${item.id}`}
                            className="instrument-select"
                            value={reviews[item.id]?.score ?? item.min}
                            onChange={(e) =>
                              setReviews((all) => ({
                                ...all,
                                [item.id]: { score: Number(e.target.value), rationale: all[item.id]?.rationale ?? "" },
                              }))
                            }
                          >
                            {item.anchors.map((anchor) => (
                              <option key={anchor.score} value={anchor.score}>
                                {anchor.score} — {anchor.text}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field-group">
                          <label htmlFor={`rationale-${item.id}`} className="field-label">
                            {item.id} rationale
                          </label>
                          <textarea
                            id={`rationale-${item.id}`}
                            className="instrument-textarea font-mono"
                            rows={4}
                            maxLength={768}
                            placeholder="State rationale explaining why this score was selected according to the anchor definition…"
                            value={reviews[item.id]?.rationale ?? ""}
                            onChange={(e) =>
                              setReviews((all) => ({
                                ...all,
                                [item.id]: { score: all[item.id]?.score ?? item.min, rationale: e.target.value },
                              }))
                            }
                          />
                          <div className="textarea-footer">
                            <span className="char-count">
                              {(reviews[item.id]?.rationale ?? "").length} / 768 chars
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <div className="stage-button-row">
                  <button
                    className="action-button secondary"
                    disabled={!canWrite || role !== "reviewer" || !["BASE_LOCKED", "RESPONSE_DRAFT"].includes(record.phase)}
                    onClick={() =>
                      write("put_review", [BigInt(caseId), review, BigInt(record.revision)], `put_review:${caseId}:${record.revision}`, "RESPONSE_DRAFT")
                    }
                  >
                    Save review
                  </button>
                  <button
                    className="action-button accent"
                    disabled={!canWrite || role !== "reviewer" || record.phase !== "RESPONSE_DRAFT"}
                    onClick={() =>
                      write("freeze_review", [BigInt(caseId), BigInt(record.revision)], `freeze_review:${caseId}:${record.revision}`, "FROZEN")
                    }
                  >
                    Freeze review
                  </button>
                </div>
              </div>
            )}

            {/* Stage 3 · Validator Calibration & Consensus */}
            {record && (
              <div className="stage-block stage-calibration">
                <div className="stage-header">
                  <span className="stage-number">Stage 3.0</span>
                  <h3 className="stage-title">Validator Consensus Calibration (Any Caller)</h3>
                </div>
                <p className="stage-description">
                  Once frozen, GenLayer validators independently classify whether the written rationale supports the selected frozen anchor, supports another anchor, omits anchor-linked reasoning, or is ambiguous.
                </p>

                <div className="stage-button-row">
                  <button
                    className="action-button primary"
                    disabled={!canWrite || record.phase !== "FROZEN"}
                    onClick={() =>
                      write("calibrate_review", [BigInt(caseId), BigInt(record.revision)], `calibrate_review:${caseId}:${record.revision}`)
                    }
                  >
                    Calibrate rationale
                  </button>
                  <button
                    className="action-button secondary"
                    disabled={!canWrite || record.phase !== "UNRESOLVED"}
                    onClick={() =>
                      write("retry_review", [BigInt(caseId), BigInt(record.revision)], `retry_review:${caseId}:${record.revision}`)
                    }
                  >
                    Retry unresolved assessment
                  </button>
                </div>

                {record.result?.labels && record.result.labels.length > 0 && (
                  <div className="calibration-result-block">
                    <div className="calibration-result-header">
                      <div className="calibration-result-title-group">
                        <span className="pane-kicker">Calibration Vector</span>
                        <h4 className="calibration-table-title">Observed validator classifications</h4>
                      </div>
                      <div className="calibration-verdict-banner">
                        <span className="verdict-banner-lead">Consensus verdict:</span>{" "}
                        <strong className="verdict-banner-phrase">{humanOutcome(record.outcome)}</strong>
                        <span className="verdict-banner-technical"> (Contract outcome: <code>{record.outcome}</code>)</span>
                      </div>
                    </div>

                    <div className="table-responsive-container">
                      <table className="calibration-spec-table">
                        <thead>
                          <tr>
                            <th scope="col">Dimension ID</th>
                            <th scope="col">Selected score</th>
                            <th scope="col">Selected anchor text</th>
                            <th scope="col">Reviewer rationale</th>
                            <th scope="col">Validator classification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {record.base.dimensions.map((dim, idx) => {
                            const rev = record.response?.reviews?.find((r) => r.dimension_id === dim.id) ?? record.response?.reviews?.[idx];
                            const anchor = dim.anchors.find((a) => a.score === rev?.score);
                            const label = record.result.labels?.[idx] ?? "—";
                            return (
                              <tr key={dim.id || idx}>
                                <td className="cell-dim-id"><code>{dim.id}</code></td>
                                <td className="cell-score"><code>{rev?.score !== undefined ? rev.score : "—"}</code></td>
                                <td className="cell-anchor">{anchor?.text ?? "—"}</td>
                                <td className="cell-rationale">{rev?.rationale ?? "—"}</td>
                                <td className="cell-label">
                                  <span className={`label-badge label-${label.toLowerCase()}`}>
                                    {label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="table-disclaimer-note">
                      Assessment of this exact submitted material only; not verification of external facts.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Live Transaction Evidence Tracker */}
        {active && (
          <section
            className={`progress-panel ${isPending ? "is-pending" : "is-terminal"}`}
            data-transaction-phase={progress.phase}
            role={progress.phase === "FAILED" || progress.phase === "REJECTED" ? "alert" : "status"}
            aria-live="polite"
          >
            <div className="progress-indicator-col">
              <span className={isPending ? "spinner" : "dot"} aria-hidden="true" />
            </div>
            <div className="progress-details-col">
              <div className="progress-title-row">
                <span className="progress-eyebrow">Transaction Lifecycle</span>
                <strong className="progress-phase-title">{progress.phase.replaceAll("_", " ")}</strong>
              </div>

              {progress.hash && (
                <div className="hash-evidence-box">
                  <code className="tx-hash-display">{progress.hash}</code>
                  <div className="hash-actions-row">
                    <button className="text-action-button" onClick={() => navigator.clipboard.writeText(progress.hash!)}>
                      Copy hash
                    </button>
                    {explorerUrl && (
                      <a className="explorer-link" href={`${explorerUrl}/transactions/${progress.hash}`} target="_blank" rel="noreferrer">
                        Open explorer ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {progress.message && <p className="progress-message-text">{progress.message}</p>}
            </div>
          </section>
        )}

        {/* Error Alert */}
        {error && (
          <div role="alert" className="error-banner">
            <span className="error-icon" aria-hidden="true">⚠</span>
            <div className="error-content">
              <strong>Execution Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Local Transaction Journal Ledger */}
        <section className="evidence-journal-section" id="journal" aria-labelledby="journal-heading">
          <div className="section-head-stack">
            <span className="section-kicker">Durable Ledger</span>
            <h2 id="journal-heading" className="section-title">Local transaction journal</h2>
          </div>

          <p className="journal-subtitle">
            Latest four of {journal.length} records. Reconcile means: do not submit again until the exact transaction is checked.
          </p>

          <div className="journal-records-list">
            {journal.length === 0 ? (
              <div className="journal-empty-slate">No transactions recorded in this browser session.</div>
            ) : (
              journal.slice(-4).reverse().map((item) => (
                <article className="journal-record-card" key={item.reservation}>
                  <div className="record-header">
                    <strong className="record-method">{item.method}</strong>
                    <span className={`record-status-pill status-${item.status.toLowerCase()}`}>{item.status}</span>
                  </div>
                  <div className="record-hash-row">
                    <span className="record-hash-label">Tx Hash:</span>
                    <small className="record-hash-code">{item.tx_hash || "Awaiting wallet hash"}</small>
                  </div>
                  {!["VERIFIED", "FINALIZED_ERROR"].includes(item.status) && (
                    <div className="record-action-row">
                      <button
                        className="action-button secondary compact"
                        disabled={item.chain !== String(chain.id) || item.contract !== contractAddress || item.account !== session.account}
                        onClick={() => reconcile(item)}
                      >
                        Resume exact transaction
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>

          <div className="journal-footer-actions">
            <button
              className="action-button secondary"
              disabled={!journal.length}
              onClick={() => {
                const blob = new Blob([JSON.stringify(journal, null, 2)], { type: "application/json" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "genlayer-transaction-journal.json";
                link.click();
                URL.revokeObjectURL(link.href);
              }}
            >
              Export journal
            </button>
          </div>
        </section>

        {/* Documentation / How It Works (Educational & Governance Reference) */}
        <section className="documentation-section" id="docs" aria-labelledby="docs-heading">
          <div className="section-head-stack">
            <span className="section-kicker">System Architecture</span>
            <h2 id="docs-heading" className="section-title">How it works</h2>
          </div>

          <ol className="workflow-steps-numbered">
            <li className="workflow-step-item">
              <strong>1. Rubric Definition & Anchor Locking</strong>
              <p>The rubric owner defines every integer anchor across 1 to 4 dimensions, sets complete definitions for each integer score, assigns a reviewer address, and locks the rubric into an immutable baseline.</p>
            </li>
            <li className="workflow-step-item">
              <strong>2. Review Submission & Freezing</strong>
              <p>The assigned reviewer submits exactly one score and separate rationale per dimension within the defined bounds, then freezes the review to seal the response for validator evaluation.</p>
            </li>
            <li className="workflow-step-item">
              <strong>3. Validator Consensus Calibration</strong>
              <p>GenLayer validators independently classify whether the written rationale supports the selected frozen anchor, supports another anchor, omits anchor-linked reasoning, or is ambiguous. Model and consensus liveness are not guaranteed, and unresolved classifications may require the bounded retry.</p>
            </li>
            <li className="workflow-step-item">
              <strong>4. Readback & Stored Operation Verification</strong>
              <p>The contract stores the consensus classification with exact revision history. Historical get_version readback verifies the expected stored operation and postcondition after transaction finality and semantic execution checks succeed; readback does not itself confirm finality and is not a cryptographic execution proof.</p>
            </li>
          </ol>

          <div className="docs-spec-details">
            <h3 className="details-subheading">Public Consensus Classification Vectors</h3>
            <p>GenLayer validators categorize each rationale into one of four mutually exclusive classifications:</p>
            <ul className="classification-list">
              <li><code>SUPPORTS_SELECTED</code> — The rationale directly provides evidence and reasoning supporting the selected anchor.</li>
              <li><code>SUPPORTS_OTHER</code> — The rationale describes characteristics belonging to a different anchor in the same dimension.</li>
              <li><code>MISSING_ANCHOR_REASON</code> — The text contains general remarks but omits anchor-linked reasoning.</li>
              <li><code>UNKNOWN</code> — The rationale is ambiguous or unclassifiable by consensus.</li>
            </ul>

            <h3 className="details-subheading">Precedence Reducer Outcomes</h3>
            <ul className="outcomes-list">
              <li><strong>CALIBRATED</strong>: All dimensions classified as <code>SUPPORTS_SELECTED</code>.</li>
              <li><strong>RATIONALE_SCORE_CONFLICT</strong>: At least one dimension classified as <code>SUPPORTS_OTHER</code> (review needs revision).</li>
              <li><strong>ANCHOR_MISSING</strong>: At least one dimension classified as <code>MISSING_ANCHOR_REASON</code> without conflict (review needs revision).</li>
              <li><strong>UNRESOLVED</strong>: At least one dimension classified as <code>UNKNOWN</code> (assessment eligible for retry).</li>
            </ul>
          </div>

          <div className="mandatory-boundaries-box">
            <p className="exact-limitation-statement">Assessment of this exact submitted material only; not verification of external facts.</p>
            <p className="exact-disclaimer-statement">All submitted text will be public and permanent. Do not include private information, credentials or personal records.</p>
          </div>
        </section>
      </main>

      {/* Footer (Archetype Ft4 · Dense Typographic Colophon) */}
      <footer className="instrument-colophon" role="contentinfo">
        <div className="colophon-grid">
          <div className="colophon-block brand-col">
            <div className="colophon-brand">
              <BrandMark />
              <span className="colophon-wordmark">Rubric Rationale Calibrator</span>
            </div>
            <p className="colophon-description">
              A public consistency instrument on GenLayer Studio Next. Records independent validator classifications of written rationales against rubric anchors. The product records an agreed classification but does not guarantee the underlying score or rationale is correct.
            </p>
          </div>

          <div className="colophon-block spec-col">
            <h4 className="colophon-heading">Execution Invariants</h4>
            <ul className="colophon-list">
              <li>Network: GenLayer Studio Next</li>
              <li>Finality: Operations remain pending until network confirmation.</li>
              <li>Execution: Results appear only after confirmed execution.</li>
              <li>Record: The final result is checked against the submitted version.</li>
              <li>Recovery: Unfinished operations remain available for reconciliation.</li>
            </ul>
          </div>

          <div className="colophon-block boundary-col">
            <h4 className="colophon-heading">Public Disclosures</h4>
            <p className="colophon-disclaimer">
              The intelligent contract never verifies submission quality, objective truth, reviewer competence, or external facts. It never rewrites submitted scores.
            </p>
            <p className="colophon-copy">
              Assessment of this exact submitted material only; not verification of external facts.
            </p>
          </div>
        </div>
      </footer>

      {/* Wallet Selector Dialog (Strict Detected Cardinality: MetaMask, OKX Wallet, Rabby) */}
      <dialog
        ref={dialog}
        className="wallet-picker-dialog"
        onCancel={(e) => {
          e.preventDefault();
          wallet.close();
        }}
      >
        <div className="dialog-content-wrapper">
          <div className="dialog-header-row">
            <h2 className="dialog-title">Select a detected wallet</h2>
            <button
              type="button"
              className="dialog-close-button"
              aria-label="Close wallet selection dialog"
              onClick={() => wallet.close()}
            >
              ✕
            </button>
          </div>

          <p className="dialog-helper-text">Choose a wallet to continue.</p>

          <div className="wallet-options-list">
            {providers.length === 0 ? (
              <div className="zero-providers-card" role="status">
                <span className="zero-icon" aria-hidden="true">∅</span>
                <p>No supported wallet was detected.</p>
                <small>Install MetaMask, OKX Wallet, or Rabby extension to connect.</small>
              </div>
            ) : (
              providers.map((option: WalletOption) => (
                <button
                  key={option.id}
                  className="wallet-provider-card"
                  onClick={() => wallet.connect(option, chainHex)}
                >
                  <div className="provider-icon-wrapper">
                    <WalletIcon id={option.id} />
                  </div>
                  <div className="provider-info-wrapper">
                    <span className="provider-name">{option.name}</span>
                    <span className="provider-detection-tag">Available</span>
                  </div>
                  <span className="provider-chevron" aria-hidden="true">→</span>
                </button>
              ))
            )}
          </div>

          <div className="dialog-footer-actions">
            <button type="button" className="action-button secondary cancel-action" onClick={() => wallet.close()}>
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
