import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  MessageError,
  fetchDirectMessages,
  getMessageUserByHandle,
  sendDirectMessage,
  updateDirectMessage,
  deleteDirectMessage,
} from "../services/messageService";
import { markMessageNotificationsRead } from "../services/notificationService";

const asString = (value: unknown) => (typeof value === "string" ? value : "");

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

const requireHandle = (value: unknown) => {
  const handle = asString(value).trim();
  if (!handle) {
    throw new MessageError("Handle is required", 400);
  }
  return handle;
};

const parseMessageBody = (value: unknown) => {
  const body = asString(value).trim();
  if (!body) {
    throw new MessageError("Message body is required", 400);
  }
  return body;
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof MessageError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Message error:", error);
  res.status(500).json({ error: "Unable to process messages" });
};

export const getMessagesWithUser = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const otherUser = await getMessageUserByHandle(handle);
    const messages = await fetchDirectMessages(user.id, otherUser.id);
    await markMessageNotificationsRead(user.id, otherUser.id);
    res.json({ user: otherUser, messages });
  } catch (error) {
    handleError(res, error);
  }
};

export const postMessageToUser = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const body = parseMessageBody(req.body?.body);
    const otherUser = await getMessageUserByHandle(handle);
    const message = await sendDirectMessage({
      senderId: user.id,
      recipientId: otherUser.id,
      body,
    });
    res.status(201).json({ message });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateMessage = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const messageId = asString(req.params?.messageId);
    const body = parseMessageBody(req.body?.body);
    if (!messageId) {
      throw new MessageError("Message id is required", 400);
    }
    const message = await updateDirectMessage({ messageId, userId: user.id, body });
    res.json({ message });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const messageId = asString(req.params?.messageId);
    if (!messageId) {
      throw new MessageError("Message id is required", 400);
    }
    await deleteDirectMessage({ messageId, userId: user.id });
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
};
