import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Mark } from "@/components/Logo";
import { ThemeToggle, THEME_BOOT } from "@/components/Theme";
import { CHAIN_NAME, NETWORK } from "@/lib/chain";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fieldwork.app"),
  title: {
    default: "Fieldwork — evidence in, settlement out",
    template: "%s — Fieldwork",
  },
  description:
    "One written standard, two photographs and independent graders. The verdict and the payment leave the contract as a single transaction.",
  openGraph: {
    title: "Fieldwork — evidence in, settlement out",
    description:
      "Bounties for physical work, settled against a written acceptance test by independent graders.",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Matches the default theme, which is dark.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Applies the stored theme before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <header className="site-head">
          <div className="wrap">
            <Link href="/" className="brand" aria-label="Fieldwork home">
              <Mark size={20} />
              <span>fieldwork</span>
            </Link>
            <nav className="nav">
              <Link href="/map">Map</Link>
              <Link href="/console" className="hide-sm">
                Console
              </Link>
              <Link href="/limits" className="hide-sm">
                Limits
              </Link>
              <ThemeToggle />
              <Link href="/console" className="btn btn-sm btn-primary">
                Post a task
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-foot">
          <div className="wrap spread" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <Link href="/" className="brand">
                <Mark size={16} />
                <span style={{ fontSize: 13 }}>fieldwork</span>
              </Link>
              <p className="eyebrow" style={{ marginTop: 12 }}>
                Physical work — verified by photograph
              </p>
              <p className="eyebrow" style={{ marginTop: 6 }}>
                {CHAIN_NAME} — {NETWORK}
              </p>
            </div>
            <nav className="nav" style={{ gap: 18 }}>
              <Link href="/limits">Limits</Link>
              <Link href="/deploy">Deploy</Link>
              <Link href="/map">Find work</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
