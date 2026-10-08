import { expect, test, type Page } from '@playwright/test';
import { createClient } from '../../apps/web/node_modules/@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const local = (() => { try { return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname); } catch { return false; } })();
const enabled = process.env.PRODUCT_V3 === 'true';
const password = 'r3-local-password-2026';
const names = ['Tortillas R3', 'Queso R3 E2E', 'Tomate R3 E2E', 'Jamón R3'];
const conceptIds = names.map((_, n) => `d2000000-0000-4000-a000-00000000000${n + 1}`);
const result = { schemaVersion: 'recipe-v1', title: 'Rolls de jamón y queso R3', ingredients: names.map(name => ({ name })), steps: ['Coloca los ingredientes y enrolla.'], source: { type: 'manual' }, provenance: { sourceType: 'manual', quality: { status: 'review_required' } } };
function admin() { if (!local) throw new Error('Fixtures R3 solo localhost'); return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }
async function signIn(page: Page) {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const email = `r3-${Date.now()}-${crypto.randomUUID()}@example.test`; const created = await client.auth.signUp({ email, password }); if (created.error || !created.data.user) throw created.error ?? new Error('Signup failed');
  await page.goto('/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Contraseña').fill(password); await page.getByRole('button', { name: /Entrar/ }).click(); await expect(page).toHaveURL(/\/app(?:\?|$)/);
  return created.data.user.id;
}
function check(r: { error: unknown }) { if (r.error) throw r.error; }
async function fixture(userId: string) {
  const db = admin(); check(await db.from('food_concepts').upsert(names.map((display_name, n) => ({ id: conceptIds[n], slug: `r3-e2e-concept-${n}`, display_name }))));
  check(await db.from('inventory_items').insert(conceptIds.slice(0, 2).map((food_concept_id, n) => ({ user_id: userId, name: names[n], expiry_date: '2026-10-30', quantity: 1, unit: 'unit', added_at: new Date().toISOString(), food_concept_id, normalization_status: 'confirmed', normalization_source: 'user', knowledge_provenance: 'user', stock_mode: 'presence', stock_state: 'present', quantity_precision: 'unknown' }))));
  const jobId = crypto.randomUUID(); check(await db.from('recipe_import_jobs').insert({ id: jobId, user_id: userId, idempotency_key: `r3-e2e-${jobId}`, source_type: 'manual', manual_text: 'Receta local de prueba.', state: 'completed', result })); return jobId;
}
test.describe('R3 local', () => {
  test.skip(!local || !process.env.RUN_LOCAL_SUPABASE_E2E);
  test('import availability 2/4, review acknowledgement, atomic buy, save, snapshot and offline', async ({ page, context }) => {
    test.setTimeout(60000);
    test.skip(!enabled); const userId = await signIn(page); const jobId = await fixture(userId); const db = admin();
    await page.setViewportSize({ width: 393, height: 852 }); await page.goto(`/app/recipes/import/${jobId}`);
    await expect(page.getByText('Tienes 2 de 4')).toBeVisible(); await expect(page.getByText('Cantidad no indicada').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r3-result-393.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 720 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r3-result-320.png', fullPage: true }); await page.setViewportSize({ width: 393, height: 852 });
    const buy = page.getByRole('button', { name: 'Añadir 2 a la compra' }); await buy.click(); await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(buy).toBeFocused(); await buy.click();
    await expect(page.getByRole('button', { name: 'Confirmar y añadir' })).toBeDisabled(); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Confirmar y añadir' }).click();
    await expect(page.getByRole('heading', { name: 'Añadido a la compra' })).toBeVisible(); await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    const shopping = await db.from('shopping_list_items').select('id,quantity,source,source_ref').eq('user_id', userId); check(shopping); expect(shopping.data).toHaveLength(2); expect(shopping.data!.every(i => i.quantity === null && i.source === 'recipe_missing' && i.source_ref === `import:${jobId}`)).toBe(true);
    await page.getByRole('button', { name: 'Guardar en Cocinar' }).click(); await expect(page.getByText('Receta guardada en Cocinar.')).toBeVisible(); await page.getByRole('button', { name: 'Guardar en Cocinar' }).click();
    await expect.poll(async () => (await db.from('favorite_recipes').select('id').eq('user_id', userId)).data?.length).toBe(1);
    await buy.click(); await page.getByRole('checkbox').check();
    check(await db.from('inventory_items').update({ stock_state: 'absent' }).eq('user_id', userId).eq('food_concept_id', conceptIds[0]));
    await page.getByRole('button', { name: 'Confirmar y añadir' }).click(); await expect(page.getByText(/Tu despensa ha cambiado/)).toBeVisible(); await page.getByRole('button', { name: 'Actualizar comparación' }).click(); await expect(page.getByText('Tienes 1 de 4')).toBeVisible();
    check(await db.from('inventory_items').update({ stock_state: 'present' }).eq('user_id', userId).eq('food_concept_id', conceptIds[0])); await page.reload(); await expect(page.getByText('Tienes 2 de 4')).toBeVisible();
    await context.setOffline(true); await expect(page.getByText(/Resultado anterior · Sin conexión/)).toBeVisible(); await expect(buy).toBeDisabled(); await context.setOffline(false);
    await page.goto('/app/cook?view=imported'); await expect(page.getByRole('link', { name: /Rolls de jamón y queso R3/ })).toBeVisible();
    await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r3-imported-393.png', fullPage: true });
    await page.goto('/app/cook?view=saved'); await page.getByRole('link', { name: /Rolls de jamón y queso R3/ }).click(); await expect(page.getByText(/Tu versión guardada/)).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r3-saved-320.png', fullPage: true });
    await page.goto('/app/cook'); await expect(page.getByRole('heading', { name: 'Puedes hacerlo ahora' })).toBeVisible(); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r3-library-320.png', fullPage: true });
    const targets = await page.getByRole('navigation', { name: 'Biblioteca de recetas' }).getByRole('link').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height)); expect(targets.every(h => h >= 44)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' }); expect(await page.locator('main').first().evaluate(node => getComputedStyle(node).animationName)).toBe('none');
    await page.setViewportSize({ width: 393, height: 852 }); await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r3-library-393.png', fullPage: true });
  });
  test('recoverable failures, same job retry, no extra quota, and strict API', async ({ page }) => {
    test.skip(!enabled); const userId = await signIn(page); const db = admin(); const id = crypto.randomUUID();
    check(await db.from('recipe_import_jobs').insert({ id, user_id: userId, idempotency_key: `r3-failed-${id}`, source_type: 'manual', manual_text: 'Receta local fallida.', state: 'failed', retryable: false, error_code: 'WHISPER_REJECTED' }));
    await page.goto(`/app/recipes/import/${id}`); await expect(page.getByText(/No pudimos leer el audio/)).toBeVisible(); await page.getByRole('link', { name: 'Pegar la receta como texto' }).click(); await expect(page.getByRole('button', { name: 'Texto', exact: true })).toHaveAttribute('aria-pressed', 'true');
    check(await db.from('recipe_import_jobs').update({ retryable: true, error_code: 'WHISPER_TIMEOUT' }).eq('id', id)); await page.goto(`/app/recipes/import/${id}`); await page.getByRole('button', { name: 'Reintentar importación' }).click(); await expect(page.getByText('La receta aún no está lista')).toBeVisible();
    const job = await db.from('recipe_import_jobs').select('state,retry_generation').eq('id', id).single(); check(job); expect(job.data).toMatchObject({ state: 'queued', retry_generation: 1 });
    const usage = await db.from('recipe_import_usage').select('consumed').eq('user_id', userId); check(usage); expect(usage.data).toHaveLength(0);
    const invalid = await page.evaluate(async id => { const r = await fetch('/api/cook/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeRef: { kind: 'import', id }, recipeVersion: 'a'.repeat(64), clientMutationId: crypto.randomUUID(), userId: 'forged' }) }); return r.status; }, id); expect(invalid).toBe(400);
    const foreign = await page.evaluate(async () => { const r = await fetch('/api/cook/availability?kind=import&id=d3000000-0000-4000-a000-000000000001'); return r.status; }); expect(foreign).toBe(404);
  });
  test('URL, text and file use current intake; downstream completion is mocked in local DB', async ({ page }) => {
    test.skip(!enabled); const userId = await signIn(page); const db = admin();
    await page.goto('/app/recipes/import'); await page.getByLabel('Enlace', { exact: true }).fill('https://example.com/r3-recipe');
    const urlCreated = page.waitForResponse(r => r.url().endsWith('/api/recipe-jobs') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Importar receta', exact: true }).click(); const first = await (await urlCreated).json(); expect(first.jobId).toBeTruthy();
    await page.getByRole('button', { name: 'Texto', exact: true }).click(); await page.getByLabel('Receta', { exact: true }).fill('Ingredientes: queso y tortillas. Coloca el queso en las tortillas, enrolla y cocina.');
    const textCreated = page.waitForResponse(r => r.url().endsWith('/api/recipe-jobs') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Importar receta', exact: true }).click(); const second = await (await textCreated).json(); expect(second.jobId).toBeTruthy();
    await page.route('**/api/recipe-jobs/upload-url', route => route.fulfill({ json: { object: `recipe-imports/${userId}/${crypto.randomUUID()}/test.mp3`, uploadUrl: 'http://127.0.0.1:3103/r3-mock-upload' } }));
    await page.route('**/r3-mock-upload', route => route.fulfill({ status: 200, body: '' })); await page.getByRole('button', { name: 'Archivo', exact: true }).click(); await page.getByLabel('Audio o vídeo').setInputFiles({ name: 'test.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('local-upload-mock') });
    const fileCreated = page.waitForResponse(r => r.url().endsWith('/api/recipe-jobs') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Importar receta', exact: true }).click(); const third = await (await fileCreated).json(); expect(third.jobId).toBeTruthy();
    check(await db.from('recipe_import_jobs').update({ state: 'completed', result }).in('id', [first.jobId, second.jobId, third.jobId]));
    await page.goto(`/app/recipes/import/${second.jobId}`); await expect(page.getByText('Tienes 0 de 4')).toBeVisible(); await page.reload(); await expect(page.getByText('Tienes 0 de 4')).toBeVisible();
    const jobs = await db.from('recipe_import_jobs').select('source_type').in('id', [first.jobId, second.jobId, third.jobId]); check(jobs); expect(jobs.data!.map(j => j.source_type).sort()).toEqual(['blog', 'file', 'manual']);
  });
  test('flag false restores legacy collection and hides new API', async ({ page }) => {
    test.skip(enabled); await signIn(page); await page.goto('/app/cook'); await expect(page).toHaveURL(/\/app\/recipes$/);
    expect(await page.evaluate(async () => (await fetch('/api/cook/library')).status)).toBe(404);
  });
  test('another browser account cannot read an existing private import or cache', async ({ page, browser }) => {
    test.skip(!enabled); const owner = await signIn(page); const jobId = await fixture(owner);
    await page.goto(`/app/recipes/import/${jobId}`); await expect(page.getByText('Tienes 2 de 4')).toBeVisible();
    const other = await browser.newContext(); const otherPage = await other.newPage();
    try { await signIn(otherPage); const forbidden = await otherPage.request.get(`/api/cook/availability?kind=import&id=${jobId}`); const missing = await otherPage.request.get('/api/cook/availability?kind=import&id=d3000000-0000-4000-a000-000000000001'); expect(forbidden.status()).toBe(404); expect(await forbidden.json()).toEqual(await missing.json()); }
    finally { await other.close(); }
  });
});
