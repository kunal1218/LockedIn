import { Router } from "express";
import { getAnswers, saveAnswers } from "../controllers/profileAnswersController";
import { getProfile, getPublicProfile } from "../controllers/profileController";

const router = Router();

router.get("/me", getProfile);
router.get("/public/:handle", getPublicProfile);
router.get("/answers", getAnswers);
router.post("/answers", saveAnswers);

export default router;
