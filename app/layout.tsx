import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ambi-overrides.css";
import "./theme-fix.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata={title:"Ambi — Calm AI Workspace",description:"A private, local-first AI workspace with cloud chat, research and Pexels media search.",applicationName:"Ambi",manifest:"/manifest.webmanifest",icons:{icon:"/ambi-logo.png",apple:"/ambi-logo.png"}};
export const viewport: Viewport={themeColor:"#f4f1ea",colorScheme:"light dark",viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<PWARegister/></body></html>;}