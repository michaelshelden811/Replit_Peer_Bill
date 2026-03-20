import { Router, type IRouter } from "express";
import { db, clientsTable, ledgerTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  CreateClientBody,
  UpdateClientBody,
  UpdateClientParams,
  DeleteClientParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toClientJson(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    house: c.house,
    status: c.status,
    intakeDate: c.intakeDate,
    createdAt: c.createdAt.toISOString(),
  };
}

function hoursFromMinutes(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

router.get("/", async (_req, res) => {
  try {
    const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
    res.json(clients.map(toClientJson));
  } catch {
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(toClientJson(client));
  } catch {
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

router.get("/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) return res.status(404).json({ error: "Not found" });

    const entries = await db.select().from(ledgerTable).where(eq(ledgerTable.clientId, id));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let dailyMin = 0, weeklyMin = 0, monthlyMin = 0;
    for (const e of entries) {
      const d = new Date(e.createdAt);
      if (d >= todayStart) dailyMin += e.duration;
      if (d >= weekStart) weeklyMin += e.duration;
      if (d >= monthStart) monthlyMin += e.duration;
    }

    const recentEntries = [...entries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(e => ({
        id: e.id,
        clientId: e.clientId,
        clientName: e.clientName,
        profileId: e.profileId,
        profileName: e.profileName,
        house: e.house,
        noteType: e.noteType,
        startTime: e.startTime,
        endTime: e.endTime,
        duration: e.duration,
        noteContent: e.noteContent,
        createdAt: e.createdAt.toISOString(),
      }));

    res.json({
      dailyHours: hoursFromMinutes(dailyMin),
      weeklyHours: hoursFromMinutes(weeklyMin),
      monthlyHours: hoursFromMinutes(monthlyMin),
      recentEntries,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch client stats" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateClientBody.parse(req.body);

    const existing = await db.select().from(clientsTable).where(eq(clientsTable.name, body.name));
    if (existing.length > 0) {
      return res.status(409).json({ error: "A client with this name already exists" });
    }

    const [client] = await db
      .insert(clientsTable)
      .values({
        name: body.name,
        house: body.house,
        status: body.status ?? "active",
        intakeDate: body.intakeDate,
      })
      .returning();
    res.status(201).json(toClientJson(client));
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateClientParams.parse(req.params);
    const body = UpdateClientBody.parse(req.body);
    const [client] = await db
      .update(clientsTable)
      .set({
        name: body.name,
        house: body.house,
        status: body.status ?? "active",
        intakeDate: body.intakeDate,
      })
      .where(eq(clientsTable.id, id))
      .returning();
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(toClientJson(client));
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteClientParams.parse(req.params);
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ success: true, message: "Client deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete client" });
  }
});

export default router;
