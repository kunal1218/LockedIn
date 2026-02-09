"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { Avatar } from "@/components/Avatar";
import { apiGet } from "@/lib/api";
import { Button } from "./Button";

const baseNavItems = [
  { href: "/", label: "Home" },
  { href: "/friends", label: "Friends" },
  { href: "/map", label: "Map" },
  { href: "/requests", label: "Requests" },
  { href: "/play", label: "Play" },
  { href: "/clubs", label: "Clubs" },
];

export const SiteHeader = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const profileName = user?.name ?? "Profile";
  const navItems = user?.isAdmin
    ? [...baseNavItems, { href: "/admin", label: "Admin" }]
    : baseNavItems;

  const handleNavClick =
    (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
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

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    let isActive = true;

    const loadCount = async () => {
      try {
        const payload = await apiGet<{ count: number }>(
          "/notifications/unread-count",
          token
        );
        if (isActive) {
          setUnreadCount(payload.count ?? 0);
        }
      } catch {
        if (isActive) {
          setUnreadCount(0);
        }
      }
    };

    loadCount();
    const interval = window.setInterval(loadCount, 15000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [pathname, token]);

  const badgeCount = unreadCount > 99 ? "99+" : `${unreadCount}`;
  const coinCount = user?.coins ?? 0;

  return (
    <header className="relative z-10 pointer-events-auto">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 py-6">
        <Link href="/" className="flex items-center gap-3" onClick={handleNavClick("/")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-lg font-bold text-accent">
            L
          </span>
          <div>
            <p className="font-display text-xl font-semibold">LockedIn</p>
            <p className="text-xs text-muted">Campus social, zero awkwardness</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex md:justify-self-center">
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
        <div className="flex items-center justify-self-end gap-3">
          {!isAuthenticated ? (
            <Button className="pulse-soft" authMode="signup">
              Join today
            </Button>
          ) : (
            <>
              <Link
                href="/leaderboard"
                onClick={handleNavClick("/leaderboard")}
                aria-label="Leaderboard"
                className="flex items-center gap-1 rounded-full border border-card-border/70 bg-white/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50"
              >
                <span role="img" aria-label="coins">
                  🪙
                </span>
                <span>{coinCount}</span>
              </Link>
              <Link
                href="/notifications"
                onClick={handleNavClick("/notifications")}
                aria-label="Notifications"
                className="relative rounded-full border border-card-border/70 bg-white/80 p-2 text-ink/80 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-ink"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {badgeCount}
                  </span>
                )}
              </Link>
              <Link
                href="/profile"
                onClick={handleNavClick("/profile")}
                aria-label="Profile"
                className="rounded-full border border-card-border/70 bg-white/80 p-1 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50"
              >
                <Avatar name={profileName} size={32} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
