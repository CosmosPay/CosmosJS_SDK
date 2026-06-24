import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REST,
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '../dist/index.js';
import { mockFetch, fakeIntent } from './helpers.mjs';

test('REST requires a baseURL', () => {
  assert.throws(() => new REST({}), /baseURL/);
});

test('buildURL applies the version prefix and trims trailing slashes', () => {
  const rest = new REST({ baseURL: 'http://gw/', fetch: mockFetch(() => ({})) });
  assert.equal(rest.buildURL('/payment-intents'), 'http://gw/v1/payment-intents');
  assert.equal(rest.buildURL('payment-intents'), 'http://gw/v1/payment-intents');
});

test('buildURL serializes query params and drops null/undefined', () => {
  const rest = new REST({ baseURL: 'http://gw', fetch: mockFetch(() => ({})) });
  const url = rest.buildURL('/payment-intents', {
    status: 'SUCCEEDED',
    take: 50,
    skip: undefined,
    cursor: null,
  });
  assert.equal(url, 'http://gw/v1/payment-intents?status=SUCCEEDED&take=50');
});

test('an empty version segment is omitted', () => {
  const rest = new REST({ baseURL: 'http://gw', version: '', fetch: mockFetch(() => ({})) });
  assert.equal(rest.buildURL('/health'), 'http://gw/health');
});

test('non-2xx responses throw a CosmosPayAPIError with status, code and body', async () => {
  const fetch = mockFetch(() => ({
    status: 404,
    body: { message: 'Not found', code: 'not_found' },
  }));
  const rest = new REST({ baseURL: 'http://gw', retries: 0, fetch });

  await assert.rejects(
    () => rest.get('/payment-intents/missing'),
    (err) => {
      assert.ok(err instanceof CosmosPayAPIError);
      assert.equal(err.status, 404);
      assert.equal(err.code, 'not_found');
      assert.deepEqual(err.body, { message: 'Not found', code: 'not_found' });
      assert.match(err.message, /\[404\] Not found/);
      return true;
    },
  );
});

test('retries on 429 then succeeds (Retry-After: 0 keeps it instant)', async () => {
  let n = 0;
  const fetch = mockFetch(() => {
    n += 1;
    if (n === 1) return { status: 429, headers: { 'retry-after': '0' }, body: { message: 'slow down' } };
    return fakeIntent();
  });
  const rest = new REST({ baseURL: 'http://gw', retries: 2, fetch });

  const data = await rest.get('/payment-intents/pi_1');
  assert.equal(data.id, 'pi_test_123');
  assert.equal(fetch.calls.length, 2); // one retry
});

test('retries are exhausted on persistent 503', async () => {
  const fetch = mockFetch(() => ({ status: 503, headers: { 'retry-after': '0' }, body: { message: 'down' } }));
  const rest = new REST({ baseURL: 'http://gw', retries: 2, fetch });

  await assert.rejects(() => rest.get('/health'), CosmosPayAPIError);
  assert.equal(fetch.calls.length, 3); // initial + 2 retries
});

test('network failures surface as CosmosPayRequestError', async () => {
  const fetch = mockFetch(() => {
    throw new Error('ECONNREFUSED');
  });
  const rest = new REST({ baseURL: 'http://gw', retries: 0, fetch });

  await assert.rejects(
    () => rest.get('/health'),
    (err) => {
      assert.ok(err instanceof CosmosPayRequestError);
      assert.match(err.message, /ECONNREFUSED/);
      return true;
    },
  );
});

test('a JSON body is serialized with a Content-Type header', async () => {
  const fetch = mockFetch(() => fakeIntent());
  const rest = new REST({ baseURL: 'http://gw', fetch });

  await rest.post('/payment-intents/pay', { body: { destination: 'G...', amount: '10' } });

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.deepEqual(call.body, { destination: 'G...', amount: '10' });
});
