#!/usr/bin/env node
// GitHub Deployments API helper (via the gh CLI, authenticated by GH_TOKEN):
// records deploys so commits/PRs get "View deployment" buttons and the repo's
// Environments page tracks production + previews.
//
//   gh-deployment.mjs create --environment production --ref <sha>
//       [--environment-url URL] [--production] [--transient]
//     prints the deployment id
//   gh-deployment.mjs status --id <id> --state success|failure|in_progress
//       [--environment-url URL]
//   gh-deployment.mjs deactivate --environment previews --ref <sha>
//     marks the newest deployment for that environment+sha inactive
//
// Env: GH_TOKEN (required), GITHUB_REPOSITORY (set by Actions).

import { execSync } from 'node:child_process';

const REPO = process.env.GITHUB_REPOSITORY;

function gh(args) {
  return execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function usage() {
  console.error(
    'usage: gh-deployment.mjs create --environment E --ref SHA [--environment-url URL] [--production] [--transient]\n' +
      '       gh-deployment.mjs status --id ID --state success|failure|in_progress [--environment-url URL]\n' +
      '       gh-deployment.mjs deactivate --environment E --ref SHA',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) usage();
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function create(args) {
  const flags = [
    `-F ref=${args.ref}`,
    `-F environment=${args.environment}`,
    // deployments created from workflow runs must not wait for other checks
    // (required_contexts would block) or try to merge (auto_merge)
    '-F required_contexts=[]',
    '-F auto_merge=false',
    `-F production_environment=${args.production ? 'true' : 'false'}`,
    args.transient ? '-F transient_environment=true' : null,
    args['environment-url'] ? `-F environment_url=${args['environment-url']}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const id = gh(`api repos/${REPO}/deployments ${flags} --jq .id`).trim();
  console.log(id);
}

function status(args) {
  const url = args['environment-url'] ? ` -F environment_url=${args['environment-url']}` : '';
  gh(`api repos/${REPO}/deployments/${args.id}/statuses -F state=${args.state}${url}`);
  console.log(`deployment ${args.id} -> ${args.state}`);
}

function deactivate(args) {
  const deployments = JSON.parse(
    gh(`api "repos/${REPO}/deployments?environment=${args.environment}&sha=${args.ref}"`),
  );
  if (!deployments.length) {
    console.log('no deployment found to deactivate');
    return;
  }
  const newest = deployments.sort((a, b) => b.id - a.id)[0];
  gh(`api repos/${REPO}/deployments/${newest.id}/statuses -F state=inactive`);
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
