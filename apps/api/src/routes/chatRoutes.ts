import { Router } from "express";
import { getChatMessages } from "../controllers/chatController";

const router = Router();

router.get("/", getChatMessages);

export default router;
