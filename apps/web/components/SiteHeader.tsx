"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./Button";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Profile" },
  { href: "/map", label: "Map" },
  { href: "/requests", label: "Requests" },
];

export const SiteHeader = () => {
  const router = useRouter();

  const handleNavClick =
    (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      router.push(href);
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname !== href) {
            window.location.assign(href);
          }
        }, 50);
      }
    };

  return (
    <header className="relative z-[70] pointer-events-auto">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <Link href="/" className="flex items-center gap-3" onClick={handleNavClick("/")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-lg font-bold text-accent">
            L
          </span>
          <div>
            <p className="font-display text-xl font-semibold">LockedIn</p>
            <p className="text-xs text-muted">Campus social, zero awkwardness</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-ink"
              onClick={handleNavClick(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            authMode="login"
          >
            Drop a post
          </Button>
          <Button className="pulse-soft" authMode="signup">
            Join today
          </Button>
        </div>
      </div>
    </header>
  );
};
