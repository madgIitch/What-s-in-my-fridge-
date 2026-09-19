import test from "node:test";
import assert from "node:assert/strict";
import { buildImportPlan, summarizePlan } from "./plan.mjs";

const fixture = [
  { localId: "firebase-a", email: "ONE@EXAMPLE.TEST", emailVerified: true, passwordHash: "redacted" },
  { localId: "firebase-b", email: "two@example.test", disabled: true, providerUserInfo: [{ providerId: "google.com" }] },
];

test("rerun recognizes the same Firebase UID", () => {
  const plan = buildImportPlan(fixture, new Set(["firebase-a"]));
  assert.equal(plan[0].action, "already_imported");
  assert.equal(plan[1].action, "import");
});

test("summary contains counts but no credential material", () => {
  const summary = summarizePlan(buildImportPlan(fixture));
  assert.deepEqual(summary, {
    total: 2, enabled: 1, disabled: 1, emailVerified: 1, resetRequired: 1,
    alreadyImported: 0, providers: { password: 1, "google.com": 1 },
  });
  assert.equal(JSON.stringify(summary).includes("redacted"), false);
});

test("duplicate source UIDs fail closed", () => {
  assert.throws(() => buildImportPlan([fixture[0], fixture[0]]), /duplicate_firebase_uid/);
});
