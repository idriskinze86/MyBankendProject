import { Router } from "express";
import {
  getTransactionHistory,
  getTransactionStatus,
} from "../controllers/transaction.controller";
import {
  intraBankTransfer,
  interBankTransfer,
} from "../controllers/transfer.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, getTransactionHistory);
router.get("/:reference", authenticate, getTransactionStatus);
router.post("/transfer", authenticate, intraBankTransfer);
router.post("/inter-bank", authenticate, interBankTransfer);

export default router;
