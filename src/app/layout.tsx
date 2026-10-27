import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pathwise — pediatric cognitive tasks with process data",
  description: "Touch-based Trail Making, Go/No-Go, Flanker and spatial span with raw event capture and a clinician dashboard.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Stops accidental pinch/double-tap zoom on iPad during timed tasks.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fafaf7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
