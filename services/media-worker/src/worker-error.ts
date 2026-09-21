const RETRYABLE_CODES = new Set([
  "DOWNLOAD_FAILED",
  "DATABASE_UNAVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "OLLAMA_TIMEOUT",
  "OLLAMA_UNAVAILABLE",
  "WHISPER_TIMEOUT",
  "WHISPER_UNAVAILABLE",
  "FFMPEG_TIMEOUT",
  "YTDLP_NETWORK_FAILED",
  "YTDLP_RATE_LIMITED",
  "YTDLP_TIMEOUT",
  "YTDLP_FAILED",
]);

export class WorkerError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "WorkerError";
  }
}

export function safeCode(error: unknown) {
  const code = error instanceof WorkerError
    ? error.code
    : error instanceof Error
      ? error.message
      : "WORKER_FAILED";
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : "WORKER_FAILED";
}

export function isRetryable(code: string) {
  return RETRYABLE_CODES.has(code);
}

export function classifyYtDlpFailure(stderr: string) {
  const normalized = stderr.toLowerCase();
  if (/too many requests|http error 429|rate.?limit/.test(normalized)) return "YTDLP_RATE_LIMITED";
  if (/login required|log in|cookies|authentication|not authorized|private (?:video|account)|requested content is not available/.test(normalized)) return "YTDLP_AUTH_REQUIRED";
  if (/unsupported url|no suitable extractor/.test(normalized)) return "YTDLP_UNSUPPORTED";
  if (/not available|has been removed|does not exist|unable to find the video|content isn't available/.test(normalized)) return "YTDLP_UNAVAILABLE";
  if (/timed? out|temporary failure|connection (?:reset|refused)|network is unreachable|name or service not known|remote end closed/.test(normalized)) return "YTDLP_NETWORK_FAILED";
  if (/extractor error|unable to extract|please report this issue|confirm you are on the latest version/.test(normalized)) return "YTDLP_EXTRACTOR_FAILED";
  return "YTDLP_FAILED";
}
