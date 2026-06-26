/**
 * The bridge to `@stellar/stellar-sdk`.
 *
 * The web client only needs the Stellar SDK for the cases a wallet can't do on
 * its own: turning a Cosmos Pay `pay` intent into a concrete payment XDR,
 * computing a transaction hash, and submitting to Horizon. To keep the package
 * dependency-free for server users, the SDK is an *optional* peer dependency —
 * it's lazy-imported on demand, or you can inject it via `new WebClient({
 * stellarSdk })`.
 */

import { StellarSdkRequiredError } from '@/web/errors';
import type {
  NetworkConfig,
  NormalizedIntent,
  StellarSdkLike,
} from '@/web/types';

let cachedSdk: StellarSdkLike | undefined;

/**
 * Resolve the Stellar SDK: an injected module wins; otherwise we lazy-import
 * `@stellar/stellar-sdk`. The specifier is assembled at runtime so bundlers and
 * the type-checker don't treat the optional dependency as required.
 */
export async function loadStellarSdk(
  injected?: StellarSdkLike,
): Promise<StellarSdkLike> {
  if (injected) return injected;
  if (cachedSdk) return cachedSdk;
  try {
    const specifier = ['@stellar', 'stellar-sdk'].join('/');
    const mod = (await import(/* @vite-ignore */ specifier)) as Record<
      string,
      unknown
    >;
    // Some builds nest everything under `default`.
    const resolved = (mod['TransactionBuilder'] ? mod : mod['default']) as
      | StellarSdkLike
      | undefined;
    if (!resolved?.TransactionBuilder) {
      throw new Error('module did not expose TransactionBuilder');
    }
    cachedSdk = resolved;
    return resolved;
  } catch (error) {
    throw new StellarSdkRequiredError(
      error instanceof Error ? error.message : undefined,
    );
  }
}

/** Resolve the Horizon `Server` constructor across SDK major versions. */
function getServerCtor(sdk: StellarSdkLike): new (url: string) => HorizonServer {
  const ctor = sdk.Horizon?.Server ?? sdk.Server;
  if (!ctor) {
    throw new StellarSdkRequiredError('no Horizon Server export found');
  }
  return ctor;
}

interface HorizonServer {
  loadAccount(account: string): Promise<unknown>;
  submitTransaction(tx: unknown): Promise<unknown>;
  fetchBaseFee?(): Promise<number>;
}

/** Map a memo value + type onto a Stellar `Memo` instance. */
function buildMemo(sdk: StellarSdkLike, intent: NormalizedIntent): unknown {
  if (!intent.memo) return sdk.Memo.none();
  switch ((intent.memoType ?? 'MEMO_ID').toUpperCase()) {
    case 'MEMO_TEXT':
      return sdk.Memo.text(intent.memo);
    case 'MEMO_HASH':
      return sdk.Memo.hash(intent.memo);
    case 'MEMO_RETURN':
      return sdk.Memo.return(intent.memo);
    case 'MEMO_ID':
    default:
      return sdk.Memo.id(intent.memo);
  }
}

/** Resolve a Stellar `Asset` from the normalized intent. */
function buildAsset(sdk: StellarSdkLike, intent: NormalizedIntent): unknown {
  const code = intent.asset;
  if (!code || code === 'native' || code.toUpperCase() === 'XLM') {
    return sdk.Asset.native();
  }
  if (!intent.assetIssuer) {
    throw new Error(`Asset ${code} requires an issuer to build the payment.`);
  }
  return new sdk.Asset(code, intent.assetIssuer);
}

/** Options for {@link buildPaymentXdr}. */
export interface BuildPaymentInput {
  intent: NormalizedIntent;
  /** Source account (the connected wallet) the payment is built from. */
  source: string;
  /** Amount override (required when the intent has an open/null amount). */
  amount?: string;
  /** Base fee in stroops. Defaults to the SDK's `BASE_FEE`, then a Horizon probe. */
  baseFee?: string;
  /** Transaction validity window in seconds (default 300). */
  timeoutSeconds?: number;
}

/**
 * Build an unsigned payment transaction (base64 XDR) for a `pay` intent. Loads
 * the source account from Horizon for the sequence number, then assembles a
 * single `payment` operation with the intent's destination/asset/amount/memo.
 */
export async function buildPaymentXdr(
  sdk: StellarSdkLike,
  network: NetworkConfig,
  input: BuildPaymentInput,
): Promise<string> {
  const { intent, source } = input;
  const amount = input.amount ?? intent.amount;
  if (!amount) {
    throw new Error(
      'This intent has no fixed amount — pass `{ amount }` so the payment can be built.',
    );
  }

  const Server = getServerCtor(sdk);
  const server = new Server(network.horizonUrl);
  const account = await server.loadAccount(source);

  let fee = input.baseFee ?? sdk.BASE_FEE ?? '100';
  if (!input.baseFee && server.fetchBaseFee) {
    try {
      fee = String(await server.fetchBaseFee());
    } catch {
      /* keep the default fee */
    }
  }

  const builder = new sdk.TransactionBuilder(account, {
    fee,
    networkPassphrase: network.passphrase,
  });
  builder.addOperation(
    sdk.Operation.payment({
      destination: intent.destination,
      asset: buildAsset(sdk, intent),
      amount: String(amount),
    }),
  );
  builder.addMemo(buildMemo(sdk, intent));
  builder.setTimeout(input.timeoutSeconds ?? 300);

  return builder.build().toXDR();
}

/** Compute the canonical transaction hash (hex) of a signed envelope. */
export function transactionHash(
  sdk: StellarSdkLike,
  signedXdr: string,
  passphrase: string,
): string {
  const tx = sdk.TransactionBuilder.fromXDR(signedXdr, passphrase);
  const hash = tx.hash();
  return typeof hash === 'string' ? hash : toHex(hash);
}

/** Submit a signed envelope to Horizon. Returns the raw Horizon response. */
export async function submitToHorizon(
  sdk: StellarSdkLike,
  network: NetworkConfig,
  signedXdr: string,
): Promise<unknown> {
  const Server = getServerCtor(sdk);
  const server = new Server(network.horizonUrl);
  const tx = sdk.TransactionBuilder.fromXDR(signedXdr, network.passphrase);
  return server.submitTransaction(tx);
}

/**
 * POST a signed envelope to a SEP-7 `callback` (`url:https://…`) as
 * `application/x-www-form-urlencoded` with an `xdr` field, per SEP-7.
 */
export async function postToCallback(
  callback: string,
  signedXdr: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<unknown> {
  const url = callback.startsWith('url:') ? callback.slice(4) : callback;
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ xdr: signedXdr }).toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Callback ${url} responded ${response.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text || null;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toHex(bytes: Uint8Array | { toString(enc: string): string }): string {
  if (typeof (bytes as { toString(enc: string): string }).toString === 'function') {
    try {
      // Node Buffer / Stellar's hash often supports toString('hex').
      const hex = (bytes as { toString(enc: string): string }).toString('hex');
      if (/^[0-9a-f]+$/i.test(hex)) return hex;
    } catch {
      /* fall through to manual encoding */
    }
  }
  return Array.from(bytes as Uint8Array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
