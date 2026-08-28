import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./ambi-overrides.css";
import "./theme-fix.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Ambi — Calm AI Workspace",
  description: "A calm, capable AI workspace powered by Groq Cloud AI and optional Puter media tools.",
  applicationName: "Ambi",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/ambi-logo.png", apple: "/ambi-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#f4f1ea",
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
