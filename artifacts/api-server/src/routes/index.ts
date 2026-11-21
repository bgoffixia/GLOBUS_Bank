import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bankRouter from "./bank";
import bankAdminRouter from "./bankAdmin";
import bankFinanceWorkspaceRouter from "./bankFinanceWorkspace";
import bankPersonalFinanceRouter from "./bankPersonalFinance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bankRouter);
router.use(bankFinanceWorkspaceRouter);
router.use(bankPersonalFinanceRouter);
router.use(bankAdminRouter);

export default router;
