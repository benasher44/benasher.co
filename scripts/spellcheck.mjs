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
import { writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NODE = process.execPath;
const YARN_RELEASE = '.yarn/releases/yarn-4.18.1.cjs';

const COMMENT_HEADER = '## 📝 Spellcheck';
const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY;

function gh(args) {
  return execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// Upsert one comment on the PR (edit our last one if it exists, else create),
// so repeat runs don't pile up separate comments.
function upsertComment(body) {
  if (!PR_NUMBER || !process.env.GH_TOKEN || !REPO) return;
  const tmp = join(tmpdir(), `spellcheck-comment-${PR_NUMBER}.json`);
  writeFileSync(tmp, JSON.stringify({ body }));
  try {
    const comments = JSON.parse(gh(`api repos/${REPO}/issues/${PR_NUMBER}/comments`));
    const mine = comments.filter((c) => c.body.startsWith(COMMENT_HEADER)).map((c) => c.id);
    if (mine.length > 0) {
      gh(
        `api repos/${REPO}/issues/${PR_NUMBER}/comments/${mine[mine.length - 1]} -X PATCH --input ${tmp}`,
      );
      console.log(`updated spellcheck comment on PR #${PR_NUMBER}`);
      return;
    }
  } catch (e) {
    console.log(
      `could not look up existing comments (${e.message.split('\n')[0]}), posting a new one`,
    );
  }
  try {
    gh(`pr comment ${PR_NUMBER} --body-file ${tmp}`);
    console.log(`posted spellcheck comment on PR #${PR_NUMBER}`);
  } catch (e) {
    console.log(`failed to post PR comment: ${e.message.split('\n')[0]}`);
  }
}

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
  upsertComment(body);
  console.log(body);
  process.exit(1);
}

upsertComment(`${COMMENT_HEADER}\n\n✅ All clean across ${files.length} file(s).`);
console.log(`spellcheck: ${files.length} file(s) clean`);
