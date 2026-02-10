import type { Listing } from "@/features/marketplace/types";

export type MarketplaceUser = {
  id: string;
  name: string;
  handle: string;
};

export type MarketplaceListingSummary = {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: Listing["category"];
  condition: Listing["condition"];
  status: Listing["status"];
};

export type MarketplaceMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: MarketplaceUser;
  read: boolean;
};

export type MarketplaceConversation = {
  id: string;
  listing: MarketplaceListingSummary;
  buyer: MarketplaceUser;
  seller: MarketplaceUser;
  otherUser: MarketplaceUser;
  lastMessage: MarketplaceMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};
