import { Router } from "express";
import { getChallengeAttemptsAdmin, updateUserBan } from "../controllers/adminController";

const router = Router();

router.get("/attempts", getChallengeAttemptsAdmin);
router.post("/users/:userId/ban", updateUserBan);

export default router;
