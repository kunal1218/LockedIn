import { Router } from "express";
import {
  getRequests,
  helpWithRequest,
  postRequest,
  likeRequest,
} from "../controllers/requestsController";

const router = Router();

router.get("/", getRequests);
router.post("/", postRequest);
router.post("/:requestId/help", helpWithRequest);
router.post("/:requestId/like", likeRequest);

export default router;
