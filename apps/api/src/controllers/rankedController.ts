import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  cancelRankedQueue,
  enqueueAndMatch,
  getRankedStatusForUser,
} from "../services/rankedService";

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
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Ranked error:", error);
  res.status(500).json({ error: "Unable to process ranked play" });
};

export const postRankedPlay = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const status = await enqueueAndMatch(user.id);
    res.json(status);
  } catch (error) {
    handleError(res, error);
  }
};

export const getRankedStatus = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const status = await getRankedStatusForUser(user.id);
    res.json(status);
  } catch (error) {
    handleError(res, error);
  }
};

export const postRankedCancel = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    await cancelRankedQueue(user.id);
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
};
