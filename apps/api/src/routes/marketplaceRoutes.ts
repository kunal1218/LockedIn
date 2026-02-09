import { Router } from "express";
import {
  deleteListingById,
  getListing,
  getListings,
  postListing,
  putListing,
} from "../controllers/marketplaceController";

const router = Router();

router.get("/listings", getListings);
router.get("/listings/:id", getListing);
router.post("/listings", postListing);
router.put("/listings/:id", putListing);
router.delete("/listings/:id", deleteListingById);

export default router;
