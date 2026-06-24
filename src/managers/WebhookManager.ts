import type { IncomingMessage, ServerResponse } from 'node:http';
import { WebhookDelivery } from '@/structures/WebhookDelivery';
import { WebhookEndpoint } from '@/structures/WebhookEndpoint';
import type {
  CreateWebhookEndpointOptions,
  ListWebhookDeliveriesOptions,
  PaymentIntentData,
  UpdateWebhookEndpointOptions,
  WebhookDeliveryData,
  WebhookDeliveryListData,
  WebhookEndpointData,
  WebhookEndpointWithSecretData,
  WebhookEvent,
  WebhookPingData,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';
import { Webhooks, WebhookSignatureError } from '@/util/Webhooks';
import { SIGNATURE_HEADER } from '@/util/Constants';

// Local alias — the deleted shape mirrors DeletedData.
type WebhookDeletedData = { id: string; deleted: boolean };

/** A page of webhook deliveries plus its pagination metadata. */
export interface WebhookDeliveryPage {
  items: WebhookDelivery[];
  total: number;
  take: number;
  skip: number;
}

/** Options for verifying + dispatching an incoming webhook. */
export interface WebhookProcessOptions {
  /** Signing secret. Falls back to the client's `webhookSecret` when omitted. */
  secret?: string;
  /** Replay tolerance in seconds (default 300; 0 disables). */
  toleranceSeconds?: number;
}

/** Options for the built-in HTTP webhook handlers. */
export type WebhookHandlerOptions = WebhookProcessOptions;

/**
 * Listener signatures for {@link WebhookManager}. You can subscribe with the raw
 * event type (`PAYMENT_INTENT_SUCCEEDED`), its camelCase alias
 * (`paymentIntentSucceeded`), or `event` to catch them all.
 */
export interface WebhookListenerEvents {
  event: [WebhookEvent<PaymentIntentData>];

  PAYMENT_INTENT_CREATED: [WebhookEvent<PaymentIntentData>];
  PAYMENT_INTENT_UPDATED: [WebhookEvent<PaymentIntentData>];
  PAYMENT_INTENT_SUCCEEDED: [WebhookEvent<PaymentIntentData>];
  PAYMENT_INTENT_FAILED: [WebhookEvent<PaymentIntentData>];
  PAYMENT_INTENT_CANCELLED: [WebhookEvent<PaymentIntentData>];
  PAYMENT_INTENT_DELETED: [WebhookEvent<PaymentIntentData>];

  paymentIntentCreated: [WebhookEvent<PaymentIntentData>];
  paymentIntentUpdated: [WebhookEvent<PaymentIntentData>];
  paymentIntentSucceeded: [WebhookEvent<PaymentIntentData>];
  paymentIntentFailed: [WebhookEvent<PaymentIntentData>];
  paymentIntentCancelled: [WebhookEvent<PaymentIntentData>];
  paymentIntentDeleted: [WebhookEvent<PaymentIntentData>];
}

/** Minimal Express-like request (so we don't depend on `@types/express`). */
interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  rawBody?: unknown;
  [key: string]: unknown;
}

/** Minimal Express-like response. */
interface ResponseLike {
  status(code: number): ResponseLike;
  send(body?: unknown): unknown;
  end(body?: unknown): unknown;
}

// Typed event overloads (declaration merging onto the class).
export interface WebhookManager {
  on<E extends keyof WebhookListenerEvents>(
    event: E,
    listener: (...args: WebhookListenerEvents[E]) => void,
  ): this;
  once<E extends keyof WebhookListenerEvents>(
    event: E,
    listener: (...args: WebhookListenerEvents[E]) => void,
  ): this;
  off<E extends keyof WebhookListenerEvents>(
    event: E,
    listener: (...args: WebhookListenerEvents[E]) => void,
  ): this;
  emit<E extends keyof WebhookListenerEvents>(
    event: E,
    ...args: WebhookListenerEvents[E]
  ): boolean;
}

/**
 * Manages webhook endpoints, their delivery audit trail, **and** the incoming
 * event listener — `client.webhooks`.
 *
 * Registering endpoints (server-side CRUD):
 * @example
 * const endpoint = await client.webhooks.create({
 *   url: 'https://me.example.com/hooks',
 *   eventTypes: ['PAYMENT_INTENT_SUCCEEDED'],
 * });
 * console.log(endpoint.secret); // shown once — store it!
 *
 * Receiving events (listener):
 * @example
 * client.webhooks.on('paymentIntentSucceeded', (event) => {
 *   console.log('Paid!', event.data.id);
 * });
 *
 * import { createServer } from 'node:http';
 * createServer(client.webhooks.createHandler()).listen(4242);
 */
export class WebhookManager extends BaseManager<WebhookEndpoint> {
  private readonly route = '/webhooks';

  // ── Endpoint CRUD ───────────────────────────────────────────────────────────

  /** Register a webhook endpoint (the returned instance carries the secret once). */
  public async create(
    options: CreateWebhookEndpointOptions,
  ): Promise<WebhookEndpoint> {
    const data = await this.rest.post<WebhookEndpointWithSecretData>(this.route, {
      body: options,
    });
    return this._add(new WebhookEndpoint(this.client, data));
  }

  /** List the consumer's webhook endpoints. */
  public async list(): Promise<WebhookEndpoint[]> {
    const data = await this.rest.get<WebhookEndpointData[]>(this.route);
    return data.map((d) => this._add(new WebhookEndpoint(this.client, d)));
  }

  /** Get a webhook endpoint by id. */
  public async fetch(id: string): Promise<WebhookEndpoint> {
    const data = await this.rest.get<WebhookEndpointData>(`${this.route}/${id}`);
    return this._add(new WebhookEndpoint(this.client, data));
  }

  /** Update a webhook endpoint (url/description/enabled/eventTypes). */
  public async update(
    id: string,
    options: UpdateWebhookEndpointOptions,
  ): Promise<WebhookEndpoint> {
    const data = await this.rest.patch<WebhookEndpointData>(
      `${this.route}/${id}`,
      { body: options },
    );
    return this._add(new WebhookEndpoint(this.client, data));
  }

  /** Delete a webhook endpoint. */
  public async delete(id: string): Promise<WebhookDeletedData> {
    const result = await this.rest.delete<WebhookDeletedData>(
      `${this.route}/${id}`,
    );
    this.cache.delete(id);
    return result;
  }

  /** Rotate the signing secret (returns a new instance carrying the secret). */
  public async rotateSecret(id: string): Promise<WebhookEndpoint> {
    const data = await this.rest.post<WebhookEndpointWithSecretData>(
      `${this.route}/${id}/rotate-secret`,
    );
    return this._add(new WebhookEndpoint(this.client, data));
  }

  /** Send a test event to verify the endpoint. */
  public ping(id: string): Promise<WebhookPingData> {
    return this.rest.post<WebhookPingData>(`${this.route}/${id}/ping`);
  }

  /** List delivery attempts for an endpoint (audit trail). */
  public async fetchDeliveries(
    id: string,
    options: ListWebhookDeliveriesOptions = {},
  ): Promise<WebhookDeliveryPage> {
    const data = await this.rest.get<WebhookDeliveryListData>(
      `${this.route}/${id}/deliveries`,
      {
        query: {
          status: options.status,
          take: options.take,
          skip: options.skip,
        },
      },
    );
    return {
      items: data.data.map((d) => new WebhookDelivery(this.client, d)),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /** Manually re-send a past delivery. */
  public async redeliver(
    id: string,
    deliveryId: string,
  ): Promise<WebhookDelivery> {
    const data = await this.rest.post<WebhookDeliveryData>(
      `${this.route}/${id}/deliveries/${deliveryId}/redeliver`,
    );
    return new WebhookDelivery(this.client, data);
  }

  // ── Incoming event listener ──────────────────────────────────────────────────

  /**
   * Verify a raw incoming webhook request and dispatch it to the listeners
   * registered via {@link WebhookManager.on}. Returns the parsed event.
   *
   * Emits, in order: the raw type (`PAYMENT_INTENT_SUCCEEDED`), the camelCase
   * alias (`paymentIntentSucceeded`) and the catch-all `event`.
   *
   * @throws {WebhookSignatureError} when the signature is missing/invalid.
   */
  public process(
    rawBody: string | Uint8Array,
    signatureHeader: string | null | undefined,
    options: WebhookProcessOptions = {},
  ): WebhookEvent<PaymentIntentData> {
    const secret = options.secret ?? this.client.webhookSecret;
    if (!secret) {
      throw new WebhookSignatureError(
        'No webhook secret configured. Pass `{ secret }` or set `webhookSecret` on the client.',
      );
    }

    const event = Webhooks.constructEvent<PaymentIntentData>(
      rawBody,
      signatureHeader,
      secret,
      { toleranceSeconds: options.toleranceSeconds },
    );

    this.emit(event.type, event);
    this.emit(toCamelEvent(event.type), event);
    this.emit('event', event);
    return event;
  }

  /**
   * Build a Node.js `http`/`https` request handler that verifies the signature,
   * dispatches the event to your listeners, and replies `200`/`400`.
   *
   * @example
   * import { createServer } from 'node:http';
   * createServer(client.webhooks.createHandler({ secret })).listen(4242);
   */
  public createHandler(
    options: WebhookHandlerOptions = {},
  ): (req: IncomingMessage, res: ServerResponse) => void {
    return (req, res) => {
      void this.collectBody(req)
        .then((raw) => {
          const sig = headerValue(req.headers[SIGNATURE_HEADER]);
          this.process(raw, sig, options);
          res.statusCode = 200;
          res.end('ok');
        })
        .catch((err: unknown) => {
          res.statusCode = err instanceof WebhookSignatureError ? 400 : 500;
          res.end(
            err instanceof WebhookSignatureError ? 'invalid signature' : 'error',
          );
        });
    };
  }

  /**
   * Express-style middleware. Expects the **raw** body (e.g. mounted with
   * `express.raw({ type: '*​/*' })`). On success it attaches the parsed event to
   * `req.cosmosEvent` and calls `next()`; on a bad signature it replies `400`.
   *
   * @example
   * app.post('/hooks', express.raw({ type: '*​/*' }), client.webhooks.middleware({ secret }));
   */
  public middleware(
    options: WebhookHandlerOptions = {},
  ): (req: RequestLike, res: ResponseLike, next: (err?: unknown) => void) => void {
    return (req, res, next) => {
      try {
        const raw = extractRawBody(req);
        const sig = headerValue(req.headers[SIGNATURE_HEADER]);
        const event = this.process(raw, sig, options);
        req.cosmosEvent = event;
        next();
      } catch (err) {
        if (err instanceof WebhookSignatureError) {
          res.status(400).send('invalid signature');
          return;
        }
        next(err);
      }
    };
  }

  /** Read a Node.js request stream into a single Buffer. */
  private collectBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** `PAYMENT_INTENT_SUCCEEDED` → `paymentIntentSucceeded`. */
function toCamelEvent(type: string): keyof WebhookListenerEvents {
  return type
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) =>
      c.toUpperCase(),
    ) as keyof WebhookListenerEvents;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function extractRawBody(req: RequestLike): string | Uint8Array {
  const candidate = req.rawBody ?? req.body;
  if (typeof candidate === 'string' || candidate instanceof Uint8Array) {
    return candidate;
  }
  // express.json() already parsed it — re-stringify so the signature still matches
  // only if the original raw body is unavailable (best-effort).
  if (candidate && typeof candidate === 'object') {
    return JSON.stringify(candidate);
  }
  return '';
}
