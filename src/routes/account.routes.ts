import { Router } from "express";
import { createAccount } from "../controllers/account.controller";
import { getBalance } from "../controllers/balance.controller";
import { nameEnquiry } from "../controllers/name-enquiry.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/create", authenticate, createAccount);
router.get("/balance", authenticate, getBalance);
router.get("/name-enquiry/:accountNumber", authenticate, nameEnquiry);

export default router;
