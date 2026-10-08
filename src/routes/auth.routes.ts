import { Router } from "express";
import { onboardCustomer } from "../controllers/auth.controller";
import { login } from "../controllers/auth-login.controller";

const router = Router();

router.post("/onboard", onboardCustomer);
router.post("/login", login);

export default router;
