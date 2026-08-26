"use client";

import { useEffect } from "react";
import { memoryStore } from "@/lib/memory/store";

function applyTheme(theme: string | undefined) {
  const root = document.documentElement;
  const selected = theme === "dark" || theme === "oled" || theme === "light" ? theme : "system";
  const resolved = selected === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : selected;
  root.dataset.theme = resolved;
}

export default function ThemeBridge() {
  useEffect(() => {
    let active = true;
    void memoryStore.loadSettings().then((settings) => {
      if (active) applyTheme(settings?.theme);
    }).catch(() => applyTheme("system"));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => {
      void memoryStore.loadSettings().then((settings) => {
        if (settings?.theme === "system") applyTheme("system");
      }).catch(() => undefined);
    };
    media.addEventListener?.("change", onSystemThemeChange);
    return () => {
      active = false;
      media.removeEventListener?.("change", onSystemThemeChange);
    };
  }, []);

  return null;
}
