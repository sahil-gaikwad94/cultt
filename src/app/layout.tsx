import type { Metadata, Viewport } from "next";
import "./globals.css";
import { grotesk, inter, syne } from "./fonts";
import RootEffects from "@/components/providers/RootEffects";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  title: "Cultured — match on your culture",
  description:
    "Culture-based dating: match on humor style and music taste before you see a photo. Every match starts from a shared laugh or a shared track.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0B12",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${syne.variable} ${grotesk.variable} ${inter.variable}`}>
      <body className="bg-canvas text-ink font-sans antialiased grain">
        {children}
        <RootEffects />
        <Toaster />
      </body>
    </html>
  );
}
