import { Router } from "express";
import {
  deleteListingImageById,
  deleteListingById,
  getListing,
  getListings,
  getMyListings,
  patchListingStatus,
  postListingImages,
  postListing,
  putListing,
} from "../controllers/marketplaceController";
import type { NextFunction, Request, Response } from "express";
import { marketplaceImageUpload, MAX_MARKETPLACE_IMAGES } from "../middleware/upload";

const router = Router();

const handleListingImageUpload = (req: Request, res: Response, next: NextFunction) => {
  marketplaceImageUpload.array("images", MAX_MARKETPLACE_IMAGES)(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message ?? "Unable to upload images" });
      return;
    }
    next();
  });
};

router.get("/listings", getListings);
router.get("/listings/:id", getListing);
router.get("/my-listings", getMyListings);
router.post("/listings", postListing);
router.put("/listings/:id", putListing);
router.patch("/listings/:id/status", patchListingStatus);
router.delete("/listings/:id", deleteListingById);
router.post(
  "/listings/:id/images",
  handleListingImageUpload,
  postListingImages
);
router.delete("/listings/:id/images", deleteListingImageById);

export default router;
