import type { Metadata } from "next";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "Hive R&D",
  description: "R&D team capabilities, current work, and skill matrix",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
