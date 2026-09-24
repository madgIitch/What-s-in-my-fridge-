import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { privateDatabaseNames } from "./private-data";

const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
describe("service worker privacy boundary", () => {
  it("uses a versioned public-shell cache and excludes sensitive requests", () => {
    expect(source).toContain('CACHE_PREFIX = "neverita-shell-"');
    expect(source).toContain('request.headers.has("authorization")');
    expect(source).toContain('response.headers.has("set-cookie")');
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('request.destination === "document"');
    expect(source).toContain("caches.delete(key)");
  });
  it("only precaches public assets", () => {
    const precache = source.slice(source.indexOf("const PUBLIC_SHELL"), source.indexOf("];", source.indexOf("const PUBLIC_SHELL")));
    expect(precache).not.toContain('"/app"');
    expect(precache).not.toContain('"/api/');
  });
  it("knows every private feature database cleared on account change", () => {
    expect(privateDatabaseNames).toEqual(expect.arrayContaining(["neverita-inventory-v1", "neverita-features-v1", "neverita-meal-calendar", "neverita-pwa-v1"]));
  });
});
