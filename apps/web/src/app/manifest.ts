import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neverita — What's in my fridge?",
    short_name: "Neverita",
    description: "Tu inventario y recetas, siempre a mano.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e6",
    theme_color: "#f4f0e6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
