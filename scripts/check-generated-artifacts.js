const { execFileSync } = require('node:child_process');

const TRACKED_PATTERNS = [
  /^packages\/web\/src\/.+\.js$/,
  /^packages\/shared\/src\/.+\.(?:js|d\.ts|js\.map|d\.ts\.map)$/,
  /^packages\/backend\/migrations\/.+\.(?:js|js\.map)$/,
];

const DIRTY_PATTERNS = [
  /packages\/web\/src\/.+\.js$/,
  /packages\/shared\/src\/.+\.(?:js|d\.ts|js\.map|d\.ts\.map)$/,
  /packages\/backend\/migrations\/.+\.(?:js|js\.map)$/,
];

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function matchesAny(patterns, value) {
  return patterns.some((pattern) => pattern.test(value));
}

function fail(message, values) {
  console.error(message);
  values.forEach((value) => console.error(` - ${value}`));
  process.exit(1);
}

const status = runGit(['status', '--porcelain']).split(/\r?\n/).filter(Boolean);
const deleted = new Set(
  status
    .filter((line) => line[0] === 'D' || line[1] === 'D')
    .map((line) => line.slice(3))
);

const tracked = runGit(['ls-files'])
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !deleted.has(file));

const forbiddenTracked = tracked.filter((file) => matchesAny(TRACKED_PATTERNS, file));
if (forbiddenTracked.length > 0) {
  fail('Tracked generated artifacts must not live in source directories:', forbiddenTracked);
}

const dirtyGenerated = status
  .map((line) => line.slice(3))
  .filter((file) => !deleted.has(file))
  .filter((file) => matchesAny(DIRTY_PATTERNS, file));

if (dirtyGenerated.length > 0) {
  fail('Build left generated artifacts dirty in source directories:', dirtyGenerated);
}

console.log('Generated artifact check passed.');
