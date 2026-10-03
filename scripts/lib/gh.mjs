// Shared gh CLI helper: returns stdout, throws on non-zero exit.
// stderr is 'ignore' by default (keeps gh's error JSON out of logs); pass
// 'inherit' where the API error text matters for diagnosis.
import { execSync } from 'node:child_process';

export function gh(args, { stderr = 'ignore' } = {}) {
  return execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', stderr] });
}
