import { createHmac, timingSafeEqual } from 'node:crypto';
import { SIGNATURE_HEADER } from '@/util/Constants';
import type { WebhookEvent } from '@/types/index';

/** Options for {@link Webhooks.verify} / {@link Webhooks.constructEvent}. */
export interface VerifyWebhookOptions {
  /**
   * Tolerance in seconds between the signed timestamp and now. Protects against
   * replay attacks. Defaults to 300 (5 minutes). Pass 0 to disable the check.
   */
  toleranceSeconds?: number;
  /** Override "now" (unix seconds) — useful for testing. */
  now?: number;
}

/** Thrown when a webhook signature fails verification. */
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/**
 * Stateless helpers to verify the HMAC signatures the Cosmos Pay dispatcher
 * sends with each webhook delivery, and to safely parse the event body.
 *
 * The dispatcher signs each POST with:
 *   `X-Cosmos-Signature: t=<unixSeconds>,v1=<hexHmacSha256>`
 * where the HMAC-SHA256 is computed over `${t}.${rawBody}` using the endpoint's
 * `whsec_...` secret.
 *
 * @example
 * // Express raw-body handler
 * app.post('/hooks', express.raw({ type: '*​/*' }), (req, res) => {
 *   try {
 *     const event = Webhooks.constructEvent(
 *       req.body,                        // the RAW body (Buffer/string)
 *       req.header('X-Cosmos-Signature'),
 *       process.env.WEBHOOK_SECRET,
 *     );
 *     // event.type, event.data ...
 *     res.sendStatus(200);
 *   } catch {
 *     res.sendStatus(400);
 *   }
 * });
 */
export const Webhooks = {
  /** Header name the dispatcher uses for the signature. */
  SIGNATURE_HEADER,

  /**
   * Verify a webhook signature. Returns `true` on success, throws
   * {@link WebhookSignatureError} on any failure (so it never silently passes).
   */
  verify(
    rawBody: string | Uint8Array,
    signatureHeader: string | null | undefined,
    secret: string,
    options: VerifyWebhookOptions = {},
  ): boolean {
    if (!signatureHeader) {
      throw new WebhookSignatureError('Missing signature header.');
    }
    if (!secret) {
      throw new WebhookSignatureError('Missing signing secret.');
    }

    const { timestamp, signature } = parseSignatureHeader(signatureHeader);
    const payload = typeof rawBody === 'string' ? rawBody : decode(rawBody);

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    if (!safeEqualHex(expected, signature)) {
      throw new WebhookSignatureError('Signature mismatch.');
    }

    const tolerance = options.toleranceSeconds ?? 300;
    if (tolerance > 0) {
      const now = options.now ?? Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > tolerance) {
        throw new WebhookSignatureError(
          `Timestamp outside tolerance (${tolerance}s).`,
        );
      }
    }

    return true;
  },

  /**
   * Verify the signature and return the parsed {@link WebhookEvent}. Throws
   * {@link WebhookSignatureError} if verification fails.
   */
  constructEvent<T = unknown>(
    rawBody: string | Uint8Array,
    signatureHeader: string | null | undefined,
    secret: string,
    options: VerifyWebhookOptions = {},
  ): WebhookEvent<T> {
    this.verify(rawBody, signatureHeader, secret, options);
    const payload = typeof rawBody === 'string' ? rawBody : decode(rawBody);
    try {
      return JSON.parse(payload) as WebhookEvent<T>;
    } catch {
      throw new WebhookSignatureError('Body is not valid JSON.');
    }
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function parseSignatureHeader(header: string): {
  timestamp: number;
  signature: string;
} {
  let timestamp: number | undefined;
  let signature: string | undefined;
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (!key || value === undefined) continue;
    const k = key.trim();
    if (k === 't') timestamp = Number(value.trim());
    else if (k === 'v1') signature = value.trim();
  }
  if (timestamp === undefined || Number.isNaN(timestamp) || !signature) {
    throw new WebhookSignatureError('Malformed signature header.');
  }
  return { timestamp, signature };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function decode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}
