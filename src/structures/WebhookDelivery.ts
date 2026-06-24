import type { Client } from '@/client/Client';
import {
  WebhookDeliveryStatus,
  WebhookEventType,
  type WebhookDeliveryData,
} from '@/types/index';
import { Base } from '@/structures/Base';

/** A single attempt to deliver an event to a webhook endpoint (audit record). */
export class WebhookDelivery extends Base<WebhookDeliveryData> {
  public endpointId!: string;
  public eventType!: WebhookEventType;
  public eventId!: string;
  public payload!: Record<string, unknown>;
  public status!: WebhookDeliveryStatus;
  public attempts!: number;
  public responseStatus!: number | null;
  public error!: string | null;
  public lastAttemptAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: WebhookDeliveryData) {
    super(client, data);
  }

  protected override _patch(data: WebhookDeliveryData): this {
    super._patch(data);
    this.endpointId = data.endpointId;
    this.eventType = data.eventType;
    this.eventId = data.eventId;
    this.payload = data.payload;
    this.status = data.status;
    this.attempts = data.attempts;
    this.responseStatus = data.responseStatus;
    this.error = data.error;
    this.lastAttemptAt = data.lastAttemptAt ? new Date(data.lastAttemptAt) : null;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  public get isSucceeded(): boolean {
    return this.status === WebhookDeliveryStatus.Succeeded;
  }

  /** Manually re-send this delivery. */
  public redeliver(): Promise<WebhookDelivery> {
    return this.client.webhooks.redeliver(this.endpointId, this.id);
  }

  public toJSON(): WebhookDeliveryData {
    return {
      id: this.id,
      endpointId: this.endpointId,
      eventType: this.eventType,
      eventId: this.eventId,
      payload: this.payload,
      status: this.status,
      attempts: this.attempts,
      responseStatus: this.responseStatus,
      error: this.error,
      lastAttemptAt: this.lastAttemptAt ? this.lastAttemptAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
