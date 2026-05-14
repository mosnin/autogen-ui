import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "autogen-ui — talk your dashboard into existence",
  description:
    "Describe what you want and watch the dashboard build and edit itself, powered by autogen-ui.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
