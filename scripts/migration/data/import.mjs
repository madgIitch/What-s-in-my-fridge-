import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { readSnapshot, plan, sha256 } from './snapshot.mjs';
import { transform } from './transform.mjs';

const STAGING_HOST = 'bwscshjtwmsfscbjbndq.supabase.co';
export function validateTarget(url, environment) {
  const parsed = new URL(url);
  if (environment === 'staging' && parsed.protocol === 'https:' && parsed.hostname === STAGING_HOST && !parsed.username && !parsed.password && !parsed.search && !parsed.hash) return parsed.origin;
  if (environment === 'local' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash) return parsed.origin;
  throw new Error('SUPABASE_TARGET_REJECTED');
}

function headers(key, extra = {}) { return { apikey: key, authorization: `Bearer ${key}`, ...extra }; }
async function request(fetchImpl, url, key, init) {
  const response = await fetchImpl(url, { ...init, headers: headers(key, init.headers) });
  if (!response.ok) throw new Error(`SUPABASE_HTTP_${response.status}`);
  return response;
}
async function saveCheckpoint(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

export async function importDomain({ snapshot, authMap, url, key, environment, confirmWrite, fetchImpl = fetch }) {
  const target = validateTarget(url, environment);
  if (environment === 'staging' && confirmWrite !== 'IMPORT_FIREBASE_DATA_STAGING') throw new Error('STAGING_WRITE_NOT_CONFIRMED');
  if (!key) throw new Error('SERVICE_ROLE_REQUIRED');
  await plan(snapshot);
  const manifest = await readFile(join(snapshot, 'manifest.json'));
  const snapshotDigest = sha256(manifest);
  const checkpointPath = join(snapshot, 'import-checkpoint.json');
  let checkpoint = null;
  try { checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (checkpoint && (checkpoint.snapshotDigest !== snapshotDigest || checkpoint.target !== target || checkpoint.transformVersion !== 1)) throw new Error('IMPORT_CHECKPOINT_MISMATCH');
  checkpoint ??= { snapshotDigest, target, transformVersion: 1, lastPath: null, processed: 0, imported: 0, quarantined: [] };
  let skipping = checkpoint.lastPath !== null;
  const report = { snapshotDigest, target, processed: checkpoint.processed, imported: checkpoint.imported, quarantined: checkpoint.quarantined, coverage: { watermelonDb: 'not_available', overall: 'partial' } };
  for await (const record of readSnapshot(snapshot)) {
    if (skipping) {
      if (record.path === checkpoint.lastPath) skipping = false;
      continue;
    }
    const userId = authMap[record.uid];
    let transformed;
    try {
      if (!userId) throw new Error('AUTH_MAPPING_MISSING');
      if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('AUTH_MAPPING_INVALID');
      transformed = transform(record, userId);
    } catch (error) {
      report.quarantined.push({ pathHash: sha256(record.path), code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'TRANSFORM_FAILED' });
      report.processed++;
      checkpoint.lastPath = record.path;
      checkpoint.processed++;
      await saveCheckpoint(checkpointPath, checkpoint);
      continue;
    }
    const endpoint = `${target}/rest/v1/${transformed.table}?on_conflict=user_id%2Csource%2Clegacy_id`;
    const response = await request(fetchImpl, endpoint, key, {
      method: 'POST', headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(transformed.row),
    });
    const rows = await response.json();
    const targetId = rows?.[0]?.id;
    if (!targetId) throw new Error('UPSERT_RETURNED_NO_ID');
    await request(fetchImpl, `${target}/rest/v1/legacy_id_map?on_conflict=source%2Centity_type%2Clegacy_id`, key, {
      method: 'POST', headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: userId, source: 'FIREBASE', entity_type: transformed.table, legacy_id: record.path, target_id: targetId }),
    });
    report.imported++;
    report.processed++;
    checkpoint.lastPath = record.path;
    checkpoint.processed++;
    checkpoint.imported++;
    await saveCheckpoint(checkpointPath, checkpoint);
  }
  if (skipping) throw new Error('IMPORT_CHECKPOINT_PATH_MISSING');
  return report;
}
