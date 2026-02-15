import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  MarketplaceError,
  createListing,
  deleteListing,
  deleteListingImage,
  getListingById,
  getUserListings,
  listListings,
  updateListingStatus,
  uploadListingImages,
  updateListing,
} from "../services/marketplaceService";
import { MARKETPLACE_UPLOAD_ROOT } from "../middleware/upload";

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

const buildImageUrl = (_req: Request, filename: string) =>
  `/uploads/marketplace/${filename}`;

const resolveImageUrl = (req: Request, url: string) => {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  const host = req.get("x-forwarded-host") ?? req.get("host");
  const protocol = req.get("x-forwarded-proto") ?? req.protocol;
  if (!host) {
    return normalized;
  }
  return `${protocol}://${host}${normalized}`;
};

const withAbsoluteImages = <T extends { images?: string[] }>(req: Request, listing: T) => ({
  ...listing,
  images: (listing.images ?? []).map((image) => resolveImageUrl(req, image)),
});

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

    res.json({ listings: listings.map((listing) => withAbsoluteImages(req, listing)) });
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
    res.json({ listing: withAbsoluteImages(req, listing) });
  } catch (error) {
    handleError(res, error);
  }
};

export const getMyListings = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listings = await getUserListings(user.id);
    res.json({ listings: listings.map((listing) => withAbsoluteImages(req, listing)) });
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

    res.status(201).json({ listing: withAbsoluteImages(req, listing) });
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

    res.json({ listing: withAbsoluteImages(req, listing) });
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

    await deleteListing({ id: listingId, userId: user.id, isAdmin: user.isAdmin });
    res.json({ status: "deleted" });
  } catch (error) {
    handleError(res, error);
  }
};

export const patchListingStatus = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listingId = String(req.params.id ?? "").trim();
    if (!listingId) {
      throw new MarketplaceError("Listing id is required", 400);
    }

    const status = typeof req.body?.status === "string" ? req.body.status : "";
    const listing = await updateListingStatus({
      id: listingId,
      userId: user.id,
      status,
    });

    res.json({ listing: withAbsoluteImages(req, listing) });
  } catch (error) {
    handleError(res, error);
  }
};

export const postListingImages = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listingId = String(req.params.id ?? "").trim();
    if (!listingId) {
      throw new MarketplaceError("Listing id is required", 400);
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) {
      throw new MarketplaceError("No images uploaded", 400);
    }

    const imageUrls = files.map((file) => buildImageUrl(req, file.filename));
    const listing = await uploadListingImages({
      id: listingId,
      userId: user.id,
      imageUrls,
    });

    res.status(201).json({
      images: (listing.images ?? []).map((image) => resolveImageUrl(req, image)),
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteListingImageById = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listingId = String(req.params.id ?? "").trim();
    if (!listingId) {
      throw new MarketplaceError("Listing id is required", 400);
    }

    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
    const listing = await deleteListingImage({
      id: listingId,
      userId: user.id,
      imageUrl,
    });

    if (imageUrl) {
      const normalizedPath = (() => {
        if (imageUrl.startsWith("/uploads/")) {
          return imageUrl;
        }
        try {
          return new URL(imageUrl).pathname;
        } catch {
          return "";
        }
      })();

      if (normalizedPath.startsWith("/uploads/marketplace/")) {
        const fileName = path.basename(normalizedPath);
        const filePath = path.join(MARKETPLACE_UPLOAD_ROOT, fileName);
        fs.promises.unlink(filePath).catch(() => null);
      }
    }

    res.json({
      images: (listing.images ?? []).map((image) => resolveImageUrl(req, image)),
    });
  } catch (error) {
    handleError(res, error);
  }
};
