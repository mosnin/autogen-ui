import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "autogen-ui — UI you ask for, in real time",
  description:
    "An AI-native UI framework. Describe what you want and watch the dashboard build, edit, and respond to your users — declaratively, with full control over your design system.",
};

function Nav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-display text-[15px] font-semibold tracking-tight">
          autogen<span className="text-foreground/35">/ui</span>
        </Link>
        <div className="flex items-center gap-6 text-[13px] text-muted-foreground">
          <Link href="/components" className="transition-colors hover:text-foreground">
            Components
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <a
            href="https://github.com/mosnin/autogen-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-32 border-t border-border/40 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-[15px] font-semibold tracking-tight">
            autogen<span className="text-foreground/35">/ui</span>
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            UI you ask for, in real time. MIT licensed.
          </div>
        </div>
        <div className="flex items-center gap-6 text-[12px] text-muted-foreground">
          <Link href="/components" className="transition-colors hover:text-foreground">
            Components
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <a
            href="https://github.com/mosnin/autogen-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/@autogen-ui/core"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            npm
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} dark`}
    >
      <body className="font-sans antialiased">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
