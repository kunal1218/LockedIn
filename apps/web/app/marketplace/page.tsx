"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { CreateListingModal } from "@/features/marketplace/CreateListingModal";
import { ListingCard } from "@/features/marketplace/ListingCard";
import type { Listing } from "@/features/marketplace/types";
import { fetchListings } from "@/lib/api/marketplace";

const ShoppingBagIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 8V7a6 6 0 0 1 12 0v1" />
    <path d="M4 8h16l-1.5 12.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" />
    <path d="M9 11a3 3 0 0 0 6 0" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const categories = [
  "All",
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Other",
];

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadListings = useCallback(async () => {
    try {
      const next = await fetchListings({
        category: selectedCategory,
        search: searchQuery,
      });
      setListings(next);
    } catch (error) {
      console.error("Fetch error:", error);
      setListings([]);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">
            Marketplace
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Buy and sell with ease
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/marketplace/messages"
            className="inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/60"
          >
            Marketplace Messages
          </Link>
          <Link
            href="/marketplace/my-listings"
            className="inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/60"
          >
            My Listings
          </Link>
          <Button requiresAuth={false} onClick={() => setIsModalOpen(true)}>
            Post Listing
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search for textbooks, furniture, electronics..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
          Categories
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isActive = category === selectedCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-orange-100 text-orange-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.length === 0 ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <div className="text-center">
              <ShoppingBagIcon className="mx-auto mb-4 h-20 w-20 text-orange-500" />
              <h2 className="mb-2 text-xl font-semibold text-gray-900">
                {searchQuery.trim() && selectedCategory !== "All"
                  ? `No ${selectedCategory} found matching '${searchQuery.trim()}'`
                  : searchQuery.trim()
                    ? `No results found for '${searchQuery.trim()}'`
                    : selectedCategory === "All"
                      ? "No listings yet"
                      : `No ${selectedCategory} found`}
              </h2>
              <p className="mb-6 text-sm text-gray-600">
                Be the first to sell something!
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border-2 border-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-500 transition hover:bg-orange-50"
              >
                Post Listing
              </button>
            </div>
          </div>
        ) : (
          listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/marketplace/${listing.id}`}
              className="block no-underline"
            >
              <div className="transition-all duration-200 hover:scale-[1.02]">
                <ListingCard listing={listing} />
              </div>
            </Link>
          ))
        )}
      </div>

      <CreateListingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          void loadListings();
        }}
      />
    </div>
  );
}
