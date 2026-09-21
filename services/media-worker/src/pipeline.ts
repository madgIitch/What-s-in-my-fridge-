import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { Job, RecipeExtractionProvider, TranscriptionProvider } from "./contracts.js";
import { sufficientText, validateRecipe } from "./contracts.js";
import { safeFetch } from "./ssrf.js";
import type { JobRepository } from "./repository.js";

const metrics = { whisperInvocations: 0, whisperSkipped: 0 };
export function pipelineMetrics() { return { ...metrics }; }

export async function processJob(job: Job, workerId: string, repo: JobRepository, transcriber: TranscriptionProvider, extractor: RecipeExtractionProvider) {
  let dir: string | undefined;
  const path: string[] = [];
  try {
    let text = job.manualText?.trim() ?? "";
    if (text) path.push("manual");
    else if (job.sourceUrl && isSocial(job.sourceType)) {
      text = await socialMetadata(job.sourceUrl);
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

    if (!sufficientText(text)) {
      if (process.env.RECIPE_IMPORT_WHISPER_ENABLED === "false") throw new Error("TEXT_INSUFFICIENT");
      metrics.whisperInvocations++;
      await repo.stage(job.id, workerId, "transcribing");
      dir ??= await mkdtemp(join(tmpdir(), "neverita-"));
      const input = join(dir, "media");
      const audio = join(dir, "audio.wav");
      if (job.uploadObject) await downloadUpload(job.uploadObject, input);
      else if (job.sourceUrl && isSocial(job.sourceType)) await downloadSocial(job.sourceUrl, input);
      else throw new Error("TEXT_INSUFFICIENT");
      await ffmpeg(input, audio);
      text = (await transcriber.transcribe(audio)).text;
      path.push("whisper");
      if (!sufficientText(text)) throw new Error("TEXT_INSUFFICIENT");
    } else metrics.whisperSkipped++;

    if (process.env.RECIPE_IMPORT_EXTRACTION_ENABLED === "false") throw new Error("EXTRACTION_DISABLED");
    await repo.stage(job.id, workerId, "extracting");
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
async function socialMetadata(url: string) {
  const output = await command("yt-dlp", ["--dump-single-json", "--skip-download", "--no-playlist", "--socket-timeout", "20", url], 60_000, true);
  try { const info = JSON.parse(output) as { title?: string; description?: string }; return `${info.title ?? ""}\n${info.description ?? ""}`.trim().slice(0, 100_000); }
  catch { return ""; }
}
async function downloadSocial(url: string, output: string) { await command("yt-dlp", ["--no-playlist", "--max-filesize", "100M", "--socket-timeout", "20", "-f", "bestaudio/best", "-o", output, url], 180_000); }
async function downloadUpload(object: string, output: string) {
  const bucket = required("GCS_TEMP_BUCKET"); validateObject(object);
  const response = await fetch(storageObjectUrl(bucket, object, true), { headers: { Authorization: `Bearer ${await googleAccessToken()}` }, signal: AbortSignal.timeout(60_000) });
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
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("GCS_AUTH_FAILED");
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error("GCS_AUTH_FAILED");
  return result.access_token;
}
async function writeResponse(path: string, response: Response) { const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.length > 100 * 1024 * 1024) throw new Error("MEDIA_TOO_LARGE"); await writeFile(path, bytes); }
async function ffmpeg(input: string, output: string) { await command("ffmpeg", ["-nostdin", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", output], 120_000); }
async function command(program: string, args: string[], timeout: number, capture = false) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(program, args, { stdio: capture ? ["ignore", "pipe", "ignore"] : "ignore" }); let stdout = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); if (stdout.length > 2_000_000) child.kill("SIGKILL"); });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${program.toUpperCase().replace("-", "_")}_TIMEOUT`)); }, timeout);
    child.once("error", reject); child.once("exit", (code) => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(`${program.toUpperCase().replace("-", "_")}_FAILED`)); });
  });
}
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
