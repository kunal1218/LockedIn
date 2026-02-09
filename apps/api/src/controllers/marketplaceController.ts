import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  MarketplaceError,
  createListing,
  deleteListing,
  getListingById,
  listListings,
  updateListing,
} from "../services/marketplaceService";

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

const asNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value);

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof MarketplaceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Marketplace error:", error);
  res.status(500).json({ error: "Unable to process marketplace request" });
};

export const getListings = async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : null;
    const search = typeof req.query.search === "string" ? req.query.search : null;
    const limit = asNumber(req.query.limit);
    const offset = asNumber(req.query.offset);

    const listings = await listListings({
      category,
      search,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });

    res.json({ listings });
  } catch (error) {
    handleError(res, error);
  }
};

export const getListing = async (req: Request, res: Response) => {
  try {
    const listingId = String(req.params.id ?? "").trim();
    if (!listingId) {
      throw new MarketplaceError("Listing id is required", 400);
    }

    const listing = await getListingById(listingId);
    res.json({ listing });
  } catch (error) {
    handleError(res, error);
  }
};

export const postListing = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);

    const listing = await createListing({
      userId: user.id,
      title: req.body?.title,
      description: req.body?.description,
      price: req.body?.price,
      category: req.body?.category,
      condition: req.body?.condition,
      location: req.body?.location,
      images: req.body?.images,
    });

    res.status(201).json({ listing });
  } catch (error) {
    handleError(res, error);
  }
};

export const putListing = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listingId = String(req.params.id ?? "").trim();
    if (!listingId) {
      throw new MarketplaceError("Listing id is required", 400);
    }

    const listing = await updateListing({
      id: listingId,
      userId: user.id,
      title: req.body?.title,
      description: req.body?.description,
      price: req.body?.price,
      category: req.body?.category,
      condition: req.body?.condition,
      location: req.body?.location,
      images: req.body?.images,
    });

    res.json({ listing });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteListingById = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listingId = String(req.params.id ?? "").trim();
    if (!listingId) {
      throw new MarketplaceError("Listing id is required", 400);
    }

    await deleteListing({ id: listingId, userId: user.id });
    res.json({ status: "deleted" });
  } catch (error) {
    handleError(res, error);
  }
};
