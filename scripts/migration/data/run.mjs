import { capture, plan, SOURCE_PROJECT } from './snapshot.mjs';
import { createFirestoreAdapter } from './firestore.mjs';
import { dryRun } from './dry-run.mjs';
import { importDomain } from './import.mjs';
import { reconcile } from './reconcile.mjs';
import { storagePlan } from './storage.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
function outsideRepository(path) {
  const rel = relative(repository, resolve(path));
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`))) throw new Error('SNAPSHOT_MUST_BE_OUTSIDE_REPOSITORY');
}
async function writeReport(directory, command, report) {
  outsideRepository(directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const runId = randomUUID();
  const payload = { runId, command, createdAt: new Date().toISOString(), ...report };
  await writeFile(join(directory, `${runId}.json`), JSON.stringify(payload, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const rows = [['kind', 'key', 'source', 'ready', 'matched', 'missing', 'changed', 'extra', 'code']];
  for (const [key, counts] of Object.entries(report.byCollection ?? report.byUserCollection ?? {})) rows.push(['collection', key, counts.source ?? '', counts.ready ?? '', counts.matched ?? '', counts.missing ?? '', counts.changed ?? '', counts.extra ?? '', '']);
  for (const item of report.quarantine ?? report.quarantined ?? []) rows.push(['quarantine', item.pathHash, '', '', '', '', '', '', item.code]);
  for (const item of report.differences ?? []) rows.push(['difference', item.pathHash, '', '', '', '', '', '', item.code]);
  for (const item of [...(report.invalid ?? []), ...(report.missing ?? []), ...(report.orphans ?? [])]) rows.push(['storage', item.pathHash, '', '', '', '', '', '', item.code]);
  await writeFile(join(directory, `${runId}.csv`), rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  return runId;
}

function args(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || !rest[i + 1]) throw new Error('INVALID_ARGUMENTS');
    options[rest[i].slice(2)] = rest[i + 1];
  }
  return { command, options };
}

async function main() {
  const { command, options } = args(process.argv.slice(2));
  if (!['capture', 'plan', 'dry-run', 'import', 'reconcile', 'storage-plan'].includes(command)) throw new Error('COMMAND_NOT_IMPLEMENTED');
  if (!['local', 'staging'].includes(options.environment)) throw new Error('ENVIRONMENT_REQUIRED');
  if (!options.snapshot) throw new Error('SNAPSHOT_PATH_REQUIRED');
  outsideRepository(options.snapshot);
  if (command === 'capture') {
    if (options['source-project'] !== SOURCE_PROJECT || options['confirm-source-read'] !== 'READ_FIRESTORE_LEGACY') throw new Error('SOURCE_READ_NOT_CONFIRMED');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_REQUIRED');
    const adapter = await createFirestoreAdapter(options['source-project']);
    const result = await capture({ adapter, destination: options.snapshot, projectId: options['source-project'] });
    console.log(JSON.stringify({ projectId: result.projectId, files: result.files.length, coverage: result.coverage }));
  } else if (command === 'plan') {
    console.log(JSON.stringify(await plan(options.snapshot), null, 2));
  } else if (command === 'storage-plan') {
    if (options['source-project'] !== SOURCE_PROJECT || options['confirm-source-read'] !== 'READ_FIRESTORE_LEGACY') throw new Error('SOURCE_READ_NOT_CONFIRMED');
    if (!options['source-bucket'] || !options['report-dir']) throw new Error('STORAGE_OPTIONS_REQUIRED');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_REQUIRED');
    const adapter = await createFirestoreAdapter(options['source-project']);
    const report = await storagePlan(options.snapshot, prefix => adapter.listStorageObjects(options['source-bucket'], prefix));
    const runId = await writeReport(options['report-dir'], command, report);
    console.log(JSON.stringify({ runId, ...report }, null, 2));
    if (report.invalid.length || report.missing.length) process.exitCode = 2;
  } else {
    if (!options['auth-map']) throw new Error('AUTH_MAP_REQUIRED');
    if (!options['report-dir']) throw new Error('REPORT_DIRECTORY_REQUIRED');
    outsideRepository(options['auth-map']);
    const mappings = JSON.parse(await readFile(options['auth-map'], 'utf8'));
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) throw new Error('INVALID_AUTH_MAP');
    if (command === 'dry-run') {
      const report = await dryRun(options.snapshot, uid => mappings[uid] ?? null);
      const runId = await writeReport(options['report-dir'], command, report);
      console.log(JSON.stringify({ runId, ...report }, null, 2));
      if (report.quarantine.length) process.exitCode = 2;
    } else if (command === 'import') {
      const report = await importDomain({ snapshot: options.snapshot, authMap: mappings, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, environment: options.environment, confirmWrite: options['confirm-write'] });
      const runId = await writeReport(options['report-dir'], command, report);
      console.log(JSON.stringify({ runId, ...report }, null, 2));
      if (report.quarantined.length) process.exitCode = 2;
    } else {
      const report = await reconcile({ snapshot: options.snapshot, authMap: mappings, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, environment: options.environment });
      const runId = await writeReport(options['report-dir'], command, report);
      console.log(JSON.stringify({ runId, ...report }, null, 2));
      if (report.quarantine.length || report.differences.length) process.exitCode = 2;
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
