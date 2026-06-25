// Shared test helpers — offline fake `fetch` + webhook signing utilities.
// The whole suite runs without a network or API key.

import { createHmac } from 'node:crypto';

/**
 * Build a fake `fetch` for injection into the Client.
 *
 * Pass a `handler(url, init, call)` that returns either:
 *   - a plain object        → sent back as 200 JSON
 *   - `{ status, body, headers }` → full control over the response
 *   - a thrown Error        → simulates a network failure
 *
 * Every call is recorded on `fetch.calls` for assertions.
 *
 * @param {(url: string, init: any, call: number) => any} handler
 */
export function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const call = { url: String(url), init, method: init.method ?? 'GET' };
    if (init.body) {
      try {
        call.body = JSON.parse(init.body);
      } catch {
        call.body = init.body;
      }
    }
    call.headers = init.headers ?? {};
    calls.push(call);

    const result = await handler(call.url, init, calls.length - 1);
    return toResponse(result);
  };
  fn.calls = calls;
  return fn;
}

/** A fetch that always returns the same JSON body (status 200). */
export function jsonOnce(body) {
  return mockFetch(() => body);
}

function toResponse(result) {
  if (result instanceof Response) return result;

  // Distinguish a response envelope (`{ status: 404, body, headers }`) from a
  // bare JSON payload that merely happens to carry its own `status` field
  // (payment intents do). Only a *numeric* status — or an explicit body/headers
  // key — marks an envelope.
  const hasEnvelope =
    result &&
    typeof result === 'object' &&
    (typeof result.status === 'number' || 'body' in result || 'headers' in result);

  const status = hasEnvelope ? result.status ?? 200 : 200;
  const headers = new Headers({
    'content-type': 'application/json',
    ...(hasEnvelope ? result.headers ?? {} : {}),
  });
  const payload = hasEnvelope ? result.body : result;
  const text = payload === undefined || payload === null ? '' : JSON.stringify(payload);

  return new Response(text, { status, headers });
}

/**
 * Produce a valid `X-Cosmos-Signature` header for a raw body, exactly the way
 * the Cosmos Pay dispatcher does: HMAC-SHA256 over `${t}.${rawBody}`.
 */
export function signWebhook(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const payload = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody).toString('utf8');
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return { header: `t=${timestamp},v1=${signature}`, timestamp, signature };
}

/** A minimal fake payment-intent payload the API would return. */
export function fakeIntent(overrides = {}) {
  return {
    id: 'pi_test_123',
    kind: 'PAY',
    status: 'PENDING',
    network: 'testnet',
    source: null,
    destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    amount: '12.5',
    asset: 'native',
    assetIssuer: null,
    memo: '999',
    msg: 'Coffee',
    callback: null,
    xdr: null,
    uri: 'web+stellar:pay?destination=GCALNQQ...',
    qr: 'data:image/png;base64,AAAA',
    txHash: null,
    reference: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
