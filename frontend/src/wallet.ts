import { useSyncExternalStore } from "react";

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
function accept(id: WalletId, provider: Provider, uuid: string, legacy = false) {
  const knownUuid = uuids.get(uuid);
  const knownIdentity = identities.get(provider as object);
  const current = options.get(id);
  if ((knownUuid && knownUuid !== provider) || (knownIdentity && knownIdentity !== id) || (current && current.provider !== provider && !current.legacy)) return;
  const item = catalog.find((entry) => entry.id === id)!;
  uuids.set(uuid, provider);
  identities.set(provider as object, id);
  options.set(id, { id, name: item.name, provider, uuid, legacy });
  publish();
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
    const candidates = [...(window.ethereum?.providers ?? []), window.ethereum, window.okxwallet].filter(validProvider);
    for (const provider of new Set(candidates)) {
      const id = identity(provider);
      if (id && !options.has(id)) accept(id, provider, `legacy-${id}`, true);
    }
  });
}
export function providerOptions() { return providerSnapshot; }
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
export const wallet = {
  snapshot: () => state,
  subscribe(fn: () => void) { stateListeners.add(fn); return () => stateListeners.delete(fn); },
  providers(value: readonly WalletOption[]) { update({ ...state, providers: value }); },
  open() { update({ phase: "CHOOSER_OPEN", providers: state.providers }); },
  close() { if (state.phase === "CHOOSER_OPEN") update({ phase: "DISCONNECTED", providers: state.providers }); },
  disconnect() { detach?.(); detach = undefined; update({ phase: "DISCONNECTED", providers: state.providers }); },
  async switchNetwork(chainHex: string) {
    if (!state.selected) return;
    try {
      await state.selected.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
      update({ ...state, phase: "CONNECTED", error: undefined });
    } catch (cause) {
      update({ ...state, phase: "WRONG_CHAIN", error: cause instanceof Error ? cause.message : "Network switch failed." });
    }
  },
  async connect(selected: WalletOption, chainHex: string) {
    update({ phase: "CONNECTING", providers: state.providers, selected });
    try {
      const active = account(await selected.provider.request({ method: "eth_requestAccounts" }));
      if (!active) throw new Error("The wallet did not return a valid account.");
      const current = String(await selected.provider.request({ method: "eth_chainId" })).toLowerCase();
      if (current !== chainHex.toLowerCase()) {
        update({ phase: "WRONG_CHAIN", providers: state.providers, selected, account: active, error: "Switch to the configured GenLayer network." });
        return;
      }
      const onAccounts = (value: unknown) => {
        const next = account(value);
        next ? update({ ...state, phase: "CONNECTED", account: next, error: undefined }) : wallet.disconnect();
      };
      const onChain = (value: unknown) => String(value).toLowerCase() === chainHex.toLowerCase()
        ? update({ ...state, phase: "CONNECTED", error: undefined })
        : update({ ...state, phase: "WRONG_CHAIN", error: "Switch to the configured GenLayer network." });
      const onDisconnect = () => wallet.disconnect();
      selected.provider.on?.("accountsChanged", onAccounts);
      selected.provider.on?.("chainChanged", onChain);
      selected.provider.on?.("disconnect", onDisconnect);
      detach = () => {
        selected.provider.removeListener?.("accountsChanged", onAccounts);
        selected.provider.removeListener?.("chainChanged", onChain);
        selected.provider.removeListener?.("disconnect", onDisconnect);
      };
      update({ phase: "CONNECTED", providers: state.providers, selected, account: active });
    } catch (cause) {
      update({ phase: "ERROR", providers: state.providers, error: cause instanceof Error ? cause.message : "Wallet connection failed." });
    }
  },
};
export function useWallet() { return useSyncExternalStore(wallet.subscribe, wallet.snapshot, wallet.snapshot); }
