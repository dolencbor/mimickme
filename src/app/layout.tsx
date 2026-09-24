import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Garment Mirror",
  description: "Interactive garment mirror and hologram prototype",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} ${GeistSans.variable} ${GeistMono.variable}`}><div className="app-root">{children}</div></body>
    </html>
  );
}
