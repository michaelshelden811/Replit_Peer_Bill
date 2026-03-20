import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const REPORT_SYSTEM_PROMPT = `You are generating a Monthly Progress Report for an AHCCCS-compliant H0038 peer support program.

ROLE:
You are summarizing a month of peer support sessions into a structured progress report. This report is used for documentation, care coordination, and audit purposes.

STRUCTURE (REQUIRED — use these exact section headers):
Overview:
Progress:
Barriers:
Interventions:
Current Status:
Plan:

STYLE RULES:
- Natural, professional tone (match the tone of SOAIP notes — not clinical, not robotic)
- No bullet points — write in paragraph form
- No client name anywhere in the output
- Always refer to the individual as "client"
- No jargon
- Clear, concise, audit-safe language
- No session duration language

CONTENT GUIDELINES:
Overview: 2–3 sentences summarizing engagement and consistency for the month.
Progress: Summarize improvements in recovery, employment, appointments, routines, daily living, etc.
Barriers: Identify challenges such as motivation, documentation, follow-through, or other obstacles.
Interventions: Describe peer support actions taken — guidance, accountability, planning, encouragement, resource connection.
Current Status: Overall condition — e.g., stable, improving, needs increased support.
Plan: Next steps and focus areas for the upcoming month.

CONFIDENTIALITY (HIPAA):
- Do NOT include any client names
- Do NOT include peer/staff names
- Refer only to "client" and "Peer"

Return ONLY a valid JSON object with exactly these six string keys:
{ "overview": "...", "progress": "...", "barriers": "...", "interventions": "...", "currentStatus": "...", "plan": "..." }

No markdown, no code fences, no extra commentary — just the raw JSON object.`;

router.post("/", async (req, res) => {
  const { notes, month } = req.body as {
    notes?: { noteContent: string; noteType: string; startTime: string; endTime: string; createdAt: string }[];
    month?: string;
  };

  if (!notes?.length) {
    res.status(400).json({ error: "No notes provided for this month" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  const noteSummaries = notes
    .map((n, i) => {
      const date = new Date(n.createdAt);
      const dateStr = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      return `Session ${i + 1} (${dateStr}, ${n.startTime}–${n.endTime}, ${n.noteType}):\n${n.noteContent}`;
    })
    .join("\n\n---\n\n");

  const userMessage = `Month: ${month ?? "Unknown"}
Total sessions this month: ${notes.length}

Session Notes:
${noteSummaries}

Generate a Monthly Progress Report based on the above sessions. Return only the JSON object.`;

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: Record<string, string>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Failed to parse OpenAI JSON:", raw);
      res.status(500).json({ error: "AI returned unparseable response" });
      return;
    }

    const { overview, progress, barriers, interventions, currentStatus, plan } = parsed;

    if (!overview || !progress || !barriers || !interventions || !currentStatus || !plan) {
      console.error("Incomplete report structure:", parsed);
      res.status(500).json({ error: "AI returned incomplete report structure" });
      return;
    }

    const reportText = [
      `Overview:\n${overview}`,
      `Progress:\n${progress}`,
      `Barriers:\n${barriers}`,
      `Interventions:\n${interventions}`,
      `Current Status:\n${currentStatus}`,
      `Plan:\n${plan}`,
    ].join("\n\n");

    res.json({ reportText });
  } catch (err) {
    console.error("OpenAI request failed:", err);
    res.status(500).json({ error: "Report generation failed" });
  }
});

export default router;
