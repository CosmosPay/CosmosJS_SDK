import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Client,
  PaymentIntent,
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '../dist/index.js';
import { mockFetch, fakeIntent } from './helpers.mjs';

const client = new Client({ apiKey: 'dv_test', fetch: mockFetch(() => ({})) });

test('PaymentIntent exposes typed kind/status helpers', () => {
  const pay = new PaymentIntent(client, fakeIntent({ kind: 'PAY', status: 'PENDING' }));
  assert.equal(pay.isPay, true);
  assert.equal(pay.isTx, false);
  assert.equal(pay.isPending, true);
  assert.equal(pay.isSucceeded, false);

  const tx = new PaymentIntent(client, fakeIntent({ kind: 'TX', status: 'SUCCEEDED' }));
  assert.equal(tx.isTx, true);
  assert.equal(tx.isSucceeded, true);
});

test('assetLabel maps native → XLM, otherwise the code', () => {
  const xlm = new PaymentIntent(client, fakeIntent({ asset: 'native' }));
  const usdc = new PaymentIntent(client, fakeIntent({ asset: 'USDC' }));
  assert.equal(xlm.assetLabel, 'XLM');
  assert.equal(usdc.assetLabel, 'USDC');
});

test('createdAt/updatedAt are parsed into Date objects', () => {
  const intent = new PaymentIntent(client, fakeIntent());
  assert.ok(intent.createdAt instanceof Date);
  assert.equal(intent.createdAt.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('toJSON round-trips back to the raw payload', () => {
  const raw = fakeIntent();
  const intent = new PaymentIntent(client, raw);
  assert.deepEqual(intent.toJSON(), raw);
});

test('valueOf returns the id so structures stringify nicely', () => {
  const intent = new PaymentIntent(client, fakeIntent({ id: 'pi_xyz' }));
  assert.equal(`${intent}`, 'pi_xyz');
  assert.equal(intent.valueOf(), 'pi_xyz');
});

test('CosmosPayAPIError resolves message/code from array and string bodies', () => {
  const arr = new CosmosPayAPIError({
    status: 400,
    method: 'POST',
    url: 'http://gw/x',
    body: { message: ['a', 'b'], code: 'bad_request' },
  });
  assert.equal(arr.code, 'bad_request');
  assert.match(arr.message, /\[400\] a, b/);

  const str = new CosmosPayAPIError({ status: 500, method: 'GET', url: 'http://gw', body: 'boom' });
  assert.match(str.message, /\[500\] boom/);
});

test('CosmosPayRequestError carries the original cause', () => {
  const cause = new Error('socket hang up');
  const err = new CosmosPayRequestError({ method: 'GET', url: 'http://gw', cause });
  assert.equal(err.cause, cause);
  assert.match(err.message, /socket hang up/);
});
