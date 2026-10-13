import { test, expect, type Page } from '@playwright/test';
import { createClient } from '../../apps/web/node_modules/@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const local = (() => { try { return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname); } catch { return false; } })();
const enabled = process.env.PRODUCT_V3 === 'true';
const EGGS = 'a6100000-0000-4000-a000-0000000000e1';
function admin() { if (!local) throw new Error('Only local fixtures'); return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }
function check(r: { error: unknown }) { if (r.error) throw r.error; }
async function signIn(page: Page) {
  const password = 'r6-local-password-2026'; const email = `r6-${crypto.randomUUID()}@example.test`;
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const r = await client.auth.signUp({ email, password }); if (r.error || !r.data.user) throw r.error ?? new Error('signup');
  await page.goto('/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /Entrar/ }).click(); await expect(page).toHaveURL(/\/app(?:\?|$)/);
  return r.data.user.id;
}
async function fixture(userId: string) {
  const db = admin();
  check(await db.from('food_concepts').upsert({ id: EGGS, slug: 'r6-e2e-huevos', display_name: 'Huevos R6 E2E' }));
  check(await db.from('inventory_items').insert({
    id: crypto.randomUUID(), user_id: userId, name: 'Huevos R6 E2E', quantity: 6, unit: 'unit', added_at: new Date().toISOString(), food_concept_id: EGGS,
    normalization_status: 'confirmed', normalization_source: 'user', knowledge_provenance: 'user', stock_mode: 'exact', quantity_precision: 'exact', quantity_exact: 6, quantity_unit: 'unit',
  }));
  const job = crypto.randomUUID();
  const result = { schemaVersion: 'recipe-v1', title: 'Tortilla R6 E2E', ingredients: [{ name: 'Huevos R6 E2E', amount: '4', unit: 'unit' }], steps: ['Bate y cocina.'], source: { type: 'manual' }, provenance: {} };
  check(await db.from('recipe_import_jobs').insert({ id: job, user_id: userId, idempotency_key: `r6-${job}`, source_type: 'manual', manual_text: 'fixture local', state: 'completed', result }));
  return { job };
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
const civil = (page: Page, offset = 0) => page.evaluate((o) => {
  const d = new Date(); const p = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => Number(p.find(x => x.type === t)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day') + o)).toISOString().slice(0, 10);
}, offset);

test.describe('R6 local', () => {
  test.skip(!local || !process.env.RUN_LOCAL_SUPABASE_E2E);

  test('schedule from a recipe, week view, aggregated faltantes and Compra with provenance', async ({ page }) => {
    test.setTimeout(120000); test.skip(!enabled);
    const user = await signIn(page); const { job } = await fixture(user); const db = admin();
    await page.goto(`/app/recipes/import/${job}`);
    await expect(page.getByRole('heading', { name: '¿Cuándo la cocinas?' })).toBeVisible();
    await page.getByRole('button', { name: 'Mañana' }).click();
    await expect(page.getByText(/Planeada para mañana/)).toBeVisible();
    const tomorrow = await civil(page, 1);
    await expect.poll(async () => (await db.from('meal_entries').select('meal_date,meal_type,plan_kind').eq('user_id', user).is('deleted_at', null)).data?.[0]?.meal_date).toBe(tomorrow);
    await page.getByRole('button', { name: 'Otro día' }).click();
    await page.getByLabel('Día').fill(await civil(page, 3)); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText(/Planeada para/).first()).toBeVisible();
    await expect.poll(async () => (await db.from('meal_entries').select('id').eq('user_id', user).is('deleted_at', null)).data?.length).toBe(2);
    await page.getByRole('link', { name: 'Ver tu semana' }).click();
    await expect(page).toHaveURL(/\/app\/cook\/week$/);
    await expect(page.getByRole('heading', { name: 'Tu semana' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tortilla R6 E2E' }).first()).toBeVisible();
    await expect(page.getByText('Sin decidir').first()).toBeVisible();
    // Two tortillas need 8 eggs against 6: the plan asks for the 2 missing, not 0.
    await expect(page.getByRole('heading', { name: 'Lo que te falta' })).toBeVisible();
    await expect(page.getByText(/Huevos R6 E2E · 2/)).toBeVisible();
    for (const [w, h] of [[393, 852], [320, 720]] as const) {
      await page.setViewportSize({ width: w, height: h }); await noOverflow(page);
      await page.screenshot({ path: `../../docs/design/neverita-v3/qa/r6-week-${w}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Añadir 1 a la compra' }).click();
    await expect(page.getByText(/Añadido a la compra: 1 ingrediente/)).toBeVisible();
    const item = await db.from('shopping_list_items').select('source,quantity,source_ref').eq('user_id', user).eq('source', 'plan_missing').single();
    check(item); expect(item.data?.quantity).toBe(2); expect(item.data?.source_ref).toMatch(/^plan:\d{4}-\d{2}-\d{2}$/);
    expect((await db.from('inventory_items').select('quantity_exact').eq('user_id', user).single()).data?.quantity_exact).toBe(6);
    await page.getByRole('link', { name: 'Ver compra' }).click();
    await expect(page).toHaveURL(/\/app\/shop$/);
    await expect(page.getByText('Huevos R6 E2E', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '¿Por qué?' }).first().click();
    await expect(page.getByText('Falta para tu plan: Tortilla R6 E2E')).toBeVisible();
  });

  test('Cenar fuera is exclusive, legacy stays readable and /app/calendar redirects', async ({ page }) => {
    test.setTimeout(120000); test.skip(!enabled);
    const user = await signIn(page); const { job } = await fixture(user); const db = admin();
    await page.goto(`/app/recipes/import/${job}`);
    await page.getByRole('button', { name: 'Mañana' }).click(); await expect(page.getByText(/Planeada para mañana/)).toBeVisible();
    const legacy = crypto.randomUUID();
    check(await db.from('meal_entries').insert({ id: legacy, user_id: user, meal_type: 'lunch', meal_date: await civil(page, 2), custom_name: 'Pasta antigua R6' }));
    await page.goto('/app/cook/week');
    await expect(page.getByText('Pasta antigua R6')).toBeVisible();
    await expect(page.getByText('Registrado antes')).toBeVisible();
    const tomorrowLabel = page.locator('section[aria-labelledby^="day-"]').filter({ has: page.getByRole('link', { name: 'Tortilla R6 E2E' }) });
    await tomorrowLabel.getByRole('button', { name: 'Cenar fuera' }).click();
    await expect.poll(async () => (await db.from('meal_entries').select('plan_kind').eq('user_id', user).eq('plan_kind', 'outside').is('deleted_at', null)).data?.length).toBe(1);
    await expect.poll(async () => (await db.from('meal_entries').select('id').eq('user_id', user).eq('plan_kind', 'meal').not('recipe_snapshot', 'is', null).is('deleted_at', null)).data?.length).toBe(0);
    await expect(page.getByText('Cenar fuera').first()).toBeVisible();
    await expect(page.getByText('Planifica una receta y te diremos qué te falta.')).toBeVisible();
    // Legacy deep links keep working; the root redirects.
    await page.goto('/app/calendar'); await expect(page).toHaveURL(/\/app\/cook\/week$/);
    expect((await page.request.get(`/app/calendar/${legacy}`)).status()).toBe(200);
  });

  test('offline planning shows pending intents and syncs on reconnect', async ({ page, context }) => {
    test.setTimeout(120000); test.skip(!enabled);
    const user = await signIn(page); await fixture(user); const db = admin();
    await page.goto('/app/cook/week'); await expect(page.getByRole('heading', { name: 'Tu semana' })).toBeVisible();
    await expect(page.getByText('Sin decidir').first()).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Cenar fuera' }).first().click();
    await expect(page.getByText('Pendiente', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' }).first()).toBeVisible();
    await expect(page.getByText('Necesitas conexión para calcular lo que falta.')).toBeVisible();
    expect((await db.from('meal_entries').select('id').eq('user_id', user)).data).toHaveLength(0);
    await page.setViewportSize({ width: 320, height: 720 }); await noOverflow(page);
    await page.screenshot({ path: '../../docs/design/neverita-v3/qa/r6-offline-320.png', fullPage: true });
    await context.setOffline(false);
    await expect.poll(async () => (await db.from('meal_entries').select('plan_kind').eq('user_id', user)).data?.[0]?.plan_kind).toBe('outside');
  });

  test('Hoy and Mañana follow the device civil date across the DST change and near midnight', async ({ browser }) => {
    test.setTimeout(120000); test.skip(!enabled);
    const context = await browser.newContext({ timezoneId: 'Europe/Madrid', baseURL: 'http://127.0.0.1:3106' });
    const page = await context.newPage();
    try {
      const user = await signIn(page); const { job } = await fixture(user); const db = admin();
      // 00:30 on 25 Oct 2026 in Madrid is still 24 Oct in UTC; the next day is 26 Oct after the clocks go back.
      await page.clock.setFixedTime(new Date('2026-10-24T22:30:00Z'));
      await page.goto(`/app/recipes/import/${job}`);
      await page.getByRole('button', { name: 'Hoy' }).click(); await expect(page.getByText(/Planeada para hoy/)).toBeVisible();
      await page.getByRole('button', { name: 'Deshacer' }).click();
      await page.getByRole('button', { name: 'Mañana' }).click(); await expect(page.getByText(/Planeada para mañana/)).toBeVisible();
      await expect.poll(async () => (await db.from('meal_entries').select('meal_date').eq('user_id', user).is('deleted_at', null).order('meal_date')).data?.map(r => r.meal_date)).toEqual(['2026-10-26']);
    } finally { await context.close(); }
  });

  test('another account has an empty plan and the API is private', async ({ page, browser }) => {
    test.setTimeout(120000); test.skip(!enabled);
    const user = await signIn(page); const { job } = await fixture(user);
    await page.goto(`/app/recipes/import/${job}`); await page.getByRole('button', { name: 'Mañana' }).click(); await expect(page.getByText(/Planeada para mañana/)).toBeVisible();
    const other = await browser.newContext(); const otherPage = await other.newPage();
    try {
      await signIn(otherPage);
      const from = await civil(otherPage, 0);
      const bad = await otherPage.request.get('/api/plan/v1/week?from=2026-10-20&today=2026-10-13&x=1'); expect(bad.status()).toBe(400);
      const shop = await otherPage.request.post('/api/plan/v1/shop', { data: { from, today: from, clientMutationId: crypto.randomUUID(), confirmedKey: 'x', userId: user } });
      expect(shop.status()).toBe(400);
      await otherPage.goto('/app/cook/week');
      await expect(otherPage.getByText('Aún no has planificado nada.')).toBeVisible();
    } finally { await other.close(); }
  });

  test('flag false keeps the legacy calendar and hides the plan API', async ({ page }) => {
    test.skip(enabled); await signIn(page);
    await page.goto('/app/cook/week'); await expect(page).toHaveURL(/\/app\/calendar$/);
    expect((await page.request.get('/api/plan/v1/week?from=2026-10-19&today=2026-10-20')).status()).toBe(404);
    expect((await page.request.post('/api/plan/v1/shop', { data: {} })).status()).toBe(404);
  });
});
