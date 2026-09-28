import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { Job, RecipeExtractionProvider, TranscriptionProvider } from "./contracts.js";
import { sufficientText, validateRecipe } from "./contracts.js";
import { safeFetch } from "./ssrf.js";
import type { JobRepository } from "./repository.js";
import { classifyYtDlpFailure, WorkerError } from "./worker-error.js";
import { assessCandidate, hasRecipeCoverage, subtitleText, validCandidate, type Evidence } from "./quality.js";
import { jobSignal, withJobDeadline } from "./deadline.js";

const metrics = { whisperInvocations: 0, whisperSkipped: 0 };
export function pipelineMetrics() { return { ...metrics }; }

export async function processJob(job: Job, workerId: string, repo: JobRepository, transcriber: TranscriptionProvider, extractor: RecipeExtractionProvider) {
  return withJobDeadline(() => processJobWithinDeadline(job, workerId, repo, transcriber, extractor));
}
async function processJobWithinDeadline(job: Job, workerId: string, repo: JobRepository, transcriber: TranscriptionProvider, extractor: RecipeExtractionProvider) {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  let dir: string | undefined;
  const path: string[] = [];
  const qualityEnabled = process.env.RECIPE_IMPORT_QUALITY_ENABLED === "true";
  if (job.provenance.qualityReprocess && !qualityEnabled) throw new WorkerError("QUALITY_DISABLED");
  const evidence: Evidence[] = [];
  let asrModel = "not-used";
  try {
    let text = job.manualText?.trim() ?? "";
    if (text) path.push("manual");
    else if (job.sourceUrl && isSocial(job.sourceType)) {
      text = await socialMetadata(job.sourceUrl, qualityEnabled ? evidence : undefined);
      if (text) path.push("social-metadata");
    } else if (job.sourceUrl) {
      const response = await safeFetch(job.sourceUrl);
      if (!response.ok) throw new Error("DOWNLOAD_FAILED");
      if (!(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("SOURCE_UNSUPPORTED");
      let html: string;
      try { html = (await response.text()).slice(0, 2_000_000); }
      catch { throw new Error("DOWNLOAD_FAILED"); }
      text = extractText(html);
      path.push(html.includes("application/ld+json") ? "jsonld" : "html");
    }

    if (qualityEnabled && text && !evidence.length) evidence.push({ id: "source-0", kind: job.manualText ? "manual" : isSocial(job.sourceType) ? "caption" : "html", text });
    if (!(qualityEnabled ? hasRecipeCoverage(text) : sufficientText(text))) {
      if (process.env.RECIPE_IMPORT_WHISPER_ENABLED === "false") throw new Error("TEXT_INSUFFICIENT");
      metrics.whisperInvocations++;
      await repo.stage(job.id, workerId, "transcribing");
      dir ??= await mkdtemp(join(tmpdir(), "neverita-"));
      const input = join(dir, "media");
      const audio = join(dir, "audio.mp3");
      if (job.uploadObject) await downloadUpload(job.uploadObject, input);
      else if (job.sourceUrl && isSocial(job.sourceType)) await downloadSocial(job.sourceUrl, input);
      else throw new Error("TEXT_INSUFFICIENT");
      const duration = Number((await command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input], 30_000, true)).trim());
      if (!Number.isFinite(duration) || duration <= 0) throw new WorkerError("WHISPER_AUDIO_INVALID");
      if (duration > 600) throw new WorkerError("MEDIA_TOO_LONG");
      await ffmpeg(input, audio);
      const asrStartedAt = Date.now();
      const transcription = await transcriber.transcribe(audio);
      timings.asrMs = Date.now() - asrStartedAt;
      if (qualityEnabled) {
        asrModel = transcription.model ?? "unreported";
        if (transcription.segments?.length) transcription.segments.forEach((segment, index) => evidence.push({ id: `asr-${index}`, kind: "asr", text: segment.text, start: segment.start, end: segment.end }));
        else evidence.push({ id: "asr-0", kind: "asr", text: transcription.text });
        text = evidence.map(item => item.text).join("\n\n");
      } else text = transcription.text;
      path.push("whisper");
      if (!(qualityEnabled ? hasRecipeCoverage(text) : sufficientText(text))) throw new Error("TEXT_INSUFFICIENT");
    } else metrics.whisperSkipped++;

    if (process.env.RECIPE_IMPORT_EXTRACTION_ENABLED === "false") throw new Error("EXTRACTION_DISABLED");
    await repo.stage(job.id, workerId, "extracting");
    if (qualityEnabled) {
      const context = { sourceType: job.sourceType, sourceUrl: job.sourceUrl, evidence };
      const extractionStartedAt = Date.now();
      let candidate = await extractor.extract(text, context);
      await repo.stage(job.id, workerId, "validating");
      if (!validCandidate(candidate)) candidate = await extractor.extract(text, { ...context, repair: true });
      if (!validCandidate(candidate)) throw new WorkerError("RECIPE_SCHEMA_INVALID");
      timings.extractionMs = Date.now() - extractionStartedAt;
      const checked = assessCandidate(candidate, evidence);
      if (!checked.ingredients.length || !checked.steps.length) throw new WorkerError("RECIPE_QUALITY_INSUFFICIENT");
      const provenance = { ...job.provenance, extractionPath: path, transcriptRetained: false, quality: { ...checked.quality, asrModel, extractionModel: process.env.OLLAMA_RECIPE_MODEL ?? "qwen2.5:3b", timings: { ...timings, totalMs: Date.now() - startedAt } } };
      await repo.complete(job.id, workerId, { schemaVersion: "recipe-v1", title: candidate.title.trim(), ingredients: checked.ingredients, steps: checked.steps, source: { type: job.sourceType, ...(job.sourceUrl ? { url: job.sourceUrl } : {}) }, provenance }, provenance);
      return;
    }
    let candidate = await extractor.extract(text, { sourceType: job.sourceType, sourceUrl: job.sourceUrl });
    await repo.stage(job.id, workerId, "validating");
    if (!validateRecipe(candidate)) candidate = await extractor.extract(text, { sourceType: job.sourceType, sourceUrl: job.sourceUrl, repair: true });
    if (!validateRecipe(candidate)) throw new Error("RECIPE_SCHEMA_INVALID");
    candidate.source = { type: job.sourceType, ...(job.sourceUrl ? { url: job.sourceUrl } : {}) };
    candidate.provenance = { ...job.provenance, extractionPath: path, transcriptRetained: false };
    await repo.complete(job.id, workerId, candidate, candidate.provenance);
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
    if (job.uploadObject) await cleanupUpload(job.uploadObject);
  }
}

function isSocial(source: Job["sourceType"]) { return source === "youtube" || source === "instagram" || source === "tiktok"; }
function extractText(html: string) {
  const ld = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join("\n");
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  return `${ld}\n${body}`.replace(/\s+/g, " ").trim().slice(0, 100_000);
}
async function socialMetadata(url: string, evidence?: Evidence[]) {
  const output = await command("yt-dlp", ["--dump-single-json", "--skip-download", "--no-playlist", "--socket-timeout", "20", url], 60_000, true);
  let info: { title?: string; description?: string; subtitles?: Record<string, Array<{ ext?: string; url?: string }>>; automatic_captions?: Record<string, Array<{ ext?: string; url?: string }>> };
  try { info = JSON.parse(output); } catch { return ""; }
  const caption = `${typeof info.title === "string" ? info.title : ""}\n${typeof info.description === "string" ? info.description : ""}`.trim().slice(0, 100_000);
  if (!evidence) return caption;
  if (caption) evidence.push({ id: "caption-0", kind: "caption", text: caption });
  if (!hasRecipeCoverage(caption)) {
    const tracks = { ...info.automatic_captions, ...info.subtitles };
    const languages = Object.keys(tracks).sort((a, b) => Number(b.startsWith("es")) - Number(a.startsWith("es")));
    const track = languages.flatMap(language => tracks[language] ?? []).find(item => item.ext === "vtt" && typeof item.url === "string");
    if (track?.url) {
      try {
        const response = await safeFetch(track.url);
        if (response.ok) {
          const content = subtitleText((await response.text()).slice(0, 1_000_000));
          if (content) evidence.push({ id: "subtitle-0", kind: "subtitle", text: content });
        }
      } catch { /* Unavailable or unsafe subtitles fall back to the existing audio path. */ }
    }
  }
  return evidence.map(item => item.text).join("\n\n");
}
async function downloadSocial(url: string, output: string) { await command("yt-dlp", ["--no-playlist", "--max-filesize", "100M", "--socket-timeout", "20", "-f", "bestaudio/best", "-o", output, url], 180_000); }
async function downloadUpload(object: string, output: string) {
  const bucket = required("GCS_TEMP_BUCKET"); validateObject(object);
  const response = await fetch(storageObjectUrl(bucket, object, true), { headers: { Authorization: `Bearer ${await googleAccessToken()}` }, signal: jobSignal(60_000) });
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  await writeResponse(output, response);
}
async function cleanupUpload(object: string) {
  try {
    const bucket = required("GCS_TEMP_BUCKET"); validateObject(object);
    const response = await fetch(storageObjectUrl(bucket, object), { method: "DELETE", headers: { Authorization: `Bearer ${await googleAccessToken()}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok && response.status !== 404) throw new Error("CLEANUP_FAILED");
  } catch { console.warn(JSON.stringify({ event: "temp_cleanup_deferred" })); }
}
function validateObject(object: string) { if (!/^recipe-imports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z0-9._-]{1,100}$/i.test(object)) throw new Error("UPLOAD_INVALID"); }
function storageObjectUrl(bucket: string, object: string, media = false) { return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}${media ? "?alt=media" : ""}`; }
async function googleAccessToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: jobSignal(5_000) });
  if (!response.ok) throw new Error("GCS_AUTH_FAILED");
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error("GCS_AUTH_FAILED");
  return result.access_token;
}
async function writeResponse(path: string, response: Response) { const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.length > 100 * 1024 * 1024) throw new Error("MEDIA_TOO_LARGE"); await writeFile(path, bytes); }
async function ffmpeg(input: string, output: string) { await command("ffmpeg", ["-nostdin", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "mp3", output], 120_000); }
async function command(program: string, args: string[], timeout: number, capture = false) {
  return new Promise<string>((resolve, reject) => {
    const signal = jobSignal(timeout);
    const child = spawn(program, args, { stdio: ["ignore", capture ? "pipe" : "ignore", "pipe"] }); let stdout = ""; let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); if (stdout.length > 2_000_000) child.kill("SIGKILL"); });
    child.stderr?.on("data", (chunk) => { if (stderr.length < 64_000) stderr += String(chunk).slice(0, 64_000 - stderr.length); });
    const prefix = program.toUpperCase().replace("-", "_");
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new WorkerError(`${prefix}_TIMEOUT`)); }, timeout);
    const abort = () => { clearTimeout(timer); child.kill("SIGKILL"); reject(new WorkerError("JOB_DEADLINE_EXCEEDED")); };
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new WorkerError(`${prefix}_FAILED`));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (code === 0) resolve(stdout);
      else reject(new WorkerError(program === "yt-dlp" ? classifyYtDlpFailure(stderr) : `${prefix}_FAILED`));
    });
  });
}
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
