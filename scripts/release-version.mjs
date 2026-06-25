/**
 * Resolve the next version to publish and write it into package.json.
 *
 * Rules (no conventional-commits discipline required — it "just always updates"):
 *   1. Never published yet            → publish package.json's version as-is.
 *   2. package.json bumped manually    → if it's higher than everything on npm and
 *      to a higher version             not yet published, respect it (minor/major).
 *   3. Otherwise (the common case,     → auto-bump PATCH from the highest version
 *      version unchanged/already on     already on npm (1.0.0 → 1.0.1 → 1.0.2 …),
 *      npm)                             skipping any patch that's somehow taken.
 *
 * Emits `version` and `bumped` to GITHUB_OUTPUT for the workflow to consume.
 * Run with: node scripts/release-version.mjs
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import semver from 'semver';

const pkgUrl = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
const name = pkg.name;
const local = pkg.version;

if (!semver.valid(local)) {
  console.error(`package.json version "${local}" is not valid semver.`);
  process.exit(1);
}

// All versions already on npm (empty if the package was never published).
let published = [];
try {
  const raw = execSync(`npm view ${name} versions --json`, {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
  const parsed = JSON.parse(raw);
  published = Array.isArray(parsed) ? parsed : [parsed];
} catch {
  published = [];
}

const highest = published.length
  ? published.slice().sort(semver.rcompare)[0]
  : null;

let target;
let bumped = false;

if (!highest) {
  // 1. First publish ever.
  target = local;
} else if (!published.includes(local) && semver.gt(local, highest)) {
  // 2. Manual minor/major bump → respect it.
  target = local;
} else {
  // 3. Auto-bump patch from the highest published version.
  target = semver.inc(highest, 'patch');
  while (published.includes(target)) target = semver.inc(target, 'patch');
  bumped = true;
}

if (target !== local) {
  pkg.version = target;
  writeFileSync(pkgUrl, `${JSON.stringify(pkg, null, 2)}\n`);
}

const out = (key, value) => {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
};

out('version', target);
out('bumped', bumped ? 'true' : 'false');
out('previous', highest ?? '(none)');
