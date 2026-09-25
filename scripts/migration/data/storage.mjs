import { readSnapshot, sha256 } from './snapshot.mjs';

const RECEIPT_PATH = /^receipts\/([^/]+)\/[^/]+$/;
const FIELDS = ['storagePath', 'imagePath', 'receiptImagePath'];

export async function storagePlan(snapshot, listObjects) {
  const referenced = new Map();
  const invalid = [];
  for await (const record of readSnapshot(snapshot)) {
    for (const field of FIELDS) {
      const value = record.data[field];
      if (value == null) continue;
      if (typeof value !== 'string' || !RECEIPT_PATH.test(value) || value.match(RECEIPT_PATH)[1] !== record.uid) {
        invalid.push({ pathHash: sha256(record.path), code: 'INVALID_STORAGE_REFERENCE' });
        continue;
      }
      referenced.set(value, { pathHash: sha256(value), ownerHash: sha256(record.uid).slice(0, 16) });
    }
  }
  const present = new Set();
  const orphans = [];
  for await (const object of listObjects('receipts/')) {
    const path = typeof object === 'string' ? object : object.name;
    if (typeof path !== 'string' || !path.startsWith('receipts/')) throw new Error('INVALID_STORAGE_LISTING');
    if (referenced.has(path)) present.add(path);
    else orphans.push({ pathHash: sha256(path), code: 'ORPHAN_STORAGE_OBJECT' });
  }
  const missing = [...referenced].filter(([path]) => !present.has(path)).map(([path]) => ({ pathHash: sha256(path), code: 'REFERENCED_STORAGE_OBJECT_MISSING' }));
  return { referenced: referenced.size, present: present.size, orphaned: orphans.length, invalid, missing, orphans,
    coverage: { watermelonDb: 'not_available', overall: 'partial' } };
}
