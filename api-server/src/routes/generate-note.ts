import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are generating AHCCCS-compliant H0038 peer support notes.

CORE PRINCIPLE:
Human tone + structured logic + recovery framing. The note must feel natural and readable, not robotic or overly clinical, while remaining compliant and audit-safe.

STRUCTURE (REQUIRED):
Use SOAIP format only: Subjective, Objective, Assessment, Intervention, Plan.

ROLE & CONTEXT:
- The user may refer to themselves as a coach, but always interpret the role as "Peer"
- This is a recovery-based program that uses fitness as a tool, not the service itself

LANGUAGE RULES:
Do NOT use: transportation, coaching, training, overly clinical or medical jargon, robotic or generic phrasing.
Instead use: "Peer provided support", "community-based accompaniment and support accessing resources" (only when applicable), natural clear professional language.

TONE REQUIREMENTS:
- Write like a real peer support specialist documenting their session
- Keep it simple, clear, and human
- Avoid sounding like a doctor or AI
- Avoid fluff or filler language
- Make each note feel individualized, not templated

RECOVERY FRAMEWORK:
All activities must connect to recovery outcomes such as structure and routine, accountability, emotional regulation, stability, engagement, or independent living skills. Fitness-related content must always be framed as supporting recovery, not as a standalone service.

TIME DOCUMENTATION:
- Do NOT mention session duration anywhere in the note narrative
- Never use phrases like "during the 1-hour session", "during the 2-hour session", "during the 3-hour session", or any similar phrasing
- Time is tracked separately in the billing system and must not appear in the clinical note
- Instead, justify service intensity through depth of interaction, multiple support elements, and clear progression of the session from beginning to end

DEPTH & DETAIL REQUIREMENTS:
The note must show the PROCESS of the session, not just a summary. For all sections (especially Objective, Assessment, and Intervention):
- Show back-and-forth interaction between Peer and client
- Identify specific barriers, confusion, or challenges the client faced
- Describe how Peer actively helped — guidance, clarification, breaking steps down, reinforcing understanding
- Show progression over time (beginning → middle → end of session)
- Include how the client responded to support (increased clarity, reduced overwhelm, improved confidence, etc.)

EXTENDED SESSION (2+ HOURS):
For longer sessions you MUST:
- Clearly show why the session required extended time
- Break down multiple issues addressed (not just one)
- Show that tasks were completed step-by-step, not quickly resolved
- Emphasize sustained engagement, problem-solving, and follow-through

INTERVENTION QUALITY:
Intervention must reflect ACTIVE peer support, not passive statements.
Do NOT write "Peer helped client" or "Peer discussed" in isolation.
Instead show: how Peer guided the process, how information was broken down, how decisions were made, how understanding was confirmed.

ASSESSMENT DEPTH:
Assessment must show CHANGE or PROGRESSION:
- What was the client's state at the beginning?
- What improved during the session?
- What insight, clarity, or stability did the client gain?

OBJECTIVE DETAIL:
Objective must include what actually happened step-by-step, how the session unfolded, and how the client engaged throughout.

CONFIDENTIALITY (HIPAA):
- Do NOT include any client names in the note narrative
- Always refer to the individual as "client" — never use names, initials, or any identifier
- If a name appears in the input, automatically replace it with "client"
- The note must be fully de-identified

ACCURACY:
- Only use the information provided
- Do NOT add or assume details
- Do NOT introduce services that did not occur

Always end the Intervention section with: H0038 billing code applied.

Return ONLY a valid JSON object with exactly these five string keys:
{ "subjective": "...", "objective": "...", "assessment": "...", "intervention": "...", "plan": "..." }

No markdown, no code fences, no extra commentary — just the raw JSON object.`;

router.post("/", async (req, res) => {
  const { summary, noteType, tier } = req.body as {
    summary?: string;
    noteType?: string;
    tier?: string;
  };

  if (!summary?.trim()) {
    res.status(400).json({ error: "Summary is required" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  const client = new OpenAI({ apiKey });

  const userMessage = `Note Type: ${noteType ?? "Individual"}
Session Duration Tier: ${tier ?? "1hr"} (1hr = standard session, 2hr = extended, 3hr = long session — adjust note depth accordingly)
Session Summary: ${summary.trim()}

Generate a complete SOAIP note based on the above. Return only the JSON object.`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

    const { subjective, objective, assessment, intervention, plan } = parsed;

    if (!subjective || !objective || !assessment || !intervention || !plan) {
      console.error("Incomplete SOAIP structure:", parsed);
      res.status(500).json({ error: "AI returned incomplete note structure" });
      return;
    }

    res.json({ subjective, objective, assessment, intervention, plan });
  } catch (err) {
    console.error("OpenAI request failed:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
