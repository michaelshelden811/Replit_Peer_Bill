import { Router, type IRouter } from "express";
import { db, ledgerTable, clientsTable, profilesTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  CreateLedgerEntryBody,
  DeleteLedgerEntryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { clientId, profileId, house, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (clientId) conditions.push(eq(ledgerTable.clientId, clientId));
    if (profileId) conditions.push(eq(ledgerTable.profileId, profileId));
    if (house) conditions.push(eq(ledgerTable.house, house));
    if (dateFrom) conditions.push(gte(ledgerTable.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(ledgerTable.createdAt, new Date(dateTo)));

    const entries = await db
      .select({
        id: ledgerTable.id,
        clientId: ledgerTable.clientId,
        clientName: clientsTable.name,
        profileId: ledgerTable.profileId,
        profileName: profilesTable.name,
        house: ledgerTable.house,
        noteType: ledgerTable.noteType,
        startTime: ledgerTable.startTime,
        endTime: ledgerTable.endTime,
        duration: ledgerTable.duration,
        noteContent: ledgerTable.noteContent,
        createdAt: ledgerTable.createdAt,
      })
      .from(ledgerTable)
      .leftJoin(clientsTable, eq(ledgerTable.clientId, clientsTable.id))
      .leftJoin(profilesTable, eq(ledgerTable.profileId, profilesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(ledgerTable.createdAt);

    res.json(
      entries.map((e) => ({
        id: e.id,
        clientId: e.clientId,
        clientName: e.clientName ?? "Unknown",
        profileId: e.profileId,
        profileName: e.profileName ?? "Unknown",
        house: e.house,
        noteType: e.noteType,
        startTime: e.startTime,
        endTime: e.endTime,
        duration: e.duration,
        noteContent: e.noteContent,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ledger entries" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateLedgerEntryBody.parse(req.body);
    const [entry] = await db
      .insert(ledgerTable)
      .values({
        clientId: body.clientId,
        profileId: body.profileId,
        house: body.house,
        noteType: body.noteType,
        startTime: body.startTime,
        endTime: body.endTime,
        duration: body.duration,
        noteContent: body.noteContent,
      })
      .returning();

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, entry.clientId));
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, entry.profileId));

    res.status(201).json({
      id: entry.id,
      clientId: entry.clientId,
      clientName: client?.name ?? "Unknown",
      profileId: entry.profileId,
      profileName: profile?.name ?? "Unknown",
      house: entry.house,
      noteType: entry.noteType,
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
      noteContent: entry.noteContent,
      createdAt: entry.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(400).json({ error: "Invalid input" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteLedgerEntryParams.parse(req.params);
    await db.delete(ledgerTable).where(eq(ledgerTable.id, id));
    res.json({ success: true, message: "Entry deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
