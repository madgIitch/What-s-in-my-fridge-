import { readSnapshot, sha256 } from './snapshot.mjs';
import { transform } from './transform.mjs';
import { validateTarget } from './import.mjs';

const canonical = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
const digest = value => sha256(canonical(value));
const timestampFields = new Set(['expiry_date', 'added_at', 'captured_at', 'saved_at', 'consumed_at', 'source_updated_at']);
const numberFields = new Set(['quantity', 'total', 'match_percentage', 'calories_estimate']);
const normalizedField = (field, value) => {
  if (value == null) return null;
  if (timestampFields.has(field)) return new Date(value).toISOString();
  if (numberFields.has(field)) return Number(value);
  return value;
};
const projection = row => Object.fromEntries(Object.entries(row).map(([field, value]) => [field, normalizedField(field, value)]));

export async function reconcile({ snapshot, authMap, url, key, environment, fetchImpl = fetch }) {
  const target = validateTarget(url, environment);
  if (!key) throw new Error('SERVICE_ROLE_REQUIRED');
  const expected = new Map();
  const report = { source: 0, matched: 0, differences: [], quarantine: [], byUserCollection: {}, coverage: { watermelonDb: 'not_available', overall: 'partial' } };
  for await (const record of readSnapshot(snapshot)) {
    report.source++;
    const userId = authMap[record.uid];
    try {
      if (!userId) throw new Error('AUTH_MAPPING_MISSING');
      const { table, row } = transform(record, userId);
      expected.set(`${table}\u0000${row.user_id}\u0000${row.legacy_id}`, { table, row, collection: record.collection });
      const key = `${sha256(record.uid).slice(0, 16)}/${record.collection}`;
      const group = report.byUserCollection[key] ??= { source: 0, matched: 0, missing: 0, changed: 0, extra: 0 };
      group.source++;
    } catch (error) {
      report.quarantine.push({ pathHash: sha256(record.path), code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'TRANSFORM_FAILED' });
    }
  }
  const tables = ['inventory_items', 'receipt_drafts', 'favorite_recipes', 'meal_entries', 'legacy_migration_records'];
  const actual = new Map();
  for (const table of tables) {
    for (let offset = 0; ; offset += 1000) {
      const endpoint = `${target}/rest/v1/${table}?select=*&source=eq.FIREBASE&limit=1000&offset=${offset}`;
      const response = await fetchImpl(endpoint, { headers: { apikey: key, authorization: `Bearer ${key}` } });
      if (!response.ok) throw new Error(`SUPABASE_HTTP_${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('INVALID_SUPABASE_RESPONSE');
      for (const row of rows) actual.set(`${table}\u0000${row.user_id}\u0000${row.legacy_id}`, { table, row });
      if (rows.length < 1000) break;
    }
  }
  for (const [key, item] of expected) {
    const groupKey = `${sha256(item.row.legacy_id.split('/')[1]).slice(0, 16)}/${item.collection}`;
    const group = report.byUserCollection[groupKey];
    const entry = actual.get(key);
    if (!entry) { report.differences.push({ pathHash: sha256(item.row.legacy_id), code: 'MISSING_TARGET' }); group.missing++; continue; }
    actual.delete(key);
    const row = entry.row;
    const actualProjection = Object.fromEntries(Object.keys(item.row).map(field => [field, row[field]]));
    if (digest(projection(actualProjection)) !== digest(projection(item.row))) { report.differences.push({ pathHash: sha256(item.row.legacy_id), code: 'CHANGED_TARGET' }); group.changed++; continue; }
    report.matched++;
    group.matched++;
  }
  for (const { table, row } of actual.values()) {
    report.differences.push({ pathHash: sha256(row.legacy_id ?? ''), code: 'EXTRA_TARGET' });
    const collection = row.collection ?? { inventory_items: 'inventory', receipt_drafts: 'drafts', favorite_recipes: 'savedRecipes', meal_entries: 'meal_entries' }[table];
    const groupKey = collection && row.legacy_id ? `${sha256(row.legacy_id.split('/')[1]).slice(0, 16)}/${collection}` : null;
    if (groupKey && report.byUserCollection[groupKey]) report.byUserCollection[groupKey].extra++;
  }
  return report;
}
