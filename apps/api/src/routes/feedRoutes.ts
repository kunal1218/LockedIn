import { Router } from "express";
import {
  createComment,
  createFeedPost,
  deleteFeedComment,
  deleteFeedPost,
  getComments,
  getFeed,
  getPost,
  likeFeedComment,
  likeFeedPost,
  updateFeedComment,
  updateFeedPost,
} from "../controllers/feedController";

const router = Router();

router.get("/", getFeed);
router.post("/", createFeedPost);

router.get("/:postId/comments", getComments);
router.post("/:postId/comments", createComment);
router.patch("/comments/:commentId", updateFeedComment);
router.delete("/comments/:commentId", deleteFeedComment);
router.post("/comments/:commentId/like", likeFeedComment);
router.post("/:postId/like", likeFeedPost);

router.get("/:postId", getPost);
router.patch("/:postId", updateFeedPost);
router.delete("/:postId", deleteFeedPost);

export default router;
