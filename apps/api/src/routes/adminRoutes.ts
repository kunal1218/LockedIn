import { Router } from "express";
import {
  getChallengeAttemptsAdmin,
  grantUserCoins,
  updateUserBan,
} from "../controllers/adminController";

const router = Router();

router.get("/attempts", getChallengeAttemptsAdmin);
router.post("/users/:userId/ban", updateUserBan);
router.post("/users/:userId/coins", grantUserCoins);

export default router;
