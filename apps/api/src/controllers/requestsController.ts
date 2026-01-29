import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  RequestError,
  createRequest,
  fetchRequests,
  toggleRequestLike,
  recordHelpOffer,
  deleteRequest,
} from "../services/requestsService";

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
  return getUserFromToken(token);
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof RequestError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Request error:", error);
  res.status(500).json({ error: "Unable to process request" });
};

export const getRequests = async (_req: Request, res: Response) => {
  try {
    const sinceHoursRaw = _req.query?.sinceHours;
    const order = _req.query?.order === "oldest" ? "oldest" : "newest";
    const sinceHours =
      typeof sinceHoursRaw === "string" ? parseFloat(sinceHoursRaw) : undefined;
    const viewer = await getOptionalUser(_req);
    const requests = await fetchRequests({
      sinceHours: Number.isFinite(sinceHours) ? sinceHours : undefined,
      order,
      viewerId: viewer?.id ?? null,
    });
    res.json({ requests });
  } catch (error) {
    handleError(res, error);
  }
};

export const postRequest = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const request = await createRequest({
      creatorId: user.id,
      title: req.body?.title,
      description: req.body?.description,
      location: req.body?.location,
      city: req.body?.city,
      isRemote: Boolean(req.body?.isRemote),
      tags: req.body?.tags ?? [],
      urgency: req.body?.urgency,
    });
    res.status(201).json({ request });
  } catch (error) {
    handleError(res, error);
  }
};

export const helpWithRequest = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const requestId = asString(req.params?.requestId);
    if (!requestId) {
      throw new RequestError("Request id is required", 400);
    }
    await recordHelpOffer({ requestId, helperId: user.id });
    res.status(201).json({ status: "notified" });
  } catch (error) {
    handleError(res, error);
  }
};

export const likeRequest = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const requestId = asString(req.params?.requestId);
    if (!requestId) {
      throw new RequestError("Request id is required", 400);
    }
    const result = await toggleRequestLike({
      requestId,
      userId: user.id,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const removeRequest = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const requestId = asString(req.params?.requestId);
    if (!requestId) {
      throw new RequestError("Request id is required", 400);
    }
    await deleteRequest({ requestId, userId: user.id });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
};
