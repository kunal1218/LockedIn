import type { Listing } from "@/features/marketplace/types";
import type {
  MarketplaceConversation,
  MarketplaceMessage,
} from "@/features/marketplace/messages/types";
import { API_BASE_URL, apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";

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

export const fetchMyListings = async (
  token?: string | null
): Promise<Listing[]> => {
  const response = await apiGet<{ listings: Listing[] }>(
    "/marketplace/my-listings",
    token ?? undefined
  );
  return response.listings ?? [];
};

export const updateListing = async (
  listingId: string,
  data: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    location?: string;
    images?: string[];
  },
  token?: string | null
): Promise<Listing> => {
  const response = await apiPut<{ listing: Listing }>(
    `/marketplace/listings/${encodeURIComponent(listingId)}`,
    data,
    token ?? undefined
  );
  return response.listing;
};

export const deleteListing = async (
  listingId: string,
  token?: string | null
): Promise<void> => {
  await apiDelete(`/marketplace/listings/${encodeURIComponent(listingId)}`, token ?? undefined);
};

export const updateListingStatus = async (
  listingId: string,
  status: "active" | "sold",
  token?: string | null
): Promise<Listing> => {
  const response = await apiPatch<{ listing: Listing }>(
    `/marketplace/listings/${encodeURIComponent(listingId)}/status`,
    { status },
    token ?? undefined
  );
  return response.listing;
};

export const startMarketplaceConversation = async (
  listingId: string,
  content: string,
  token?: string | null
): Promise<{ conversationId: string; message: MarketplaceMessage }> => {
  const response = await apiPost<{ conversationId: string; message: MarketplaceMessage }>(
    `/marketplace/listings/${encodeURIComponent(listingId)}/message`,
    { content },
    token ?? undefined
  );
  return response;
};

export const getMarketplaceConversations = async (
  token?: string | null
): Promise<MarketplaceConversation[]> => {
  const response = await apiGet<{ conversations: MarketplaceConversation[] }>(
    "/marketplace/conversations",
    token ?? undefined
  );
  return response.conversations ?? [];
};

export const getMarketplaceConversationMessages = async (
  conversationId: string,
  token?: string | null
): Promise<{ conversation: MarketplaceConversation; messages: MarketplaceMessage[] }> => {
  const response = await apiGet<{
    conversation: MarketplaceConversation;
    messages: MarketplaceMessage[];
  }>(`/marketplace/conversations/${encodeURIComponent(conversationId)}/messages`, token ?? undefined);
  return response;
};

export const sendMarketplaceMessage = async (
  conversationId: string,
  content: string,
  token?: string | null
): Promise<MarketplaceMessage> => {
  const response = await apiPost<{ message: MarketplaceMessage }>(
    `/marketplace/conversations/${encodeURIComponent(conversationId)}/messages`,
    { content },
    token ?? undefined
  );
  return response.message;
};

const resolveErrorMessage = async (response: Response) => {
  if (response.ok) return "";
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore JSON parsing errors
  }
  return `API error: ${response.status}`;
};

export const uploadListingImages = async (
  listingId: string,
  files: File[],
  token?: string | null
): Promise<string[]> => {
  if (!files.length) {
    return [];
  }
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const response = await fetch(
    `${API_BASE_URL}/marketplace/listings/${encodeURIComponent(listingId)}/images`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }

  const data = (await response.json()) as { images?: string[] };
  return data.images ?? [];
};

export const deleteListingImage = async (
  listingId: string,
  imageUrl: string,
  token?: string | null
): Promise<string[]> => {
  const response = await fetch(
    `${API_BASE_URL}/marketplace/listings/${encodeURIComponent(listingId)}/images`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ imageUrl }),
    }
  );

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }

  const data = (await response.json()) as { images?: string[] };
  return data.images ?? [];
};
