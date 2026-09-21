import test from "node:test";
import assert from "node:assert/strict";
import { verifyTaskOidc } from "./auth.js";

const token = "header.payload.signature";
const audience = "https://worker.example";
const serviceAccount = "neverita-tasks@example.iam.gserviceaccount.com";

test("rejects a token that Google does not validate", async () => {
  const fetcher = async () => new Response("{}", { status: 400 });
  assert.equal(await verifyTaskOidc(`Bearer ${token}`, audience, serviceAccount, fetcher as typeof fetch), false);
});

test("accepts only matching verified Cloud Tasks claims", async () => {
  const fetcher = async () => Response.json({
    aud: audience,
    email: serviceAccount,
    email_verified: "true",
    exp: String(Math.floor(Date.now() / 1000) + 300),
    iss: "https://accounts.google.com",
  });
  assert.equal(await verifyTaskOidc(`Bearer ${token}`, audience, serviceAccount, fetcher as typeof fetch), true);
  assert.equal(await verifyTaskOidc(`Bearer ${token}`, `${audience}/wrong`, serviceAccount, fetcher as typeof fetch), false);
});
