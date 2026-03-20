import { Router, type IRouter } from "express";
import healthRouter from "./health";
import housesRouter from "./houses";
import clientsRouter from "./clients";
import profilesRouter from "./profiles";
import ledgerRouter from "./ledger";
import generateNoteRouter from "./generate-note";
import monthlyReportsRouter from "./monthly-reports";
import generateReportRouter from "./generate-report";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/houses", housesRouter);
router.use("/clients", clientsRouter);
router.use("/profiles", profilesRouter);
router.use("/ledger", ledgerRouter);
router.use("/generate-note", generateNoteRouter);
router.use("/monthly-reports", monthlyReportsRouter);
router.use("/generate-report", generateReportRouter);

export default router;
