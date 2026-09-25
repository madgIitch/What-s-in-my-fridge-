import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capture, SOURCE_PROJECT } from './snapshot.mjs';
import { importDomain, validateTarget } from './import.mjs';

test('target guard rejects production and staging requires explicit write confirmation', async () => {
  assert.throws(() => validateTarget('https://production.supabase.co', 'staging'), /SUPABASE_TARGET_REJECTED/);
  assert.throws(() => validateTarget('https://bwscshjtwmsfscbjbndq.supabase.co.evil.test', 'staging'), /SUPABASE_TARGET_REJECTED/);
  assert.equal(validateTarget('http://127.0.0.1:54321', 'local'), 'http://127.0.0.1:54321');
  await assert.rejects(importDomain({ snapshot: 'unused', authMap: {}, url: 'https://bwscshjtwmsfscbjbndq.supabase.co', key: 'test', environment: 'staging' }), /STAGING_WRITE_NOT_CONFIRMED/);
});

test('domain import resumes without re-upserting a confirmed record', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fridge-s12-import-'));
  try {
    const adapter = {
      listUsers: async () => ['uid1'],
      listDocuments: async (uid, collection) => collection === 'inventory' ? [
        { path: `users/${uid}/inventory/a`, data: { name: 'A', expiryDate: 1767225600000, quantity: 1, unit: 'kg', addedAt: 1767139200000 } },
        { path: `users/${uid}/inventory/b`, data: { name: 'B', expiryDate: 1767225600000, quantity: 2, unit: 'kg', addedAt: 1767139200000 } },
      ] : [],
    };
    await capture({ adapter, destination: directory, projectId: SOURCE_PROJECT });
    const calls = [];
    let fail = true;
    const fetchImpl = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (fail && calls.length === 3) { fail = false; return { ok: false, status: 503 }; }
      return { ok: true, json: async () => [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] };
    };
    const input = { snapshot: directory, authMap: { uid1: '11111111-1111-4111-8111-111111111111' }, url: 'http://127.0.0.1:54321', key: 'test-key', environment: 'local', fetchImpl };
    await assert.rejects(importDomain(input), /SUPABASE_HTTP_503/);
    const result = await importDomain(input);
    assert.equal(result.imported, 2);
    assert.equal(calls.filter(call => call.url.includes('/inventory_items?')).length, 3);
    assert.equal(calls.filter(call => call.url.includes('/legacy_id_map?')).length, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
