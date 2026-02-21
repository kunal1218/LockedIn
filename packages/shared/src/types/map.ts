export type FriendLocation = {
  id: string;
  name: string;
  handle: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  isLive?: boolean;
  profilePictureUrl?: string | null;
  bio?: string | null;
  previousLatitude?: number | null;
  previousLongitude?: number | null;
};

export type PublicUserLocation = {
  userId: string;
  name: string;
  handle: string;
  profilePictureUrl?: string | null;
  bio?: string | null;
  collegeName?: string | null;
  collegeDomain?: string | null;
  latitude: number;
  longitude: number;
  mutualFriendsCount?: number | null;
  lastUpdated: string;
};
