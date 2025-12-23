import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  ChallengeAttemptError,
  fetchChallengeAttempts,
} from "../services/challengeAttemptService";

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

const requireAdmin = async (req: Request) => {
  const user = await requireUser(req);
  if (!user.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof ChallengeAttemptError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Admin error:", error);
  res.status(500).json({ error: "Unable to load admin dashboard" });
};

export const getChallengeAttemptsAdmin = async (req: Request, res: Response) => {
  try {
    await requireAdmin(req);
    const submissions = await fetchChallengeAttempts();
    res.json({ submissions });
  } catch (error) {
    handleError(res, error);
  }
};
