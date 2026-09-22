import { expect, test } from "@playwright/test";

test.describe("Stripe Pro paywall", () => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires local Supabase authentication");

  test.beforeEach(async ({ page }) => {
    const email = `stripe-pro-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("stripe-pro-test-password");
    await page.getByRole("button", { name: /Crear cuenta/ }).click();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("stripe-pro-test-password");
    await page.getByRole("button", { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/\/app/);
    await page.setViewportSize({ width: 320, height: 700 });
  });

  test("renders Free, trialing, active, past_due and canceled from canonical fetches", async ({ page }) => {
    let status: "none" | "trialing" | "active" | "past_due" | "canceled" = "none";
    await page.route("**/api/stripe/entitlement", async (route) => {
      const plan = status === "active" || status === "trialing" ? "pro" : "free";
      await route.fulfill({ json: { ok: true, data: { plan, status, source: "stripe", currentPeriodEnd: null, cancelAtPeriodEnd: false }, error: null } });
    });
    for (const [next, heading] of [["none", "Neverita Free"], ["trialing", "Pro está activo"], ["active", "Pro está activo"], ["past_due", "Pago pendiente"], ["canceled", "Tu plan está cancelado"]] as const) {
      status = next;
      await page.goto("/app/pro");
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
  });

  test("success and cancel notices refetch, never grant Pro optimistically", async ({ page }) => {
    let fetches = 0;
    await page.route("**/api/stripe/entitlement", async (route) => {
      fetches++;
      await route.fulfill({ json: { ok: true, data: { plan: "free", status: "none", source: "default", currentPeriodEnd: null, cancelAtPeriodEnd: false }, error: null } });
    });
    await page.goto("/app/pro?checkout=success");
    await expect(page.getByText(/Pago completado/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Neverita Free" })).toBeVisible();
    await page.goto("/app/pro?checkout=cancel");
    await expect(page.getByText(/No se realizó ningún cambio/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Neverita Free" })).toBeVisible();
    expect(fetches).toBeGreaterThanOrEqual(2);
  });

  test("a transient error offers retry without claiming a plan", async ({ page }) => {
    let recover = false;
    await page.route("**/api/stripe/entitlement", async (route) => {
      if (!recover) await route.fulfill({ status: 503, json: { ok: false, data: null, error: { code: "BILLING_UNAVAILABLE", message: "Unavailable", retryable: true } } });
      else await route.fulfill({ json: { ok: true, data: { plan: "free", status: "none", source: "default", currentPeriodEnd: null, cancelAtPeriodEnd: false }, error: null } });
    });
    await page.goto("/app/pro");
    await expect(page.getByText("Código: BILLING_UNAVAILABLE")).toBeVisible();
    recover = true;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "Neverita Free" })).toBeVisible();
  });

  test("shows loading until canonical entitlement arrives", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/stripe/entitlement", async (route) => {
      await gate;
      await route.fulfill({ json: { ok: true, data: { plan: "free", status: "none", source: "default", currentPeriodEnd: null, cancelAtPeriodEnd: false }, error: null } });
    });
    await page.goto("/app/pro");
    await expect(page.getByRole("heading", { name: /Consultando tu plan/ })).toBeVisible();
    release();
    await expect(page.getByRole("heading", { name: "Neverita Free" })).toBeVisible();
  });

  test("redirects on expired session without exposing plan data", async ({ page }) => {
    await page.route("**/api/stripe/entitlement", async (route) => {
      await route.fulfill({ status: 401, json: { ok: false, data: null, error: { code: "UNAUTHENTICATED", message: "Expired", retryable: false } } });
    });
    await page.goto("/app/pro");
    await expect(page).toHaveURL(/\/login\?error=session_expired&returnTo=%2Fapp%2Fpro/);
  });
});
