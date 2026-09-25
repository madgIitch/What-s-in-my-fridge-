import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capture, plan, SOURCE_PROJECT } from './snapshot.mjs';

test('capture writes verified snapshot and marks local-only coverage partial', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-'));
  try {
    const adapter = {
      listUsers: async () => ['uid1'],
      listDocuments: async (uid, collection, after) => collection === 'inventory' && !after
        ? [{ path: `users/${uid}/inventory/item1`, data: { name: 'milk', addedAt: new Date('2026-01-01T00:00:00Z') }, updateTime: '2026-01-02T00:00:00Z' }]
        : [],
    };
    await capture({ adapter, destination: directory, projectId: SOURCE_PROJECT, batchSize: 2 });
    assert.deepEqual(await plan(directory), { documents: 1, counts: { inventory: 1 }, coverage: { watermelonDb: 'not_available', overall: 'partial' } });
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.files.length, 8);
    await assert.rejects(capture({ adapter, destination: directory, projectId: SOURCE_PROJECT }), /SNAPSHOT_ALREADY_COMPLETE/);
    await writeFile(join(directory, manifest.files.find(file => file.name.endsWith('_inventory.jsonl')).name), 'tampered\n');
    await assert.rejects(plan(directory), /SNAPSHOT_CHECKSUM_MISMATCH/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('capture resumes after a failed batch without duplicating documents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-'));
  let fail = true;
  try {
    const adapter = {
      listUsers: async () => ['uid1'],
      listDocuments: async (uid, collection, after) => {
        if (collection !== 'inventory') return [];
        if (!after) return [{ path: `users/${uid}/inventory/a`, data: { name: 'a' } }];
        if (fail) { fail = false; throw new Error('TRANSIENT'); }
        return [{ path: `users/${uid}/inventory/b`, data: { name: 'b' } }];
      },
    };
    await assert.rejects(capture({ adapter, destination: directory, projectId: SOURCE_PROJECT, batchSize: 1 }), /TRANSIENT/);
    adapter.listDocuments = async (uid, collection, after) => collection !== 'inventory' ? [] :
      !after ? [{ path: `users/${uid}/inventory/a`, data: { name: 'a' } }] :
      after.endsWith('/a') ? [{ path: `users/${uid}/inventory/b`, data: { name: 'b' } }] : [];
    await capture({ adapter, destination: directory, projectId: SOURCE_PROJECT, batchSize: 1 });
    assert.equal((await plan(directory)).documents, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('capture rejects source changes observed during its verification pass', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-drift-'));
  let reads = 0;
  try {
    const adapter = {
      listUsers: async () => ['uid1'],
      listDocuments: async (uid, collection) => collection === 'inventory' ? [{
        path: `users/${uid}/inventory/a`, data: { name: 'a' }, updateTime: ++reads === 1 ? '2026-01-01T00:00:00Z' : '2026-01-02T00:00:00Z',
      }] : [],
    };
    await assert.rejects(capture({ adapter, destination: directory, projectId: SOURCE_PROJECT }), /SOURCE_DRIFT_DETECTED/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
