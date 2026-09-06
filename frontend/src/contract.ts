import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Provider, Address } from "./wallet";

export const chain = studionet;
export const chainHex = `0x${chain.id.toString(16)}`;
export const explorerUrl = chain.blockExplorers?.default.url;
const configured = String(import.meta.env.VITE_CONTRACT_ADDRESS ?? "").toLowerCase();
export const contractAddress = /^0x[0-9a-f]{40}$/.test(configured) ? configured as Address : undefined;
export const readClient = createClient({ chain });

export type CaseRecord = {
  id: string; primary: Address; secondary: Address; phase: string; revision: string; parent: string;
  base: { dimensions: { id: string; min: number; max: number; anchors: { score: number; text: string }[] }[] };
  response: { reviews?: { dimension_id: string; score: number; rationale: string }[] };
  outcome: string; result: { labels?: string[] }; accepted_attempts: number;
};
export async function readCase(id: string): Promise<CaseRecord | null> {
  if (!contractAddress) throw new Error("Contract address is not configured.");
  const result = await readClient.readContract({ address: contractAddress, functionName: "get_case", args: [BigInt(id)] });
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
  if (String((transaction as { txExecutionResultName?: unknown }).txExecutionResultName) !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error("The finalized transaction did not execute successfully.");
  }
}
