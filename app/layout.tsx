import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Ambi — Calm AI Workspace",
  description: "A calm, capable AI workspace powered by Groq Cloud AI.",
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
  return <html lang="en"><body className={`${inter.variable} ${manrope.variable}`}><PWARegister />{children}</body></html>;
}
