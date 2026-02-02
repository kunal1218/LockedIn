import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { ensureFriendTables } from "./friendService";
import { getSocketServer } from "./socketService";

export type EventCategory = "study" | "social" | "build" | "sports" | "other";
export type EventVisibility = "public" | "friends-only";
export type EventRsvpStatus = "going" | "maybe" | "declined";

export type EventRecord = {
  id: number;
  title: string;
  description: string | null;
  category: EventCategory;
  latitude: number;
  longitude: number;
  venue_name: string | null;
  start_time: string;
  end_time: string;
  creator_id: string;
  max_attendees: number | null;
  visibility: EventVisibility;
  created_at: string;
  updated_at: string;
};

export type EventDetails = EventRecord & {
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
  user_status?: EventRsvpStatus | null;
  distance_km?: number | null;
};

export type NearbyFilters = {
  category?: EventCategory | string;
  timeRange?: "today" | "this-week";
  friendsOnly?: boolean;
};

export type CreateEventInput = {
  title: string;
  description?: string | null;
  category: EventCategory | string;
  latitude: number;
  longitude: number;
  venue_name?: string | null;
  start_time: string;
  end_time: string;
  max_attendees?: number | null;
  visibility?: EventVisibility | string;
};

export class EventError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const VALID_CATEGORIES: EventCategory[] = [
  "study",
  "social",
  "build",
  "sports",
  "other",
];
const VALID_VISIBILITY: EventVisibility[] = ["public", "friends-only"];
const VALID_RSVP: EventRsvpStatus[] = ["going", "maybe", "declined"];
const LOCATION_RADIUS_METERS = 100;

const toIsoString = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const isValidCoordinate = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

const normalizeCategory = (value?: string | null): EventCategory | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_CATEGORIES.includes(normalized as EventCategory)
    ? (normalized as EventCategory)
    : null;
};

const normalizeVisibility = (value?: string | null): EventVisibility | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_VISIBILITY.includes(normalized as EventVisibility)
    ? (normalized as EventVisibility)
    : null;
};

const normalizeRsvp = (value?: string | null): EventRsvpStatus | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_RSVP.includes(normalized as EventRsvpStatus)
    ? (normalized as EventRsvpStatus)
    : null;
};

const distanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

let eventsTablesReady: Promise<void> | null = null;
let userLocationTableCache: Promise<boolean> | null = null;

const ensureEventsTables = async () => {
  if (eventsTablesReady) {
    return eventsTablesReady;
  }

  eventsTablesReady = (async () => {
    await ensureUsersTable();

    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id serial PRIMARY KEY,
        title varchar(200) NOT NULL,
        description text,
        category varchar(50) NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        venue_name varchar(200),
        start_time timestamptz NOT NULL,
        end_time timestamptz NOT NULL,
        creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        max_attendees integer,
        visibility varchar(20) NOT NULL DEFAULT 'public',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_events_location
        ON events (latitude, longitude);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_events_time
        ON events (start_time, end_time);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_events_creator
        ON events (creator_id);
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS event_attendees (
        id serial PRIMARY KEY,
        event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status varchar(20) NOT NULL,
        checked_in boolean NOT NULL DEFAULT false,
        checked_in_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(event_id, user_id)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_attendees_event
        ON event_attendees (event_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_attendees_user
        ON event_attendees (user_id);
    `);
  })();

  return eventsTablesReady;
};

const hasUserLocationTable = async () => {
  if (userLocationTableCache) {
    return userLocationTableCache;
  }

  userLocationTableCache = (async () => {
    try {
      const result = await db.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_name = 'user_locations'
         LIMIT 1`
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.warn("[events] unable to check user_locations table", error);
      return false;
    }
  })();

  return userLocationTableCache;
};

const mapEventRow = (row: {
  id: number;
  title: string;
  description: string | null;
  category: string;
  latitude: number | string;
  longitude: number | string;
  venue_name: string | null;
  start_time: string | Date;
  end_time: string | Date;
  creator_id: string;
  max_attendees: number | null;
  visibility: string;
  created_at: string | Date;
  updated_at: string | Date;
}): EventRecord => ({
  id: Number(row.id),
  title: row.title,
  description: row.description ?? null,
  category: normalizeCategory(row.category) ?? "other",
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  venue_name: row.venue_name ?? null,
  start_time: toIsoString(row.start_time),
  end_time: toIsoString(row.end_time),
  creator_id: row.creator_id,
  max_attendees: row.max_attendees ?? null,
  visibility: normalizeVisibility(row.visibility) ?? "public",
  created_at: toIsoString(row.created_at),
  updated_at: toIsoString(row.updated_at),
});

const buildFriendVisibility = (userParam: number) => {
  const param = `$${userParam}`;
  return {
    cte: `WITH friend_ids AS (
      SELECT
        CASE
          WHEN fr.requester_id = ${param} THEN fr.recipient_id
          ELSE fr.requester_id
        END AS friend_id
      FROM friend_requests fr
      WHERE fr.status = 'accepted'
        AND (fr.requester_id = ${param} OR fr.recipient_id = ${param})
    ),
    unblocked AS (
      SELECT friend_id
      FROM friend_ids f
      LEFT JOIN friend_blocks b1
        ON b1.blocker_id = ${param} AND b1.blocked_id = f.friend_id
      LEFT JOIN friend_blocks b2
        ON b2.blocker_id = f.friend_id AND b2.blocked_id = ${param}
      WHERE b1.blocker_id IS NULL AND b2.blocker_id IS NULL
    )`,
    join: "LEFT JOIN unblocked visibility_friends ON visibility_friends.friend_id = events.creator_id",
    condition: `(
      events.visibility = 'public'
      OR events.creator_id = ${param}
      OR visibility_friends.friend_id IS NOT NULL
    )`,
  };
};

const validateEventInput = (input: CreateEventInput) => {
  if (!input.title?.trim()) {
    throw new EventError("Title is required", 400);
  }

  const category = normalizeCategory(input.category);
  if (!category) {
    throw new EventError("Invalid category", 400);
  }

  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    throw new EventError("Valid latitude and longitude are required", 400);
  }

  const start = new Date(input.start_time);
  const end = new Date(input.end_time);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new EventError("Valid start_time and end_time are required", 400);
  }
  if (start >= end) {
    throw new EventError("end_time must be after start_time", 400);
  }

  const visibility = normalizeVisibility(input.visibility ?? "public");
  if (!visibility) {
    throw new EventError("Invalid visibility", 400);
  }

  const maxAttendees =
    input.max_attendees == null ? null : Number(input.max_attendees);
  if (maxAttendees != null && (!Number.isFinite(maxAttendees) || maxAttendees <= 0)) {
    throw new EventError("max_attendees must be a positive number", 400);
  }

  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category,
    latitude,
    longitude,
    venue_name: input.venue_name?.trim() || null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    max_attendees: maxAttendees,
    visibility,
  };
};

export const createEvent = async (userId: string, input: CreateEventInput) => {
  await ensureEventsTables();

  const validated = validateEventInput(input);

  const result = await db.query(
    `INSERT INTO events (
        title,
        description,
        category,
        latitude,
        longitude,
        venue_name,
        start_time,
        end_time,
        creator_id,
        max_attendees,
        visibility
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
    [
      validated.title,
      validated.description,
      validated.category,
      validated.latitude,
      validated.longitude,
      validated.venue_name,
      validated.start_time,
      validated.end_time,
      userId,
      validated.max_attendees,
      validated.visibility,
    ]
  );

  const event = mapEventRow(result.rows[0]);

  await db.query(
    `INSERT INTO event_attendees (event_id, user_id, status)
     VALUES ($1, $2, 'going')
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [event.id, userId]
  );

  return event;
};

export const getNearbyEvents = async (
  userId: string,
  latitude: number,
  longitude: number,
  radiusKm = 5,
  filters: NearbyFilters = {}
) => {
  await ensureEventsTables();
  await ensureFriendTables();

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!isValidCoordinate(lat, -90, 90) || !isValidCoordinate(lng, -180, 180)) {
    throw new EventError("Valid latitude and longitude are required", 400);
  }

  const normalizedRadius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 5;
  const category = normalizeCategory(filters.category ?? "");
  const visibilityFilter = filters.friendsOnly ? "friends-only" : null;

  const params: Array<string | number | boolean | null> = [
    lat,
    lng,
    userId,
    normalizedRadius,
  ];

  const latParam = 1;
  const lngParam = 2;
  const userParam = 3;
  const radiusParam = 4;

  const distanceExpr = `(
    6371 * 2 * ASIN(
      SQRT(
        POWER(SIN(RADIANS($${latParam} - events.latitude) / 2), 2) +
        COS(RADIANS(events.latitude)) *
          COS(RADIANS($${latParam})) *
          POWER(SIN(RADIANS($${lngParam} - events.longitude) / 2), 2)
      )
    )
  )`;

  const friendVisibility = buildFriendVisibility(userParam);

  const conditions: string[] = [
    `events.end_time > now()`,
    `${distanceExpr} <= $${radiusParam}`,
    friendVisibility.condition,
  ];

  if (category) {
    params.push(category);
    conditions.push(`events.category = $${params.length}`);
  }

  if (visibilityFilter) {
    params.push(visibilityFilter);
    conditions.push(`events.visibility = $${params.length}`);
  }

  if (filters.timeRange === "today") {
    conditions.push(
      `events.start_time < date_trunc('day', now()) + interval '1 day'`
    );
    conditions.push(`events.end_time >= date_trunc('day', now())`);
  }

  if (filters.timeRange === "this-week") {
    conditions.push(
      `events.start_time < date_trunc('week', now()) + interval '7 days'`
    );
    conditions.push(`events.end_time >= date_trunc('week', now())`);
  }

  const query = `
    ${friendVisibility.cte}
    SELECT
      events.*,
      ${distanceExpr} AS distance_km,
      counts.attendee_count,
      user_rsvp.status AS user_status
    FROM events
    ${friendVisibility.join}
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS attendee_count
      FROM event_attendees ea
      WHERE ea.event_id = events.id
        AND ea.status IN ('going', 'maybe')
    ) counts ON true
    LEFT JOIN event_attendees user_rsvp
      ON user_rsvp.event_id = events.id
      AND user_rsvp.user_id = $${userParam}
    WHERE ${conditions.join(" AND ")}
    ORDER BY distance_km ASC, events.start_time ASC
  `;

  const result = await db.query(query, params);

  return result.rows.map((row) => {
    const base = mapEventRow(row as EventRecord & { distance_km?: number });
    return {
      ...base,
      attendee_count: Number(row.attendee_count ?? 0),
      user_status: row.user_status ?? null,
      is_going: row.user_status === "going",
      distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    };
  });
};

export const getEventDetails = async (
  eventId: number,
  userId: string
): Promise<EventDetails> => {
  await ensureEventsTables();
  await ensureFriendTables();

  const friendVisibility = buildFriendVisibility(2);

  const eventResult = await db.query(
    `
    ${friendVisibility.cte}
    SELECT
      events.*,
      users.name AS creator_name,
      users.handle AS creator_handle,
      users.profile_picture_url AS creator_profile_picture_url
    FROM events
    JOIN users ON users.id = events.creator_id
    ${friendVisibility.join}
    WHERE events.id = $1
      AND ${friendVisibility.condition}
    LIMIT 1
  `,
    [eventId, userId]
  );

  if ((eventResult.rowCount ?? 0) === 0) {
    throw new EventError("Event not found", 404);
  }

  const eventRow = eventResult.rows[0] as {
    id: number;
    title: string;
    description: string | null;
    category: string;
    latitude: number | string;
    longitude: number | string;
    venue_name: string | null;
    start_time: string | Date;
    end_time: string | Date;
    creator_id: string;
    max_attendees: number | null;
    visibility: string;
    created_at: string | Date;
    updated_at: string | Date;
    creator_name: string;
    creator_handle: string;
    creator_profile_picture_url: string | null;
  };

  const base = mapEventRow(eventRow);

  const attendeesResult = await db.query(
    `SELECT
        users.id,
        users.name,
        users.handle,
        users.profile_picture_url,
        attendees.status,
        attendees.checked_in
      FROM event_attendees attendees
      JOIN users ON users.id = attendees.user_id
      WHERE attendees.event_id = $1
        AND attendees.status IN ('going', 'maybe')
      ORDER BY attendees.created_at ASC
      LIMIT 20`,
    [eventId]
  );

  const attendeeCountResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM event_attendees
     WHERE event_id = $1
       AND status IN ('going', 'maybe')`,
    [eventId]
  );

  const userStatusResult = await db.query(
    `SELECT status
     FROM event_attendees
     WHERE event_id = $1 AND user_id = $2
     LIMIT 1`,
    [eventId, userId]
  );

  let distanceKm: number | null = null;
  if (await hasUserLocationTable()) {
    const locationResult = await db.query(
      `SELECT latitude, longitude
       FROM user_locations
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    if ((locationResult.rowCount ?? 0) > 0) {
      const location = locationResult.rows[0] as {
        latitude: number | string;
        longitude: number | string;
      };
      const meters = distanceMeters(
        Number(location.latitude),
        Number(location.longitude),
        base.latitude,
        base.longitude
      );
      distanceKm = Number.isFinite(meters) ? meters / 1000 : null;
    }
  }

  return {
    ...base,
    creator: {
      id: eventRow.creator_id,
      name: eventRow.creator_name,
      handle: eventRow.creator_handle,
      profile_picture_url: eventRow.creator_profile_picture_url ?? null,
    },
    attendee_count: Number(attendeeCountResult.rows[0]?.count ?? 0),
    attendees: attendeesResult.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      handle: row.handle as string,
      profile_picture_url: row.profile_picture_url ?? null,
      status: row.status as "going" | "maybe",
      checked_in: Boolean(row.checked_in),
    })),
    user_status: (userStatusResult.rows[0]?.status as EventRsvpStatus) ?? null,
    distance_km: distanceKm,
  };
};

export const rsvpToEvent = async (
  eventId: number,
  userId: string,
  status: string
) => {
  await ensureEventsTables();

  const normalized = normalizeRsvp(status);
  if (!normalized) {
    throw new EventError("Invalid RSVP status", 400);
  }

  const eventResult = await db.query(
    `SELECT id, max_attendees
     FROM events
     WHERE id = $1
     LIMIT 1`,
    [eventId]
  );

  if ((eventResult.rowCount ?? 0) === 0) {
    throw new EventError("Event not found", 404);
  }

  const maxAttendees = eventResult.rows[0]?.max_attendees as number | null;
  if (normalized === "going" && maxAttendees != null) {
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM event_attendees
       WHERE event_id = $1 AND status = 'going'`,
      [eventId]
    );
    const currentCount = Number(countResult.rows[0]?.count ?? 0);

    const existingResult = await db.query(
      `SELECT status
       FROM event_attendees
       WHERE event_id = $1 AND user_id = $2
       LIMIT 1`,
      [eventId, userId]
    );
    const existingStatus = existingResult.rows[0]?.status as
      | EventRsvpStatus
      | undefined;

    if (existingStatus !== "going" && currentCount >= maxAttendees) {
      throw new EventError("This event is at capacity", 400);
    }
  }

  await db.query(
    `INSERT INTO event_attendees (event_id, user_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       checked_in = CASE WHEN EXCLUDED.status = 'going' THEN event_attendees.checked_in ELSE false END,
       checked_in_at = CASE WHEN EXCLUDED.status = 'going' THEN event_attendees.checked_in_at ELSE NULL END,
       updated_at = now()`,
    [eventId, userId, normalized]
  );

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM event_attendees
     WHERE event_id = $1 AND status IN ('going', 'maybe')`,
    [eventId]
  );

  const newAttendeeCount = Number(countResult.rows[0]?.count ?? 0);

  const io = getSocketServer();
  if (io) {
    io.to(`event-${eventId}`).emit("event-rsvp-update", {
      eventId,
      userId,
      status: normalized,
      newAttendeeCount,
    });
  }

  return { status: normalized, attendee_count: newAttendeeCount };
};

export const checkInToEvent = async (
  eventId: number,
  userId: string,
  userLat: number,
  userLng: number,
  userName: string
) => {
  await ensureEventsTables();

  const latitude = Number(userLat);
  const longitude = Number(userLng);
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    throw new EventError("Valid latitude and longitude are required", 400);
  }

  const eventResult = await db.query(
    `SELECT id, latitude, longitude, start_time, end_time
     FROM events
     WHERE id = $1
     LIMIT 1`,
    [eventId]
  );

  if ((eventResult.rowCount ?? 0) === 0) {
    throw new EventError("Event not found", 404);
  }

  const event = eventResult.rows[0] as {
    latitude: number | string;
    longitude: number | string;
    start_time: string | Date;
    end_time: string | Date;
  };

  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new EventError("Event time is invalid", 400);
  }
  if (now < start || now > end) {
    throw new EventError("Event is not active", 400);
  }

  const meters = distanceMeters(
    latitude,
    longitude,
    Number(event.latitude),
    Number(event.longitude)
  );
  if (meters > LOCATION_RADIUS_METERS) {
    throw new EventError("You must be within 100 meters to check in", 400);
  }

  const attendeeResult = await db.query(
    `SELECT status
     FROM event_attendees
     WHERE event_id = $1 AND user_id = $2
     LIMIT 1`,
    [eventId, userId]
  );

  if ((attendeeResult.rowCount ?? 0) === 0) {
    throw new EventError("RSVP required before check-in", 403);
  }

  const currentStatus = attendeeResult.rows[0]?.status as EventRsvpStatus;
  if (currentStatus === "declined") {
    throw new EventError("Cannot check in after declining", 403);
  }

  await db.query(
    `UPDATE event_attendees
     SET checked_in = true,
         checked_in_at = now(),
         updated_at = now()
     WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );

  const checkedInCountResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM event_attendees
     WHERE event_id = $1 AND checked_in = true`,
    [eventId]
  );

  const attendeesResult = await db.query(
    `SELECT
        users.id,
        users.name,
        users.handle,
        users.profile_picture_url,
        attendees.status,
        attendees.checked_in
      FROM event_attendees attendees
      JOIN users ON users.id = attendees.user_id
      WHERE attendees.event_id = $1
        AND attendees.status IN ('going', 'maybe')
      ORDER BY attendees.created_at ASC
      LIMIT 20`,
    [eventId]
  );

  const checkedInCount = Number(checkedInCountResult.rows[0]?.count ?? 0);

  const io = getSocketServer();
  if (io) {
    io.to(`event-${eventId}`).emit("event-checkin", {
      eventId,
      userId,
      userName,
      checkedInCount,
    });
  }

  return {
    checkedInCount,
    attendees: attendeesResult.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      handle: row.handle as string,
      profile_picture_url: row.profile_picture_url ?? null,
      status: row.status as "going" | "maybe",
      checked_in: Boolean(row.checked_in),
    })),
  };
};

export const getUserEvents = async (
  userId: string,
  filter: "upcoming" | "past" | "hosting" = "upcoming"
) => {
  await ensureEventsTables();

  const params: Array<string | number> = [userId];
  const conditions: string[] = [];

  if (filter === "hosting") {
    conditions.push(`events.creator_id = $1`);
  } else {
    conditions.push(`(events.creator_id = $1 OR attendee.user_id = $1)`);
  }

  if (filter === "upcoming") {
    conditions.push(`events.end_time > now()`);
  }

  if (filter === "past") {
    conditions.push(`events.end_time <= now()`);
  }

  const query = `
    SELECT
      events.*,
      counts.attendee_count,
      attendee.status AS user_status
    FROM events
    LEFT JOIN event_attendees attendee
      ON attendee.event_id = events.id AND attendee.user_id = $1
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS attendee_count
      FROM event_attendees ea
      WHERE ea.event_id = events.id
        AND ea.status IN ('going', 'maybe')
    ) counts ON true
    WHERE ${conditions.join(" AND ")}
    ORDER BY events.start_time ASC
  `;

  const result = await db.query(query, params);

  return result.rows.map((row) => ({
    ...mapEventRow(row as EventRecord),
    attendee_count: Number(row.attendee_count ?? 0),
    user_status: row.user_status ?? null,
  }));
};

export const updateEvent = async (
  eventId: number,
  userId: string,
  updates: Partial<CreateEventInput>
) => {
  await ensureEventsTables();

  const existingResult = await db.query(
    `SELECT *
     FROM events
     WHERE id = $1
     LIMIT 1`,
    [eventId]
  );

  if ((existingResult.rowCount ?? 0) === 0) {
    throw new EventError("Event not found", 404);
  }

  const existing = existingResult.rows[0] as {
    creator_id: string;
    title: string;
    description: string | null;
    category: string;
    latitude: number | string;
    longitude: number | string;
    venue_name: string | null;
    start_time: string | Date;
    end_time: string | Date;
    max_attendees: number | null;
    visibility: string;
  };

  if (existing.creator_id !== userId) {
    throw new EventError("Only the creator can update this event", 403);
  }

  const nextTitle = updates.title ?? existing.title;
  const nextDescription =
    updates.description != null ? updates.description : existing.description;
  const nextStart = updates.start_time ?? toIsoString(existing.start_time);
  const nextEnd = updates.end_time ?? toIsoString(existing.end_time);
  const maxAttendees =
    updates.max_attendees != null
      ? Number(updates.max_attendees)
      : existing.max_attendees;

  if (!nextTitle?.trim()) {
    throw new EventError("Title is required", 400);
  }

  const start = new Date(nextStart);
  const end = new Date(nextEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new EventError("Valid start_time and end_time are required", 400);
  }
  if (start >= end) {
    throw new EventError("end_time must be after start_time", 400);
  }

  if (maxAttendees != null && (!Number.isFinite(maxAttendees) || maxAttendees <= 0)) {
    throw new EventError("max_attendees must be a positive number", 400);
  }

  const updatedResult = await db.query(
    `UPDATE events
     SET title = $1,
         description = $2,
         start_time = $3,
         end_time = $4,
         max_attendees = $5,
         updated_at = now()
     WHERE id = $6
     RETURNING *`,
    [
      nextTitle.trim(),
      nextDescription?.trim() || null,
      start.toISOString(),
      end.toISOString(),
      maxAttendees ?? null,
      eventId,
    ]
  );

  return mapEventRow(updatedResult.rows[0]);
};

export const deleteEvent = async (eventId: number, userId: string) => {
  await ensureEventsTables();

  const result = await db.query(
    `DELETE FROM events
     WHERE id = $1 AND creator_id = $2`,
    [eventId, userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new EventError("Only the creator can delete this event", 403);
  }

  return { status: "ok" };
};

