import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Provider, Address } from "./wallet";

const studioNext = {
  ...studionet,
  id: 61997,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: ["https://studio-dev.genlayer.com/api"] } },
  blockExplorers: { default: { name: "GenLayer Studio Next Explorer", url: "https://explorer-studio-dev.genlayer.com" } },
};

export const chain = studioNext;
export const chainHex = `0x${chain.id.toString(16)}`;
export const explorerUrl = chain.blockExplorers?.default.url;
export const walletChain = { chainId: chainHex, chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: chain.rpcUrls.default.http, blockExplorerUrls: explorerUrl ? [explorerUrl] : undefined };
const configured = String(import.meta.env.VITE_CONTRACT_ADDRESS ?? "").toLowerCase();
export const contractAddress = /^0x[0-9a-f]{40}$/.test(configured) ? configured as Address : undefined;
export const readClient = createClient({ chain });

export type CaseRecord = {
  id: string; primary: Address; secondary: Address; phase: string; revision: string; parent: string;
  base: { dimensions: { id: string; min: number; max: number; anchors: { score: number; text: string }[] }[] };
  response: { reviews?: { dimension_id: string; score: number; rationale: string }[] };
  outcome: string; result: { labels?: string[] }; accepted_attempts: number;
  last_operation: { method: string; caller: Address; args_hash: string };
};
export async function readCase(id: string): Promise<CaseRecord | null> {
  if (!contractAddress) throw new Error("Contract address is not configured.");
  const result = await readClient.readContract({ address: contractAddress, functionName: "get_case", args: [BigInt(id)] });
  const text = String(result); return text === "null" ? null : JSON.parse(text) as CaseRecord;
}
export async function readVersion(id: string, revision: string): Promise<CaseRecord | null> {
  if (!contractAddress) throw new Error("Contract address is not configured.");
  const result = await readClient.readContract({ address: contractAddress, functionName: "get_version", args: [BigInt(id), BigInt(revision)] });
  const text = String(result); return text === "null" ? null : JSON.parse(text) as CaseRecord;
}
export function writeClient(provider: Provider, account: Address) {
  return createClient({ chain, account, provider: provider as never });
}
export function terminal(transaction: unknown): boolean {
  return !!transaction && typeof transaction === "object" && String((transaction as { statusName?: unknown }).statusName).toUpperCase() === TransactionStatus.FINALIZED;
}
export function assertSuccessful(transaction: unknown) {
  if (!terminal(transaction)) throw new Error("Transaction is not finalized.");
  const detail = transaction as { txExecutionResultName?: unknown; consensus_data?: { leader_receipt?: { execution_result?: unknown; result?: { status?: unknown } } } };
  const leader = detail.consensus_data?.leader_receipt;
  const successful = String(detail.txExecutionResultName) === ExecutionResult.FINISHED_WITH_RETURN || (leader?.execution_result === "SUCCESS" && leader.result?.status === "return");
  if (!successful) {
    throw new Error("The finalized transaction did not execute successfully.");
  }
}
