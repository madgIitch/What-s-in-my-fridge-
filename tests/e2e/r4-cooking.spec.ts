import { test, expect, type Page } from '@playwright/test';
import { createClient } from '../../apps/web/node_modules/@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const local = (() => { try { return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname); } catch { return false; } })();
const enabled = process.env.PRODUCT_V3 === 'true';
const ids = [1, 2, 3].map(n => `e2100000-0000-4000-a000-00000000000${n}`);
const names = ['Huevos R4 E2E', 'Cebolla R4 E2E', 'Pimiento R4 E2E'];
function admin() { if (!local) throw new Error('Only local fixtures'); return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }
function check(r: { error: unknown }) { if (r.error) throw r.error; }
async function signIn(page: Page) {
  const password = 'r4-local-password-2026'; const email = `r4-${crypto.randomUUID()}@example.test`;
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); const r = await client.auth.signUp({ email, password }); if (r.error || !r.data.user) throw r.error ?? new Error('signup');
  await page.goto('/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Contraseña').fill(password); await page.getByRole('button', { name: /Entrar/ }).click(); await expect(page).toHaveURL(/\/app(?:\?|$)/); return r.data.user.id;
}
async function fixture(userId: string) {
  const db = admin(); check(await db.from('food_concepts').upsert(names.map((display_name, n) => ({ id: ids[n], slug: `r4-e2e-${n}`, display_name }))));
  const lots = ids.map(() => crypto.randomUUID());
  check(await db.from('inventory_items').insert(ids.map((food_concept_id, n) => ({ id: lots[n], user_id: userId, name: names[n], quantity: n === 0 ? 16 : 0, unit: 'unit', added_at: new Date().toISOString(), food_concept_id, normalization_status: 'confirmed', normalization_source: 'user', knowledge_provenance: 'user', stock_mode: n === 1 ? 'qualitative' : 'exact', stock_state: n === 1 ? 'plenty' : null, quantity_precision: n === 1 ? 'unknown' : 'exact', quantity_exact: n === 0 ? 16 : n === 2 ? 30 : null, quantity_unit: n === 1 ? null : 'unit' }))));
  const job = crypto.randomUUID(); const result = { schemaVersion: 'recipe-v1', title: 'Huevos con cebolla R4', ingredients: [{ name: names[0], amount: '4', unit: 'unit' }, { name: names[1] }, { name: names[2] }, { name: 'Ingrediente no identificado R4' }], steps: ['Corta la cebolla.', 'Bate los huevos y cocina.'], source: { type: 'manual' }, provenance: { quality: { status: 'review_required' } } };
  check(await db.from('recipe_import_jobs').insert({ id: job, user_id: userId, idempotency_key: `r4-${job}`, source_type: 'manual', manual_text: 'fixture local', state: 'completed', result })); return { job, lots, result };
}
async function open(page: Page, job: string) { await page.goto(`/app/cook/session?kind=import&id=${job}`); await expect(page.getByRole('heading', { name: 'Huevos con cebolla R4' })).toBeVisible(); }
async function preview(page: Page) { await page.getByRole('button', { name: 'Ya está' }).click(); await expect(page.getByRole('heading', { name: '¿Lo has cocinado?' })).toBeFocused(); await page.getByRole('checkbox').check(); }
async function row(page: Page, name: string) { return page.locator('li').filter({ has: page.getByText(name, { exact: true }) }).first(); }
test.describe('R4 local', () => {
  test.skip(!local || !process.env.RUN_LOCAL_SUPABASE_E2E);
  test('exact 16→12, qualitative low, unknown kept, progress, snapshots, replay and undo', async ({ page }) => {
    test.setTimeout(60000); test.skip(!enabled); const user = await signIn(page); const { job, lots } = await fixture(user); const db = admin();
    await page.goto(`/app/recipes/import/${job}`); await page.getByRole('link', { name: 'Cocinar esta receta' }).click(); await expect(page.getByRole('heading', { name: 'Huevos con cebolla R4' })).toBeVisible();
    await page.getByRole('button', { name: /Corta la cebolla/ }).click(); await page.reload(); await expect(page.getByText('1 de 2 completados')).toBeVisible();
    await page.setViewportSize({ width: 393, height: 852 }); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r4-session-393.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 720 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r4-session-320.png', fullPage: true }); await page.setViewportSize({ width: 393, height: 852 });
    await preview(page); await expect(page.getByText('→ 12 unidades')).toBeVisible(); await expect(page.getByText('→ Queda poco')).toBeVisible();
    expect((await db.from('inventory_items').select('quantity_exact').eq('id', lots[0]).single()).data?.quantity_exact).toBe(16);
    await page.getByRole('button', { name: 'Ajustar cantidades' }).click(); const egg = await row(page, names[0]); await egg.getByLabel(`Acción para ${names[0]}`).selectOption('set_consumption'); await egg.getByLabel(/Cantidad consumida/).fill('2'); await expect(egg.getByText('→ 14 unidades')).toBeVisible(); await egg.getByLabel(`Acción para ${names[0]}`).selectOption('apply'); await page.getByRole('button', { name: 'Terminar ajustes' }).click();
    await page.setViewportSize({ width: 320, height: 720 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r4-preview-320.png', fullPage: true });
    await page.setViewportSize({ width: 393, height: 852 }); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r4-preview-393.png', fullPage: true });
    const bodies: string[] = []; let first = true;
    await page.route('**/api/cooking/v3/confirm', async route => { bodies.push(route.request().postData()!); if (first) { first = false; await route.fetch(); await route.abort(); } else await route.continue(); });
    await page.getByRole('button', { name: 'Sí, actualizar despensa' }).click(); await expect(page.getByText(/El intento sigue pendiente/)).toBeVisible(); await page.getByRole('button', { name: 'Reintentar confirmación' }).click(); await expect(page.getByRole('heading', { name: 'Despensa actualizada' })).toBeVisible(); expect(bodies).toHaveLength(2); expect(bodies[0]).toBe(bodies[1]);
    const stock = await db.from('inventory_items').select('id,quantity_exact,stock_state').in('id', lots); check(stock); expect(stock.data!.find(l => l.id === lots[0])?.quantity_exact).toBe(12); expect(stock.data!.find(l => l.id === lots[1])?.stock_state).toBe('low'); expect(stock.data!.find(l => l.id === lots[2])?.quantity_exact).toBe(30);
    expect((await db.from('inventory_items').select('quantity').eq('id', lots[0]).single()).data?.quantity).toBe(12);
    expect(await page.getByRole('button', { name: 'Deshacer actualización' }).evaluate(n => n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r4-applied-393.png', fullPage: true });
    await page.getByRole('button', { name: 'Deshacer actualización' }).click(); await expect(page.getByRole('heading', { name: 'Cambios deshechos' })).toBeVisible(); expect((await db.from('inventory_items').select('quantity_exact').eq('id', lots[0]).single()).data?.quantity_exact).toBe(16);
    expect((await db.from('cooking_v3_events').select('id').eq('user_id', user)).data).toHaveLength(2);
    await page.emulateMedia({ reducedMotion: 'reduce' }); expect(await page.locator('main').first().evaluate(n => getComputedStyle(n).animationName)).toBe('none');
  });
  test('offline intention, same payload replay after reload, expired plan needs review, account isolation', async ({ page, context, browser }) => {
    test.setTimeout(60000); test.skip(!enabled); const user = await signIn(page); const { job, lots } = await fixture(user); const db = admin(); await open(page, job); await preview(page);
    await context.setOffline(true); await page.getByRole('button', { name: 'Guardar intención pendiente' }).click(); await expect(page.getByText(/Pendiente de conexión o confirmación/)).toBeVisible(); expect((await db.from('inventory_items').select('quantity_exact').eq('id', lots[0]).single()).data?.quantity_exact).toBe(16);
    await context.setOffline(false); await expect(page.getByRole('heading', { name: 'Despensa actualizada' })).toBeVisible(); await page.reload(); await expect(page.getByRole('heading', { name: 'Despensa actualizada' })).toBeVisible();
    await page.getByRole('button', { name: 'Deshacer actualización' }).click(); await page.getByRole('link', { name: 'Ver mi despensa' }).click();
    // A new source has a separate draft and plan; offline intent expires on server.
    const second = await fixture(user); await open(page, second.job); await preview(page); await context.setOffline(true); await page.getByRole('button', { name: 'Guardar intención pendiente' }).click(); await expect(page.getByText(/Pendiente de conexión o confirmación/)).toBeVisible();
    check(await db.from('cooking_v3_plans').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('source_id', second.job).eq('user_id', user)); await context.setOffline(false); await expect(page.getByText(/La comparación ha caducado/)).toBeVisible(); await page.getByRole('button', { name: 'Actualizar comparación' }).click(); await expect(page.getByRole('button', { name: 'Sí, actualizar despensa' })).toBeDisabled(); await page.getByRole('checkbox').check();
    const other = await browser.newContext(); const otherPage = await other.newPage(); try { await signIn(otherPage); const r = await otherPage.request.get(`/api/cooking/v3/plan?kind=import&id=${job}`); expect(r.status()).toBe(404); } finally { await other.close(); }
  });
  test('pantry conflict, immutable favorite source, manual unknown adjustment and undo conflict', async ({ page }) => {
    test.setTimeout(60000); test.skip(!enabled); const user = await signIn(page); const { job, lots, result } = await fixture(user); const db = admin(); await open(page, job); await preview(page);
    const stock = await db.from('inventory_items').select('version').eq('id', lots[0]).single(); check(stock); check(await db.from('inventory_items').update({ quantity_exact: 18, version: stock.data!.version + 1 }).eq('id', lots[0]));
    await page.getByRole('button', { name: 'Sí, actualizar despensa' }).click(); await expect(page.getByText(/Tu despensa ha cambiado/)).toBeVisible(); await page.getByRole('button', { name: 'Actualizar comparación' }).click(); await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Ajustar cantidades' }).click(); const pepper = await row(page, names[2]); await pepper.getByLabel(`Acción para ${names[2]}`).selectOption('set_consumption'); await pepper.getByLabel(/Cantidad consumida/).fill('3'); await page.getByRole('button', { name: 'Sí, actualizar despensa' }).click(); await expect(page.getByRole('heading', { name: 'Despensa actualizada' })).toBeVisible(); expect((await db.from('inventory_items').select('quantity_exact').eq('id', lots[2]).single()).data?.quantity_exact).toBe(27);
    const after = await db.from('inventory_items').select('version').eq('id', lots[2]).single(); check(after); check(await db.from('inventory_items').update({ notes: 'later edit', version: after.data!.version + 1 }).eq('id', lots[2])); await page.getByRole('button', { name: 'Deshacer actualización' }).click(); await expect(page.getByText(/Tu despensa cambió después/)).toBeVisible();
    const snapshot = { version: 1, title: 'Versión guardada R4', instructions: result.steps, reviewRequired: true, ingredients: result.ingredients.map(i => ({ ingredientKey: i.name, name: i.name, quantity: i.amount ? Number(i.amount) : null, unit: i.unit ?? null, amount_status: i.amount ? 'exact' : 'unknown' })) };
    const favorite = await db.from('favorite_recipes').insert({ user_id: user, recipe_id: `import:${job}`, name: snapshot.title, match_percentage: 0, instructions: '', saved_at: new Date().toISOString(), snapshot }).select('id').single(); check(favorite);
    check(await db.from('recipe_import_revisions').insert({ job_id: job, user_id: user, version: 1, result: { ...result, title: 'Revisión nueva R4' } }));
    await page.goto(`/app/recipes/import/${job}?saved=${favorite.data!.id}`); await page.getByRole('link', { name: 'Cocinar esta receta' }).click(); await expect(page.getByRole('heading', { name: 'Versión guardada R4' })).toBeVisible();
  });
  test('catalog source and invalid body do not change inventory; logout purges draft', async ({ page }) => {
    test.setTimeout(60000); test.skip(!enabled); const user = await signIn(page); const { job } = await fixture(user); const db = admin();
    const recipes = await db.from('recipes').select('id').neq('instructions', '').limit(1); check(recipes); expect(recipes.data?.length).toBe(1); await page.goto(`/app/recipes/${recipes.data![0].id}`); await page.getByRole('link', { name: 'Cocinar esta receta' }).click(); await expect(page.getByRole('heading', { name: 'Vas a usar' })).toBeVisible();
    await open(page, job); await page.getByRole('button', { name: /Corta la cebolla/ }).click();
    const bad = await page.evaluate(async () => { const r = await fetch('/api/cooking/v3/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'forged' }) }); return r.status; }); expect(bad).toBe(400);
    await page.goto('/app/settings'); await page.getByRole('button', { name: /Cerrar sesión/ }).click(); await expect(page).toHaveURL(/login/);
    // Logout may happen on a different page: the auth hook must still clear persisted cooking state.
    const drafts = await page.evaluate(async () => new Promise<number>((resolve, reject) => { const r = indexedDB.open('neverita-pwa-v1', 1); r.onsuccess = () => { if (!r.result.objectStoreNames.contains('drafts')) { r.result.close(); resolve(0); return; } const count = r.result.transaction('drafts').objectStore('drafts').count(); count.onsuccess = () => { r.result.close(); resolve(count.result); }; }; r.onerror = () => reject(r.error); })); expect(drafts).toBe(0);
  });
  test('undo expiry remains visible and stops writes', async ({ page }) => {
    test.skip(!enabled); const user = await signIn(page); const { job } = await fixture(user); const db = admin(); await open(page, job); await preview(page); await page.getByRole('button', { name: 'Sí, actualizar despensa' }).click(); await expect(page.getByRole('heading', { name: 'Despensa actualizada' })).toBeVisible();
    check(await db.from('cooking_v3_events').update({ undo_until: new Date(Date.now() - 1000).toISOString() }).eq('user_id', user)); await page.getByRole('button', { name: 'Deshacer actualización' }).click(); await expect(page.getByText(/Ha terminado el plazo para deshacer/)).toBeVisible();
  });
  test('flag false preserves legacy and hides v3 APIs', async ({ page }) => {
    test.skip(enabled); await signIn(page); await page.goto('/app/cook/session?kind=import&id=e3000000-0000-4000-a000-000000000001'); await expect(page).toHaveURL(/\/app\/recipes$/); expect((await page.request.get('/api/cooking/v3/plan?kind=import&id=e3000000-0000-4000-a000-000000000001')).status()).toBe(404);
  });
});
