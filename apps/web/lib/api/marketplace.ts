import type { Listing } from "@/features/marketplace/types";
import { apiGet, apiPost } from "@/lib/api";

export const createListing = async (
  data: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    images?: string[];
  },
  token?: string | null
): Promise<Listing> => {
  const response = await apiPost<{ listing: Listing }>(
    "/marketplace/listings",
    data,
    token ?? undefined
  );
  return response.listing;
};

export const fetchListings = async (params?: {
  category?: string;
  search?: string;
}): Promise<Listing[]> => {
  const queryParams = new URLSearchParams();
  if (params?.category && params.category !== "All") {
    queryParams.append("category", params.category);
  }
  if (params?.search && params.search.trim()) {
    queryParams.append("search", params.search.trim());
  }

  const query = queryParams.toString();
  const response = await apiGet<{ listings: Listing[] }>(
    `/marketplace/listings${query ? `?${query}` : ""}`
  );
  return response.listings ?? [];
};

export const fetchListingById = async (listingId: string): Promise<Listing> => {
  const response = await apiGet<{ listing: Listing }>(
    `/marketplace/listings/${encodeURIComponent(listingId)}`
  );
  return response.listing;
};
