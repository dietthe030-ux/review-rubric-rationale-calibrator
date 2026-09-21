import { useSyncExternalStore } from "react";
import { writeClient as makeWriteClient } from "./contract";
import { invalidateRpc } from "./rpc";

export type Address = `0x${string}`;
export type WalletId = "metamask" | "okx" | "rabby";
export interface Provider {
  request(input: { method: string; params?: readonly unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  providers?: readonly Provider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
}
export interface WalletOption {
  id: WalletId;
  name: "MetaMask" | "OKX Wallet" | "Rabby";
  provider: Provider;
  uuid: string;
  legacy?: boolean;
}
export type WalletPhase = "DISCONNECTED" | "DISCOVERING" | "CHOOSER_OPEN" | "CONNECTING" | "CONNECTED" | "WRONG_CHAIN" | "ERROR";
export interface WalletState {
  phase: WalletPhase;
  providers: readonly WalletOption[];
  selected?: WalletOption;
  account?: Address;
  writeClient?: ReturnType<typeof makeWriteClient>;
  error?: string;
}

declare global {
  interface Window { ethereum?: Provider; okxwallet?: Provider }
}

const catalog = [
  { id: "metamask", name: "MetaMask", rdns: ["io.metamask"] },
  { id: "okx", name: "OKX Wallet", rdns: ["com.okx.wallet", "com.okex.wallet"] },
  { id: "rabby", name: "Rabby", rdns: ["io.rabby"] },
] as const;
const options = new Map<WalletId, WalletOption>();
const uuids = new Map<string, Provider>();
const identities = new WeakMap<object, WalletId>();
const providerListeners = new Set<() => void>();
let providerSnapshot: readonly WalletOption[] = Object.freeze([]);
let discoveryStarted = false;

function validProvider(value: unknown): value is Provider {
  return !!value && typeof value === "object" && typeof (value as Provider).request === "function";
}
function identity(provider: Provider): WalletId | undefined {
  const found: WalletId[] = [];
  if (provider.isMetaMask === true) found.push("metamask");
  if (provider.isOkxWallet === true || provider.isOKExWallet === true) found.push("okx");
  if (provider.isRabby === true) found.push("rabby");
  return found.length === 1 ? found[0] : undefined;
}
function publish() {
  providerSnapshot = Object.freeze(catalog.flatMap(({ id }) => options.get(id) ? [options.get(id)!] : []));
  providerListeners.forEach((listener) => listener());
}
function acceptInto(target: Map<WalletId, WalletOption>, seenUuids: Map<string, Provider>, seenIdentities: WeakMap<object, WalletId>, id: WalletId, provider: Provider, uuid: string, legacy = false) {
  const knownUuid = seenUuids.get(uuid);
  const knownIdentity = seenIdentities.get(provider as object);
  const current = target.get(id);
  if ((knownUuid && knownUuid !== provider) || (current && current.provider !== provider && !current.legacy)) return;
  if (knownIdentity && knownIdentity !== id) {
    const prior = target.get(knownIdentity);
    if (legacy || prior?.provider !== provider || !prior.legacy) return;
    target.delete(knownIdentity);
  }
  const item = catalog.find((entry) => entry.id === id)!;
  seenUuids.set(uuid, provider);
  seenIdentities.set(provider as object, id);
  target.set(id, { id, name: item.name, provider, uuid, legacy });
  return current;
}
function accept(id: WalletId, provider: Provider, uuid: string, legacy = false) {
  const selectedWasReclassified = state.selected?.provider === provider && state.selected.id !== id;
  const current = acceptInto(options, uuids, identities, id, provider, uuid, legacy);
  if (!current && !options.has(id)) return;
  const replacingSelected = current && current.provider !== provider && current.legacy && state.selected?.id === id && state.selected.provider === current.provider;
  publish();
  if (replacingSelected || selectedWasReclassified) { detach?.(); detach = undefined; update({ phase: "DISCONNECTED", providers: providerSnapshot }); }
}
function announcement(event: Event) {
  const detail = (event as CustomEvent).detail as { info?: { uuid?: unknown; rdns?: unknown }; provider?: unknown } | undefined;
  if (!detail || typeof detail.info?.uuid !== "string" || typeof detail.info.rdns !== "string" || !validProvider(detail.provider)) return;
  const item = catalog.find(({ rdns }) => rdns.includes(detail.info!.rdns!.toString().toLowerCase() as never));
  if (item) accept(item.id, detail.provider, detail.info.uuid);
}
export function startDiscovery() {
  if (discoveryStarted || typeof window === "undefined") return;
  discoveryStarted = true;
  window.addEventListener("eip6963:announceProvider", announcement);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  queueMicrotask(() => {
    const candidates = [...(window.ethereum?.providers ?? []), window.ethereum].filter(validProvider);
    for (const provider of new Set(candidates)) {
      const id = identity(provider);
      if (id && !options.has(id)) accept(id, provider, `legacy-${id}`, true);
    }
    if (validProvider(window.okxwallet)) accept("okx", window.okxwallet, "legacy-okxwallet", true);
  });
}
export function providerOptions() { return providerSnapshot; }
export function providerCardinality(options: readonly WalletOption[] = providerSnapshot) { return options.length; }
export type ProviderAnnouncement = { provider: Provider; uuid: string; rdns: string };
export function resolveProviderOptions(legacyCandidates: readonly Provider[], announcements: readonly ProviderAnnouncement[] = [], okxProvider?: Provider) {
  const resolved = new Map<WalletId, WalletOption>();
  const seenUuids = new Map<string, Provider>();
  const seenIdentities = new WeakMap<object, WalletId>();
  for (const provider of legacyCandidates) {
    const id = identity(provider);
    if (id) acceptInto(resolved, seenUuids, seenIdentities, id, provider, `legacy-${id}`, true);
  }
  for (const announcement of announcements) {
    const item = catalog.find(({ rdns }) => rdns.includes(announcement.rdns.toLowerCase() as never));
    if (item) acceptInto(resolved, seenUuids, seenIdentities, item.id, announcement.provider, announcement.uuid);
  }
  if (validProvider(okxProvider)) acceptInto(resolved, seenUuids, seenIdentities, "okx", okxProvider, "legacy-okxwallet", true);
  return Object.freeze(catalog.flatMap(({ id }) => resolved.get(id) ? [resolved.get(id)!] : []));
}
export function useProviders() {
  startDiscovery();
  return useSyncExternalStore((fn) => { providerListeners.add(fn); return () => providerListeners.delete(fn); }, () => providerSnapshot, () => []);
}

let state: WalletState = { phase: "DISCONNECTED", providers: [] };
const stateListeners = new Set<() => void>();
let detach: (() => void) | undefined;
function update(next: WalletState) { state = next; stateListeners.forEach((fn) => fn()); }
function account(value: unknown): Address | undefined {
  const text = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  return /^0x[0-9a-fA-F]{40}$/.test(text) ? text.toLowerCase() as Address : undefined;
}
export function walletHeaderAction(phase: WalletPhase): "CONNECTED" | "WRONG_CHAIN" | "CONNECT" {
  return phase === "CONNECTED" ? "CONNECTED" : phase === "WRONG_CHAIN" ? "WRONG_CHAIN" : "CONNECT";
}
function bind(selected: WalletOption, chainHex: string) {
  detach?.();
  const onAccounts = (value: unknown) => {
    if (state.selected?.provider !== selected.provider) return;
    const next = account(value);
    if (!next) { wallet.disconnect(); return; }
    invalidateRpc("wallet context", `account:${next}`);
    const connected = state.phase === "CONNECTED";
    update({ ...state, account: next, writeClient: connected ? makeWriteClient(selected.provider, next) : undefined });
  };
  const onChain = (value: unknown) => {
    if (state.selected?.provider !== selected.provider) return;
    invalidateRpc("wallet context", `chain:${String(value).toLowerCase()}`);
    const connected = String(value).toLowerCase() === chainHex.toLowerCase() && !!state.account;
    update({ ...state, phase: connected ? "CONNECTED" : "WRONG_CHAIN", writeClient: connected ? makeWriteClient(selected.provider, state.account!) : undefined, error: connected ? undefined : "Switch to the configured GenLayer network." });
  };
  const onDisconnect = () => { if (state.selected?.provider === selected.provider) wallet.disconnect(); };
  selected.provider.on?.("accountsChanged", onAccounts);
  selected.provider.on?.("chainChanged", onChain);
  selected.provider.on?.("disconnect", onDisconnect);
  detach = () => {
    selected.provider.removeListener?.("accountsChanged", onAccounts);
    selected.provider.removeListener?.("chainChanged", onChain);
    selected.provider.removeListener?.("disconnect", onDisconnect);
  };
}
export const wallet = {
  snapshot: () => state,
  subscribe(fn: () => void) { stateListeners.add(fn); return () => stateListeners.delete(fn); },
  providers(value: readonly WalletOption[]) { update({ ...state, providers: value }); },
  open() { update({ phase: "DISCOVERING", providers: state.providers }); queueMicrotask(() => update({ phase: "CHOOSER_OPEN", providers: state.providers })); },
  close() { if (state.phase === "CHOOSER_OPEN") update({ phase: "DISCONNECTED", providers: state.providers }); },
  disconnect() { invalidateRpc("wallet context", "disconnect"); detach?.(); detach = undefined; update({ phase: "DISCONNECTED", providers: state.providers }); },
  async switchNetwork(configuration: { chainId: string; chainName: string; nativeCurrency: unknown; rpcUrls: readonly string[]; blockExplorerUrls?: readonly string[] }) {
    const selected = state.selected;
    if (!selected) return;
    try {
      await selected.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: configuration.chainId }] });
      const active = account(await selected.provider.request({ method: "eth_accounts" }));
      if (!active) { wallet.disconnect(); return; }
      bind(selected, configuration.chainId);
      update({ ...state, selected, account: active, phase: "CONNECTED", writeClient: makeWriteClient(selected.provider, active), error: undefined });
    } catch (cause) {
      if (cause && typeof cause === "object" && Number((cause as { code?: unknown }).code) === 4902) {
        try { await selected.provider.request({ method: "wallet_addEthereumChain", params: [configuration] }); await selected.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: configuration.chainId }] }); const active = account(await selected.provider.request({ method: "eth_accounts" })); if (!active) { wallet.disconnect(); return; } bind(selected, configuration.chainId); update({ ...state, selected, account: active, phase: "CONNECTED", writeClient: makeWriteClient(selected.provider, active), error: undefined }); return; }
        catch (addCause) { cause = addCause; }
      }
      update({ ...state, phase: "WRONG_CHAIN", writeClient: undefined, error: cause instanceof Error ? cause.message : "Network switch failed." });
    }
  },
  async connect(selected: WalletOption, chainHex: string) {
    detach?.(); detach = undefined;
    update({ phase: "CONNECTING", providers: state.providers, selected });
    try {
      const active = account(await selected.provider.request({ method: "eth_requestAccounts" }));
      if (!active) throw new Error("The wallet did not return a valid account.");
      const current = String(await selected.provider.request({ method: "eth_chainId" })).toLowerCase();
      if (current !== chainHex.toLowerCase()) {
        bind(selected, chainHex);
        update({ phase: "WRONG_CHAIN", providers: state.providers, selected, account: active, error: "Switch to the configured GenLayer network." });
        return;
      }
      bind(selected, chainHex);
      update({ phase: "CONNECTED", providers: state.providers, selected, account: active, writeClient: makeWriteClient(selected.provider, active) });
    } catch (cause) {
      update({ phase: "ERROR", providers: state.providers, error: cause instanceof Error ? cause.message : "Wallet connection failed." });
    }
  },
};
export function useWallet() { return useSyncExternalStore(wallet.subscribe, wallet.snapshot, wallet.snapshot); }
