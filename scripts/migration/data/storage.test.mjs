import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capture, SOURCE_PROJECT } from './snapshot.mjs';
import { storagePlan } from './storage.mjs';

test('Storage plan separates referenced and orphan objects without copying either', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-storage-'));
  try {
    await capture({ destination: directory, projectId: SOURCE_PROJECT, adapter: {
      listUsers: async () => ['uid1'],
      listDocuments: async (uid, collection) => collection === 'drafts' ? [{ path: `users/${uid}/drafts/a`, data: { storagePath: `receipts/${uid}/a.jpg` } }] : [],
    } });
    const report = await storagePlan(directory, async function* () { yield 'receipts/uid1/a.jpg'; yield 'receipts/uid1/orphan.jpg'; });
    assert.equal(report.referenced, 1);
    assert.equal(report.present, 1);
    assert.equal(report.orphaned, 1);
    assert.equal(report.missing.length, 0);
    assert.ok(!JSON.stringify(report).includes('receipts/uid1'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
