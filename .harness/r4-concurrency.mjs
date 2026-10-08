import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
function sql(input) { return new Promise((resolve, reject) => { const p = spawn('docker', ['exec', '-i', 'supabase_db_whats-in-my-fridge-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true }); let out = '', error = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => error += d); p.on('exit', c => c === 0 ? resolve(out.trim().split('\n').at(-1)) : reject(new Error(error))); p.stdin.end(input); }); }
const user = randomUUID(), other = randomUUID(), job = randomUUID(), concept = randomUUID(), item = randomUUID();
const claims = uid => JSON.stringify({ sub: uid, role: 'authenticated' });
const prefix = `begin; set local statement_timeout='10s'; set local role authenticated; select set_config('request.jwt.claims','${claims(user)}',true);`;
const recipe = { schemaVersion: 'recipe-v1', title: 'R4 concurrent cooking', ingredients: [{ name: `Egg ${concept}`, amount: '4', unit: 'unit' }], steps: ['Cook'], source: { type: 'manual' } };
async function plan() {
 const ctx = JSON.parse(await sql(`${prefix} select public.read_cooking_v3_context('import','${job}'); commit;`));
 const row = ctx.pantry.find(i => i.id === item);
 const result = { contract: 'cooking-plan-v1', recipeVersion: ctx.recipe.recipeVersion, recipe: ctx.recipe, lines: [{ lineId: concept, conceptId: concept, mode: 'exact', required: 4, requiredUnit: 'unit', allowedActions: ['apply', 'keep'], allocations: [{ inventoryItemId: item, version: row.version }] }] };
 return JSON.parse(await sql(`select public.store_cooking_v3_plan('${user}','import','${job}','${ctx.stateKey}','${JSON.stringify(result)}');`)).planKey;
}
const confirm = (key, mutation) => sql(`${prefix} select public.confirm_cooking_v3('${key}','${mutation}',false,'[{"lineId":"${concept}","action":"apply"}]'); commit;`).then(JSON.parse);
const undo = (event, mutation) => sql(`${prefix} select public.undo_cooking_v3('${event}','${mutation}'); commit;`).then(JSON.parse);
try {
 await sql(`insert into auth.users(id,email) values('${user}','r4-${user}@example.test'),('${other}','r4-${other}@example.test'); insert into public.food_concepts(id,slug,display_name) values('${concept}','r4-${concept}','Egg ${concept}'); insert into public.recipe_import_jobs(id,user_id,idempotency_key,source_type,manual_text,state,result) values('${job}','${user}','r4-${job}','manual','Local test','completed','${JSON.stringify(recipe)}'); insert into public.inventory_items(id,user_id,name,quantity,unit,added_at,food_concept_id,normalization_status,normalization_source,knowledge_provenance,stock_mode,quantity_precision,quantity_exact,quantity_unit) values('${item}','${user}','Egg ${concept}',16,'unit',now(),'${concept}','confirmed','user','user','exact','exact',16,'unit');`);
 const key = await plan(), mutation = randomUUID(); const results = await Promise.all([confirm(key, mutation), confirm(key, mutation)]);
 assert.deepEqual(results.map(r => r.status).sort(), ['applied', 'duplicate']); assert.equal(results[0].eventId, results[1].eventId);
 assert.equal(Number(await sql(`select quantity_exact from public.inventory_items where id='${item}';`)), 12);
 const undone = await Promise.all([undo(results[0].eventId, randomUUID()), undo(results[0].eventId, randomUUID())]);
 assert.deepEqual(undone.map(r => r.status).sort(), ['applied', 'duplicate']); assert.equal(undone[0].eventId, undone[1].eventId);
 const next = await plan(); const distinct = await Promise.all([confirm(next, randomUUID()), confirm(next, randomUUID())]);
 assert.equal(distinct.filter(r => r.status === 'applied').length, 1); assert.equal(distinct.filter(r => r.error === 'PANTRY_CONFLICT').length, 1);
 const event = distinct.find(r => r.status === 'applied').eventId;
 const mixed = await Promise.all([undo(event, randomUUID()), sql(`begin; set local statement_timeout='10s'; select quantity_exact from public.inventory_items where id='${item}' for update; update public.inventory_items set quantity_exact=20,version=version+1 where id='${item}'; commit;`)]);
 assert.ok(mixed[0].status === 'applied' || mixed[0].error === 'UNDO_CONFLICT'); assert.equal(Number(await sql(`select quantity_exact from public.inventory_items where id='${item}';`)), 20);
 const latest = await plan(); const reading = await Promise.all([confirm(latest, randomUUID()), sql(`begin; set local statement_timeout='10s'; set local role authenticated; select set_config('request.jwt.claims','${claims(other)}',true); select public.read_cook_library_v1(); commit;`)]);
 assert.equal(reading[0].status, 'applied');
 console.log('R4 concurrency PASS: confirm replay, unique undo, distinct confirmations, undo/edit and cross-user library/consumption (5 checks).');
} finally {
 // Only this script's UUID fixtures; no reset or unrelated deletion.
 await sql(`delete from public.cooking_v3_events where user_id='${user}' and compensates is not null; delete from auth.users where id in('${user}','${other}'); delete from public.food_concepts where id='${concept}';`);
}
