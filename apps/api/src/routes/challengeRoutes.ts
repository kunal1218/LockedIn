import { Router } from "express";
import {
  getDailyChallenge,
  getChallengeAttempts,
  postChallengeAttempt,
} from "../controllers/challengeController";

const router = Router();

router.get("/today", getDailyChallenge);
router.get("/attempts", getChallengeAttempts);
router.post("/attempts", postChallengeAttempt);

export default router;
