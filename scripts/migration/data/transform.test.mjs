import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capture, SOURCE_PROJECT } from './snapshot.mjs';
import { dryRun } from './dry-run.mjs';
import { transform } from './transform.mjs';

test('legacy inventory maps to the domain schema without using email ownership', () => {
  const record = { uid: 'firebase-1', collection: 'inventory', path: 'users/firebase-1/inventory/item-1', data: {
    name: 'Milk', expiryDate: 1767225600000, quantity: 2, unit: 'l', addedAt: 1767139200000,
  } };
  const result = transform(record, '11111111-1111-4111-8111-111111111111');
  assert.equal(result.table, 'inventory_items');
  assert.equal(result.row.legacy_id, record.path);
  assert.equal(result.row.quantity, 2);
  assert.equal(result.row.source, 'FIREBASE');
});

test('dry-run quarantines missing auth and maps historical usage without affecting canonical counters', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-dry-'));
  try {
    const adapter = {
      listUsers: async () => ['known', 'unknown'],
      listDocuments: async (uid, collection) => collection === 'inventory'
        ? [{ path: `users/${uid}/inventory/a`, data: { name: 'A', expiryDate: 1767225600000, quantity: 1, unit: 'kg', addedAt: 1767139200000 } }]
        : collection === 'usage' ? [{ path: `users/${uid}/usage/2026-01`, data: { recipeCallsUsed: 2 } }] : [],
    };
    await capture({ adapter, destination: directory, projectId: SOURCE_PROJECT });
    const report = await dryRun(directory, uid => uid === 'known' ? '11111111-1111-4111-8111-111111111111' : null);
    assert.equal(report.source, 4);
    assert.equal(report.ready, 2);
    assert.deepEqual(report.quarantine.map(item => item.code).sort(), ['AUTH_MAPPING_MISSING', 'AUTH_MAPPING_MISSING']);
    assert.ok(report.quarantine.every(item => !JSON.stringify(item).includes('users/')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
