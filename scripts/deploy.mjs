#!/usr/bin/env node
// Port of scripts/deploy.rb: sync dist/ to S3 bucket benasher.co
// (with orphan deletion) and invalidate the CloudFront distribution.
// The upload/orphan/invalidate mechanics live in scripts/lib/s3-sync.mjs
// (shared with scripts/deploy-preview.mjs).
//
// Env: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_CF_DISTRIBUTION_ID
// (CI injects these; local runs use the default credential chain).
// Pass --dry-run to validate the build output (keys, content types,
// cache headers, readability) without touching S3 or CloudFront.

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import {
  ASSET_MAX_AGE,
  contentTypeFor,
  createInvalidation,
  enumerateSiteFiles,
  syncSite,
} from './lib/s3-sync.mjs';

const BUCKET = 'benasher.co';
const SITE_ROOT = 'dist';

const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  let count = 0;
  for (const file of enumerateSiteFiles(SITE_ROOT)) {
    const key = relative(SITE_ROOT, file);
    const type = contentTypeFor(key);
    const body = await readFile(file); // fail early on unreadable files
    const cache = key.startsWith('_astro/') ? ` max-age=${ASSET_MAX_AGE} immutable` : '';
    console.log(`Would put ${key} (${type}${cache}, ${body.length} bytes)`);
    count++;
  }
  console.log(`dry run: ${count} objects validated`);
  process.exit(0);
}

const s3 = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-west-2' });

try {
  await syncSite(s3, { bucket: BUCKET, siteRoot: SITE_ROOT });
} catch (e) {
  // per-key delete failures print and fail the deploy (see s3-sync)
  console.error(e.message);
  process.exit(1);
}

// bounce cloudfront caches
const cf = new CloudFrontClient({ region: 'us-east-1' });
await createInvalidation(cf, process.env.AWS_CF_DISTRIBUTION_ID, ['/*']);
