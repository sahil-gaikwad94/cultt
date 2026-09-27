import localFont from "next/font/local";

/**
 * Self-hosted via @fontsource packages (Google Fonts CDN is unavailable).
 * v3 type system: Syne (display — wide, geometric, startup energy),
 * Space Grotesk (labels/numerals), Inter (UI body).
 */

export const syne = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/syne/files/syne-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/syne/files/syne-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/syne/files/syne-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-syne",
  display: "swap",
});

export const grotesk = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
      weight: "300 700",
      style: "normal",
    },
  ],
  variable: "--font-grotesk",
  display: "swap",
});

export const inter = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});
