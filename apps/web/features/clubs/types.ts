export type ClubCategory =
  | "social"
  | "study"
  | "build"
  | "sports"
  | "creative"
  | "wellness";

export type Club = {
  id: string;
  title: string;
  description: string;
  category: ClubCategory;
  city: string | null;
  location: string;
  isRemote: boolean;
  distanceKm?: number | null;
  memberCount: number;
  createdAt: string;
  imageUrl?: string | null;
  creator: {
    id: string;
    name: string;
    handle: string;
  };
  joinedByUser?: boolean;
};

export type ClubComposerPayload = {
  title: string;
  description: string;
  category: ClubCategory;
  city: string | null;
  isRemote: boolean;
  imageUrl?: string | null;
};
