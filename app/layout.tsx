import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./runtime.css";
import "./monochrome.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Ambi — Personal AI Workspace",
  description: "A premium, privacy-aware AI workspace powered by Groq Cloud AI and optional web research.",
  applicationName: "Ambi",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/ambi-logo.png", apple: "/ambi-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PWARegister />{children}</body></html>;
}
