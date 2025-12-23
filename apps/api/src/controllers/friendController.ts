import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  FriendError,
  acceptFriendRequest,
  blockUser,
  createFriendRequest,
  fetchFriendSummary,
  getRelationshipStatus,
  getUserByHandle,
  removeFriendRequest,
  removeFriendship,
  unblockUser,
} from "../services/friendService";

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
    throw new FriendError("Handle is required", 400);
  }
  return handle;
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof FriendError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Friend error:", error);
  res.status(500).json({ error: "Unable to process friend request" });
};

export const getFriendSummary = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const summary = await fetchFriendSummary(user.id);
    res.json(summary);
  } catch (error) {
    handleError(res, error);
  }
};

export const getRelationship = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const target = await getUserByHandle(handle);
    const status = await getRelationshipStatus(user.id, target.id);
    res.json({ status });
  } catch (error) {
    handleError(res, error);
  }
};

export const requestFriend = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.body?.handle);
    const target = await getUserByHandle(handle);
    await createFriendRequest({ requesterId: user.id, recipientId: target.id });
    res.status(201).json({ status: "pending" });
  } catch (error) {
    handleError(res, error);
  }
};

export const acceptFriend = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const target = await getUserByHandle(handle);
    await acceptFriendRequest({ requesterId: target.id, recipientId: user.id });
    res.json({ status: "friends" });
  } catch (error) {
    handleError(res, error);
  }
};

export const removePendingFriend = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const target = await getUserByHandle(handle);
    await removeFriendRequest({ userId: user.id, otherUserId: target.id });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
};

export const removeFriend = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const target = await getUserByHandle(handle);
    await removeFriendship({ userId: user.id, otherUserId: target.id });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
};

export const blockFriend = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const target = await getUserByHandle(handle);
    await blockUser({ blockerId: user.id, blockedId: target.id });
    res.json({ status: "blocked" });
  } catch (error) {
    handleError(res, error);
  }
};

export const unblockFriend = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const handle = requireHandle(req.params?.handle);
    const target = await getUserByHandle(handle);
    await unblockUser({ blockerId: user.id, blockedId: target.id });
    res.json({ status: "none" });
  } catch (error) {
    handleError(res, error);
  }
};
