import { Usdt0Transfer } from '@/structures/Usdt0Transfer';
import type {
  CreateUsdt0TransferOptions,
  ListUsdt0TransfersOptions,
  QuoteUsdt0Options,
  SubmitUsdt0TransferOptions,
  Usdt0QuoteData,
  Usdt0RecordTokenOptions,
  Usdt0RoutesData,
  Usdt0SubmitOutcomeData,
  Usdt0TransferData,
  Usdt0TransferListData,
  Usdt0TransferStatus,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

/** A page of USDT0 transfers plus its pagination metadata. */
export interface Usdt0TransferPage {
  items: Usdt0Transfer[];
  total: number;
  take: number;
  skip: number;
}

/** Submission outcome of a USDT0 transfer, with the refreshed transfer materialized. */
export interface Usdt0SubmitOutcome {
  /** True when the network accepted the transaction (SUBMITTED, or already DELIVERED). */
  submitted: boolean;
  status: Usdt0TransferStatus;
  txHash: string | null;
  /** Why it was not submitted: refused by the network (still PENDING, submit again) or failed on the ledger. */
  reason: string | null;
  transfer: Usdt0Transfer;
}

/** The `X-Record-Token` header, when there is a token to send. */
function recordTokenHeader(recordToken: string | undefined): { headers?: Record<string, string> } {
  return recordToken ? { headers: { 'X-Record-Token': recordToken } } : {};
}

/**
 * USDT0 from Stellar to EVM networks: `client.usdt0`.
 *
 * USDT0 is Tether's omnichain USDT. From Stellar it travels through LayerZero's
 * OFT: Ethereum receives native USDT, every other network receives USDT0, and
 * every route takes an EVM recipient. Signing works like a swap: the API builds
 * the transaction, the holder signs it, and {@link submit} relays the signed XDR.
 * The holder pays LayerZero's fee and the network fee in XLM. Mainnet only: a
 * `dev` key gets `available: false` from {@link routes}, and `400
 * network_unsupported` from {@link quote} and {@link create}.
 *
 * @example
 * const quote = await client.usdt0.quote({ to: 'arb', amount: '12.5' });
 * const transfer = await client.usdt0.create({
 *   source: 'G...', to: 'arb', recipient: '0x5aAe...', amount: '12.5',
 * });
 * // ...the holder signs transfer.xdr (or opens transfer.uri)...
 * await transfer.submit({ signedXdr });
 * await transfer.fetch(); // transfer.status: SUBMITTED, then DELIVERED
 */
export class Usdt0Manager extends BaseManager<Usdt0Transfer> {
  private readonly route = '/usdt0';

  /** The networks USDT0 can be sent to from Stellar, with the token and OFT a transfer uses. */
  public routes(): Promise<Usdt0RoutesData> {
    return this.rest.get<Usdt0RoutesData>(`${this.route}/routes`);
  }

  /**
   * Price a transfer: what is sent and arrives, the dust, LayerZero's fee and the
   * OFT's limits. Persists nothing.
   */
  public quote(options: QuoteUsdt0Options): Promise<Usdt0QuoteData> {
    return this.rest.post<Usdt0QuoteData>(`${this.route}/quote`, { body: options });
  }

  /** Build a transfer: the one unsigned Soroban transaction the holder signs (XDR and SEP-7 link). */
  public async create(options: CreateUsdt0TransferOptions): Promise<Usdt0Transfer> {
    const { idempotencyKey, ...body } = options;
    const data = await this.rest.post<Usdt0TransferData>(`${this.route}/transfers`, {
      body: { ...body, ...(idempotencyKey ? { idempotencyKey } : {}) },
      ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    });
    return this._add(new Usdt0Transfer(this.client, data));
  }

  /** List your transfers, newest first, as last refreshed (fetch one to refresh it). */
  public async list(options: ListUsdt0TransfersOptions = {}): Promise<Usdt0TransferPage> {
    const data = await this.rest.get<Usdt0TransferListData>(`${this.route}/transfers`, {
      query: { status: options.status, take: options.take, skip: options.skip },
    });
    return {
      items: data.data.map((d) => this._add(new Usdt0Transfer(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /**
   * Get one transfer. While PENDING or SUBMITTED the API refreshes it from the
   * Stellar ledger and LayerZero Scan (at most every 15 seconds).
   */
  public async fetch(id: string, options: Usdt0RecordTokenOptions = {}): Promise<Usdt0Transfer> {
    const data = await this.rest.get<Usdt0TransferData>(
      `${this.route}/transfers/${id}`,
      recordTokenHeader(options.recordToken),
    );
    return this._add(new Usdt0Transfer(this.client, data));
  }

  /**
   * Relay the signed transaction to Stellar mainnet. It must be the transaction
   * the API built for this transfer, signed. A refusal by the network leaves it
   * PENDING (`submitted: false`, `reason`) to submit again until it expires.
   */
  public async submit(
    id: string,
    options: SubmitUsdt0TransferOptions & Usdt0RecordTokenOptions,
  ): Promise<Usdt0SubmitOutcome> {
    const { recordToken, ...body } = options;
    const data = await this.rest.post<Usdt0SubmitOutcomeData>(
      `${this.route}/transfers/${id}/submit`,
      { body, ...recordTokenHeader(recordToken) },
    );
    return {
      submitted: data.submitted,
      status: data.status,
      txHash: data.txHash ?? null,
      reason: data.reason ?? null,
      transfer: this._add(new Usdt0Transfer(this.client, data.transfer)),
    };
  }
}
