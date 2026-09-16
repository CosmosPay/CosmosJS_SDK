import { LiquidityOperation } from '@/structures/LiquidityOperation';
import type {
  BrowseLiquidityPoolsOptions,
  DepositLiquidityOptions,
  LiquidityOperationData,
  LiquidityOperationListData,
  LiquidityOperationStatus,
  LiquidityPoolData,
  LiquidityPoolListData,
  LiquidityPositionsData,
  LiquiditySubmitOutcomeData,
  ListLiquidityOperationsOptions,
  SubmitLiquidityOptions,
  WithdrawLiquidityOptions,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

/** A page of liquidity operations plus its pagination metadata. */
export interface LiquidityOperationPage {
  items: LiquidityOperation[];
  total: number;
  take: number;
  skip: number;
}

/** A page of on-chain pools. Horizon paginates by cursor, not by offset. */
export interface LiquidityPoolPage {
  items: LiquidityPoolData[];
  /** Pass back as `cursor` to get the next page; null when there is none. */
  cursor: string | null;
}

/** Submission outcome with the refreshed operation materialized. */
export interface LiquiditySubmitOutcome {
  submitted: boolean;
  status: LiquidityOperationStatus;
  txHash: string | null;
  reason: string | null;
  resultCodes: string[] | null;
  operation: LiquidityOperation;
}

/**
 * Liquidity pools — `client.liquidity`.
 *
 * Two surfaces in one manager, because they are two halves of the same job:
 * *browsing* pools and positions (read-only, straight off Horizon), and
 * *operating* on them (deposit / withdraw), which produces an unsigned envelope
 * for a wallet to sign and a `submit()` to relay it back.
 *
 * The managed structure is the OPERATION, not the pool: a pool is a public
 * on-chain object with no lifecycle of its own, while an operation is a thing this
 * consumer created, can re-read and can push to the network.
 *
 * @example
 * const op = await client.liquidity.deposit({
 *   source: 'G…',
 *   assetACode: 'XLM',
 *   assetBCode: 'USDC',
 *   assetBIssuer: 'GA5Z…',
 *   maxAmountA: '100',
 *   maxAmountB: '25',
 * });
 * // …wallet signs op.xdr…
 * const { status, txHash } = await op.submit({ signedXdr });
 */
export class LiquidityManager extends BaseManager<LiquidityOperation> {
  private readonly route = '/liquidity-pools';

  /**
   * Build a deposit into the pool formed by the two assets → unsigned XDR, SEP-7
   * URI and QR.
   *
   * The pool is DERIVED from the two assets rather than named: a constant-product
   * pool id is a hash of its (assetA, assetB, fee) in CAP-38 order, so there is
   * exactly one pool the pair can form and no id for a caller to get wrong.
   */
  public async deposit(options: DepositLiquidityOptions): Promise<LiquidityOperation> {
    const { idempotencyKey, ...body } = options;
    const data = await this.rest.post<LiquidityOperationData>(`${this.route}/deposit`, {
      body: { ...body, ...(idempotencyKey ? { idempotencyKey } : {}) },
      // Sent as a header too: the service accepts either, and the header is what
      // makes a retried POST safe when the body was already consumed upstream.
      ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    });
    return this._add(new LiquidityOperation(this.client, data));
  }

  /** Build a withdrawal (burn shares) from a pool → unsigned XDR, SEP-7 URI and QR. */
  public async withdraw(options: WithdrawLiquidityOptions): Promise<LiquidityOperation> {
    const { idempotencyKey, ...body } = options;
    const data = await this.rest.post<LiquidityOperationData>(`${this.route}/withdraw`, {
      body: { ...body, ...(idempotencyKey ? { idempotencyKey } : {}) },
      ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    });
    return this._add(new LiquidityOperation(this.client, data));
  }

  /** An account's pool share positions, with what each is redeemable for right now. */
  public positions(account: string): Promise<LiquidityPositionsData> {
    return this.rest.get<LiquidityPositionsData>(`${this.route}/positions`, {
      query: { account },
    });
  }

  /** Browse on-chain pools (Horizon proxy). Filter by asset pair or by holder. */
  public async browse(options: BrowseLiquidityPoolsOptions = {}): Promise<LiquidityPoolPage> {
    const data = await this.rest.get<LiquidityPoolListData>(this.route, {
      query: {
        assetACode: options.assetACode,
        assetAIssuer: options.assetAIssuer,
        assetBCode: options.assetBCode,
        assetBIssuer: options.assetBIssuer,
        account: options.account,
        cursor: options.cursor,
        limit: options.limit,
      },
    });
    return { items: data.data, cursor: data.cursor ?? null };
  }

  /** One on-chain pool by its hex id (Horizon proxy). */
  public pool(poolId: string): Promise<LiquidityPoolData> {
    return this.rest.get<LiquidityPoolData>(`${this.route}/${poolId}`);
  }

  /** List this consumer's pool operations (paginated). */
  public async operations(
    options: ListLiquidityOperationsOptions = {},
  ): Promise<LiquidityOperationPage> {
    const data = await this.rest.get<LiquidityOperationListData>(`${this.route}/operations`, {
      query: {
        kind: options.kind,
        status: options.status,
        take: options.take,
        skip: options.skip,
      },
    });
    return {
      items: data.data.map((d) => this._add(new LiquidityOperation(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /** Get one operation by id, materialized. */
  public async fetch(id: string): Promise<LiquidityOperation> {
    return this._add(new LiquidityOperation(this.client, await this.fetchRaw(id)));
  }

  /**
   * The raw payload for one operation. Exists so {@link LiquidityOperation.fetch}
   * can patch itself in place instead of materializing a second instance of the
   * thing the caller is already holding.
   */
  public fetchRaw(id: string): Promise<LiquidityOperationData> {
    return this.rest.get<LiquidityOperationData>(`${this.route}/operations/${id}`);
  }

  /**
   * Relay a signed operation to the network. The service checks the envelope's
   * hash against the one it built, so a signed envelope that is not the one this
   * operation describes is refused rather than broadcast.
   */
  public async submit(
    id: string,
    options: SubmitLiquidityOptions,
  ): Promise<LiquiditySubmitOutcome> {
    const data = await this.rest.post<LiquiditySubmitOutcomeData>(
      `${this.route}/operations/${id}/submit`,
      { body: options },
    );
    return {
      submitted: data.submitted,
      status: data.status,
      txHash: data.txHash ?? null,
      reason: data.reason ?? null,
      resultCodes: data.resultCodes ?? null,
      operation: this._add(new LiquidityOperation(this.client, data.operation)),
    };
  }
}
