import { Router } from "express";
import { getDailyChallenge } from "../controllers/challengeController";

const router = Router();

router.get("/today", getDailyChallenge);

export default router;
