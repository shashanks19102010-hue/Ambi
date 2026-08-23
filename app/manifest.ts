export default function manifest() {
  return {
    name: "Ambi — Local AI Workspace",
    short_name: "Ambi",
    description: "Local-first AI assistant for private conversations, coding, research and study.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#11110f",
    icons: [{ src: "/ambi-logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }]
  };
}
