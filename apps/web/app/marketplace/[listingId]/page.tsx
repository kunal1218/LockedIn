"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Armchair, Book, Cpu, Package, Shirt } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ImageCarousel } from "@/components/ImageCarousel";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { EditListingModal } from "@/features/marketplace/EditListingModal";
import type { Listing } from "@/features/marketplace/types";
import { IMAGE_BASE_URL } from "@/lib/api";
import {
  deleteListing,
  fetchListingById,
  startMarketplaceConversation,
  updateListingStatus,
} from "@/lib/api/marketplace";
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

const resolveImageUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${IMAGE_BASE_URL}${normalized}`;
};

const toHandleSlug = (handle: string) => handle.replace(/^@/, "").trim();

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const listingId = useMemo(() => {
    const raw = (params as { listingId?: string | string[] } | null)?.listingId;
    if (!raw) return "";
    return Array.isArray(raw) ? raw[0] ?? "" : raw;
  }, [params]);

  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isMessagingSeller, setIsMessagingSeller] = useState(false);

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

  useEffect(() => {
    if (!listing || process.env.NODE_ENV === "production") {
      return;
    }
    console.log("[Marketplace] Listing images", listing.images);
    const resolved = (listing.images ?? []).map((image) => resolveImageUrl(image));
    console.log("[Marketplace] Resolved image URLs", resolved);
  }, [listing]);

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
  const canDeleteListing = isSeller || Boolean(user?.isAdmin);
  const isSold = listing.status === "sold";
  const handleMessageSeller = async () => {
    if (!isAuthenticated || !token) {
      openAuthModal("login");
      return;
    }
    if (!listing) {
      return;
    }
    if (!isSeller && isSold) {
      return;
    }
    setIsMessagingSeller(true);
    setNotice(null);
    try {
      const response = await startMarketplaceConversation(
        listing.id,
        `Hi! I'm interested in your listing: ${listing.title}`,
        token
      );
      router.push(`/marketplace/messages/${response.conversationId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to start conversation.";
      setNotice({ type: "error", message });
    } finally {
      setIsMessagingSeller(false);
    }
  };
  const memberSince = new Date(listing.createdAt).getFullYear();
  const sellerHandleSlug = toHandleSlug(listing.seller.username ?? "");
  const sellerProfileIdentifier = sellerHandleSlug || listing.seller.id;

  const handleSellerProfileClick = () => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }

    if (user?.id === listing.seller.id) {
      router.push("/profile");
      return;
    }

    if (!sellerProfileIdentifier) {
      return;
    }

    router.push(`/profile/${encodeURIComponent(sellerProfileIdentifier)}`);
  };

  const handleEditSuccess = (updated: Listing) => {
    setListing(updated);
    setNotice({ type: "success", message: "Listing updated." });
    setIsEditOpen(false);
  };

  const handleDelete = async () => {
    if (!isAuthenticated || !token) {
      openAuthModal("login");
      return;
    }
    if (!listing) {
      return;
    }
    setIsDeleting(true);
    setNotice(null);
    try {
      await deleteListing(listing.id, token);
      setNotice({ type: "success", message: "Listing deleted." });
      router.push("/marketplace");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete listing.";
      setNotice({ type: "error", message });
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!isAuthenticated || !token) {
      openAuthModal("login");
      return;
    }
    if (!listing) {
      return;
    }
    setIsUpdatingStatus(true);
    setNotice(null);
    try {
      const nextStatus = listing.status === "sold" ? "active" : "sold";
      const updated = await updateListingStatus(listing.id, nextStatus, token);
      setListing(updated);
      setNotice({
        type: "success",
        message: nextStatus === "sold" ? "Listing marked as sold." : "Listing marked as available.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update listing status.";
      setNotice({ type: "error", message });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {notice && (
        <div
          className={`mb-6 rounded-3xl border px-5 py-4 text-sm font-semibold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-600"
          }`}
        >
          {notice.message}
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-card-border/70 bg-white/90 shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
            <div className="relative h-[360px] w-full">
              {listing.images?.length ? (
                <ImageCarousel images={listing.images} alt={listing.title} />
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
              {isSold && (
                <div className="absolute right-4 top-4 rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                  SOLD
                </div>
              )}
              <div
                className={`absolute right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur ${
                  isSold ? "top-12" : "top-4"
                }`}
              >
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
              <button
                type="button"
                onClick={handleSellerProfileClick}
                className="rounded-full"
                aria-label={`View ${listing.seller.name} profile`}
                data-profile-link
              >
                <Avatar name={listing.seller.name} size={48} />
              </button>
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
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.3)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleMessageSeller}
                disabled={(!isSeller && isSold) || isMessagingSeller}
              >
                {isMessagingSeller ? "Opening..." : "Message Seller"}
              </button>
              {!isSeller && isSold && (
                <p className="text-xs font-semibold text-rose-500">
                  This item has been sold.
                </p>
              )}
              {canDeleteListing && (
                <div className="flex gap-3">
                  {isSeller && (
                    <Button
                      variant="outline"
                      requiresAuth={false}
                      className="flex-1"
                      onClick={() => setIsEditOpen(true)}
                    >
                      Edit Listing
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    requiresAuth={false}
                    className="flex-1 text-rose-500 hover:border-rose-200 hover:text-rose-600"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    Delete Listing
                  </Button>
                  {isSeller && (
                    <button
                      type="button"
                      onClick={handleStatusToggle}
                      disabled={isUpdatingStatus}
                      className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                        isSold
                          ? "border-2 border-gray-300 text-gray-600 hover:bg-gray-50"
                          : "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_4px_12px_rgba(255,107,53,0.3)]"
                      }`}
                    >
                      {isUpdatingStatus
                        ? "Updating..."
                        : isSold
                          ? "Mark as Available"
                          : "Mark as Sold"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-card-border/70 bg-white/90 p-6 text-sm text-muted shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
            Tip: Meet in a public place on campus and verify the item before paying.
          </div>
        </div>
      </div>

      {listing && (
        <EditListingModal
          isOpen={isEditOpen}
          listing={listing}
          onClose={() => setIsEditOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="font-display text-xl font-semibold text-ink">
                Delete this listing?
              </h3>
              <p className="mt-2 text-sm text-muted">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-3 px-6 py-6 sm:flex-row sm:justify-end">
              <Button variant="outline" requiresAuth={false} onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="inline-flex items-center justify-center rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(244,63,94,0.3)] transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
