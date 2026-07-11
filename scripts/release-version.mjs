/**
 * Resolve the next version to publish and write it into package.json.
 *
 * Fully automatic — you never edit the version by hand:
 *   1. Never published yet            → publish package.json's version as-is.
 *   2. package.json bumped manually    → if it's higher than everything on npm and
 *      to a higher version             not yet published, respect it (manual override).
 *   3. Otherwise (the common case)     → auto-bump from the highest version on npm, with
 *                                        the bump TYPE derived from the Conventional
 *                                        Commits since the last release: `feat` → minor,
 *                                        `!`/`BREAKING CHANGE` → major, anything else →
 *                                        patch (skipping any version that's already taken).
 *
 * Emits `version`, `bumped`, `bump` and `previous` to GITHUB_OUTPUT for the workflow.
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

// Determine the semver bump (major/minor/patch) from Conventional Commits made since
// the last release ref. Mirrors the other CosmosPay repos: `feat` -> minor,
// `!` or `BREAKING CHANGE` -> major, anything else -> patch.
function bumpFromCommits(sinceRef) {
  let log = '';
  try {
    const range = sinceRef ? `${sinceRef}..HEAD` : 'HEAD';
    log = execSync(`git log ${range} --format=%B`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return 'patch'; // no git history reachable (e.g. shallow checkout) -> safe default
  }
  if (/(^|\n)[ \t]*BREAKING CHANGE/.test(log) || /(^|\n)[a-z]+(\([^)]+\))?!:/.test(log)) return 'major';
  if (/(^|\n)feat(\([^)]+\))?:/i.test(log)) return 'minor';
  return 'patch';
}

// The tag marking the last released commit — the boundary for "commits since release".
// Best-effort: needs tags present (the release workflow checks out with fetch-tags).
function lastReleaseRef(highestVersion) {
  if (!highestVersion) return null;
  for (const tag of [`v${highestVersion}`, highestVersion]) {
    try {
      execSync(`git rev-parse -q --verify refs/tags/${tag}`, { stdio: 'ignore' });
      return tag;
    } catch {
      /* tag not present — try the next form */
    }
  }
  return null;
}

let target;
let bumped = false;
let bump = 'none';

if (!highest) {
  // 1. First publish ever.
  target = local;
} else if (!published.includes(local) && semver.gt(local, highest)) {
  // 2. Manual override: package.json was bumped higher than anything on npm.
  target = local;
} else {
  // 3. Auto-bump from the highest published version, with the type from Conventional Commits.
  bump = bumpFromCommits(lastReleaseRef(highest));
  target = semver.inc(highest, bump);
  while (published.includes(target)) target = semver.inc(target, 'patch');
  bumped = true;
}

if (target !== local) {
  pkg.version = target;
  writeFileSync(pkgUrl, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Keep the hardcoded library version (src/util/Constants.ts) in lockstep with the
// resolved version. The build bakes it into the client as `Client.version`, and a
// unit test asserts `Client.version === package.json version` — so an auto-bump that
// left Constants behind would fail the release's own test step. Sync it unconditionally
// (also self-heals any prior drift), even when package.json itself didn't change.
const constUrl = new URL('../src/util/Constants.ts', import.meta.url);
const constSrc = readFileSync(constUrl, 'utf8');
const nextConst = constSrc.replace(/(export const version = )'[^']*'/, `$1'${target}'`);
if (nextConst === constSrc && !/export const version = '[^']*'/.test(constSrc)) {
  console.error('release-version: could not find `export const version` in src/util/Constants.ts');
  process.exit(1);
}
if (nextConst !== constSrc) writeFileSync(constUrl, nextConst);

const out = (key, value) => {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
};

out('version', target);
out('bumped', bumped ? 'true' : 'false');
out('bump', bump);
out('previous', highest ?? '(none)');
