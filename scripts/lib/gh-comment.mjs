// Shared PR-comment upsert (gh CLI mechanics). Expects the PR context env
// pr.yml provides: PR_NUMBER + GH_TOKEN + GITHUB_REPOSITORY. Outside that
// context (local runs) it skips silently.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gh } from './gh.mjs';

// Upsert one comment on the PR (edit our last one if it exists, else create),
// so repeat runs don't pile up separate comments. `label` names the temp
// files and the log lines. Match our comment with includes(), NOT
// startsWith(): self-heals the one malformed comment posted before the
// create path stopped sending the raw JSON envelope.
export function upsertComment({ header, label, body }) {
  const prNumber = process.env.PR_NUMBER;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!prNumber || !process.env.GH_TOKEN || !repo) return;
  const tmpJson = join(tmpdir(), `${label}-comment-${prNumber}.json`);
  const tmpMd = join(tmpdir(), `${label}-comment-${prNumber}.md`);
  writeFileSync(tmpJson, JSON.stringify({ body }));
  writeFileSync(tmpMd, body);
  try {
    const comments = JSON.parse(gh(`api repos/${repo}/issues/${prNumber}/comments`));
    const mine = comments.filter((c) => c.body.includes(header)).map((c) => c.id);
    if (mine.length > 0) {
      gh(
        `api repos/${repo}/issues/${prNumber}/comments/${mine[mine.length - 1]} -X PATCH --input ${tmpJson}`,
      );
      console.log(`updated ${label} comment on PR #${prNumber}`);
      return;
    }
  } catch (e) {
    console.log(
      `could not look up existing comments (${e.message.split('\n')[0]}), posting a new one`,
    );
  }
  try {
    // --body-file takes raw markdown, not a JSON envelope
    gh(`pr comment ${prNumber} --body-file ${tmpMd}`);
    console.log(`posted ${label} comment on PR #${prNumber}`);
  } catch (e) {
    console.log(`failed to post PR comment: ${e.message.split('\n')[0]}`);
  }
}
