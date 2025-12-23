import { Router } from "express";
import {
  getMessagesWithUser,
  postMessageToUser,
} from "../controllers/messageController";

const router = Router();

router.get("/with/:handle", getMessagesWithUser);
router.post("/with/:handle", postMessageToUser);

export default router;
