#!/usr/bin/env node
// Port of scripts/deploy.rb: sync dist/ to S3 bucket benasher.co
// (with orphan deletion) and invalidate the CloudFront distribution.
//
// Env: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_CF_DISTRIBUTION_ID
// (CI injects these; local runs use the default credential chain).
// Pass --dry-run to validate the build output (keys, content types,
// cache headers, readability) without touching S3 or CloudFront.

import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const BUCKET = 'benasher.co';
const SITE_ROOT = 'dist';
const WEEK_SECONDS = '604800';

const CONTENT_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/vnd.microsoft.icon',
  '.map': 'application/octet-stream',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  // astro-era assets
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function* enumerateSiteFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* enumerateSiteFiles(path);
    } else {
      yield path;
    }
  }
}

function content_type(path) {
  const type = CONTENT_TYPES[extname(path)];
  if (!type) {
    throw new Error(`Missing content-type for extension ${extname(path)} (${path})`);
  }
  return type;
}

const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  let count = 0;
  for (const file of enumerateSiteFiles(SITE_ROOT)) {
    const key = relative(SITE_ROOT, file);
    const type = content_type(key);
    const body = await readFile(file); // fail early on unreadable files
    const cache = key.startsWith('_astro/') ? ` max-age=${WEEK_SECONDS}` : '';
    console.log(`Would put ${key} (${type}${cache}, ${body.length} bytes)`);
    count++;
  }
  console.log(`dry run: ${count} objects validated`);
  process.exit(0);
}

const s3 = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-west-2' });

const existingKeys = new Set();
let token;
do {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
  for (const obj of res.Contents ?? []) existingKeys.add(obj.Key);
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);

for (const file of enumerateSiteFiles(SITE_ROOT)) {
  const key = relative(SITE_ROOT, file);
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: await readFile(file),
    ContentType: content_type(key),
  };
  // content-hashed assets: long-lived cache (replaces the old
  // prep_cache/fill_cache content-hash mechanism)
  if (key.startsWith('_astro/')) {
    params.CacheControl = `max-age=${WEEK_SECONDS}`;
  }
  console.log(`Putting ${key}`);
  await s3.send(new PutObjectCommand(params));
  existingKeys.delete(key);
}

if (existingKeys.size > 0) {
  const orphans = [...existingKeys];
  console.log(`Deleting ${orphans.join(', ')}`);
  for (let i = 0; i < orphans.length; i += 1000) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: orphans.slice(i, i + 1000).map((key) => ({ Key: key })) },
      }),
    );
  }
}

// bounce cloudfront caches
const cf = new CloudFrontClient({ region: 'us-east-1' });
await cf.send(
  new CreateInvalidationCommand({
    DistributionId: process.env.AWS_CF_DISTRIBUTION_ID,
    InvalidationBatch: {
      Paths: { Quantity: 1, Items: ['/*'] },
      CallerReference: `${Date.now()}`,
    },
  }),
);
console.log('Invalidation requested');
