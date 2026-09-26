// The SDK against the server's own contract (`openapi/openapi.json`, kept fresh by
// `npm run openapi:sync`).
//
// The SDK is hand-written, so nothing at build time ties a manager's path to a route
// the server serves: a renamed route compiles, ships, and 404s for every integrator. This
// suite reads the SDK's source with the TypeScript compiler — every `this.rest.<verb>()`
// and `this.api().<verb>()` call, its method and its path — and holds it against the spec
// in both directions:
//
//   1. Every call the SDK makes is an operation the server documents, same method.
//   2. Every operation the server documents is either called by the SDK or listed in
//      `openapi/unsupported.json` with the reason it is not. A new server route is a
//      decision someone has to make, not a gap someone finds.
//
// Static on purpose: a runtime trace would only see the methods a test happens to call.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Not `import.meta.dirname`: CI still runs Node 18, which does not have it.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(readFileSync(path.join(root, 'openapi', 'openapi.json'), 'utf8'));
const unsupported = JSON.parse(readFileSync(path.join(root, 'openapi', 'unsupported.json'), 'utf8'));

const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);
/** The REST layer prefixes every path with this (`DEFAULT_VERSION`). */
const VERSION_PREFIX = '/v1';

/** `/v1/kyc/receivers/{id}` and `/v1/kyc/receivers/${x}` both become `/v1/kyc/receivers/{}`. */
const normalize = (p) => p.replace(/\{[^}]*\}/g, '{}').replace(/\/+$/, '') || '/';

/** Every `METHOD path` the spec serves. */
const served = new Map();
for (const [p, methods] of Object.entries(spec.paths)) {
  for (const m of Object.keys(methods)) {
    if (VERBS.has(m)) served.set(`${m.toUpperCase()} ${normalize(p)}`, `${m.toUpperCase()} ${p}`);
  }
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return e.name.endsWith('.ts') ? [full] : [];
  });
}

/** The literal a class's `route` property is initialized with, per class. */
function routeOf(cls) {
  for (const m of cls.members) {
    if (ts.isPropertyDeclaration(m) && m.name.getText() === 'route' && m.initializer && ts.isStringLiteral(m.initializer)) {
      return m.initializer.text;
    }
  }
  return null;
}

/** A path argument as a template: `${this.route}` resolved, every other `${…}` a `{}`. */
function pathOf(arg, route) {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isPropertyAccessExpression(arg) && arg.getText() === 'this.route') return route;
  if (ts.isTemplateExpression(arg)) {
    let out = arg.head.text;
    for (const span of arg.templateSpans) {
      out += span.expression.getText() === 'this.route' ? route : '{}';
      out += span.literal.text;
    }
    return out;
  }
  return null;
}

/** Every HTTP call in the SDK source: `{ key: 'METHOD /v1/path', where }`. */
function sdkCalls() {
  const calls = [];
  for (const file of sourceFiles(path.join(root, 'src'))) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node, route) => {
      if (ts.isClassDeclaration(node)) route = routeOf(node) ?? route;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const verb = node.expression.name.getText();
        const target = node.expression.expression.getText();
        if (VERBS.has(verb) && (target === 'this.rest' || target === 'this.api()')) {
          const where = `${path.relative(root, file)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
          const p = node.arguments[0] ? pathOf(node.arguments[0], route) : null;
          calls.push({ key: p === null ? null : `${verb.toUpperCase()} ${normalize(VERSION_PREFIX + p)}`, where });
        }
      }
      ts.forEachChild(node, (child) => visit(child, route));
    };
    visit(sf, null);
  }
  return calls;
}

const calls = sdkCalls();

test('the SDK source was actually read', () => {
  // A refactor that renamed `this.rest` would otherwise make every check below vacuous.
  assert.ok(calls.length > 50, `found only ${calls.length} calls`);
});

test('every path the SDK builds is one it can resolve statically', () => {
  const opaque = calls.filter((c) => c.key === null).map((c) => c.where);
  assert.deepEqual(opaque, [], 'build these paths from literals so they can be checked');
});

test('every call the SDK makes is an operation the server serves', () => {
  const missing = calls.filter((c) => c.key && !served.has(c.key)).map((c) => `${c.key}  (${c.where})`);
  assert.deepEqual(missing, [], 'the server does not document these — a 404 waiting for an integrator');
});

test('every operation the server serves is implemented or deliberately left out', () => {
  const implemented = new Set(calls.map((c) => c.key));
  const left = new Set(Object.keys(unsupported.operations).map((k) => {
    const [m, p] = k.split(' ');
    return `${m} ${normalize(p)}`;
  }));
  const undecided = [...served.entries()]
    .filter(([key]) => !implemented.has(key) && !left.has(key))
    .map(([, original]) => original);
  assert.deepEqual(undecided, [], 'implement these, or list them in openapi/unsupported.json with a reason');
});

test('nothing is listed as unsupported that the SDK implements or the server dropped', () => {
  const implemented = new Set(calls.map((c) => c.key));
  const stale = Object.keys(unsupported.operations).filter((k) => {
    const [m, p] = k.split(' ');
    const key = `${m} ${normalize(p)}`;
    return implemented.has(key) || !served.has(key);
  });
  assert.deepEqual(stale, [], 'remove these from openapi/unsupported.json');
});

test('every unsupported operation says why', () => {
  const blank = Object.entries(unsupported.operations)
    .filter(([, reason]) => typeof reason !== 'string' || reason.trim().length < 10)
    .map(([k]) => k);
  assert.deepEqual(blank, []);
});
