import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "K-PRINT 2026 — 스폰서십",
  description: "K-PRINT 2026 스폰서십 안내 및 견적 문의",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
