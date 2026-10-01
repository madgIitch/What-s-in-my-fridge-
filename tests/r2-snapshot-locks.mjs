import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

// Local-only lock verification. UPDATE ... WHERE false acquires the write lock
// without touching data; every probe rolls back, including a failed probe.
const container = 'supabase_db_whats-in-my-fridge-local';
const exec = promisify(execFile);
const args = ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'];
const query = (sql) => exec('docker', [...args, '-c', sql], { timeout: 15000 });
const holder = spawn('docker', [...args, '-c', "SET application_name='r2_snapshot_lock_test'; BEGIN; SELECT public.today_lock_snapshot_v1(); SELECT pg_sleep(8); ROLLBACK;"], { stdio: ['ignore', 'pipe', 'pipe'] });
let errors = '';
holder.stderr.on('data', (chunk) => { errors += chunk; });
const finished = new Promise((resolve, reject) => {
  holder.on('error', reject);
  holder.on('close', (code) => code === 0 ? resolve() : reject(new Error(errors)));
});
try {
  let acquired = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { stdout } = await query("SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='r2_snapshot_lock_test' AND l.relation='public.inventory_items'::regclass AND l.mode='ShareLock' AND l.granted);");
    if (stdout.trim() === 't') { acquired = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(acquired, 'snapshot transaction must hold its locks');
  for (const table of ['inventory_items', 'recipes', 'catalog_versions']) {
    await assert.rejects(query(`BEGIN; SET LOCAL lock_timeout='400ms'; UPDATE public.${table} SET id=id WHERE false; ROLLBACK;`), (error) => /lock timeout/.test(error.stderr));
    console.log(`PASS: concurrent ${table} write waits for snapshot transaction`);
  }
  await finished;
  await query('BEGIN; UPDATE public.inventory_items SET id=id WHERE false; UPDATE public.recipes SET id=id WHERE false; UPDATE public.catalog_versions SET id=id WHERE false; ROLLBACK;');
  console.log('PASS: write locks are released after the snapshot transaction');
} finally {
  await finished;
}
