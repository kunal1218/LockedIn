export type Event = {
  id: number;
  title: string;
  description?: string | null;
  category: "study" | "social" | "build" | "sports" | "other";
  latitude: number;
  longitude: number;
  venue_name?: string | null;
  start_time: string;
  end_time: string;
  creator_id: string;
  max_attendees?: number | null;
  visibility: "public" | "friends-only";
  created_at: string;
  updated_at: string;
};

export type EventWithDetails = Event & {
  creator: {
    id: string;
    name: string;
    handle: string;
    profile_picture_url?: string | null;
  };
  attendee_count: number;
  attendees: Array<{
    id: string;
    name: string;
    handle: string;
    profile_picture_url?: string | null;
    status: "going" | "maybe";
    checked_in: boolean;
  }>;
  user_status?: "going" | "maybe" | "declined" | null;
  distance_km?: number | null;
};

export type CreateEventRequest = {
  title: string;
  description?: string;
  category: string;
  latitude: number;
  longitude: number;
  venue_name?: string;
  start_time: string;
  end_time: string;
  max_attendees?: number;
  visibility?: "public" | "friends-only";
};
