import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capture, SOURCE_PROJECT } from './snapshot.mjs';
import { transform } from './transform.mjs';
import { reconcile } from './reconcile.mjs';

test('reconciliation detects changed fields and extra target keys despite matching counts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-reconcile-'));
  const uid = 'uid1';
  const userId = '11111111-1111-4111-8111-111111111111';
  const document = { path: `users/${uid}/inventory/a`, data: { name: 'A', expiryDate: 1767225600000, quantity: 1, unit: 'kg', addedAt: 1767139200000 } };
  try {
    await capture({ destination: directory, projectId: SOURCE_PROJECT, adapter: {
      listUsers: async () => [uid],
      listDocuments: async (_uid, collection) => collection === 'inventory' ? [document] : [],
    } });
    const expected = transform({ ...document, collection: 'inventory' }, userId).row;
    const report = await reconcile({ snapshot: directory, authMap: { [uid]: userId }, url: 'http://127.0.0.1:54321', key: 'test', environment: 'local',
      fetchImpl: async url => ({ ok: true, json: async () => url.includes('/inventory_items?') ? [
        { ...expected, quantity: 2 },
        { ...expected, legacy_id: `users/${uid}/inventory/extra` },
      ] : [] }),
    });
    assert.equal(report.source, 1);
    assert.equal(report.matched, 0);
    assert.deepEqual(report.differences.map(item => item.code).sort(), ['CHANGED_TARGET', 'EXTRA_TARGET']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
