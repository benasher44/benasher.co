#!/usr/bin/env node
// Per-PR preview deploys for benasher.co.
//
//   node scripts/deploy-preview.mjs deploy   (PR opened/updated: sync dist/)
//   node scripts/deploy-preview.mjs remove   (PR closed/merged: delete keys)
//
// Previews live in bucket benasher-co-previews under pr-<N>/ keys and serve
// at https://pr-<N>.previews.benasher.co/ via the previews CloudFront
// distribution (infra repo: aws/benasher_previews.tf). Writes are
// prefix-scoped: other PRs' preview keys and the shared 404 page survive.
// In a PR context (PR_NUMBER + GH_TOKEN + GITHUB_REPOSITORY, set by pr.yml)
// the preview comment on the PR is upserted after every deploy/remove.
//
// Env: PR_NUMBER (required). AWS_* come from the benasher-co-previews OIDC
// role in CI; local runs use the default credential chain (bridge the aws
// login session with `aws configure export-credentials`).

import { readFile } from 'node:fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { createInvalidation, deleteKeys, listKeys, syncSite } from './lib/s3-sync.mjs';
import { upsertComment } from './lib/gh-comment.mjs';

const BUCKET = 'benasher-co-previews';
const DISTRIBUTION_ID = 'E3EML22JHNSM57';
const SITE_ROOT = 'dist';
const ROOT_404 = new URL('./preview-404.html', import.meta.url).pathname;

const PR_NUMBER = Number(process.env.PR_NUMBER);
const COMMAND = process.argv[2];

const COMMENT_HEADER = '## ⚡ Preview deploy';

function previewUrl() {
  return `https://pr-${PR_NUMBER}.previews.benasher.co/`;
}

function previewPrefix() {
  return `pr-${PR_NUMBER}/`;
}

function validateArgs() {
  if (COMMAND !== 'deploy' && COMMAND !== 'remove') {
    console.error('usage: node scripts/deploy-preview.mjs deploy|remove');
    process.exit(2);
  }
  if (!Number.isInteger(PR_NUMBER) || PR_NUMBER <= 0) {
    console.error('PR_NUMBER env must be a positive integer');
    process.exit(2);
  }
}

async function deploy() {
  const s3 = new S3Client({ region: 'us-west-2' });
  const { uploaded } = await syncSite(s3, {
    bucket: BUCKET,
    siteRoot: SITE_ROOT,
    keyPrefix: previewPrefix(),
    scope: 'prefix',
  });
  // shared 404 page at the bucket root (the distribution maps 404s to
  // /404.html); re-put every deploy — one tiny object
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: '404.html',
      Body: await readFile(ROOT_404),
      ContentType: 'text/html',
    }),
  );

  const cf = new CloudFrontClient({ region: 'us-east-1' });
  // invalidation paths must start with /
  await createInvalidation(cf, DISTRIBUTION_ID, [`/${previewPrefix()}*`]);

  // COMMIT_SHA: pr.yml passes the PR head sha (GITHUB_SHA is the merge ref in
  // PR runs); falls back to GITHUB_SHA for local runs
  const sha = process.env.COMMIT_SHA || process.env.GITHUB_SHA;
  const shaLine = sha ? ` (\`${sha.slice(0, 7)}\`)` : '';
  upsertComment({
    header: COMMENT_HEADER,
    label: 'preview',
    body: [
      COMMENT_HEADER,
      '',
      `🔍 Live preview: ${previewUrl()}${shaLine}`,
      '',
      'Rebuilt on every push to this PR. Removed automatically when the PR closes or merges.',
    ].join('\n'),
  });
  console.log(`preview deployed: ${uploaded} object(s) at ${previewUrl()}`);
}

async function remove() {
  const s3 = new S3Client({ region: 'us-west-2' });
  const keys = [...(await listKeys(s3, BUCKET, previewPrefix()))];
  if (keys.length === 0) {
    console.log(`nothing to remove under ${previewPrefix()}`);
  } else {
    await deleteKeys(s3, BUCKET, keys);
  }
  upsertComment({
    header: COMMENT_HEADER,
    label: 'preview',
    body: [COMMENT_HEADER, '', '🧹 Preview removed — this PR was closed or merged.'].join('\n'),
  });
  console.log(`preview removed: ${keys.length} object(s)`);
}

validateArgs();
try {
  if (COMMAND === 'deploy') {
    await deploy();
  } else {
    await remove();
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
