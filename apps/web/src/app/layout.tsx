import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Neverita — Tu despensa, al día",
  description: "Inventario y cocina inteligente, ahora también en la web.",
  applicationName: "Neverita",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#fff0f5",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
