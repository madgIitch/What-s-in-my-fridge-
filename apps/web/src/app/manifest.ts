import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const value: MetadataRoute.Manifest = {
    name: "Neverita — What's in my fridge?",
    short_name: "Neverita",
    description: "Tu inventario y recetas, siempre a mano.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f0e6",
    theme_color: "#f4f0e6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/api/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "media", accept: ["video/*", "audio/*"] }] },
    },
  };
  if (process.env.SHARE_TARGET_ENABLED === "false") delete value.share_target;
  return value;
}
