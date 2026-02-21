"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { Avatar } from "@/components/Avatar";
import { apiGet } from "@/lib/api";
import { Button } from "./Button";

type NavItem = {
  href: string;
  label: string;
};

const baseNavItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/friends", label: "Friends" },
  { href: "/map", label: "Map" },
  { href: "/requests", label: "Requests" },
  { href: "/play", label: "Play" },
  { href: "/clubs", label: "Groups" },
  { href: "/marketplace", label: "Marketplace" },
];

const BrandMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 48 48"
    aria-hidden="true"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8 6h32v27H28v9l-7-9H8V6Z" fill="#1B1A17" />
    <path
      d="M24 13c-5.5 0-9.2 3.7-9.2 9.4v5.4c0 5.7 3.7 9.4 9.2 9.4 1.5 0 2.9-.2 4.2-.8l2.2 3.2h5.1l-3.8-5.6c1.1-1.6 1.7-3.5 1.7-5.8v-5.4c0-5.7-3.8-9.4-9.4-9.4Zm0 4.5c2.6 0 4.2 1.7 4.2 4.8v5.4c0 .8-.1 1.6-.4 2.2l-1.4-2.1h-5.1l3.2 4.6H24c-2.6 0-4.2-1.7-4.2-4.8v-5.4c0-3.1 1.6-4.8 4.2-4.8Z"
      fill="#FF8658"
    />
  </svg>
);

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
        <Link
          href="/"
          className="group flex items-center gap-3"
          onClick={handleNavClick("/")}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-card-border/70 bg-white/80 shadow-sm transition-transform duration-150 ease-out group-active:scale-[0.98]">
            <BrandMark className="h-8 w-8" />
          </span>
          <div>
            <p className="inline-block font-display text-xl font-semibold transition-colors duration-150 group-hover:text-accent">
              QuadBlitz
            </p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex md:justify-self-center">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const baseClasses =
              "relative inline-flex items-center gap-2 transition after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-200";
            const stateClasses = isActive
              ? "text-ink after:scale-x-100"
              : "text-muted hover:text-ink hover:after:scale-x-100";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`${baseClasses} ${stateClasses}`}
                onClick={handleNavClick(item.href)}
              >
                {item.label}
              </Link>
            );
          })}
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
