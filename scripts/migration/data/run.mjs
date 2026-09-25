import { capture, plan, SOURCE_PROJECT } from './snapshot.mjs';
import { createFirestoreAdapter } from './firestore.mjs';
import { dryRun } from './dry-run.mjs';
import { importDomain } from './import.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve, sep } from 'node:path';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
function outsideRepository(path) {
  const rel = relative(repository, resolve(path));
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`))) throw new Error('SNAPSHOT_MUST_BE_OUTSIDE_REPOSITORY');
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
  if (!['capture', 'plan', 'dry-run', 'import'].includes(command)) throw new Error('COMMAND_NOT_IMPLEMENTED');
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
  } else {
    if (!options['auth-map']) throw new Error('AUTH_MAP_REQUIRED');
    outsideRepository(options['auth-map']);
    const mappings = JSON.parse(await readFile(options['auth-map'], 'utf8'));
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) throw new Error('INVALID_AUTH_MAP');
    if (command === 'dry-run') {
      const report = await dryRun(options.snapshot, uid => mappings[uid] ?? null);
      console.log(JSON.stringify(report, null, 2));
      if (report.quarantine.length) process.exitCode = 2;
    } else {
      const report = await importDomain({ snapshot: options.snapshot, authMap: mappings, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, environment: options.environment, confirmWrite: options['confirm-write'] });
      console.log(JSON.stringify(report, null, 2));
      if (report.quarantined.length) process.exitCode = 2;
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
