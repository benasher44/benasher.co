import { execSync } from 'child_process';
import { fail } from 'danger';
import spellcheck from 'danger-plugin-spellcheck';

try {
    execSync('bundle exec rubocop');
} catch (e) {
    fail(`rubocop failed with error: ${e}`);
}

spellcheck();
