import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  ClubError,
  createClub,
  decideClubApplication,
  fetchClubs,
  joinClub,
  leaveClub,
} from "../services/clubsService";

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
  const user = await getUserFromToken(token);
  if (!user) {
    throw new AuthError("Invalid session", 401);
  }
  return user;
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof ClubError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Clubs error:", error);
  res.status(500).json({ error: "Unable to process clubs request" });
};

export const getClubs = async (req: Request, res: Response) => {
  try {
    const user = await getOptionalUser(req);
    const limit =
      typeof req.query?.limit === "string" ? Number(req.query.limit) : undefined;
    const clubs = await fetchClubs({
      viewerId: user?.id ?? null,
      limit: Number.isFinite(limit ?? Number.NaN) ? limit : undefined,
    });
    res.json({ clubs });
  } catch (error) {
    handleError(res, error);
  }
};

export const postClub = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const payload = req.body ?? {};
    const club = await createClub({
      creatorId: user.id,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      location: payload.location,
      city: payload.city ?? payload.location,
      isRemote: payload.isRemote ?? payload.is_remote,
      joinPolicy: payload.joinPolicy ?? payload.join_policy,
      imageUrl: payload.imageUrl ?? payload.image_url,
    });
    res.json({ club });
  } catch (error) {
    handleError(res, error);
  }
};

export const postClubJoin = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const clubId = String(req.params.clubId ?? "");
    if (!clubId) {
      throw new ClubError("Club id is required.", 400);
    }
    const result = await joinClub({ clubId, userId: user.id });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const postClubLeave = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const clubId = String(req.params.clubId ?? "");
    if (!clubId) {
      throw new ClubError("Club id is required.", 400);
    }
    const result = await leaveClub({ clubId, userId: user.id });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const postClubApplicationDecision = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const clubId = String(req.params.clubId ?? "");
    const applicantId = String(req.params.applicantId ?? "");
    const decision =
      req.params.decision === "approve"
        ? "approve"
        : req.params.decision === "deny"
          ? "deny"
          : (req.body?.decision as "approve" | "deny" | undefined);

    if (!clubId || !applicantId) {
      throw new ClubError("Missing club or applicant id.", 400);
    }
    if (!decision || (decision !== "approve" && decision !== "deny")) {
      throw new ClubError("Invalid decision.", 400);
    }

    const result = await decideClubApplication({
      clubId,
      applicantId,
      ownerId: user.id,
      decision,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};
