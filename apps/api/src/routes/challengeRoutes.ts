import { Router } from "express";
import {
  getDailyChallenge,
  postChallengeAttempt,
} from "../controllers/challengeController";

const router = Router();

router.get("/today", getDailyChallenge);
router.post("/attempts", postChallengeAttempt);

export default router;
