import { Router, type IRouter } from "express";
import { db, profilesTable, ledgerTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateProfileBody,
  UpdateProfileBody,
  UpdateProfileParams,
  DeleteProfileParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatProfile(p: typeof profilesTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    phone: p.phone,
    houseName: p.houseName,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  try {
    const profiles = await db.select().from(profilesTable).orderBy(profilesTable.createdAt);
    res.json(profiles.map(formatProfile));
  } catch {
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, req.params.id));
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json(formatProfile(profile));
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/:id/stats", async (req, res) => {
  try {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, req.params.id));
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const entries = await db
      .select({
        id: ledgerTable.id,
        clientId: ledgerTable.clientId,
        clientName: clientsTable.name,
        house: ledgerTable.house,
        duration: ledgerTable.duration,
        startTime: ledgerTable.startTime,
        endTime: ledgerTable.endTime,
        noteType: ledgerTable.noteType,
        createdAt: ledgerTable.createdAt,
      })
      .from(ledgerTable)
      .leftJoin(clientsTable, eq(ledgerTable.clientId, clientsTable.id))
      .where(eq(ledgerTable.profileId, req.params.id))
      .orderBy(ledgerTable.createdAt);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let dailyMins = 0, weeklyMins = 0, monthlyMins = 0;

    for (const e of entries) {
      const created = new Date(e.createdAt);
      if (created >= startOfToday) dailyMins += e.duration;
      if (created >= startOfWeek) weeklyMins += e.duration;
      if (created >= startOfMonth) monthlyMins += e.duration;
    }

    const toHours = (mins: number) => Math.round((mins / 60) * 10) / 10;

    const recentEntries = [...entries].reverse().slice(0, 50).map(e => ({
      id: e.id,
      clientId: e.clientId,
      clientName: e.clientName ?? "Unknown",
      house: e.house,
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
      recentEntries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile stats" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateProfileBody.parse(req.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    // Get-or-create: return existing profile if email already registered
    const [existing] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.email, normalizedEmail));

    if (existing) {
      res.json(formatProfile(existing));
      return;
    }

    const [profile] = await db
      .insert(profilesTable)
      .values({
        name: body.name,
        email: normalizedEmail,
        role: body.role,
        phone: body.phone ?? "",
        houseName: body.houseName ?? "",
      })
      .returning();
    res.status(201).json(formatProfile(profile));
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateProfileParams.parse(req.params);
    const body = UpdateProfileBody.parse(req.body);
    const [profile] = await db
      .update(profilesTable)
      .set({ name: body.name, email: body.email, role: body.role, phone: body.phone ?? "", houseName: body.houseName ?? "" })
      .where(eq(profilesTable.id, id))
      .returning();
    if (!profile) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatProfile(profile));
  } catch {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteProfileParams.parse(req.params);
    await db.delete(profilesTable).where(eq(profilesTable.id, id));
    res.json({ success: true, message: "Profile deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

export default router;
