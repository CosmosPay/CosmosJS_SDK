import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  ActivityEventInput,
  ActivityListData,
  ActivityReportData,
  ActivitySummaryData,
  ListActivityOptions,
  ReportActivityOptions,
} from '@/types/index';

/** A page of events plus its pagination metadata. */
export interface ActivityPage {
  items: ActivityListData['data'];
  total: number;
  take: number;
  skip: number;
}

/**
 * The client event stream — `client.activity`.
 *
 * This is the trail the wallet, the dashboard and your own server write to: errors,
 * screen views, timings, the operations they built. It exists because a console is
 * not a trail — an extension popup's console dies with the popup and a phone's
 * WebView console needs a cable — and because the failures worth having are the
 * ones that never reach the API at all.
 *
 * Two rules the writers are expected to keep, and neither is enforceable here:
 * report only what the user consented to, and never put memo text or anything that
 * names a counterparty in `props`.
 *
 * @example
 * await client.activity.report([
 *   { type: 'checkout.opened', source: 'server', level: 'info', eventId: crypto.randomUUID() },
 * ]);
 */
export class ActivityManager {
  public readonly client: Client;
  private readonly route = '/activity';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /**
   * Report a batch of events.
   *
   * Accepts the array directly or the full body. Give each event an `eventId`: the
   * service de-duplicates on it, which is the difference between a retried batch
   * and a double-counted one.
   */
  public report(
    events: ActivityEventInput[] | ReportActivityOptions,
  ): Promise<ActivityReportData> {
    const body: ReportActivityOptions = Array.isArray(events) ? { events } : events;
    return this.rest.post<ActivityReportData>(`${this.route}/events`, { body });
  }

  /** Recent events for this consumer, newest first. */
  public async events(options: ListActivityOptions = {}): Promise<ActivityPage> {
    const data = await this.rest.get<ActivityListData>(`${this.route}/events`, {
      query: {
        take: options.take,
        skip: options.skip,
        source: options.source,
        level: options.level,
        category: options.category,
        type: options.type,
        network: options.network,
        since: options.since,
        until: options.until,
      },
    });
    return { items: data.data, total: data.total, take: data.take, skip: data.skip };
  }

  /** Counts, top event types, top errors and a daily series. */
  public summary(options: { days?: number; source?: string } = {}): Promise<ActivitySummaryData> {
    return this.rest.get<ActivitySummaryData>(`${this.route}/summary`, {
      query: { days: options.days, source: options.source },
    });
  }
}
