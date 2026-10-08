// Local-only test harness. Never reads or copies remote credentials.
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const status = JSON.parse(execFileSync('cmd.exe', ['/d', '/s', '/c', 'corepack pnpm --dir apps/web exec supabase status --workdir ../.. -o json'], { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }));
if (!['127.0.0.1', 'localhost'].includes(new URL(status.API_URL).hostname)) throw new Error('R3 tests require localhost');
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY, RUN_LOCAL_SUPABASE_E2E: '1', PRODUCT_V3: process.argv.includes('--rollback') ? 'false' : 'true', CLOUD_TASKS_ENQUEUE_URL: '', RECIPE_IMPORT_REVIEW_ENABLED: 'false', RECIPE_IMPORT_REPROCESS_ENABLED: 'false' };
let command, args, cwd;
if (process.argv[2] === 'server') { env.PRODUCT_V3 = process.env.PRODUCT_V3 ?? 'true'; command = process.execPath; args = [fileURLToPath(new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url)), 'dev', '--port', '3103']; cwd = fileURLToPath(new URL('../apps/web', import.meta.url)); }
else { command = 'cmd.exe'; args = ['/d', '/s', '/c', 'corepack pnpm --dir apps/web exec playwright test --config ../../.harness/r3-playwright.config.mjs']; cwd = root; }
const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => process.exit(code ?? 1));
process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM'));
