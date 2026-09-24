import { expect, test } from "@playwright/test";

test("push APIs reject cross-origin mutation before authentication", async ({ request }) => {
  const response = await request.post("/api/push/subscriptions", { headers: { Origin: "https://evil.example" }, data: { userId: "attacker" } });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("ORIGIN_REJECTED");
});
