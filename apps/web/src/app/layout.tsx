import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Neverita — Tu despensa, al día",
  description: "Inventario y cocina inteligente, ahora también en la web.",
  applicationName: "Neverita",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f4f0e6",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
