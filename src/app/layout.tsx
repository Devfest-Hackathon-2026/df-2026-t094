import type { Metadata } from "next";
import { BIZ_UDPGothic, DotGothic16 } from "next/font/google";
import "./globals.css";

const dot = DotGothic16({ weight: "400", subsets: ["latin"], variable: "--font-dot", display: "swap" });
const body = BIZ_UDPGothic({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "ことばロボ",
  description: "言われたとおりにしか うごけない ロボに、おにぎりの作りかたを 言葉で おしえよう",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${dot.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
