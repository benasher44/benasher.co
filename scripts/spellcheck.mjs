#!/usr/bin/env node
// Markdown spellcheck gate via cspell (replaced the old danger-based gate,
// then the markdown-spellcheck engine whose tree carried the vulnerable tmp).
//
// Usage:
//   yarn spellcheck                 # check .md files changed vs origin/main
//   yarn spellcheck <file.md>...    # check specific files
//
// In a PR context (PR_NUMBER + GH_TOKEN env, set by pr.yml), findings or an
// all-clean message are posted as an upserted PR comment.
// Exits 1 if any unknown words are found (add them to cspell.json "words").

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { upsertComment } from './lib/gh-comment.mjs';

const NODE = process.execPath;
const YARN_RELEASE = '.yarn/releases/yarn-4.18.1.cjs';

const COMMENT_HEADER = '## 📝 Spellcheck';

function changedMarkdownFiles() {
  const out = execSync('git diff --name-only origin/main...HEAD -- "*.md"', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f && existsSync(f));
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : changedMarkdownFiles();

if (files.length === 0) {
  console.log('no markdown files to check');
  process.exit(0);
}

// cspell lint <files> --no-progress --no-summary
// output lines: "file:line:col - Unknown word (theWord)"
const res = spawnSync(
  NODE,
  [YARN_RELEASE, 'cspell', 'lint', ...files, '--no-progress', '--no-summary'],
  {
    encoding: 'utf8',
  },
);
if (res.status !== 0 && res.status !== 1) {
  console.error(res.stderr || res.stdout);
  process.exit(res.status ?? 1);
}

const byFile = new Map();
for (const line of res.stdout.split('\n')) {
  const m = line.match(/^(.+?):\d+:\d+ - Unknown word \((.+?)\)/);
  if (!m) continue;
  if (!byFile.has(m[1])) byFile.set(m[1], []);
  byFile.get(m[1]).push(m[2]);
}

if (byFile.size > 0) {
  const lines = [`${COMMENT_HEADER} — ${[...byFile.values()].flat().length} unknown word(s)`, ''];
  for (const [file, words] of byFile) {
    lines.push(`**${file}**`, ...words.map((w) => `- \`${w}\``), '');
  }
  lines.push('Add deliberate words to `cspell.json` "words", or fix the spelling.');
  const body = lines.join('\n');
  upsertComment({ header: COMMENT_HEADER, label: 'spellcheck', body });
  console.log(body);
  process.exit(1);
}

if (res.status !== 0) {
  // cspell failed (status 1) but nothing matched the expected output format —
  // the format may have drifted in a cspell upgrade. Fail loudly instead of
  // reporting a false-positive clean pass.
  console.error('cspell exited non-zero but no findings could be parsed:');
  console.error(res.stderr || res.stdout);
  process.exit(res.status ?? 1);
}

upsertComment({
  header: COMMENT_HEADER,
  label: 'spellcheck',
  body: `${COMMENT_HEADER}\n\n✅ All clean across ${files.length} file(s).`,
});
console.log(`spellcheck: ${files.length} file(s) clean`);
