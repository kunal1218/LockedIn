import { Router } from "express";
import {
  getRankedLeaderboardHandler,
  getRankedLeaderboardPublicHandler,
} from "../controllers/rankedController";

const router = Router();

router.get("/", getRankedLeaderboardHandler);
router.get("/public", getRankedLeaderboardPublicHandler);

export default router;
