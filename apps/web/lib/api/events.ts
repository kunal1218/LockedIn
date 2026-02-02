import type { CreateEventRequest, EventWithDetails } from "@lockedin/shared";
import { apiGet, apiPost } from "@/lib/api";

const STORAGE_KEY = "lockedin_auth";

const readToken = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? "";
  } catch {
    return "";
  }
};

export const getNearbyEvents = async (
  latitude: number,
  longitude: number,
  radiusKm = 5,
  token?: string
): Promise<EventWithDetails[]> => {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusKm),
  });
  return apiGet<EventWithDetails[]>(
    `/events/nearby?${params.toString()}`,
    token ?? readToken()
  );
};

export const getEventDetails = async (
  eventId: number,
  token?: string
): Promise<EventWithDetails> =>
  apiGet<EventWithDetails>(`/events/${eventId}`, token ?? readToken());

export const rsvpToEvent = async (
  eventId: number,
  status: "going" | "maybe" | "declined",
  token?: string
) =>
  apiPost<void>(
    `/events/${eventId}/rsvp`,
    { status },
    token ?? readToken()
  );

export const createEvent = async (
  payload: CreateEventRequest,
  token?: string
): Promise<EventWithDetails> =>
  apiPost<EventWithDetails>("/events", payload, token ?? readToken());
