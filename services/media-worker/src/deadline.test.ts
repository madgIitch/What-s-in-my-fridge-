import test from "node:test";
import assert from "node:assert/strict";
import { withJobDeadline, jobSignal } from "./deadline.js";
test("job deadline cancels external work before stage timeouts", async () => {
  await withJobDeadline(async () => {
    const signal = jobSignal(10_000);
    await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    assert.equal(signal.aborted, true);
    assert.throws(() => jobSignal(1000), /JOB_DEADLINE_EXCEEDED/);
  }, 10);
});
test("job deadline is isolated between concurrent jobs", async () => {
  await Promise.all([withJobDeadline(async () => { assert.equal(jobSignal(1000).aborted, false); }), withJobDeadline(async () => { assert.equal(jobSignal(1000).aborted, false); })]);
});
