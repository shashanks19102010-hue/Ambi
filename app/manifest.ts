import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ambi — Calm AI Workspace",
    short_name: "Ambi",
    description: "A calm, capable AI workspace powered by Groq Cloud AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#f4f1ea",
    icons: [
      { src: "/ambi-logo-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/ambi-logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
