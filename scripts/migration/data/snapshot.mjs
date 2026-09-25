import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, truncate, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

export const SOURCE_PROJECT = 'what-s-in-my-fridge-a2a07';
export const COLLECTIONS = Object.freeze([
  'inventory', 'drafts', 'savedRecipes', 'meal_entries',
  'cookingPreferences', 'recipe_jobs', 'usage', 'subscription',
]);
export const SNAPSHOT_VERSION = 1;

export const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value) + '\n';
const safeName = value => {
  if (typeof value !== 'string' || !value || value.includes('/') || value.includes('\\')) throw new Error('INVALID_UID');
  return value;
};
const fileName = task => `${sha256(task.uid).slice(0, 24)}_${task.collection}.jsonl`;

export function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value.path === 'string' && value.firestore) return { $reference: value.path };
    if (Buffer.isBuffer(value)) return { $base64: value.toString('base64') };
    if (typeof value.latitude === 'number' && typeof value.longitude === 'number') return { latitude: value.latitude, longitude: value.longitude };
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalizeValue(item)]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
  return value;
}

export function validateRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.path !== 'string' || typeof record.uid !== 'string' || !COLLECTIONS.includes(record.collection)) throw new Error('INVALID_RECORD');
  const segments = record.path.split('/');
  if (segments.length !== 4 || segments[0] !== 'users' || segments[1] !== record.uid || segments[2] !== record.collection || !segments.every(Boolean)) throw new Error('INVALID_RECORD_PATH');
  if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data)) throw new Error('INVALID_RECORD_DATA');
  return record;
}

async function atomicJson(path, value) {
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, path);
}

export async function capture({ adapter, destination, projectId, batchSize = 200, now = () => new Date().toISOString() }) {
  if (projectId !== SOURCE_PROJECT) throw new Error('SOURCE_PROJECT_REJECTED');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error('INVALID_BATCH_SIZE');
  const directory = resolve(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const manifestPath = join(directory, 'manifest.json');
  try { await stat(manifestPath); throw new Error('SNAPSHOT_ALREADY_COMPLETE'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const checkpointPath = join(directory, 'checkpoint.json');
  let checkpoint;
  try { checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (checkpoint && (checkpoint.projectId !== projectId || checkpoint.version !== SNAPSHOT_VERSION || checkpoint.batchSize !== batchSize)) throw new Error('CHECKPOINT_MISMATCH');
  checkpoint ??= { version: SNAPSHOT_VERSION, projectId, batchSize, startedAt: now(), cursor: null, counts: {} };
  const users = await adapter.listUsers();
  const userIds = users.map(user => safeName(typeof user === 'string' ? user : user.id)).sort();
  if (new Set(userIds).size !== userIds.length) throw new Error('DUPLICATE_USER');
  const tasks = userIds.flatMap(uid => COLLECTIONS.map(collection => ({ uid, collection, key: `${uid}/${collection}` })));
  const resumeIndex = checkpoint.cursor ? tasks.findIndex(task => task.key === checkpoint.cursor.key) : 0;
  if (resumeIndex < 0) throw new Error('CHECKPOINT_TASK_MISMATCH');
  for (const [index, task] of tasks.entries()) {
    if (index < resumeIndex) continue;
    const file = join(directory, fileName(task));
    let after = checkpoint.cursor?.key === task.key ? checkpoint.cursor.after : null;
    if (checkpoint.cursor?.key === task.key && checkpoint.cursor.complete) continue;
    if (checkpoint.cursor?.key === task.key && checkpoint.cursor.offset !== undefined) await truncate(file, checkpoint.cursor.offset);
    while (true) {
      const batch = await adapter.listDocuments(task.uid, task.collection, after, batchSize);
      if (!Array.isArray(batch) || batch.length > batchSize) throw new Error('INVALID_ADAPTER_BATCH');
      if (batch.some((document, index) => typeof document.path !== 'string' || (after && document.path <= after) || (index && document.path <= batch[index - 1].path))) throw new Error('INVALID_ADAPTER_ORDER');
      const lines = batch.map(document => json(validateRecord({ path: document.path, uid: task.uid, collection: task.collection, data: normalizeValue(document.data), updateTime: document.updateTime ?? null })));
      const writer = createWriteStream(file, { flags: 'a', mode: 0o600 });
      await new Promise((done, fail) => { writer.on('error', fail); writer.end(lines.join(''), done); });
      after = batch.at(-1)?.path ?? after;
      checkpoint.cursor = { key: task.key, after, complete: batch.length < batchSize, offset: (await stat(file)).size };
      checkpoint.counts[task.key] = (checkpoint.counts[task.key] ?? 0) + batch.length;
      await writeFile(`${checkpointPath}.tmp`, JSON.stringify(checkpoint, null, 2) + '\n', { mode: 0o600 });
      await rename(`${checkpointPath}.tmp`, checkpointPath);
      if (batch.length < batchSize) break;
    }
  }
  const files = [];
  for (const task of tasks) {
    const name = fileName(task);
    const content = await readFile(join(directory, name));
    files.push({ name, count: checkpoint.counts[task.key] ?? 0, sha256: sha256(content) });
  }
  const manifest = { version: SNAPSHOT_VERSION, projectId, startedAt: checkpoint.startedAt, completedAt: now(), coverage: { watermelonDb: 'not_available', overall: 'partial' }, files };
  await atomicJson(manifestPath, manifest);
  return manifest;
}

export async function* readSnapshot(destination) {
  const directory = resolve(destination);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== SNAPSHOT_VERSION || manifest.projectId !== SOURCE_PROJECT || !Array.isArray(manifest.files)) throw new Error('INVALID_MANIFEST');
  const seen = new Set();
  for (const file of manifest.files) {
    if (typeof file.name !== 'string' || !/^[A-Za-z0-9_-]+\.jsonl$/.test(file.name) || seen.has(file.name)) throw new Error('INVALID_SNAPSHOT_FILE');
    seen.add(file.name);
    const content = await readFile(join(directory, file.name));
    if (sha256(content) !== file.sha256) throw new Error('SNAPSHOT_CHECKSUM_MISMATCH');
    let count = 0;
    const reader = createInterface({ input: createReadStream(join(directory, file.name)), crlfDelay: Infinity });
    for await (const line of reader) {
      if (!line) continue;
      const record = validateRecord(JSON.parse(line));
      count++;
      yield record;
    }
    if (count !== file.count) throw new Error('SNAPSHOT_COUNT_MISMATCH');
  }
}

export async function plan(destination) {
  const counts = {};
  const paths = new Set();
  for await (const record of readSnapshot(destination)) {
    if (paths.has(record.path)) throw new Error('DUPLICATE_DOCUMENT_PATH');
    paths.add(record.path);
    counts[record.collection] = (counts[record.collection] ?? 0) + 1;
  }
  return { documents: paths.size, counts, coverage: { watermelonDb: 'not_available', overall: 'partial' } };
}
