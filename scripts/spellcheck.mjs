#!/usr/bin/env node
// Markdown spellcheck gate — replaces the old danger-based gate (same engine:
// markdown-spellcheck, same word list: spellcheck.json "ignore").
//
// Usage:
//   yarn spellcheck                 # check .md files changed vs origin/main
//   yarn spellcheck <file.md>...    # check specific files
//
// In a PR context (PR_NUMBER + GH_TOKEN env, set by pr.yml), findings or an
// all-clean message are posted as an upserted PR comment, like danger did.
// Exits 1 if any non-ignored misspellings are found.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mdspellPkg from 'markdown-spellcheck';

const spell = (mdspellPkg.default ?? mdspellPkg).spell;

const settings = JSON.parse(readFileSync('spellcheck.json', 'utf8'));
const ignoredWords = (settings.ignore || settings['cSpell.words'] || []).map((w) =>
  w.toLowerCase(),
);

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

const byFile = new Map();
for (const file of files) {
  const sourceText = readFileSync(file, 'utf8');
  const misspellings = spell(sourceText, { ignoreNumbers: true, ignoreAcronyms: true }).filter(
    (e) => {
      // normalize possessives ("Galligan's" -> "galligan") so the ignore
      // list doesn't need every possessive form
      const base = e.word
        .toLowerCase()
        .replace(/['’]+s$/, '')
        .replace(/['’]+$/, '');
      return !ignoredWords.includes(base);
    },
  );
  if (misspellings.length > 0)
    byFile.set(
      file,
      misspellings.map((e) => e.word),
    );
}

if (byFile.size > 0) {
  const lines = [`${COMMENT_HEADER} — ${[...byFile.values()].flat().length} misspelling(s)`, ''];
  for (const [file, words] of byFile) {
    lines.push(`**${file}**`, ...words.map((w) => `- \`${w}\``), '');
  }
  lines.push('Add deliberate words to `spellcheck.json` "ignore", or fix the spelling.');
  const body = lines.join('\n');
  upsertComment(body);
  console.log(body);
  process.exit(1);
}

upsertComment(`${COMMENT_HEADER}\n\n✅ All clean across ${files.length} file(s).`);
console.log(`spellcheck: ${files.length} file(s) clean`);
