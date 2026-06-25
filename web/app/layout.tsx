import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import TriggerButton from "@/components/TriggerButton";

export const metadata: Metadata = {
  title: "Methodic Monday Brief",
  description: "Weekly intelligence brief — rates, comps, watchlist, competitors.",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/archive", label: "Archive" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="text-[15px] font-semibold tracking-tight text-gray-950">
                Methodic Monday Brief
              </span>
              <span className="hidden text-xs uppercase tracking-[0.18em] text-gray-400 sm:inline">
                Intelligence
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
                >
                  {item.label}
                </Link>
              ))}
              <span className="mx-2 hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />
              <TriggerButton />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <footer className="border-t border-gray-200">
          <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-gray-400">
            Methodic Monday Brief — private analytics.
          </div>
        </footer>
      </body>
    </html>
  );
}
