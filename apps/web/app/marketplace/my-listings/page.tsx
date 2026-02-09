"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { CreateListingModal } from "@/features/marketplace/CreateListingModal";
import { EditListingModal } from "@/features/marketplace/EditListingModal";
import { ListingCard } from "@/features/marketplace/ListingCard";
import { useAuth } from "@/features/auth";
import type { Listing } from "@/features/marketplace/types";
import { deleteListing, fetchMyListings } from "@/lib/api/marketplace";

export default function MyListingsPage() {
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stats = useMemo(() => {
    const totalValue = listings.reduce(
      (sum, listing) => sum + Number(listing.price || 0),
      0
    );
    return { count: listings.length, totalValue };
  }, [listings]);

  const loadListings = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setListings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyListings(token);
      setListings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load listings.";
      setError(message);
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const handleEdit = (listing: Listing) => {
    setActiveListing(listing);
    setIsEditOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !token) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteListing(deleteTarget.id, token);
      setListings((prev) => prev.filter((listing) => listing.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete listing.";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = (updated: Listing) => {
    setListings((prev) =>
      prev.map((listing) => (listing.id === updated.id ? updated : listing))
    );
    setActiveListing(updated);
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-3xl border border-card-border/70 bg-white/80 px-6 py-10 text-center shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
          <h1 className="font-display text-3xl font-semibold text-ink">My Listings</h1>
          <p className="mt-3 text-sm text-muted">
            Sign in to manage the items you have posted on the marketplace.
          </p>
          <Button
            className="mt-6"
            onClick={() => openAuthModal("login")}
            requiresAuth={false}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">My Listings</h1>
          <p className="mt-2 text-base text-gray-600">
            Keep tabs on everything you have posted.
          </p>
        </div>
        <Button requiresAuth={false} onClick={() => setIsCreateOpen(true)}>
          Post Listing
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-card-border/70 bg-white/80 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total Listings</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{stats.count}</p>
        </div>
        <div className="rounded-2xl border border-card-border/70 bg-white/80 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total Value</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            ${stats.totalValue.toFixed(2)}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-card-border/70 bg-white/70 px-6 py-8 text-sm text-muted">
          Loading your listings...
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-card-border/70 bg-white/70 px-6 py-12 text-center">
          <p className="mb-4 text-gray-500">You haven't posted anything yet</p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.3)] transition hover:bg-orange-600"
          >
            Post Your First Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <div key={listing.id} className="group">
              <ListingCard listing={listing} />
              <div className="mt-3 flex flex-wrap gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleEdit(listing)}
                  className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.3)] transition hover:bg-orange-600"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(listing)}
                  className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:text-rose-600"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-400"
                >
                  Mark as Sold
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateListingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          void loadListings();
        }}
      />

      <EditListingModal
        isOpen={isEditOpen}
        listing={activeListing}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(updated) => {
          handleEditSuccess(updated);
          setIsEditOpen(false);
        }}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="font-display text-xl font-semibold text-ink">
                Delete this listing?
              </h3>
              <p className="mt-2 text-sm text-muted">This action cannot be undone.</p>
            </div>
            <div className="flex flex-col gap-3 px-6 py-6 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                requiresAuth={false}
                onClick={() => setDeleteTarget(null)}
              >
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
