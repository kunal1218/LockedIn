import { Router } from "express";
import {
  getFriendLocations,
  patchSettings,
  postLocation,
} from "../controllers/mapController";

const router = Router();

router.post("/location", postLocation);
router.get("/friends", getFriendLocations);
router.patch("/settings", patchSettings);

export default router;
