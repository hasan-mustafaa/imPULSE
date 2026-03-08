import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "imPULSE - Smart Hospital Finder",
  description:
    "Find the best hospital to visit based on wait times, distance, and AI-powered recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
