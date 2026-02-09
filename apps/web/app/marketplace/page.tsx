"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { ListingCard } from "@/features/marketplace/ListingCard";
import type { Listing } from "@/features/marketplace/types";

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
  const mockListings: Listing[] = [
    {
      id: "1",
      title: "Calculus Textbook - 8th Edition",
      description: "Barely used calculus textbook",
      price: 45,
      category: "Textbooks",
      condition: "Like New",
      images: [],
      seller: { id: "1", username: "john_doe", name: "John Doe" },
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      title: "Gaming Mouse - Logitech G502",
      description: "Wireless gaming mouse, works perfectly",
      price: 30,
      category: "Electronics",
      condition: "Good",
      images: [],
      seller: { id: "2", username: "jane_smith", name: "Jane Smith" },
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "3",
      title: "Desk Lamp - IKEA",
      description: "White desk lamp, adjustable",
      price: 15,
      category: "Furniture",
      condition: "Good",
      images: [],
      seller: { id: "3", username: "mike_wong", name: "Mike Wong" },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "4",
      title: "UW-Madison Hoodie - Size M",
      description: "Official UW hoodie, red",
      price: 25,
      category: "Clothing",
      condition: "Like New",
      images: [],
      seller: { id: "4", username: "sarah_lee", name: "Sarah Lee" },
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "5",
      title: "Mini Fridge - Compact",
      description: "Perfect for dorm room",
      price: 80,
      category: "Furniture",
      condition: "Good",
      images: [],
      seller: { id: "5", username: "tom_chen", name: "Tom Chen" },
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "6",
      title: "Mechanical Keyboard",
      description: "Cherry MX Blue switches",
      price: 60,
      category: "Electronics",
      condition: "Like New",
      images: [],
      seller: { id: "6", username: "amy_park", name: "Amy Park" },
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "7",
      title: "Chemistry Lab Goggles",
      description: "Required for CHEM 103",
      price: 10,
      category: "Other",
      condition: "New",
      images: [],
      seller: { id: "7", username: "alex_nguyen", name: "Alex Nguyen" },
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "8",
      title: "Standing Desk Converter",
      description: "Adjustable height, barely used",
      price: 50,
      category: "Furniture",
      condition: "Like New",
      images: [],
      seller: { id: "8", username: "ben_taylor", name: "Ben Taylor" },
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ];
  const filteredListings = mockListings
    .filter(
      (listing) =>
        selectedCategory === "All" || listing.category === selectedCategory
    )
    .filter((listing) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        listing.title.toLowerCase().includes(query) ||
        listing.description.toLowerCase().includes(query)
      );
    });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">
            Marketplace
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Buy and sell with students at UW-Madison
          </p>
        </div>
        <Button requiresAuth={false}>Post Listing</Button>
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
                {category === "All"
                  ? `All (${mockListings.length})`
                  : category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredListings.length === 0 ? (
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
                className="inline-flex items-center justify-center rounded-lg border-2 border-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-500 transition hover:bg-orange-50"
              >
                Post Listing
              </button>
            </div>
          </div>
        ) : (
          filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))
        )}
      </div>
    </div>
  );
}
