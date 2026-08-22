import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ambi — Private Local AI",
  description:
    "A safety-first local AI chat assistant that runs inference on your device.",
  applicationName: "Ambi",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}