import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSevereViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const severe = result.violations.filter(violation => violation.impact === "critical" || violation.impact === "serious");
  expect(severe.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => node.target) }))).toEqual([]);
}

test("login has no severe accessibility violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Qué bien verte." })).toBeVisible();
  await expectNoSevereViolations(page);
});

test("critical private screens have no severe accessibility violations", async ({ page }) => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires local Supabase auth");
  const email = `axe-${Date.now()}@example.test`;
  const password = "axe-local-test-password";
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Crear cuenta/ }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/app/);

  for (const path of ["/app", "/app/items/new", "/app/scan", "/app/recipes", "/app/recipes/import", "/app/favorites", "/app/shopping-list", "/app/calendar", "/app/calendar/new", "/app/pro", "/app/settings"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    await expectNoSevereViolations(page);
    const smallButtons = await page.locator("main button:visible, nav[aria-label='Acciones del inventario'] a:visible, .app-back-row a:visible").evaluateAll(elements => elements.map(element => ({ label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })).filter(target => target.width < 44 || target.height < 44));
    expect(smallButtons, `${path} touch targets`).toEqual([]);
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});
