import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  InstallPluginOptions,
  PluginActionResultData,
  PluginData,
  PluginListData,
  PluginUninstalledData,
} from '@/types/index';

/**
 * Plugins this deployment serves — `client.plugins`. A plugin runs only for a
 * consumer that installed it, and installing is consenting to exactly the
 * capabilities it declares: pass them back as `grantCapabilities`.
 *
 * @example
 * const plugin = await client.plugins.fetch('invoices');
 * await client.plugins.install('invoices', { grantCapabilities: plugin.capabilities });
 * const { output } = await client.plugins.query('invoices', 'list', { status: 'open' });
 */
export class PluginManager {
  public readonly client: Client;
  private readonly route = '/plugins';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  public async list(): Promise<PluginData[]> {
    const { data } = await this.rest.get<PluginListData>(this.route);
    return data;
  }

  public fetch(slug: string): Promise<PluginData> {
    return this.rest.get<PluginData>(`${this.route}/${encodeURIComponent(slug)}`);
  }

  /** Install (or re-consent to) a plugin. */
  public install(slug: string, options: InstallPluginOptions): Promise<PluginData> {
    return this.rest.put<PluginData>(
      `${this.route}/${encodeURIComponent(slug)}/installation`,
      { body: options },
    );
  }

  public uninstall(slug: string): Promise<PluginUninstalledData> {
    return this.rest.delete<PluginUninstalledData>(
      `${this.route}/${encodeURIComponent(slug)}/installation`,
    );
  }

  /** Run a read-only action the plugin declares. */
  public query<T = unknown>(
    slug: string,
    action: string,
    input?: Record<string, unknown>,
  ): Promise<PluginActionResultData<T>> {
    return this.rest.post<PluginActionResultData<T>>(
      `${this.route}/${encodeURIComponent(slug)}/queries/${encodeURIComponent(action)}`,
      { body: { input } },
    );
  }

  /** Run an action that may change the plugin's state. */
  public command<T = unknown>(
    slug: string,
    action: string,
    input?: Record<string, unknown>,
  ): Promise<PluginActionResultData<T>> {
    return this.rest.post<PluginActionResultData<T>>(
      `${this.route}/${encodeURIComponent(slug)}/commands/${encodeURIComponent(action)}`,
      { body: { input } },
    );
  }
}
