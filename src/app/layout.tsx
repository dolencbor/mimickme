import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "MimickMe™",
  description: "Interactive garment mirror and hologram prototype",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} ${GeistSans.variable}`}><div className="app-root">{children}</div></body>
    </html>
  );
}
