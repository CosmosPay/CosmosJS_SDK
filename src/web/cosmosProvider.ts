/**
 * Reaching Cosmos Wallet, over either of the two transports it ships.
 *
 * Cosmos Pay's own wallet exposes a SEP-43-shaped provider on `window.cosmosWallet`,
 * and it gets there two different ways:
 *
 *   extension  the browser extension's content script injects it at document start,
 *              so the global is simply there — nothing to configure.
 *   hosted     the wallet also runs as a plain web page, and a site opts in by
 *              loading `<wallet origin>/cosmos-wallet.js`. Each call then opens the
 *              wallet's own approval window. Nothing is installed.
 *
 * One module for both, because everything above the provider — the SDK's wallet
 * adapter and the Stellar Wallets Kit module — cares about the same five methods
 * and not at all about how they arrived.
 *
 * WHY THE SCRIPT IS LOADED ONCE AND MEMOISED AS A PROMISE: `isAvailable()` and
 * `getAddress()` can be called in the same tick (a kit rendering its modal does
 * exactly that), and two `<script>` tags for one provider is a race whose loser
 * silently wins — the second load finds `window.cosmosWallet` already defined and
 * bails, and whichever promise settles last is the one the caller reads.
 */

/** The provider surface this SDK uses. A superset lives on the real object. */
export interface CosmosWalletProvider {
  /** Marker the wallet sets on its own provider. */
  isCosmosWallet?: boolean;
  /** `'web'` on the hosted build; absent on the extension's provider. */
  transport?: string;
  isConnected?(): Promise<boolean>;
  getAddress(): Promise<{
    address: string;
    network?: string;
    networkPassphrase?: string;
    networkUrl?: string;
  }>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string; networkUrl?: string }>;
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
  signMessage(
    message: string,
    opts?: { networkPassphrase?: string; address?: string },
  ): Promise<{ signedMessage: string; signerAddress?: string; domain?: string }>;
  /** SEP-7 `web+stellar:pay…` — the wallet builds, signs and submits it. */
  requestPayment?(uri: string): Promise<{ hash: string; signerAddress?: string }>;
}

/** How to find the provider. Everything is optional: an extension needs nothing. */
export interface CosmosProviderOptions {
  /**
   * A provider object supplied by the host (tests, or an app that already holds
   * one). Wins over everything else and is never probed for.
   */
  provider?: CosmosWalletProvider;
  /**
   * Origin of a hosted Cosmos Wallet — e.g. `https://wallet.cosmospay.lat`. Set it
   * to support users who have not installed the extension: the provider script is
   * pulled from that origin on first use, and signing happens in the wallet's own
   * window on its own origin. Leave it unset to require the extension.
   */
  walletUrl?: string;
  /**
   * How long to wait for that script, in ms. The kit gives a module 1000ms to answer
   * `isAvailable()`, which is why availability never waits for this — see
   * `CosmosWalletModule`.
   */
  loadTimeoutMs?: number;
}

/** File the hosted wallet serves its provider from, relative to the wallet origin. */
const PROVIDER_FILE = 'cosmos-wallet.js';
const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

/** The window, or undefined outside a browser (SSR-safe). */
function browserWindow(): (Window & typeof globalThis) | undefined {
  return typeof window !== 'undefined' ? window : undefined;
}

/** The provider the extension injected, if any. Never throws, never loads. */
export function injectedProvider(): CosmosWalletProvider | undefined {
  const win = browserWindow() as unknown as Record<string, unknown> | undefined;
  const provider = win?.['cosmosWallet'];
  return provider && typeof provider === 'object' ? (provider as CosmosWalletProvider) : undefined;
}

/** One in-flight load per wallet origin, shared by every caller. */
const loads = new Map<string, Promise<CosmosWalletProvider | undefined>>();

/**
 * Load the hosted wallet's provider script from `walletUrl` and resolve with the
 * provider it defines. Resolves `undefined` rather than throwing when there is no
 * document, no URL, or the script never arrives: "no wallet" is an answer every
 * caller here already has to handle.
 */
export function loadHostedProvider(
  walletUrl: string,
  timeoutMs: number = DEFAULT_LOAD_TIMEOUT_MS,
): Promise<CosmosWalletProvider | undefined> {
  const existing = injectedProvider();
  if (existing) return Promise.resolve(existing);

  const win = browserWindow();
  if (!win || typeof document === 'undefined') return Promise.resolve(undefined);

  const origin = walletUrl.replace(/\/+$/, '');
  const cached = loads.get(origin);
  if (cached) return cached;

  const pending = new Promise<CosmosWalletProvider | undefined>((resolve) => {
    const src = `${origin}/${PROVIDER_FILE}`;
    const done = (value: CosmosWalletProvider | undefined) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(injectedProvider()), timeoutMs);

    // A tag for this exact src may already be on the page — the site can ship it
    // itself, which is the documented integration. Reuse it instead of adding a
    // second one; `onload` on an already-loaded script never fires, so the
    // provider is read directly in that case.
    const existingTag = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existingTag) {
      const found = injectedProvider();
      if (found) return done(found);
      existingTag.addEventListener('load', () => done(injectedProvider()), { once: true });
      existingTag.addEventListener('error', () => done(undefined), { once: true });
      return;
    }

    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.addEventListener('load', () => done(injectedProvider()), { once: true });
    tag.addEventListener('error', () => done(undefined), { once: true });
    (document.head ?? document.documentElement).appendChild(tag);
  });

  // Not cached on failure: a wallet origin that was down once should be retried,
  // and a memoised `undefined` would make the wallet permanently unavailable for
  // the life of the page.
  loads.set(origin, pending);
  void pending.then((provider) => {
    if (!provider) loads.delete(origin);
  });
  return pending;
}

/**
 * The provider to act on: the injected one, the host's, or the hosted build's —
 * in that order. `undefined` when Cosmos Wallet cannot be reached at all.
 */
export async function resolveProvider(
  options: CosmosProviderOptions = {},
): Promise<CosmosWalletProvider | undefined> {
  if (options.provider) return options.provider;
  const injected = injectedProvider();
  if (injected) return injected;
  if (!options.walletUrl) return undefined;
  return loadHostedProvider(options.walletUrl, options.loadTimeoutMs);
}

/** Forget memoised loads. Exposed for tests; harmless in an app. */
export function resetProviderCache(): void {
  loads.clear();
}
