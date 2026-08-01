import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle, THEME_BOOT } from "@/components/Theme";
import { CHAIN_NAME, NETWORK } from "@/lib/chain";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fieldwork.app"),
  title: {
    default: "Fieldwork — physical work, verified by photo",
    template: "%s — Fieldwork",
  },
  description:
    "Bounties for physical tasks, verified by photo against a written acceptance test. Do the work, get paid on the spot.",
  openGraph: {
    title: "Fieldwork — physical work, verified by photo",
    description:
      "Every task has an acceptance test you can read before you claim it. Submit a before and after photo, and the contract grades them and pays.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2e9" },
    { media: "(prefers-color-scheme: dark)", color: "#121310" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <header className="site-head">
          <div className="wrap">
            <Link href="/" aria-label="Fieldwork home">
              <Wordmark size={20} />
            </Link>
            <nav className="nav">
              <Link href="/map">Map</Link>
              <Link href="/console" className="hide-sm">
                Post a task
              </Link>
              <Link href="/#how" className="hide-sm">
                How it works
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-foot">
          <div className="wrap spread" style={{ alignItems: "flex-start" }}>
            <div>
              <Wordmark size={16} />
              <p className="mono muted" style={{ marginTop: 10 }}>
                Physical work, verified by photo.
              </p>
              <p className="mono muted" style={{ marginTop: 6 }}>
                {CHAIN_NAME} · {NETWORK}
              </p>
            </div>
            <nav className="nav" style={{ gap: 14 }}>
              <Link href="/limits">What this cannot do</Link>
              <Link href="/map">Find work</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
