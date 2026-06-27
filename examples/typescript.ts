// TypeScript — the SDK is fully typed. Import option/entity types and the
// const-enums directly. Compile with `tsc`, or run with `tsx examples/typescript.ts`.
import {
  Client,
  Assets,
  PaymentIntentStatus,
  WebhookEventType,
  ProductKind,
  type CreatePayPaymentIntentOptions,
  type PaymentIntentData,
  type ClientOptions,
} from '@cosmosapp/pay_sdk';

const options: ClientOptions = { apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' };
const client = new Client(options);

// Option objects are type-checked at the call site.
const payOptions: CreatePayPaymentIntentOptions = {
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '10',
  asset: Assets.USDC,
};

async function main(): Promise<void> {
  const intent = await client.paymentIntents.createPay(payOptions);

  // Narrowing with the typed enums + helpers.
  if (intent.status === PaymentIntentStatus.Succeeded) {
    console.log('already settled');
  }
  console.log(intent.isPay, intent.assetLabel, intent.uri);

  // The raw payload type, e.g. for persisting to your DB.
  const data: PaymentIntentData = intent.toJSON();
  console.log(data.id, data.kind);

  // Enums are plain const objects — use them as values or types.
  const event: WebhookEventType = WebhookEventType.PaymentIntentSucceeded;
  const kind: ProductKind = ProductKind.Recurring;
  console.log(event, kind);
}

void main();
