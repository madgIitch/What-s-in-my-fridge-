export type UrlSourceType = "youtube" | "instagram" | "tiktok" | "blog";

export function detectUrlType(url: string): UrlSourceType {
  const normalized = url.toLowerCase();

  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
    return "youtube";
  }

  if (normalized.includes("instagram.com")) {
    return "instagram";
  }

  if (normalized.includes("tiktok.com")) {
    return "tiktok";
  }

  return "blog";
}
