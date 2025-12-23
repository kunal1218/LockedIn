import { Router } from "express";
import { getAnswers, saveAnswers } from "../controllers/profileAnswersController";
import {
  getProfile,
  getProfileLayout,
  getPublicProfile,
  saveProfileLayoutHandler,
} from "../controllers/profileController";

const router = Router();

router.get("/me", getProfile);
router.get("/public/:handle", getPublicProfile);
router.get("/layout", getProfileLayout);
router.post("/layout", saveProfileLayoutHandler);
router.get("/answers", getAnswers);
router.post("/answers", saveAnswers);

export default router;
