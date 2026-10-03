// Shared S3 sync mechanics for the benasher.co deploy scripts:
//   scripts/deploy.mjs         — prod: whole-bucket sync, bucket-wide orphan delete
//   scripts/deploy-preview.mjs — PR previews: prefix-scoped sync under pr-<N>/
// Both upload dist/ trees with the same content-type map and the immutable
// cache header on content-hashed _astro/* assets.

import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

// cache-control max-age for content-hashed assets (safe to cache forever
// because the filename changes when the content does)
export const ASSET_MAX_AGE = 60 * 60 * 24 * 365; // one year, in seconds

export const CONTENT_TYPES = {
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

export function* enumerateSiteFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* enumerateSiteFiles(path);
    } else {
      yield path;
    }
  }
}

export function contentTypeFor(path) {
  const type = CONTENT_TYPES[extname(path)];
  if (!type) {
    throw new Error(`Missing content-type for extension ${extname(path)} (${path})`);
  }
  return type;
}

export async function listKeys(s3, bucket, prefix = '') {
  const keys = new Set();
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) keys.add(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

// Batched DeleteObjects with the per-key error check: delete failures are
// reported IN the 200 response — ignoring them leaves orphan keys on S3
// silently (the MalformedXML incident).
export async function deleteKeys(s3, bucket, keys) {
  if (keys.length === 0) return;
  console.log(`Deleting ${keys.join(', ')}`);
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const res = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((key) => ({ Key: key })) },
      }),
    );
    if (res.Errors?.length) {
      const lines = [`Failed to delete ${res.Errors.length} orphan key(s):`];
      for (const err of res.Errors) lines.push(`  ${err.Key}: ${err.Message}`);
      throw new Error(lines.join('\n'));
    }
  }
}

// Upload every file under siteRoot under keyPrefix, then delete keys inside
// the scan scope that were not just uploaded:
//   scope 'bucket' — the whole bucket is the scope (prod: anything outside
//     dist/ is an orphan; NOTHING else may live in the prod bucket)
//   scope 'prefix' — only keyPrefix is the scope (previews: other PRs'
//     preview keys and the shared 404 page must survive)
// Throws when per-key delete failures are reported (script exits non-zero).
export async function syncSite(s3, { bucket, siteRoot, keyPrefix = '', scope = 'bucket' }) {
  if (scope === 'bucket' && keyPrefix) {
    throw new Error('scope "bucket" scans the whole bucket; pass no keyPrefix');
  }
  const existing = await listKeys(s3, bucket, scope === 'prefix' ? keyPrefix : '');
  let uploaded = 0;
  for (const file of enumerateSiteFiles(siteRoot)) {
    const rel = relative(siteRoot, file);
    const key = keyPrefix + rel;
    const params = {
      Bucket: bucket,
      Key: key,
      Body: await readFile(file),
      ContentType: contentTypeFor(key),
    };
    // content-hashed assets: immutable year-long cache (replaces the old
    // prep_cache/fill_cache content-hash mechanism). Test the path RELATIVE
    // to siteRoot, not the full key: preview keys carry the pr-<N>/ prefix.
    if (rel.startsWith('_astro/')) {
      params.CacheControl = `max-age=${ASSET_MAX_AGE}, immutable`;
    }
    console.log(`Putting ${key}`);
    await s3.send(new PutObjectCommand(params));
    existing.delete(key);
    uploaded++;
  }
  await deleteKeys(s3, bucket, [...existing]);
  return { uploaded };
}

// Bounce CloudFront caches — fire-and-forget: the completion waiter blocks
// for minutes and deploys don't need to wait for propagation.
export async function createInvalidation(cloudfront, distributionId, paths) {
  await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: { Quantity: paths.length, Items: paths },
        CallerReference: `${Date.now()}`,
      },
    }),
  );
  console.log('Invalidation requested');
}
