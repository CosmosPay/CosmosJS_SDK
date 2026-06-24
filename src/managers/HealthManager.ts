import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type { HealthCheckData } from '@/types/index';

/**
 * Service health probes — `client.health`. These routes are public (they don't
 * require an authenticated consumer).
 */
export class HealthManager {
  public readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** Liveness probe — resolves when the service is up. */
  public async liveness(): Promise<boolean> {
    await this.rest.get<unknown>('/health/liveness');
    return true;
  }

  /** Readiness probe (checks the database). Returns the health report. */
  public readiness(): Promise<HealthCheckData> {
    return this.rest.get<HealthCheckData>('/health/readiness');
  }
}
