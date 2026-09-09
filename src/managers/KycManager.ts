import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import { Receiver } from '@/structures/Receiver';
import { BaseManager } from '@/managers/BaseManager';
import type {
  ApproveReceiverOptions,
  BankAccountData,
  BankAccountListData,
  BankDetailsData,
  CreateBankAccountOptions,
  CreateReceiverOptions,
  CreateReceiverWalletOptions,
  EnableReceiverOptions,
  InitiateTosOptions,
  KycRailsData,
  KycUploadData,
  ListKycOptions,
  ReceiverData,
  ReceiverListData,
  ReceiverWalletData,
  ReceiverWalletListData,
  RequestTosOptions,
  SetReceiverAccessOptions,
  TermsOfServiceData,
  UpdateReceiverOptions,
  WalletSignMessageData,
} from '@/types/index';

/** A page of receivers plus its pagination metadata. */
export interface ReceiverPage {
  items: Receiver[];
  total: number;
  take: number;
  skip: number;
}

/** A page of a receiver's wallets. */
export interface ReceiverWalletPage {
  items: ReceiverWalletData[];
  total: number;
  take: number;
  skip: number;
}

/** A page of a receiver's bank accounts. */
export interface BankAccountPage {
  items: BankAccountData[];
  total: number;
  take: number;
  skip: number;
}

/**
 * KYC / KYB — `client.kyc`.
 *
 * A receiver is the verified identity both ramps hang off: an on-ramp pays INTO
 * one of its wallets, an off-ramp pays OUT to one of its bank accounts, and
 * neither works until verification passes.
 *
 * The order is not obvious and the API will not guess it for you:
 *
 *   1. `termsOfService()` — the acceptance the provider requires up front, which
 *      returns a `tos_id`.
 *   2. `upload()` each document, keeping the `file_url` it returns.
 *   3. `createReceiver()` with those URLs and the `tos_id`.
 *   4. `addWallet()` / `addBankAccount()` for where money should land.
 *   5. verification runs; `fetchReceiver()` refreshes `kycStatus` from upstream.
 *
 * @example
 * const tos = await client.kyc.termsOfService({ redirect_url: 'https://app/kyc/done' });
 * const { file_url } = await client.kyc.upload(fileBase64);
 * const receiver = await client.kyc.createReceiver({
 *   type: 'individual', kyc_type: 'standard', email: 'a@b.com', country: 'BR',
 *   id_doc_front_file: file_url, tos_id: tosId,
 * });
 */
export class KycManager extends BaseManager<Receiver> {
  private readonly route = '/kyc';

  /* ----------------------------- receivers ------------------------------- */

  /** Create a receiver and start verification. */
  public async createReceiver(options: CreateReceiverOptions): Promise<Receiver> {
    const data = await this.rest.post<ReceiverData>(`${this.route}/receivers`, { body: options });
    return this._add(new Receiver(this.client, data));
  }

  /** List this consumer's receivers (paginated). */
  public async receivers(options: ListKycOptions = {}): Promise<ReceiverPage> {
    const data = await this.rest.get<ReceiverListData>(`${this.route}/receivers`, {
      query: { take: options.take, skip: options.skip },
    });
    return {
      items: data.data.map((d) => this._add(new Receiver(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /** One receiver, materialized. Reading it refreshes `kycStatus` upstream. */
  public async fetchReceiver(id: string): Promise<Receiver> {
    return this._add(new Receiver(this.client, await this.fetchReceiverRaw(id)));
  }

  /** The raw payload, so a {@link Receiver} can patch itself in place. */
  public fetchReceiverRaw(id: string): Promise<ReceiverData> {
    return this.rest.get<ReceiverData>(`${this.route}/receivers/${id}`);
  }

  /** Update a receiver — the same fields as creation, all optional. */
  public async updateReceiver(id: string, options: UpdateReceiverOptions): Promise<Receiver> {
    const data = await this.rest.patch<ReceiverData>(`${this.route}/receivers/${id}`, {
      body: options,
    });
    return this._add(new Receiver(this.client, data));
  }

  /** Delete a receiver. */
  public async deleteReceiver(id: string): Promise<void> {
    await this.rest.delete<unknown>(`${this.route}/receivers/${id}`);
    this.cache.delete(id);
  }

  /**
   * Approve a receiver sitting in review. Admin-only: it is the human gate on a
   * verification the provider could not decide by itself.
   */
  public approveReceiver(id: string, options: ApproveReceiverOptions = {}): Promise<ReceiverData> {
    return this.rest.post<ReceiverData>(`${this.route}/receivers/${id}/approve`, { body: options });
  }

  /**
   * Ask for a terms-of-service link for an existing receiver. `channel: 'code'`
   * returns the URL to render; `'email'` sends it to the receiver instead.
   */
  public requestTos(id: string, options: RequestTosOptions): Promise<TermsOfServiceData> {
    return this.rest.post<TermsOfServiceData>(`${this.route}/receivers/${id}/tos`, {
      body: options,
    });
  }

  /** Enable an inactive receiver with an accepted terms-of-service id. */
  public async enableReceiver(id: string, options: EnableReceiverOptions): Promise<Receiver> {
    const data = await this.rest.post<ReceiverData>(`${this.route}/receivers/${id}/enable`, {
      body: options,
    });
    return this._add(new Receiver(this.client, data));
  }

  /**
   * Cut a receiver off from both ramps, or let it back in. Admin-only, and the
   * fastest lever there is when something is wrong with an account.
   */
  public async setReceiverAccess(
    id: string,
    options: SetReceiverAccessOptions,
  ): Promise<Receiver> {
    const data = await this.rest.patch<ReceiverData>(`${this.route}/receivers/${id}/access`, {
      body: options,
    });
    return this._add(new Receiver(this.client, data));
  }

  /* ------------------------------ wallets -------------------------------- */

  /**
   * The message a receiver must sign to prove it controls an address. Sign it,
   * then pass the resulting transaction hash as `signature_tx_hash` to
   * {@link addWallet}.
   */
  public walletSignMessage(receiverId: string): Promise<WalletSignMessageData> {
    return this.rest.get<WalletSignMessageData>(
      `${this.route}/receivers/${receiverId}/wallets/sign-message`,
    );
  }

  /** Register a blockchain wallet for a receiver. */
  public addWallet(
    receiverId: string,
    options: CreateReceiverWalletOptions,
  ): Promise<ReceiverWalletData> {
    return this.rest.post<ReceiverWalletData>(`${this.route}/receivers/${receiverId}/wallets`, {
      body: options,
    });
  }

  /** A receiver's wallets (paginated). */
  public async wallets(
    receiverId: string,
    options: ListKycOptions = {},
  ): Promise<ReceiverWalletPage> {
    const data = await this.rest.get<ReceiverWalletListData>(
      `${this.route}/receivers/${receiverId}/wallets`,
      { query: { take: options.take, skip: options.skip } },
    );
    return { items: data.data, total: data.total, take: data.take, skip: data.skip };
  }

  /** Delete one of a receiver's wallets. */
  public async deleteWallet(receiverId: string, id: string): Promise<void> {
    await this.rest.delete<unknown>(`${this.route}/receivers/${receiverId}/wallets/${id}`);
  }

  /* ---------------------------- bank accounts ---------------------------- */

  /** Add a fiat bank account for a receiver — where an off-ramp pays out. */
  public addBankAccount(
    receiverId: string,
    options: CreateBankAccountOptions,
  ): Promise<BankAccountData> {
    return this.rest.post<BankAccountData>(
      `${this.route}/receivers/${receiverId}/bank-accounts`,
      { body: options },
    );
  }

  /** A receiver's bank accounts (paginated). */
  public async bankAccounts(
    receiverId: string,
    options: ListKycOptions = {},
  ): Promise<BankAccountPage> {
    const data = await this.rest.get<BankAccountListData>(
      `${this.route}/receivers/${receiverId}/bank-accounts`,
      { query: { take: options.take, skip: options.skip } },
    );
    return { items: data.data, total: data.total, take: data.take, skip: data.skip };
  }

  /** Delete one of a receiver's bank accounts. */
  public async deleteBankAccount(receiverId: string, id: string): Promise<void> {
    await this.rest.delete<unknown>(`${this.route}/receivers/${receiverId}/bank-accounts/${id}`);
  }

  /* ------------------------------ the rest ------------------------------- */

  /**
   * Upload a KYC document and get back the `file_url` every `*_file` field
   * expects. Documents are uploaded first and referenced by URL — the receiver
   * payload never carries bytes.
   */
  public upload(file: unknown): Promise<KycUploadData> {
    return this.rest.post<KycUploadData>(`${this.route}/upload`, { body: file });
  }

  /**
   * Start terms-of-service acceptance and get the hosted URL. This is the FIRST
   * step of the flow: the provider will not create a receiver without the `tos_id`
   * it produces.
   */
  public termsOfService(options: InitiateTosOptions = {}): Promise<TermsOfServiceData> {
    return this.rest.post<TermsOfServiceData>(`${this.route}/terms-of-service`, { body: options });
  }

  /** The bank rails available to this consumer. */
  public rails(): Promise<KycRailsData> {
    return this.rest.get<KycRailsData>(`${this.route}/rails`);
  }

  /**
   * The field schema a given rail requires. The authority on which of the ~70
   * rail-specific bank-account fields to send — read it at runtime rather than
   * hard-coding a rail's shape.
   */
  public bankDetails(rail: string): Promise<BankDetailsData> {
    return this.rest.get<BankDetailsData>(`${this.route}/bank-details`, { query: { rail } });
  }

  protected get rest(): REST {
    return this.client.rest;
  }
}
