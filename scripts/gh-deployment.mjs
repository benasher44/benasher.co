#!/usr/bin/env node
// GitHub Deployments API helper (via the gh CLI, authenticated by GH_TOKEN):
// records deploys so commits/PRs get "View deployment" buttons and the repo's
// Environments page tracks production + previews.
//
//   gh-deployment.mjs create --environment production --ref <sha>
//       [--production] [--transient]
//     prints the deployment id (the preview/production URL goes on the
//     deployment STATUSES — that is where GitHub reads it for the
//     View deployment button — not on the create call)
//   gh-deployment.mjs status --id <id> --state success|failure|in_progress
//       [--environment-url URL]
//   gh-deployment.mjs deactivate --environment previews --ref <sha>
//     marks the newest deployment for that environment+sha inactive
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
    'usage: gh-deployment.mjs create --environment E --ref SHA [--production] [--transient]\n' +
      '       gh-deployment.mjs status --id ID --state success|failure|in_progress [--environment-url URL]\n' +
      '       gh-deployment.mjs deactivate --environment E --ref SHA',
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

function deactivate(args) {
  const deployments = JSON.parse(
    ghOut(`api "repos/${REPO}/deployments?environment=${args.environment}&sha=${args.ref}"`),
  );
  if (!deployments.length) {
    console.log('no deployment found to deactivate');
    return;
  }
  const newest = deployments.sort((a, b) => b.id - a.id)[0];
  ghOut(`api repos/${REPO}/deployments/${newest.id}/statuses -F state=inactive`);
  console.log(`deployment ${newest.id} -> inactive`);
}

if (!REPO) {
  console.error('GITHUB_REPOSITORY is required');
  process.exit(2);
}
const [command] = process.argv.slice(2);
const args = parseArgs(process.argv.slice(3));
if (command === 'create') create(args);
else if (command === 'status') status(args);
else if (command === 'deactivate') deactivate(args);
else usage();
