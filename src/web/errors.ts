/**
 * Errors surfaced by the browser ("web client") side of the SDK.
 *
 * These are intentionally kept separate from the server-side
 * {@link CosmosPayAPIError}/{@link CosmosPayRequestError} so that bundling the
 * web entry never pulls in Node-only code paths. They all extend
 * {@link CosmosPayWebError} so a consumer can `catch (e) { if (e instanceof
 * CosmosPayWebError) ... }`.
 */

/** Base class for every error thrown by `@cosmosapp/pay_sdk/web`. */
export class CosmosPayWebError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CosmosPayWebError';
    Error.captureStackTrace?.(this, CosmosPayWebError);
  }
}

/** No compatible Stellar wallet could be detected in the current environment. */
export class WalletNotFoundError extends CosmosPayWebError {
  /** Ids of the wallets that were searched for. */
  public readonly searched: string[];
  constructor(searched: string[]) {
    super(
      searched.length
        ? `No compatible Stellar wallet detected. Looked for: ${searched.join(', ')}. ` +
            'Install one (e.g. Freighter, xBull, Rabet) or pass a wallet adapter explicitly.'
        : 'No wallet adapters are registered on this client.',
    );
    this.name = 'WalletNotFoundError';
    this.searched = searched;
  }
}

/** A wallet was found but the operation failed (user rejected, locked, etc.). */
export class WalletError extends CosmosPayWebError {
  /** Id of the wallet that produced the error (e.g. `freighter`). */
  public readonly wallet: string;
  /** The underlying error, if any. */
  public readonly cause: unknown;
  constructor(wallet: string, message: string, cause?: unknown) {
    super(`[${wallet}] ${message}`);
    this.name = 'WalletError';
    this.wallet = wallet;
    this.cause = cause;
  }
}

/**
 * Building a `pay` transaction (or submitting to Horizon) requires the Stellar
 * SDK, which is an optional peer dependency. Thrown when it is neither installed
 * nor injected.
 */
export class StellarSdkRequiredError extends CosmosPayWebError {
  constructor(detail?: string) {
    super(
      'The Stellar SDK is required to build/submit this transaction but was not found. ' +
        'Install it with `npm i @stellar/stellar-sdk`, or pass it via `new WebClient({ stellarSdk })`.' +
        (detail ? ` (${detail})` : ''),
    );
    this.name = 'StellarSdkRequiredError';
  }
}

/** The intent / SEP-7 request could not be interpreted or is missing data. */
export class IntentError extends CosmosPayWebError {
  constructor(message: string) {
    super(message);
    this.name = 'IntentError';
  }
}
