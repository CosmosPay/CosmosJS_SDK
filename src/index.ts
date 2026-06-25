/**
 * @cosmosapp/pay_sdk — object-oriented SDK for the Cosmos Pay Payments API.
 *
 * @example
 * import { Client } from '@cosmosapp/pay_sdk';
 * const client = new Client({ baseURL: 'https://gateway.example.com', apiKey: '...' });
 */

// Client
export { Client } from '@/client/Client';
export type { ClientOptions, ClientEvents } from '@/client/Client';

// REST layer
export { REST } from '@/rest/REST';
export type { RESTOptions, RequestOptions, FetchLike } from '@/rest/REST';

// Errors
export {
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '@/errors/CosmosPayError';

// Managers
export { BaseManager } from '@/managers/BaseManager';
export { PaymentIntentManager } from '@/managers/PaymentIntentManager';
export type {
  PaymentIntentPage,
  ValidationOutcome,
} from '@/managers/PaymentIntentManager';
export { WebhookManager } from '@/managers/WebhookManager';
export type {
  WebhookDeliveryPage,
  WebhookProcessOptions,
  WebhookHandlerOptions,
  WebhookListenerEvents,
} from '@/managers/WebhookManager';
export { ProductManager } from '@/managers/ProductManager';
export { CustomerManager } from '@/managers/CustomerManager';
export { AnalyticsManager } from '@/managers/AnalyticsManager';
export { HealthManager } from '@/managers/HealthManager';

// Structures
export { Base } from '@/structures/Base';
export { PaymentIntent } from '@/structures/PaymentIntent';
export { WebhookEndpoint } from '@/structures/WebhookEndpoint';
export { WebhookDelivery } from '@/structures/WebhookDelivery';
export { Product } from '@/structures/Product';
export { Customer } from '@/structures/Customer';

// Webhook signature verification
export {
  Webhooks,
  WebhookSignatureError,
} from '@/util/Webhooks';
export type { VerifyWebhookOptions } from '@/util/Webhooks';

// Shared / internal configuration (gateway URL, version, secrets) — maintained
// by Cosmos Pay so users only bring their apiKey.
export { shared, resolveShared } from '@/util/shared';
export type { SharedConfig } from '@/util/shared';

// Constants
export {
  version,
  Events,
  DEFAULT_BASE_URL,
  DEFAULT_VERSION,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRIES,
  SIGNATURE_HEADER,
} from '@/util/Constants';
export type { ClientEvent } from '@/util/Constants';

// Enums + all API types
export {
  PaymentIntentStatus,
  PaymentIntentKind,
  WebhookEventType,
  WebhookDeliveryStatus,
  ProductKind,
} from '@/types/index';
export type * from '@/types/index';
