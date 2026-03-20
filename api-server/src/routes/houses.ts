import { Router, type IRouter } from "express";
import { db, housesTable, ledgerTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateHouseBody,
  UpdateHouseBody,
  UpdateHouseParams,
  DeleteHouseParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatHouse(h: typeof housesTable.$inferSelect) {
  return {
    id: h.id,
    name: h.name,
    managerName: h.managerName,
    bedCount: h.bedCount,
    createdAt: h.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  try {
    const houses = await db.select().from(housesTable).orderBy(housesTable.createdAt);
    res.json(houses.map(formatHouse));
  } catch {
    res.status(500).json({ error: "Failed to fetch houses" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [house] = await db.select().from(housesTable).where(eq(housesTable.id, req.params.id));
    if (!house) { res.status(404).json({ error: "House not found" }); return; }
    res.json(formatHouse(house));
  } catch {
    res.status(500).json({ error: "Failed to fetch house" });
  }
});

router.get("/:id/stats", async (req, res) => {
  try {
    const [house] = await db.select().from(housesTable).where(eq(housesTable.id, req.params.id));
    if (!house) { res.status(404).json({ error: "House not found" }); return; }

    const entries = await db
      .select({
        id: ledgerTable.id,
        clientId: ledgerTable.clientId,
        clientName: clientsTable.name,
        duration: ledgerTable.duration,
        startTime: ledgerTable.startTime,
        endTime: ledgerTable.endTime,
        noteType: ledgerTable.noteType,
        createdAt: ledgerTable.createdAt,
      })
      .from(ledgerTable)
      .leftJoin(clientsTable, eq(ledgerTable.clientId, clientsTable.id))
      .where(eq(ledgerTable.house, house.name))
      .orderBy(ledgerTable.createdAt);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let dailyMins = 0, weeklyMins = 0, monthlyMins = 0;
    const clientMap = new Map<string, { name: string; daily: number; weekly: number; monthly: number }>();

    for (const e of entries) {
      const created = new Date(e.createdAt);
      const mins = e.duration;
      const clientName = e.clientName ?? "Unknown";

      if (created >= startOfToday) dailyMins += mins;
      if (created >= startOfWeek) weeklyMins += mins;
      if (created >= startOfMonth) monthlyMins += mins;

      if (!clientMap.has(e.clientId)) {
        clientMap.set(e.clientId, { name: clientName, daily: 0, weekly: 0, monthly: 0 });
      }
      const c = clientMap.get(e.clientId)!;
      if (created >= startOfToday) c.daily += mins;
      if (created >= startOfWeek) c.weekly += mins;
      if (created >= startOfMonth) c.monthly += mins;
    }

    const toHours = (mins: number) => Math.round((mins / 60) * 10) / 10;

    const clientBreakdown = Array.from(clientMap.entries()).map(([id, c]) => ({
      clientId: id,
      clientName: c.name,
      dailyHours: toHours(c.daily),
      weeklyHours: toHours(c.weekly),
      monthlyHours: toHours(c.monthly),
    }));

    const activeClients = clientMap.size;
    const openBeds = Math.max(0, house.bedCount - activeClients);

    const recentEntries = [...entries].reverse().slice(0, 50).map(e => ({
      id: e.id,
      clientId: e.clientId,
      clientName: e.clientName ?? "Unknown",
      duration: e.duration,
      startTime: e.startTime,
      endTime: e.endTime,
      noteType: e.noteType,
      createdAt: e.createdAt.toISOString(),
    }));

    res.json({
      dailyHours: toHours(dailyMins),
      weeklyHours: toHours(weeklyMins),
      monthlyHours: toHours(monthlyMins),
      activeClients,
      openBeds,
      clientBreakdown,
      recentEntries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch house stats" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateHouseBody.parse(req.body);
    const [house] = await db.insert(housesTable).values({
      name: body.name,
      managerName: body.managerName ?? "",
      bedCount: body.bedCount ?? 8,
    }).returning();
    res.status(201).json(formatHouse(house));
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateHouseParams.parse(req.params);
    const body = UpdateHouseBody.parse(req.body);
    const [house] = await db
      .update(housesTable)
      .set({ name: body.name, managerName: body.managerName ?? "", bedCount: body.bedCount ?? 8 })
      .where(eq(housesTable.id, id))
      .returning();
    if (!house) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatHouse(house));
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteHouseParams.parse(req.params);
    await db.delete(housesTable).where(eq(housesTable.id, id));
    res.json({ success: true, message: "House deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete house" });
  }
});

export default router;
