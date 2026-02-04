import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  ChallengeAttemptError,
  createChallengeAttempt,
  fetchChallengeAttemptsByChallengeId,
} from "../services/challengeAttemptService";
import { fetchDailyChallenge } from "../services/challengeService";

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

const getOptionalUser = async (req: Request) => {
  const token = getToken(req);
  if (!token) {
    return null;
  }

  try {
    return await getUserFromToken(token);
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof ChallengeAttemptError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Challenge error:", error);
  res.status(500).json({ error: "Unable to process challenge attempt" });
};

export const getDailyChallenge = async (_req: Request, res: Response) => {
  const challenge = await fetchDailyChallenge();
  res.json(challenge);
};

export const postChallengeAttempt = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const challenge = await fetchDailyChallenge();
    const imageData = asString(req.body?.imageData);

    const attempt = await createChallengeAttempt({
      userId: user.id,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      imageData,
    });

    res.status(201).json(attempt);
  } catch (error) {
    handleError(res, error);
  }
};

export const getChallengeAttempts = async (req: Request, res: Response) => {
  const challengeId = asString(req.query?.challengeId).trim();
  if (!challengeId) {
    res.status(400).json({ error: "Challenge ID is required" });
    return;
  }

  try {
    const viewer = await getOptionalUser(req);
    const submissions = await fetchChallengeAttemptsByChallengeId(challengeId);
    if (!viewer?.isAdmin) {
      submissions.forEach((submission) => {
        submission.user.email = "";
      });
    }
    res.json({ submissions });
  } catch (error) {
    handleError(res, error);
  }
};
