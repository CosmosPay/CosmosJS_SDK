# Types & enums reference

Everything is fully typed. Import option/entity types and the const-enums directly
from `@cosmosapp/pay_sdk` (or `/web`).

```ts
import {
  Client,
  PaymentIntentStatus,
  PaymentIntentKind,
  WebhookEventType,
  WebhookDeliveryStatus,
  ProductKind,
  type CreatePayPaymentIntentOptions,
  type CreateTxPaymentIntentOptions,
  type PaymentIntentData,
} from '@cosmosapp/pay_sdk';
```

## Enums (const objects — usable as values and types)

```ts
PaymentIntentStatus = { Pending:'PENDING', Submitted:'SUBMITTED', Succeeded:'SUCCEEDED',
                        Failed:'FAILED', Cancelled:'CANCELLED', Expired:'EXPIRED' }
PaymentIntentKind   = { Tx:'TX', Pay:'PAY' }
WebhookEventType    = { PaymentIntentCreated:'PAYMENT_INTENT_CREATED',
                        PaymentIntentUpdated:'PAYMENT_INTENT_UPDATED',
                        PaymentIntentSucceeded:'PAYMENT_INTENT_SUCCEEDED',
                        PaymentIntentFailed:'PAYMENT_INTENT_FAILED',
                        PaymentIntentCancelled:'PAYMENT_INTENT_CANCELLED',
                        PaymentIntentDeleted:'PAYMENT_INTENT_DELETED' }
WebhookDeliveryStatus = { Pending:'PENDING', Succeeded:'SUCCEEDED', Failed:'FAILED' }
ProductKind         = { Recurring:'recurring', OneTime:'one_time', Link:'link' }
```

## Option types (inputs)

```ts
interface CreatePayPaymentIntentOptions {
  destination: string; amount?: string; asset?: AssetRef;
  assetCode?: string; assetIssuer?: string; memo?: string; msg?: string; callback?: string;
}
interface CreateTxPaymentIntentOptions {
  source: string; destination: string; amount: string; asset?: AssetRef;
  assetCode?: string; assetIssuer?: string; memo?: string; msg?: string; callback?: string;
}
interface UpdatePaymentIntentOptions { status?: PaymentIntentStatus; txHash?: string; reference?: string; }
interface ListPaymentIntentsOptions  { status?: PaymentIntentStatus; take?: number; skip?: number; }
interface ValidatePaymentIntentOptions { txHash: string; }

interface CreateWebhookEndpointOptions { url: string; description?: string; eventTypes?: WebhookEventType[]; }
interface UpdateWebhookEndpointOptions { url?: string; description?: string; enabled?: boolean; eventTypes?: WebhookEventType[]; }
interface ListWebhookDeliveriesOptions { status?: WebhookDeliveryStatus; take?: number; skip?: number; }

interface CreateProductOptions { name: string; description?: string; amount?: string; assetCode?: string; kind?: ProductKind; active?: boolean; reference?: string; }
type      UpdateProductOptions = Partial<CreateProductOptions>;

interface CreateCustomerOptions { name: string; alias?: string; note?: string; email?: string; account?: string; reference?: string; }
type      UpdateCustomerOptions = Partial<CreateCustomerOptions>;
```

## Entity payloads (outputs)

- `PaymentIntentData` — `id, kind, status, network, source, destination, amount,
  asset, assetIssuer, memo, msg, callback, xdr, uri, qr, txHash, reference,
  createdAt, updatedAt`.
- `WebhookEndpointData` — `id, url, description, enabled, eventTypes, createdAt,
  updatedAt` (+ `secret` on create/rotate only).
- `WebhookEvent<T = PaymentIntentData>` — `{ id, type, createdAt, data }`.
- `ProductData` — `id, name, description, amount, asset, kind, active, reference,
  createdAt, updatedAt`.
- `CustomerData` — `id, consumerId, name, alias, note, email, account, reference,
  createdAt, updatedAt` (+ list-only `payments, succeeded, total`).
- `AnalyticsBalancesData` — `{ data: { asset, amount, pending, count }[], total }`.
- `ValidationOutcomeData` — `{ valid, status, reason?, paymentIntent? }`.

Pagination wrappers (`list` / `fetchDeliveries`) return
`{ items, total, take, skip }`.
