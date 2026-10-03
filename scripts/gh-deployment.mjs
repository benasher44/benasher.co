#!/usr/bin/env node
// GitHub Deployments API helper (via the gh CLI, authenticated by GH_TOKEN):
// records deploys so commits/PRs get "View deployment" buttons and the repo's
// Environments page tracks production + previews.
//
//   gh-deployment.mjs create --environment production --ref <sha>
//       [--production] [--transient] [--payload '<json>']
//     prints the deployment id (the preview/production URL goes on the
//     deployment STATUSES — that is where GitHub reads it for the
//     View deployment button — not on the create call)
//   gh-deployment.mjs status --id <id> --state success|failure|in_progress
//       [--environment-url URL]
//   gh-deployment.mjs cleanup --environment E --pr N
//     deactivates and DELETES every deployment for that environment whose
//     payload tags pr N (previews are transient: one record accumulates per
//     push, and ref/sha matching only reaches the newest — the payload tag
//     reaches all of them)
//
// Env: GH_TOKEN (required), GITHUB_REPOSITORY (set by Actions).

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gh } from './lib/gh.mjs';

const REPO = process.env.GITHUB_REPOSITORY;

// API error bodies here are diagnostic gold (422 messages etc.) — surface stderr
const ghOut = (args) => gh(args, { stderr: 'inherit' });

function usage() {
  console.error(
    'usage: gh-deployment.mjs create --environment E --ref SHA [--production] [--transient] [--payload JSON]\n' +
      '       gh-deployment.mjs status --id ID --state success|failure|in_progress [--environment-url URL]\n' +
      '       gh-deployment.mjs cleanup --environment E --pr N',
  );
  process.exit(2);
}

const BOOL_FLAGS = new Set(['transient', 'production']);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) usage();
    const key = argv[i].slice(2);
    if (BOOL_FLAGS.has(key)) {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i += 1;
      if (args[key] === undefined) usage();
    }
  }
  return args;
}

// The list/create API round-trips payload as a JSON string; parse defensively
// either way and return the tag we care about
function payloadPr(deployment) {
  if (deployment.payload == null) return undefined;
  const p = typeof deployment.payload === 'string' ? JSON.parse(deployment.payload) : deployment.payload;
  return typeof p?.pr === 'number' ? p.pr : undefined;
}

function create(args) {
  const body = {
    ref: args.ref,
    environment: args.environment,
    // deployments created from workflow runs must not wait for other checks
    // (required_contexts would block) or try to merge (auto_merge)
    auto_merge: false,
    required_contexts: [],
    production_environment: Boolean(args.production),
    transient_environment: Boolean(args.transient),
  };
  if (args.payload !== undefined) body.payload = args.payload;
  // POST via --input with a real JSON body: gh's -F doesn't parse `[]` into
  // an empty array (it sends the literal string, which the API rejects with
  // "is not an array or null")
  const tmp = join(tmpdir(), `gh-deployment-create-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(body));
  const id = ghOut(`api repos/${REPO}/deployments --input ${tmp} --jq .id`).trim();
  console.log(id);
}

function status(args) {
  const url = args['environment-url'] ? ` -F environment_url=${args['environment-url']}` : '';
  ghOut(`api repos/${REPO}/deployments/${args.id}/statuses -F state=${args.state}${url}`);
  console.log(`deployment ${args.id} -> ${args.state}`);
}

function cleanup(args) {
  const pr = Number(args.pr);
  if (!Number.isInteger(pr) || pr <= 0) usage();
  const deployments = JSON.parse(
    ghOut(`api "repos/${REPO}/deployments?environment=${args.environment}&per_page=100"`),
  );
  const targets = deployments.filter((d) => payloadPr(d) === pr);
  if (!targets.length) {
    console.log(`no ${args.environment} deployments tagged pr ${pr}`);
    return;
  }
  const failures = [];
  for (const d of targets) {
    try {
      // the API rejects deleting an active deployment — set inactive first
      ghOut(`api repos/${REPO}/deployments/${d.id}/statuses -F state=inactive`);
      ghOut(`api -X DELETE repos/${REPO}/deployments/${d.id}`);
      console.log(`deployment ${d.id} (${d.sha.slice(0, 7)}) deleted`);
    } catch (e) {
      failures.push(`deployment ${d.id} (${d.sha.slice(0, 7)}): ${e.message}`);
    }
  }
  if (failures.length) {
    throw new Error(`failed to remove ${failures.length}/${targets.length} deployment(s):\n${failures.join('\n')}`);
  }
  console.log(`removed ${targets.length} ${args.environment} deployment(s) tagged pr ${pr}`);
}

if (!REPO) {
  console.error('GITHUB_REPOSITORY is required');
  process.exit(2);
}
const [command] = process.argv.slice(2);
const args = parseArgs(process.argv.slice(3));
if (command === 'create') create(args);
else if (command === 'status') status(args);
else if (command === 'cleanup') cleanup(args);
else usage();