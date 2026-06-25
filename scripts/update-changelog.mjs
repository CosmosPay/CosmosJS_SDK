/**
 * Prepend a new section to CHANGELOG.md for the version currently in
 * package.json (set by scripts/release-version.mjs). Collects the commits since
 * the previous git tag — no conventional-commits discipline required.
 *
 * Run with: node scripts/update-changelog.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkgUrl = new URL('../package.json', import.meta.url);
const changelogUrl = new URL('../CHANGELOG.md', import.meta.url);

const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

const sh = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

// Most recent existing tag, if any (the previous release).
const prevTag = sh('git describe --tags --abbrev=0');
const range = prevTag ? `${prevTag}..HEAD` : '';
// Cap the very first changelog (no prior tag) so it doesn't list all history.
const maxCount = prevTag ? '' : '-n 100';

// %x1f = ASCII Unit Separator (0x1F): a delimiter that never appears in a commit
// subject, so splitting subject/hash is unambiguous.
const SEP = String.fromCharCode(0x1f);
const rawLog = sh(`git log ${range} ${maxCount} --no-merges --pretty=format:%s%x1f%h`);
const commits = rawLog
  .split('\n')
  .filter(Boolean)
  // Drop the bot's own release commits.
  .filter((line) => !/^chore\(release\):/i.test(line));

const date = new Date().toISOString().slice(0, 10);

const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
const repo = process.env.GITHUB_REPOSITORY || 'Emanuel250YT/cosmosjs_sdk';
const repoUrl = `${server}/${repo}`;

const heading = prevTag
  ? `## [${tag}](${repoUrl}/compare/${prevTag}...${tag}) - ${date}`
  : `## [${tag}](${repoUrl}/releases/tag/${tag}) - ${date}`;

const lines = commits.length
  ? commits.map((line) => {
      const [subject, hash] = line.split(SEP);
      return `- ${subject} ([\`${hash}\`](${repoUrl}/commit/${hash}))`;
    })
  : ['- Maintenance release (no notable changes).'];

const section = `${heading}\n\n${lines.join('\n')}\n`;

const HEADER =
  '# Changelog\n\n' +
  'All notable changes to this project are documented here. ' +
  'This file is updated automatically on each release.\n\n';

let entries = '';
if (existsSync(changelogUrl)) {
  const current = readFileSync(changelogUrl, 'utf8');
  entries = current.startsWith(HEADER) ? current.slice(HEADER.length) : current;
}

writeFileSync(changelogUrl, `${HEADER}${section}\n${entries}`);
console.log(
  `CHANGELOG.md updated for ${tag} (${commits.length} commit(s) since ${prevTag || 'start'}).`,
);
