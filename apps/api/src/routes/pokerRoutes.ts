import { Router } from "express";
import { postPokerBuyIn } from "../controllers/pokerController";

const router = Router();

router.post("/buy-in", postPokerBuyIn);

export default router;
