/**
 * SEP-7 (`web+stellar:`) parsing and intent normalization.
 *
 * Cosmos Pay returns a SEP-7 URI for every intent. Browser wallets, however,
 * don't ingest those URIs from a dapp — so the web client parses the URI (or
 * the structured intent) into a {@link NormalizedIntent} it can turn into a
 * concrete transaction and hand to a wallet for signing.
 */

import type { PaymentIntentData } from '@/types/index';
import { IntentError } from '@/web/errors';
import type {
  NormalizedIntent,
  PayableInput,
  Sep7Request,
} from '@/web/types';

const SCHEME = 'web+stellar:';

/** Whether a value is a SEP-7 `web+stellar:` URI string. */
export function isSep7Uri(value: unknown): value is string {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith(SCHEME);
}

/**
 * Parse a `web+stellar:tx?…` / `web+stellar:pay?…` URI into its parameters.
 * Throws {@link IntentError} on an unrecognized operation.
 */
export function parseSep7(uri: string): Sep7Request {
  const trimmed = uri.trim();
  const withoutScheme = trimmed.slice(SCHEME.length);
  const queryStart = withoutScheme.indexOf('?');
  const operation = (
    queryStart === -1 ? withoutScheme : withoutScheme.slice(0, queryStart)
  ).toLowerCase();
  if (operation !== 'tx' && operation !== 'pay') {
    throw new IntentError(`Unsupported SEP-7 operation: "${operation}".`);
  }

  const params = new URLSearchParams(
    queryStart === -1 ? '' : withoutScheme.slice(queryStart + 1),
  );
  const get = (key: string): string | undefined => params.get(key) ?? undefined;

  return {
    operation,
    xdr: get('xdr'),
    destination: get('destination'),
    amount: get('amount'),
    assetCode: get('asset_code'),
    assetIssuer: get('asset_issuer'),
    memo: get('memo'),
    memoType: get('memo_type'),
    msg: get('msg'),
    callback: get('callback'),
    networkPassphrase: get('network_passphrase'),
    originDomain: get('origin_domain'),
    signature: get('signature'),
  };
}

function fromSep7(req: Sep7Request): NormalizedIntent {
  const isTx = req.operation === 'tx';
  if (isTx && !req.xdr) {
    throw new IntentError('SEP-7 `tx` request is missing its `xdr`.');
  }
  if (!isTx && !req.destination) {
    throw new IntentError('SEP-7 `pay` request is missing its `destination`.');
  }
  return {
    kind: isTx ? 'tx' : 'pay',
    network: req.networkPassphrase ?? null,
    source: null,
    destination: req.destination ?? '',
    amount: req.amount ?? null,
    asset: req.assetCode || 'native',
    assetIssuer: req.assetIssuer ?? null,
    memo: req.memo ?? null,
    memoType: req.memoType ?? (req.memo ? 'MEMO_ID' : null),
    msg: req.msg ?? null,
    callback: req.callback ?? null,
    xdr: req.xdr ?? null,
    uri: null,
  };
}

function fromPaymentIntent(data: PaymentIntentData): NormalizedIntent {
  return {
    kind: data.kind === 'TX' ? 'tx' : 'pay',
    id: data.id,
    network: data.network ?? null,
    source: data.source ?? null,
    destination: data.destination,
    amount: data.amount ?? null,
    asset: data.asset || 'native',
    assetIssuer: data.assetIssuer ?? null,
    memo: data.memo ?? null,
    memoType: data.memo ? 'MEMO_ID' : null,
    msg: data.msg ?? null,
    callback: data.callback ?? null,
    xdr: data.xdr ?? null,
    uri: data.uri ?? null,
  };
}

function looksLikePaymentIntent(value: object): value is PaymentIntentData {
  return 'kind' in value && 'destination' in value && 'asset' in value;
}

function looksLikeSep7(value: object): value is Sep7Request {
  return 'operation' in value;
}

/**
 * Coerce any accepted input — a {@link PaymentIntentData}, a structure with
 * `toJSON()`, a parsed {@link Sep7Request}, or a raw SEP-7 URI string — into a
 * {@link NormalizedIntent}. If the structured intent only exposes a URI, that
 * URI is parsed and merged so callback/network details survive.
 */
export function normalizeIntent(input: PayableInput): NormalizedIntent {
  if (isSep7Uri(input)) {
    return fromSep7(parseSep7(input));
  }
  if (typeof input === 'string') {
    throw new IntentError(
      'Expected a payment intent or a `web+stellar:` URI string.',
    );
  }
  if (typeof input !== 'object' || input === null) {
    throw new IntentError('Cannot normalize a non-object intent.');
  }

  // A PaymentIntent structure instance (or anything with toJSON()).
  if ('toJSON' in input && typeof (input as { toJSON: unknown }).toJSON === 'function') {
    return fromPaymentIntent((input as { toJSON(): PaymentIntentData }).toJSON());
  }
  if (looksLikePaymentIntent(input)) {
    const normalized = fromPaymentIntent(input);
    // The structured payload doesn't carry the SEP-7 callback/passphrase; pull
    // them from the embedded URI when present.
    if (normalized.uri && isSep7Uri(normalized.uri)) {
      const sep7 = parseSep7(normalized.uri);
      normalized.callback = normalized.callback ?? sep7.callback ?? null;
      normalized.memoType = normalized.memoType ?? sep7.memoType ?? null;
      if (!normalized.network && sep7.networkPassphrase) {
        normalized.network = sep7.networkPassphrase;
      }
    }
    return normalized;
  }
  if (looksLikeSep7(input)) {
    return fromSep7(input);
  }

  throw new IntentError(
    'Unrecognized intent shape. Pass a Cosmos Pay payment intent, a `web+stellar:` URI, or a parsed SEP-7 request.',
  );
}
