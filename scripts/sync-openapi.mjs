/**
 * Refresh `openapi/openapi.json` — the SDK's copy of the Payments API contract.
 *
 * The SDK is hand-written, and that is fine; what is not fine is a hand-written client
 * that can drift from the server without anything noticing. So the server's own spec is
 * vendored here, and `test/openapi.test.mjs` checks every call the SDK makes against it:
 * a path or a method the server does not serve fails the suite, and so does a server
 * route the SDK neither implements nor lists in `openapi/unsupported.json`.
 *
 * The source is the community server's generated spec, VERBATIM — no transform. The
 * developer platform's docs copy is the same spec with public-facing auth rewritten; that
 * is a presentation of the contract, not the contract.
 *
 * Where it reads from, first match wins:
 *   1. `OPENAPI_SRC`      — a file path, or an http(s) URL
 *   2. `../comos-pay-community-server/openapi/openapi.json` — the sibling checkout
 *
 *   node scripts/sync-openapi.mjs            # write it
 *   node scripts/sync-openapi.mjs --check    # exit 1 if the copy is stale (skips if no source)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'openapi', 'openapi.json');
const SIBLING = path.resolve(root, '..', 'comos-pay-community-server', 'openapi', 'openapi.json');

/** The source spec as text, or null when none is reachable. */
async function readSourceSpec() {
  const src = process.env.OPENAPI_SRC;
  if (src && /^https?:\/\//i.test(src)) {
    const res = await fetch(src, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${src} answered ${res.status}`);
    return res.text();
  }
  const file = src ? path.resolve(src) : SIBLING;
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** Canonical text: parsed and re-serialized, so line endings and key spacing never count. */
function canonical(text) {
  return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
}

async function main() {
  const check = process.argv.includes('--check');
  const source = await readSourceSpec();
  if (source === null) {
    console.warn('[openapi] no source spec reachable (set OPENAPI_SRC) — nothing to compare.');
    return;
  }
  const next = canonical(source);
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (check) {
    if (canonical(current || '{}') !== next) {
      console.error('[openapi] openapi/openapi.json is stale — run `npm run openapi:sync`.');
      process.exit(1);
    }
    console.log('[openapi] openapi/openapi.json matches the server.');
    return;
  }
  writeFileSync(OUT, next);
  console.log(`[openapi] wrote ${path.relative(root, OUT)}`);
}

await main();
