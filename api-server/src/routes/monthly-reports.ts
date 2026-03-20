import { Router, type IRouter } from "express";
import { db, monthlyReportsTable, insertMonthlyReportSchema } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { clientId } = req.query as Record<string, string | undefined>;
    const conditions = [];
    if (clientId) conditions.push(eq(monthlyReportsTable.clientId, clientId));

    const reports = await db
      .select()
      .from(monthlyReportsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(monthlyReportsTable.createdAt);

    res.json(
      reports.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        month: r.month,
        reportText: r.reportText,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch monthly reports" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = insertMonthlyReportSchema.parse(req.body);
    const [report] = await db
      .insert(monthlyReportsTable)
      .values({
        clientId: body.clientId,
        month: body.month,
        reportText: body.reportText,
        createdBy: body.createdBy,
      })
      .returning();

    res.status(201).json({
      id: report.id,
      clientId: report.clientId,
      month: report.month,
      reportText: report.reportText,
      createdBy: report.createdBy,
      createdAt: report.createdAt.toISOString(),
    });
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [report] = await db
      .select()
      .from(monthlyReportsTable)
      .where(eq(monthlyReportsTable.id, id));

    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.json({
      id: report.id,
      clientId: report.clientId,
      month: report.month,
      reportText: report.reportText,
      createdBy: report.createdBy,
      createdAt: report.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

export default router;
