import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  AnalyticsBalancesData,
  AnalyticsSeriesData,
  AnalyticsSeriesOptions,
  AnalyticsSummaryData,
  ApiLogsData,
  WebhookLogsData,
} from '@/types/index';

/**
 * Read-only analytics derived from the consumer's intents and deliveries —
 * `client.analytics`. Powers dashboard-style Overview / Balances / Logs views.
 */
export class AnalyticsManager {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** Overview metrics: totals, settled volume, webhook health, 30-day series. */
  public summary(): Promise<AnalyticsSummaryData> {
    return this.rest.get<AnalyticsSummaryData>('/summary');
  }

  /**
   * Activity per day, week, month or year, with the window before for growth:
   * payments (with their settled volume in USD), swaps of every kind, liquidity
   * operations, webhook deliveries and private payments, each in the UTC
   * buckets of `period` (`day` when omitted).
   */
  public series(options: AnalyticsSeriesOptions = {}): Promise<AnalyticsSeriesData> {
    return this.rest.get<AnalyticsSeriesData>('/summary/series', {
      query: { period: options.period },
    });
  }

  /** Settled (and pending) amount per asset. */
  public balances(): Promise<AnalyticsBalancesData> {
    return this.rest.get<AnalyticsBalancesData>('/balances');
  }

  /** Recent API requests reaching the service (with details). */
  public apiLogs(): Promise<ApiLogsData> {
    return this.rest.get<ApiLogsData>('/logs');
  }

  /** Recent webhook deliveries across all endpoints (with details). */
  public webhookLogs(): Promise<WebhookLogsData> {
    return this.rest.get<WebhookLogsData>('/logs/webhooks');
  }
}
