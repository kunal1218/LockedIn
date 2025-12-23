import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  readNotifications,
} from "../controllers/notificationController";

const router = Router();

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/read", readNotifications);

export default router;
