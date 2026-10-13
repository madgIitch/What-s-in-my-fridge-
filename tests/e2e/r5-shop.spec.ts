import { test, expect, type Page } from '@playwright/test';
import { createClient } from '../../apps/web/node_modules/@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const local = (() => { try { return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname); } catch { return false; } })();
const enabled = process.env.PRODUCT_V3 === 'true';
const concepts = [
  { id: 'f2100000-0000-4000-a000-000000000001', name: 'Leche R5 E2E' },
  { id: 'f2100000-0000-4000-a000-000000000002', name: 'Tomate R5 E2E' },
  { id: 'f2100000-0000-4000-a000-000000000003', name: 'Huevos R5 E2E' },
];
function admin() { if (!local) throw new Error('Only local fixtures'); return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }
function check(r: { error: unknown }) { if (r.error) throw r.error; }
async function signIn(page: Page) {
  const password = 'r5-local-password-2026'; const email = `r5-${crypto.randomUUID()}@example.test`;
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const r = await client.auth.signUp({ email, password }); if (r.error || !r.data.user) throw r.error ?? new Error('signup');
  await page.goto('/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /Entrar/ }).click(); await expect(page).toHaveURL(/\/app(?:\?|$)/);
  return r.data.user.id;
}
async function fixture(userId: string) {
  const db = admin();
  check(await db.from('food_concepts').upsert(concepts.map((c, n) => ({ id: c.id, slug: `r5-e2e-${n}`, display_name: c.name }))));
  const tomato = crypto.randomUUID();
  check(await db.from('inventory_items').insert({
    id: tomato, user_id: userId, name: concepts[1].name, quantity: 1, unit: 'unit', added_at: new Date().toISOString(), food_concept_id: concepts[1].id,
    normalization_status: 'confirmed', normalization_source: 'user', knowledge_provenance: 'user', stock_mode: 'qualitative', stock_state: 'low', quantity_precision: 'unknown',
  }));
  const job = crypto.randomUUID();
  const result = { schemaVersion: 'recipe-v1', title: 'Leche caliente R5', ingredients: [{ name: concepts[0].name, amount: '1', unit: 'l' }], steps: ['Calienta la leche.'], source: { type: 'manual' }, provenance: { quality: { status: 'review_required' } } };
  check(await db.from('recipe_import_jobs').insert({ id: job, user_id: userId, idempotency_key: `r5-${job}`, source_type: 'manual', manual_text: 'fixture local', state: 'completed', result }));
  return { job, tomato };
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
async function shotAndOverflow(page: Page, name: string) {
  await page.setViewportSize({ width: 393, height: 852 }); await noOverflow(page);
  await page.screenshot({ path: `../../docs/design/neverita-v3/qa/${name}-393.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 }); await noOverflow(page);
  await page.screenshot({ path: `../../docs/design/neverita-v3/qa/${name}-320.png`, fullPage: true });
  await page.setViewportSize({ width: 393, height: 852 });
}

test.describe('R5 local', () => {
  test.skip(!local || !process.env.RUN_LOCAL_SUPABASE_E2E);

  test('recipe missing, low-stock suggestion, manual item and explanation never touch the pantry', async ({ page }) => {
    test.setTimeout(90000); test.skip(!enabled);
    const user = await signIn(page); const { job, tomato } = await fixture(user); const db = admin();
    const before = await db.from('inventory_items').select('id,version').eq('user_id', user); check(before);
    await page.goto(`/app/recipes/import/${job}`);
    await page.getByRole('button', { name: /Añadir \d+ a la compra/ }).click();
    const review = page.getByLabel(/He revisado los ingredientes/);
    if (await review.isVisible()) await review.check();
    await page.getByRole('button', { name: 'Confirmar y añadir' }).click();
    await page.getByRole('link', { name: 'Ver compra' }).click();
    await expect(page).toHaveURL(/\/app\/shop$/);
    await expect(page.getByRole('heading', { name: 'Para tus recetas' })).toBeVisible();
    await expect(page.getByText(concepts[0].name, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '¿Por qué?' }).first().click();
    await expect(page.getByText('Falta para Leche caliente R5')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leche caliente R5' })).toHaveAttribute('href', `/app/recipes/import/${job}`);
    // Suggestions are ideas: present, not selected, and not in the finish counter until accepted.
    await expect(page.getByRole('heading', { name: 'Sugerencias por poco stock' })).toBeVisible();
    await expect(page.getByText(concepts[1].name, { exact: true })).toBeVisible();
    const suggested = await db.from('shopping_list_items').select('selection,source').eq('user_id', user).eq('source', 'low_stock_suggestion').single();
    check(suggested); expect(suggested.data?.selection).toBe('suggested');
    await shotAndOverflow(page, 'r5-shop');
    await page.getByRole('button', { name: 'Añadir a mi compra' }).click();
    await expect.poll(async () => (await db.from('shopping_list_items').select('selection').eq('user_id', user).eq('source', 'low_stock_suggestion').single()).data?.selection).toBe('selected');
    await page.getByLabel('Qué quieres comprar').fill('Pan R5 E2E'); await page.getByRole('button', { name: 'Añadir', exact: true }).click();
    await expect(page.getByText('Pan R5 E2E', { exact: true })).toBeVisible();
    await page.getByLabel(/Pan R5 E2E: marcar como cogido/).check();
    await expect.poll(async () => (await db.from('shopping_list_items').select('checked').eq('user_id', user).eq('name', 'Pan R5 E2E').single()).data?.checked).toBe(true);
    const after = await db.from('inventory_items').select('id,version').eq('user_id', user); check(after);
    expect(after.data).toEqual(before.data);
    expect((await db.from('inventory_items').select('stock_state').eq('id', tomato).single()).data?.stock_state).toBe('low');
    const boxes = await page.getByRole('checkbox').first().boundingBox(); expect(boxes!.height).toBeGreaterThanOrEqual(24);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('main').first().evaluate(n => getComputedStyle(n).animationName)).toBe('none');
  });

  test('offline add keeps working with an honest pending state and syncs once', async ({ page, context }) => {
    test.setTimeout(90000); test.skip(!enabled);
    const user = await signIn(page); await fixture(user); const db = admin();
    await page.goto('/app/shop'); await expect(page.getByRole('heading', { name: 'Tu lista' })).toBeVisible();
    await context.setOffline(true);
    await page.getByLabel('Qué quieres comprar').fill('Sal R5 E2E'); await page.getByRole('button', { name: 'Añadir', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sin conexión, tu lista sigue funcionando.' })).toBeVisible();
    await expect(page.getByText('Sal R5 E2E', { exact: true })).toBeVisible();
    await expect(page.getByText('Pendiente', { exact: true }).first()).toBeVisible();
    expect((await db.from('shopping_list_items').select('id').eq('user_id', user).eq('name', 'Sal R5 E2E')).data).toHaveLength(0);
    await shotAndOverflow(page, 'r5-offline');
    await context.setOffline(false);
    await expect.poll(async () => (await db.from('shopping_list_items').select('id').eq('user_id', user).eq('name', 'Sal R5 E2E')).data?.length).toBe(1);
    await expect(page.getByText('Pendiente', { exact: true })).toHaveCount(0);
  });

  test('finish opens the ticket flow with a session and a later ticket reconciles safely, then undoes', async ({ page }) => {
    test.setTimeout(90000); test.skip(!enabled);
    const user = await signIn(page); await fixture(user); const db = admin();
    check(await db.from('shopping_list_items').insert([
      { user_id: user, name: concepts[2].name, quantity: 6, unit: 'unidades', source: 'manual' },
      { user_id: user, name: 'Algo sin concepto R5', source: 'manual' },
    ]));
    await page.goto('/app/shop'); await expect(page.getByText(concepts[2].name, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'He terminado, añadir ticket' }).click();
    await expect(page).toHaveURL(/\/app\/scan\?shoppingSession=[0-9a-f-]{36}/, { timeout: 45000 });
    expect((await db.from('inventory_items').select('id').eq('user_id', user).eq('name', concepts[2].name)).data).toHaveLength(0);
    const lot = crypto.randomUUID();
    check(await db.from('inventory_items').insert({
      id: lot, user_id: user, name: concepts[2].name, quantity: 12, unit: 'unit', added_at: new Date().toISOString(), food_concept_id: concepts[2].id,
      normalization_status: 'confirmed', normalization_source: 'user', knowledge_provenance: 'user', stock_mode: 'exact', quantity_precision: 'exact', quantity_exact: 12, quantity_unit: 'unit',
    }));
    check(await db.from('receipt_drafts').insert({ user_id: user, raw_text: 'ticket', captured_at: new Date().toISOString(), status: 'confirmed', confirmed: true, confirmed_at: new Date().toISOString(), confirmed_item_ids: [lot] }));
    await page.goto('/app/shop');
    await expect(page.getByText('Ya tienes tu ticket')).toBeVisible();
    await page.getByRole('button', { name: 'Revisar compra' }).click();
    await expect(page.getByText('Compra revisada', { exact: true })).toBeVisible();
    const bought = async () => (await db.from('shopping_list_items').select('purchased_at').eq('user_id', user).eq('name', concepts[2].name).single()).data?.purchased_at;
    expect(await bought()).not.toBeNull();
    expect((await db.from('shopping_list_items').select('purchased_at').eq('user_id', user).eq('name', 'Algo sin concepto R5').single()).data?.purchased_at).toBeNull();
    await expect(page.getByRole('button', { name: 'Ya lo compré' })).toBeVisible();
    expect((await db.from('inventory_items').select('quantity_exact').eq('id', lot).single()).data?.quantity_exact).toBe(12);
    await shotAndOverflow(page, 'r5-review');
    await page.getByRole('button', { name: 'Deshacer', exact: true }).first().click();
    await expect.poll(bought).toBeNull();
  });

  test('a change from another device asks for review instead of overwriting', async ({ page }) => {
    test.setTimeout(90000); test.skip(!enabled);
    const user = await signIn(page); await fixture(user); const db = admin();
    const item = await db.from('shopping_list_items').insert({ user_id: user, name: 'Queso R5 E2E', source: 'manual' }).select('id,version').single(); check(item);
    await page.goto('/app/shop'); await expect(page.getByText('Queso R5 E2E', { exact: true })).toBeVisible();
    check(await db.from('shopping_list_items').update({ checked: true, version: item.data!.version + 1 }).eq('id', item.data!.id));
    await page.getByRole('button', { name: '¿Por qué?' }).first().click();
    await page.getByRole('button', { name: 'Quitar de la lista' }).click();
    await expect(page.getByText('Tu lista cambió en otro dispositivo')).toBeVisible();
    expect((await db.from('shopping_list_items').select('deleted_at').eq('id', item.data!.id).single()).data?.deleted_at).toBeNull();
    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByText('Tu lista cambió en otro dispositivo')).toHaveCount(0);
  });

  test('another account sees nothing and logout purges the private list cache', async ({ page, browser }) => {
    test.setTimeout(90000); test.skip(!enabled);
    const user = await signIn(page); await fixture(user); const db = admin();
    check(await db.from('shopping_list_items').insert({ user_id: user, name: 'Privado R5 E2E', source: 'manual' }));
    await page.goto('/app/shop'); await expect(page.getByText('Privado R5 E2E', { exact: true })).toBeVisible();
    const other = await browser.newContext(); const otherPage = await other.newPage();
    try {
      await signIn(otherPage);
      const r = await otherPage.request.get('/api/shop/v1/list'); expect(r.status()).toBe(200);
      expect(JSON.stringify(await r.json())).not.toContain('Privado R5 E2E');
      expect(r.headers()['cache-control']).toContain('no-store');
      const bad = await otherPage.request.post('/api/shop/v1/mutations', { data: { clientMutationId: crypto.randomUUID(), op: 'check', itemId: crypto.randomUUID(), userId: user } });
      expect(bad.status()).toBe(400);
    } finally { await other.close(); }
    await page.goto('/app/settings'); await page.getByRole('button', { name: /Cerrar sesión/ }).click(); await expect(page).toHaveURL(/login/);
    const left = await page.evaluate(async () => new Promise<number>((resolve, reject) => {
      const r = indexedDB.open('neverita-shop-v1', 1);
      r.onsuccess = () => { if (!r.result.objectStoreNames.contains('cache')) { r.result.close(); indexedDB.deleteDatabase('neverita-shop-v1'); resolve(0); return; } const tx = r.result.transaction('cache'); const c = tx.objectStore('cache').count(); c.onsuccess = () => resolve(c.result); c.onerror = () => reject(c.error); };
      r.onerror = () => reject(r.error);
    }));
    expect(left).toBe(0);
  });

  test('flag false keeps the legacy list and hides v1 APIs', async ({ page }) => {
    test.skip(enabled); await signIn(page);
    await page.goto('/app/shop'); await expect(page).toHaveURL(/\/app\/shopping-list$/);
    const response = await page.request.get('/api/shop/v1/list'); expect(response.status()).toBe(404);
  });
});
