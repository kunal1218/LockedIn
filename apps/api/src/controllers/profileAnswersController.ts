import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  getProfileAnswers,
  upsertProfileAnswers,
} from "../services/profileAnswersService";

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

const parseAnswers = (body: Request["body"]) => {
  const career = asString(body?.career).trim();
  const memory = asString(body?.memory).trim();
  const when = asString(body?.madlib?.when).trim();
  const focus = asString(body?.madlib?.focus).trim();
  const action = asString(body?.madlib?.action).trim();

  if (!career || !memory || !when || !focus || !action) {
    throw new AuthError("All profile questions are required", 400);
  }

  return {
    career,
    madlib: { when, focus, action },
    memory,
  };
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Profile answers error:", error);
  res.status(500).json({ error: "Unable to save profile answers" });
};

export const getAnswers = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const answers = await getProfileAnswers(user.id);
    res.json({ answers });
  } catch (error) {
    handleError(res, error);
  }
};

export const saveAnswers = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const answers = parseAnswers(req.body);
    const saved = await upsertProfileAnswers(user.id, answers);
    res.json({ answers: saved });
  } catch (error) {
    handleError(res, error);
  }
};
