import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repolyzer",
  description: "Analyze GitHub repositories - architecture, dependencies, and more",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
