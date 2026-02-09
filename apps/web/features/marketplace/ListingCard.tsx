"use client";

import { useEffect } from "react";
import { Armchair, Book, Cpu, Package, Shirt } from "lucide-react";
import { IMAGE_BASE_URL } from "@/lib/api";
import type { Listing } from "./types";

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

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

const avatarStyles = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-green-100 text-green-600",
  "bg-purple-100 text-purple-600",
];

const getAvatarStyle = (username: string) => {
  if (!username) return avatarStyles[0];
  const index = username.charCodeAt(0) % avatarStyles.length;
  return avatarStyles[index];
};

const resolveImageUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${IMAGE_BASE_URL}${normalized}`;
};

type ListingCardProps = {
  listing: Listing;
  showSoldBadge?: boolean;
};

export const ListingCard = ({ listing, showSoldBadge = false }: ListingCardProps) => {
  const styles = categoryStyles[listing.category] ?? categoryStyles.Other;
  const avatarStyle = getAvatarStyle(listing.seller.username);
  const initial = listing.seller.username
    ? listing.seller.username.charAt(0).toUpperCase()
    : listing.seller.name.charAt(0).toUpperCase();
  const imageUrl =
    listing.images && listing.images.length > 0
      ? resolveImageUrl(listing.images[0])
      : "";
  const isSold = listing.status === "sold";

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[Marketplace] Listing card images", {
        id: listing.id,
        images: listing.images,
        imageUrl,
      });
    }
  }, [listing.id, listing.images, imageUrl]);

  return (
    <div
      className={`cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-lg ${
        showSoldBadge && isSold ? "opacity-60 grayscale-[0.3]" : ""
      }`}
    >
      <div className="relative h-48">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600"
          >
            <styles.Icon className="h-12 w-12 text-white" />
          </div>
        )}
        {listing.images && listing.images.length > 1 && (
          <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
            IMG {listing.images.length}
          </div>
        )}
        {showSoldBadge && isSold && (
          <div className="absolute right-2 top-2 rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
            SOLD
          </div>
        )}
        <div className={`absolute left-2 bottom-2 rounded-full px-2 py-1 text-xs font-semibold ${styles.badge}`}>
          {listing.category}
        </div>
        <div
          className={`absolute right-2 rounded-full bg-white/90 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur ${
            showSoldBadge && isSold ? "top-10" : "top-2"
          }`}
        >
          {listing.condition}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-1 text-lg font-bold text-orange-600">
          ${listing.price}
        </div>
        <div className="mb-2 line-clamp-2 font-semibold text-gray-900">
          {listing.title}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${avatarStyle}`}
            >
              {initial}
            </div>
            <span className="text-sm text-gray-600">
              {listing.seller.username}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {formatTimeAgo(listing.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};
