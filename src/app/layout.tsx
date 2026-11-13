import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const body = Nunito({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Fredoka({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Haya Baby — Baby Shop", template: "%s · Haya Baby" },
  description: "Soft, safe & sweet things for your little one. Cash on delivery across Pakistan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
