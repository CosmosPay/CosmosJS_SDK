import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  ActivatePollarWalletOptions,
  PollarActivationData,
  PollarAuthorizeData,
  PollarAuthorizeOptions,
  PollarLoginSessionData,
  PollarLogoutData,
  PollarLogoutOptions,
  PollarRefreshData,
  PollarRefreshOptions,
  PollarSessionData,
  PollarTokenOptions,
  PollarTokenVerificationData,
  PollarTrustlineData,
  PollarTrustlinesOptions,
  PollarUserData,
  RegisterPollarUserOptions,
  VerifyPollarTokenOptions,
} from '@/types/index';

/**
 * Pollar — social login and the custodial wallets behind it — `client.pollar`.
 *
 * The login is a three-legged flow, and the middle leg is the one that surprises
 * people: the browser leaves for the provider and comes back to POLLAR, not to
 * you, so a client cannot simply await a redirect. It polls instead.
 *
 *   1. `authorize()` → a `state` and the `authorization_url` to open.
 *   2. `session(state)` until `status` is `authorized`, which carries a bridge `code`.
 *   3. `token({ code, code_verifier })` → the session, its wallets and the profile.
 *
 * Use PKCE. The code travels through a redirect a client does not control, and the
 * `code_verifier` is the only reason an intercepted one is worth nothing. With a
 * `redirect_uri` it is not a choice: the service refuses that authorize without a
 * `code_challenge` (`400 validation_failed`).
 *
 * The session only comes back to the account that owns the API key. Every tenant
 * shares one Pollar application, so `token()` compares the email the login reports
 * with the key's account email and refuses a login someone else completed with
 * `403 pollar_identity_mismatch` — the session is revoked, never returned. A key
 * whose account has no verified email gets `403 pollar_identity_required` at
 * `authorize()`.
 *
 * The two callback routes (`/oauth/callback…`) are deliberately absent from this
 * manager: they are where a BROWSER lands, not something a server calls. Polling
 * `session()` is the programmatic half of the same step.
 *
 * @example
 * const { state, authorization_url } = await client.pollar.authorize({
 *   provider: 'google',
 *   code_challenge: challenge,
 *   code_challenge_method: 'S256',
 * });
 * // open `authorization_url`, then poll:
 * const polled = await client.pollar.session(state);
 * if (polled.status === 'authorized') {
 *   const session = await client.pollar.token({ code: polled.code, code_verifier: verifier });
 * }
 */
export class PollarManager {
  public readonly client: Client;
  private readonly route = '/pollar';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /* -------------------------------- login -------------------------------- */

  /** Start a login and get the URL to send the user to. */
  public authorize(options: PollarAuthorizeOptions): Promise<PollarAuthorizeData> {
    return this.rest.post<PollarAuthorizeData>(`${this.route}/oauth/authorize`, { body: options });
  }

  /**
   * Poll a login. `status: 'authorized'` carries the bridge `code` to redeem;
   * `pending` means keep waiting; anything else is over.
   */
  public session(state: string): Promise<PollarLoginSessionData> {
    return this.rest.get<PollarLoginSessionData>(`${this.route}/oauth/sessions/${state}`);
  }

  /** Redeem the bridge code for a session. Single use — a consumed code is dead. */
  public token(options: PollarTokenOptions): Promise<PollarSessionData> {
    return this.rest.post<PollarSessionData>(`${this.route}/oauth/token`, { body: options });
  }

  /**
   * Rotate the token pair. The old refresh token stops working, so store what
   * comes back before using it — a rotation you lose is a session you lose.
   */
  public refresh(options: PollarRefreshOptions): Promise<PollarRefreshData> {
    return this.rest.post<PollarRefreshData>(`${this.route}/oauth/refresh`, { body: options });
  }

  /** Revoke a session — this device, or every one of them. */
  public logout(options: PollarLogoutOptions): Promise<PollarLogoutData> {
    return this.rest.post<PollarLogoutData>(`${this.route}/oauth/logout`, { body: options });
  }

  /** Validate an end-user access token and learn whose it is. */
  public verifyToken(options: VerifyPollarTokenOptions): Promise<PollarTokenVerificationData> {
    return this.rest.post<PollarTokenVerificationData>(`${this.route}/tokens/verify`, {
      body: options,
    });
  }

  /* ------------------------------- wallets ------------------------------- */

  /**
   * Fund a wallet's XLM base reserve. A Stellar account does not exist until
   * something pays for it, which is why a fresh Pollar wallet can have an address
   * and still not be on the network.
   */
  public activateWallet(options: ActivatePollarWalletOptions): Promise<PollarActivationData> {
    return this.rest.post<PollarActivationData>(`${this.route}/wallets/activate`, {
      body: options,
    });
  }

  /** Enable the application's configured assets on a wallet. */
  public addDefaultTrustlines(address: string): Promise<PollarTrustlineData> {
    return this.rest.post<PollarTrustlineData>(
      `${this.route}/wallets/${address}/trustlines/default`,
    );
  }

  /** Enable specific assets on a wallet. */
  public addTrustlines(
    address: string,
    options: PollarTrustlinesOptions,
  ): Promise<PollarTrustlineData> {
    return this.rest.post<PollarTrustlineData>(`${this.route}/wallets/${address}/trustlines`, {
      body: options,
    });
  }

  /**
   * Remove a trustline. An asset is `(code, issuer)`, and both are in the path for
   * that reason: a bare code names no asset.
   */
  public removeTrustline(
    address: string,
    code: string,
    issuer: string,
  ): Promise<PollarTrustlineData> {
    return this.rest.delete<PollarTrustlineData>(
      `${this.route}/wallets/${address}/trustlines/${code}/${issuer}`,
    );
  }

  /* -------------------------------- users -------------------------------- */

  /**
   * Register a user with Pollar ahead of their first login. Needs an elevated
   * (admin) key: the Pollar user directory is shared by every tenant, so a tenant
   * key gets `403 elevated_key_required`.
   */
  public registerUser(options: RegisterPollarUserOptions): Promise<PollarUserData> {
    return this.rest.post<PollarUserData>(`${this.route}/users`, { body: options });
  }

  /**
   * Register a user AND provision their Stellar wallet in one call — the variant
   * to use when the user should be able to receive before they ever log in. Needs
   * an elevated (admin) key, like {@link registerUser}.
   */
  public registerUserWithWallet(options: RegisterPollarUserOptions): Promise<PollarUserData> {
    return this.rest.post<PollarUserData>(`${this.route}/users/with-wallet`, { body: options });
  }
}
