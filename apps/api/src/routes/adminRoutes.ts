import { Router } from "express";
import { getChallengeAttemptsAdmin } from "../controllers/adminController";

const router = Router();

router.get("/attempts", getChallengeAttemptsAdmin);

export default router;
