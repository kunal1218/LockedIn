import { Router } from "express";
import { getRankedLeaderboardHandler } from "../controllers/rankedController";

const router = Router();

router.get("/", getRankedLeaderboardHandler);

export default router;
