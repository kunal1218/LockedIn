import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  NotificationError,
  fetchNotificationsForUser,
  fetchUnreadNotificationCount,
  markNotificationsRead,
} from "../services/notificationService";

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

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof NotificationError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Notification error:", error);
  res.status(500).json({ error: "Unable to process notifications" });
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const notifications = await fetchNotificationsForUser(user.id);
    res.json({ notifications });
  } catch (error) {
    handleError(res, error);
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const count = await fetchUnreadNotificationCount(user.id);
    res.json({ count });
  } catch (error) {
    handleError(res, error);
  }
};

export const readNotifications = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    await markNotificationsRead(user.id);
    res.json({ status: "ok" });
  } catch (error) {
    handleError(res, error);
  }
};
