import type { Client } from '@/client/Client';
import type {
  ListWebhookDeliveriesOptions,
  UpdateWebhookEndpointOptions,
  WebhookEndpointData,
  WebhookEndpointWithSecretData,
  WebhookEventType,
} from '@/types/index';
import { Base } from '@/structures/Base';

/**
 * A registered webhook endpoint.
 *
 * Note: the signing `secret` is only ever present on the instance returned by
 * `create()` / `rotateSecret()` — list/get responses never include it.
 */
export class WebhookEndpoint extends Base<WebhookEndpointData> {
  public url!: string;
  public description!: string | null;
  public enabled!: boolean;
  public eventTypes!: WebhookEventType[];
  public createdAt!: Date;
  public updatedAt!: Date;
  /** HMAC signing secret — only set on create/rotate responses. */
  public readonly secret: string | null;

  constructor(
    client: Client,
    data: WebhookEndpointData | WebhookEndpointWithSecretData,
  ) {
    super(client, data);
    this.secret = 'secret' in data ? data.secret : null;
  }

  protected override _patch(
    data: WebhookEndpointData | WebhookEndpointWithSecretData,
  ): this {
    super._patch(data);
    this.url = data.url;
    this.description = data.description;
    this.enabled = data.enabled;
    this.eventTypes = data.eventTypes;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** Whether the endpoint receives all events (empty subscription). */
  public get receivesAllEvents(): boolean {
    return this.eventTypes.length === 0;
  }

  /** Re-fetch this endpoint. */
  public fetch(): Promise<WebhookEndpoint> {
    return this.client.webhooks.fetch(this.id);
  }

  /** Update url/description/enabled/eventTypes. Mutates and returns this. */
  public async edit(options: UpdateWebhookEndpointOptions): Promise<this> {
    const updated = await this.client.webhooks.update(this.id, options);
    return this._patch(updated.toJSON());
  }

  /** Pause deliveries to this endpoint. */
  public disable(): Promise<this> {
    return this.edit({ enabled: false });
  }

  /** Resume deliveries to this endpoint. */
  public enable(): Promise<this> {
    return this.edit({ enabled: true });
  }

  /** Rotate the signing secret (returns a new instance carrying the secret). */
  public rotateSecret(): Promise<WebhookEndpoint> {
    return this.client.webhooks.rotateSecret(this.id);
  }

  /** Send a test event to verify the endpoint. */
  public ping() {
    return this.client.webhooks.ping(this.id);
  }

  /** List delivery attempts for this endpoint. */
  public fetchDeliveries(options?: ListWebhookDeliveriesOptions) {
    return this.client.webhooks.fetchDeliveries(this.id, options);
  }

  /** Delete this endpoint. */
  public delete() {
    return this.client.webhooks.delete(this.id);
  }

  public toJSON(): WebhookEndpointData {
    return {
      id: this.id,
      url: this.url,
      description: this.description,
      enabled: this.enabled,
      eventTypes: this.eventTypes,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
