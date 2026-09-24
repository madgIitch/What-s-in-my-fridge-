import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../app/manifest";

const publicDir = resolve(process.cwd(), "public");
function pngDimensions(path: string) {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("PWA manifest", () => {
  it("serves complete install metadata and real PNG icons", () => {
    const value = manifest();
    expect(value).toMatchObject({ name: expect.any(String), short_name: expect.any(String), start_url: "/app", display: "standalone", theme_color: expect.any(String), background_color: expect.any(String) });
    const icons = value.icons ?? [];
    expect(icons).toHaveLength(4);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const size = Number(String(icon.sizes).split("x")[0]);
      expect(pngDimensions(resolve(publicDir, String(icon.src).replace(/^\//, "")))).toEqual({ width: size, height: size });
    }
    expect(icons.filter((icon) => icon.purpose === "maskable")).toHaveLength(2);
  });
});
