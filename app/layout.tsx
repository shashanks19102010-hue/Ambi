import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Ambi — Local AI Workspace",
  description: "A local-first, privacy-aware AI assistant for conversation, coding, research and study.",
  applicationName: "Ambi",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/ambi-logo.png", apple: "/ambi-logo.png" }
};

export const viewport: Viewport = { themeColor: "#11110f", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PWARegister />{children}</body></html>;
}
