"use client";

import { useSyncExternalStore } from "react";

/**
 * "Low temperature mode": the night edition toggle, worded as on the site.
 *
 * Sets data-theme on <html>; demo-look.css reads it. Remembered per browser.
 * Pair with THEME_BOOT_SCRIPT in the document head so there is no flash.
 */
export const THEME_KEY = "dl-theme";

export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

const CHANGE_EVENT = "dl-theme-change";

function isDark(): boolean {
  const set = document.documentElement.dataset.theme;
  if (set) return set === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function ThemeToggle() {
  // null on the server: the label settles on the client, after the boot script.
  const dark = useSyncExternalStore(subscribe, isDark, () => null);

  function toggle() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button type="button" className="dl-toggle dl-label" onClick={toggle} aria-pressed={dark ?? undefined}>
      <span aria-hidden>{dark ? "☀" : "☾"}</span>
      {dark ? "Day edition" : "Low temperature mode"}
    </button>
  );
}
