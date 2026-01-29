import { Router } from "express";
import {
  getRequests,
  helpWithRequest,
  unhelpWithRequest,
  postRequest,
  likeRequest,
  removeRequest,
} from "../controllers/requestsController";

const router = Router();

router.get("/", getRequests);
router.post("/", postRequest);
router.post("/:requestId/help", helpWithRequest);
router.delete("/:requestId/help", unhelpWithRequest);
router.post("/:requestId/like", likeRequest);
router.delete("/:requestId", removeRequest);

export default router;
