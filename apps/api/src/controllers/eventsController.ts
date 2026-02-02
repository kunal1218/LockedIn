import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  EventError,
  checkInToEvent,
  createEvent,
  deleteEvent,
  getEventDetails,
  getNearbyEvents,
  getUserEvents,
  rsvpToEvent,
  updateEvent,
} from "../services/eventsService";

const getToken = (req: Request) => {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

const requireUser = async (req: Request) => {
  const token = getToken(req);
  if (!token) {
    throw new AuthError("Missing session token", 401);
  }

  const user = await getUserFromToken(token);
  if (!user) {
    throw new AuthError("Invalid session", 401);
  }

  return user;
};

const asNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value);

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof EventError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Events error:", error);
  res.status(500).json({ error: "Unable to process events request" });
};

const normalizeEventPayload = (body: Request["body"]) => ({
  title: body?.title,
  description: body?.description,
  category: body?.category,
  latitude: body?.latitude,
  longitude: body?.longitude,
  venue_name: body?.venue_name ?? body?.venueName,
  start_time: body?.start_time ?? body?.startTime,
  end_time: body?.end_time ?? body?.endTime,
  max_attendees: body?.max_attendees ?? body?.maxAttendees,
  visibility: body?.visibility,
});

export const postEvent = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const payload = normalizeEventPayload(req.body);
    const event = await createEvent(user.id, payload);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const getNearby = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const latitude = asNumber(req.query.lat ?? req.query.latitude);
    const longitude = asNumber(req.query.lng ?? req.query.longitude);
    const radius =
      req.query.radiusKm != null
        ? Number(req.query.radiusKm)
        : req.query.radius != null
          ? Number(req.query.radius)
          : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const timeRange =
      req.query.timeRange === "today" || req.query.timeRange === "this-week"
        ? req.query.timeRange
        : undefined;
    const friendsOnly =
      req.query.friendsOnly === "true" || req.query.friendsOnly === "1";

    const events = await getNearbyEvents(user.id, latitude, longitude, radius, {
      category,
      timeRange,
      friendsOnly,
    });

    res.json(events);
  } catch (error) {
    handleError(res, error);
  }
};

export const getEvent = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
      throw new EventError("Invalid event id", 400);
    }

    const event = await getEventDetails(eventId, user.id);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const postRsvp = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
      throw new EventError("Invalid event id", 400);
    }

    const status = req.body?.status as string | undefined;
    const result = await rsvpToEvent(eventId, user.id, status ?? "");
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const postCheckIn = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
      throw new EventError("Invalid event id", 400);
    }

    const latitude = asNumber(req.body?.latitude);
    const longitude = asNumber(req.body?.longitude);

    const result = await checkInToEvent(
      eventId,
      user.id,
      latitude,
      longitude,
      user.name
    );
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const getMine = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const filter =
      req.query.filter === "past" || req.query.filter === "hosting"
        ? req.query.filter
        : "upcoming";
    const events = await getUserEvents(user.id, filter);
    res.json(events);
  } catch (error) {
    handleError(res, error);
  }
};

export const patchEvent = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
      throw new EventError("Invalid event id", 400);
    }

    const updates = normalizeEventPayload(req.body);
    const event = await updateEvent(eventId, user.id, updates);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteEventById = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId)) {
      throw new EventError("Invalid event id", 400);
    }

    const result = await deleteEvent(eventId, user.id);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

