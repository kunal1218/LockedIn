import { Router } from "express";
import {
  getMessagesWithUser,
  postMessageToUser,
  updateMessage,
  deleteMessage,
} from "../controllers/messageController";

const router = Router();

router.get("/with/:handle", getMessagesWithUser);
router.post("/with/:handle", postMessageToUser);
router.patch("/:messageId", updateMessage);
router.delete("/:messageId", deleteMessage);

export default router;
