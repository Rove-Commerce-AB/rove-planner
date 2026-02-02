import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rove Planner",
  description: "Resource planning and allocation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body className="flex min-h-screen antialiased font-primary">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8" style={{ backgroundColor: 'var(--color-bg-content)' }}>{children}</main>
      </body>
    </html>
  );
}
