import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
function sql(input) { return new Promise((resolve,reject) => { const p=spawn('docker',['exec','-i','supabase_db_whats-in-my-fridge-local','psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{windowsHide:true}); let out='',err=''; p.stdout.on('data',d=>out+=d); p.stderr.on('data',d=>err+=d); p.on('exit',c=>c===0?resolve(out.trim().split('\n').at(-1)):reject(new Error(err))); p.stdin.end(input); }); }
const user=randomUUID(),other=randomUUID(),job=randomUUID(),concept=randomUUID();
const claims=JSON.stringify({sub:user,role:'authenticated'});
const prefix=`begin; set local role authenticated; select set_config('request.jwt.claims','${claims}',true);`;
const recipe={schemaVersion:'recipe-v1',title:'R3 concurrency fixture',ingredients:[{name:`R3 ${concept}`}],steps:['Cook'],source:{type:'manual'},provenance:{sourceType:'manual'}};
try {
 await sql(`insert into auth.users(id,email) values('${user}','r3-concurrent-${user}@example.test'),('${other}','r3-concurrent-${other}@example.test'); insert into public.food_concepts(id,slug,display_name) values('${concept}','r3-${concept}','R3 ${concept}'); insert into public.recipe_import_jobs(id,user_id,idempotency_key,source_type,manual_text,state,result) values('${job}','${user}','r3-${job}','manual','Local test','completed','${JSON.stringify(recipe)}');`);
 const context=JSON.parse(await sql(`${prefix} select public.read_cook_context_v1('import','${job}'); commit;`));
 const cached=JSON.parse(await sql(`select public.store_cook_cache_v1('${user}','import','${job}','${context.stateKey}','${context.recipe.recipeVersion}','{}');`));
 const invoke=(op,token,id)=>sql(`${prefix} select public.apply_cook_mutation_v1('${op}','import','${job}','${token}','${id}'); commit;`).then(JSON.parse);
 const saveId=randomUUID(); const saved=await Promise.all([invoke('save',context.recipe.recipeVersion,saveId),invoke('save',context.recipe.recipeVersion,saveId)]);
 assert.deepEqual(saved.map(r=>r.status).sort(),['applied','duplicate']); assert.equal(saved[0].result.favoriteId,saved[1].result.favoriteId);
 const shopId=randomUUID(); const bought=await Promise.all([invoke('shopping',cached.snapshotKey,shopId),invoke('shopping',cached.snapshotKey,shopId)]);
 assert.deepEqual(bought.map(r=>r.status).sort(),['applied','duplicate']); assert.deepEqual(bought[0].result.itemIds,bought[1].result.itemIds);
 const distinct=await Promise.all([invoke('shopping',cached.snapshotKey,randomUUID()),invoke('shopping',cached.snapshotKey,randomUUID())]);
 assert.deepEqual(distinct[0].result.itemIds,bought[0].result.itemIds); assert.deepEqual(distinct[1].result.itemIds,bought[0].result.itemIds);
 assert.equal(await sql(`select count(*) from public.shopping_list_items where user_id='${user}';`),'1');
 const mixed=await Promise.all([invoke('save',context.recipe.recipeVersion,randomUUID()),sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${JSON.stringify({sub:other,role:'authenticated'})}',true); select public.read_cook_library_v1(); select pg_sleep(0.1); commit;`)]);
 assert.equal(mixed[0].status,'applied');
 console.log('R3 concurrency: save replay, shopping replay, distinct gestures, single active origin item and cross-user read/save PASS (5 checks).');
} finally { await sql(`delete from auth.users where id in('${user}','${other}'); delete from public.food_concepts where id='${concept}';`); }
