import { readSnapshot, sha256 } from './snapshot.mjs';
import { transform } from './transform.mjs';

export async function dryRun(snapshot, resolveUser) {
  const report = { source: 0, ready: 0, quarantine: [], byCollection: {}, coverage: { watermelonDb: 'not_available', overall: 'partial' } };
  for await (const record of readSnapshot(snapshot)) {
    report.source++;
    const collection = report.byCollection[record.collection] ??= { source: 0, ready: 0, quarantined: 0 };
    collection.source++;
    try {
      const userId = await resolveUser(record.uid);
      if (!userId) throw new Error('AUTH_MAPPING_MISSING');
      transform(record, userId);
      report.ready++;
      collection.ready++;
    } catch (error) {
      collection.quarantined++;
      report.quarantine.push({ pathHash: sha256(record.path), code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'TRANSFORM_FAILED' });
    }
  }
  return report;
}
