import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  cancelRankedQueue,
  enqueueAndMatch,
  fetchRankedMessages,
  getRankedStatusForUser,
  markRankedTimeout,
  updateRankedTyping,
  submitTypingTestAttempt,
  saveRankedTranscript,
  sendRankedMessage,
  updateRankedMessage,
  deleteRankedMessageById,
  smiteRankedOpponent,
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

const parseMatchId = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Match id is required");
  }
  return value.trim();
};

const parseMessageId = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Message id is required");
  }
  return value.trim();
};

const parseMessageBody = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Message body is required");
  }
  return value.trim();
};

const parseTypingAttempt = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Typing attempt is required");
  }
  return value;
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

export const getRankedMessages = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const result = await fetchRankedMessages(matchId, user.id);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const postRankedMessage = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const body = parseMessageBody(req.body?.body);
    const message = await sendRankedMessage({ matchId, senderId: user.id, body });
    res.status(201).json({ message });
  } catch (error) {
    handleError(res, error);
  }
};

export const patchRankedMessage = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const messageId = parseMessageId(req.params?.messageId);
    const body = parseMessageBody(req.body?.body);
    const message = await updateRankedMessage({ matchId, messageId, userId: user.id, body });
    res.json({ message });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteRankedMessage = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const messageId = parseMessageId(req.params?.messageId);
    await deleteRankedMessageById({ matchId, messageId, userId: user.id });
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
};

export const postRankedSave = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const result = await saveRankedTranscript(matchId, user.id);
    res.json({ savedAt: result.savedAt });
  } catch (error) {
    handleError(res, error);
  }
};

export const postRankedTimeout = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    await markRankedTimeout(matchId, user.id);
    res.json({ timedOut: true });
  } catch (error) {
    handleError(res, error);
  }
};

export const patchRankedTyping = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    await updateRankedTyping({ matchId, userId: user.id, body });
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
};

export const postRankedTypingTest = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const matchId = parseMatchId(req.params?.matchId);
    const attempt = parseTypingAttempt(req.body?.attempt);
    const result = await submitTypingTestAttempt({
      matchId,
      userId: user.id,
      attempt,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const postRankedSmite = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    if (!user.isAdmin) {
      throw new AuthError("Unauthorized", 403);
    }
    const matchId = parseMatchId(req.params?.matchId);
    await smiteRankedOpponent({ matchId, userId: user.id });
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
};
