import { Router } from "express";
import {
  getRequests,
  helpWithRequest,
  postRequest,
} from "../controllers/requestsController";

const router = Router();

router.get("/", getRequests);
router.post("/", postRequest);
router.post("/:requestId/help", helpWithRequest);

export default router;
