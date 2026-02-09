"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Armchair, Book, Cpu, Package, Shirt } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import type { Listing } from "@/features/marketplace/types";
import { fetchListingById } from "@/lib/api/marketplace";
import { formatRelativeTime } from "@/lib/time";

const categoryStyles = {
  Textbooks: {
    gradient: "bg-gradient-to-br from-blue-400 to-blue-600",
    badge: "bg-blue-100 text-blue-700",
    Icon: Book,
  },
  Electronics: {
    gradient: "bg-gradient-to-br from-purple-400 to-purple-600",
    badge: "bg-purple-100 text-purple-700",
    Icon: Cpu,
  },
  Furniture: {
    gradient: "bg-gradient-to-br from-green-400 to-green-600",
    badge: "bg-green-100 text-green-700",
    Icon: Armchair,
  },
  Clothing: {
    gradient: "bg-gradient-to-br from-pink-400 to-pink-600",
    badge: "bg-pink-100 text-pink-700",
    Icon: Shirt,
  },
  Other: {
    gradient: "bg-gradient-to-br from-gray-400 to-gray-600",
    badge: "bg-gray-100 text-gray-700",
    Icon: Package,
  },
} as const;

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const listingId = useMemo(() => {
    const raw = (params as { listingId?: string | string[] } | null)?.listingId;
    if (!raw) return "";
    return Array.isArray(raw) ? raw[0] ?? "" : raw;
  }, [params]);

  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!listingId) {
      setError("Listing not found.");
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    fetchListingById(listingId)
      .then((data) => {
        if (!isActive) return;
        setListing(data);
      })
      .catch((err) => {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : "Unable to load listing.";
        setError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [listingId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-3xl border border-card-border/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
          <p className="text-sm text-muted">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-3xl border border-accent/30 bg-accent/10 p-6 text-sm font-semibold text-accent">
          {error ?? "Listing not found."}
        </div>
      </div>
    );
  }

  const styles = categoryStyles[listing.category] ?? categoryStyles.Other;
  const isSeller = user?.id === listing.seller.id;
  const handleMessageSeller = () => {
    const handle = listing.seller.username.replace(/^@/, "");
    router.push(`/messages/${encodeURIComponent(handle)}`);
  };
  const memberSince = new Date(listing.createdAt).getFullYear();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-card-border/70 bg-white/90 shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
            <div className="relative h-[360px] w-full">
              {listing.images?.length ? (
                <img
                  src={listing.images[0]}
                  alt={listing.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center ${styles.gradient}`}
                >
                  <styles.Icon className="h-16 w-16 text-white" />
                </div>
              )}
              <div className="absolute left-4 top-4">
                <Tag className={styles.badge}>{listing.category}</Tag>
              </div>
              <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
                {listing.condition}
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">Posted {formatRelativeTime(listing.createdAt)}</p>
                  <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
                    {listing.title}
                  </h1>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  ${listing.price}
                </div>
              </div>
              <p className="text-sm text-muted">{listing.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-card-border/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
            <div className="flex items-center gap-4">
              <Avatar name={listing.seller.name} size={48} />
              <div>
                <p className="text-base font-semibold text-ink">
                  {listing.seller.name}
                </p>
                <p className="text-sm text-muted">{listing.seller.username}</p>
                <p className="text-xs text-muted">Member since {memberSince}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.3)] transition hover:bg-orange-600"
                onClick={handleMessageSeller}
              >
                Message Seller
              </button>
              {isSeller && (
                <div className="flex gap-3">
                  <Button variant="outline" requiresAuth={false} className="flex-1">
                    Edit Listing
                  </Button>
                  <Button variant="outline" requiresAuth={false} className="flex-1">
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-card-border/70 bg-white/90 p-6 text-sm text-muted shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
            Tip: Meet in a public place on campus and verify the item before paying.
          </div>
        </div>
      </div>
    </div>
  );
}
