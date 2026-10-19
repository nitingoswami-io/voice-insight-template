import { JetBrains_Mono, Libre_Franklin, Playfair_Display, Source_Serif_4 } from "next/font/google";

// Same faces as the portfolio site. Prefixed variable names so they never collide
// with a framework's own --font-sans / --font-mono (Tailwind v4 defines both).
export const display = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-dl-display", display: "swap" });
export const serif = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-dl-serif", display: "swap" });
export const sans = Libre_Franklin({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-dl-sans", display: "swap" });
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dl-mono", display: "swap" });

export const fontVariables = [display.variable, serif.variable, sans.variable, mono.variable].join(" ");
