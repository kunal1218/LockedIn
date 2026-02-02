export type FriendLocation = {
  id: string;
  name: string;
  handle: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  profilePictureUrl?: string | null;
  bio?: string | null;
  previousLatitude?: number | null;
  previousLongitude?: number | null;
};
