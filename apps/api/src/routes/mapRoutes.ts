import { Router } from "express";
import {
  getFriendLocations,
  getPublicNearby,
  patchSettings,
  postLocation,
} from "../controllers/mapController";

const router = Router();

router.post("/location", postLocation);
router.get("/friends", getFriendLocations);
router.get("/public-nearby", getPublicNearby);
router.patch("/settings", patchSettings);

export default router;
