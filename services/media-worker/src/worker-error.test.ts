import test from "node:test";
import assert from "node:assert/strict";
import { classifyYtDlpFailure, isRetryable, safeCode, WorkerError } from "./worker-error.js";

test("classifies yt-dlp failures without retaining sensitive stderr", () => {
  const secret = "https://instagram.com/reel/secret?token=do-not-log";
  const cases = [
    ["HTTP Error 429: Too Many Requests", "YTDLP_RATE_LIMITED"],
    ["Login required. Use --cookies to authenticate", "YTDLP_AUTH_REQUIRED"],
    ["Unsupported URL", "YTDLP_UNSUPPORTED"],
    ["This content is not available", "YTDLP_UNAVAILABLE"],
    ["Connection reset by peer", "YTDLP_NETWORK_FAILED"],
    ["Unable to extract data; please report this issue", "YTDLP_EXTRACTOR_FAILED"],
    [`unknown failure for ${secret}`, "YTDLP_FAILED"],
  ] as const;

  for (const [stderr, expected] of cases) {
    const code = classifyYtDlpFailure(stderr);
    assert.equal(code, expected);
    assert.equal(code.includes(secret), false);
  }
});

test("only transient yt-dlp failures are retryable", () => {
  assert.equal(isRetryable("YTDLP_RATE_LIMITED"), true);
  assert.equal(isRetryable("YTDLP_NETWORK_FAILED"), true);
  assert.equal(isRetryable("YTDLP_TIMEOUT"), true);
  assert.equal(isRetryable("OLLAMA_TIMEOUT"), true);
  assert.equal(isRetryable("OLLAMA_UNAVAILABLE"), true);
  assert.equal(isRetryable("WHISPER_TIMEOUT"), true);
  assert.equal(isRetryable("YTDLP_AUTH_REQUIRED"), false);
  assert.equal(isRetryable("OLLAMA_REJECTED"), false);
  assert.equal(isRetryable("YTDLP_UNAVAILABLE"), false);
  assert.equal(isRetryable("YTDLP_EXTRACTOR_FAILED"), false);
});

test("safeCode exposes only stable codes", () => {
  assert.equal(safeCode(new WorkerError("YTDLP_AUTH_REQUIRED")), "YTDLP_AUTH_REQUIRED");
  assert.equal(safeCode(new Error("request failed for https://example.test/private")), "WORKER_FAILED");
});
