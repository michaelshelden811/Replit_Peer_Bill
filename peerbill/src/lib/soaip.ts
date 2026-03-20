export interface SOAIPNote {
  subjective: string;
  objective: string;
  assessment: string;
  intervention: string;
  plan: string;
}

export const NOTE_TYPES = [
  "Individual",
  "Group",
  "Morning Check-In",
  "Nightly Check-Out",
  "Shared Meal",
  "Transportation",
  "Outside Meeting",
  "House Activity",
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];
export type DurationTier = "1hr" | "2hr" | "3hr";

// ─── Issue detection system ────────────────────────────────────────────────

interface IssuePattern {
  id: string;
  keywords: string[];
  label: string;
  isBarrier: boolean;
  objectiveDesc: string;
  interventionDesc: string;
  planClient: string;
  planPeer: string;
  suppressedBy?: string[]; // skip this pattern if any of these ids already matched
}

// Ordered most-specific → least-specific so shorter keywords don't
// shadow longer ones. Break on first keyword match per pattern.
const ISSUE_PATTERNS: IssuePattern[] = [
  {
    id: "gi_appointment",
    keywords: ["gi appointment", "gi doctor", "gastro", "gastroenterology", "gi specialist"],
    label: "scheduling a GI appointment",
    isBarrier: true,
    objectiveDesc: "discussed needing to schedule a GI appointment",
    interventionDesc: "assisted client in identifying the steps needed to schedule the GI appointment and explored any barriers to making the call",
    planClient: "Client will contact the provider to schedule the GI appointment before the next session",
    planPeer: "Peer will confirm scheduling progress at follow-up",
  },
  {
    id: "dental",
    keywords: ["dental appointment", "dentist", "dental"],
    label: "scheduling a dental appointment",
    isBarrier: true,
    objectiveDesc: "discussed a need to schedule a dental appointment",
    interventionDesc: "helped client identify a dental provider and outlined steps to schedule the appointment",
    planClient: "Client will contact the dental provider to schedule the appointment before the next session",
    planPeer: "Peer will confirm appointment scheduling at follow-up",
  },
  {
    id: "psych_appointment",
    keywords: ["psych appointment", "psychiatrist appointment", "psychiatric appointment", "psych visit", "psychiatrist"],
    label: "scheduling a psychiatric appointment",
    isBarrier: true,
    objectiveDesc: "discussed needing to schedule a psychiatric appointment",
    interventionDesc: "helped client identify the appropriate psychiatric provider and outlined steps to schedule the visit",
    planClient: "Client will contact the psychiatric provider to schedule or confirm the appointment",
    planPeer: "Peer will verify appointment status at follow-up",
  },
  {
    id: "iop",
    keywords: ["iop attendance", "iop sessions", "iop meetings", "intensive outpatient program", "intensive outpatient", "iop"],
    label: "maintaining IOP attendance",
    isBarrier: true,
    objectiveDesc: "discussed difficulty or need for support maintaining IOP attendance",
    interventionDesc: "discussed the importance of IOP attendance with client, identified specific barriers to consistent attendance, and developed a plan to address those barriers",
    planClient: "Client will attend all scheduled IOP sessions before the next peer support session",
    planPeer: "Peer will follow up on IOP attendance at the next session and assist with any ongoing barriers",
  },
  {
    id: "outpatient",
    keywords: ["outpatient program", "outpatient attendance", "op program", "op sessions", "outpatient"],
    label: "maintaining outpatient program attendance",
    isBarrier: true,
    objectiveDesc: "discussed support needed to maintain outpatient program attendance",
    interventionDesc: "discussed barriers to outpatient attendance with client and identified concrete steps to improve consistency",
    planClient: "Client will attend all scheduled outpatient sessions before the next peer support session",
    planPeer: "Peer will monitor attendance and follow up at the next session",
  },
  {
    id: "transportation",
    keywords: ["transportation support", "needs transportation", "transportation", "needs a ride", "no transportation", "no ride", "no car", "bus", "transit", "transport"],
    label: "transportation support",
    isBarrier: true,
    objectiveDesc: "requested transportation support to access services",
    interventionDesc: "explored available transportation options with client and coordinated a plan to address the transportation need",
    planClient: "Client will confirm transportation arrangements for upcoming appointments or obligations",
    planPeer: "Peer will coordinate or confirm transportation logistics before the next scheduled obligation",
  },
  {
    id: "room_change",
    keywords: ["switching rooms", "switch rooms", "room change", "room switch", "room transfer", "different room", "move rooms", "room request", "change rooms"],
    label: "a room change request",
    isBarrier: true,
    objectiveDesc: "discussed a request to change rooms within the house",
    interventionDesc: "discussed the room change request with client, clarified the reason and need, and outlined the steps to submit a formal request to house staff",
    planClient: "Client will submit or follow up on the room change request with house staff",
    planPeer: "Peer will follow up with house staff to support the request and confirm next steps",
  },
  {
    id: "ankle_swelling",
    keywords: ["ankle swelling", "ankle pain", "ankle", "swelling", "mobility issue", "physical accommodation"],
    label: "a physical health concern (ankle swelling)",
    isBarrier: true,
    objectiveDesc: "reported a physical health concern affecting mobility, specifically ankle swelling",
    interventionDesc: "acknowledged client's physical health concern and supported client in identifying appropriate next steps, including whether a medical visit or accommodation request is needed",
    planClient: "Client will seek medical attention or follow up on an accommodation request related to the ankle swelling",
    planPeer: "Peer will check on status of medical follow-up or accommodation at the next session",
  },
  {
    id: "recovery_meeting",
    keywords: ["meeting attendance", "aa meetings", "na meetings", "aa meeting", "na meeting", "recovery meeting", "twelve step", "12-step", "12 step"],
    label: "recovery meeting attendance",
    isBarrier: true,
    objectiveDesc: "discussed recovery meeting attendance and any barriers to participation",
    interventionDesc: "encouraged recovery meeting participation, discussed barriers, and helped client identify specific meetings to attend",
    planClient: "Client will attend at least one recovery meeting before the next peer support session",
    planPeer: "Peer will follow up on meeting attendance at the next session",
  },
  {
    id: "medication",
    keywords: ["medication refill", "prescription refill", "medication", "meds", "prescription", "pharmacy", "refill"],
    label: "medication management",
    isBarrier: true,
    objectiveDesc: "discussed medication needs or management",
    interventionDesc: "helped client identify what action is needed regarding medication and outlined steps to address the need (refill, pickup, or provider contact)",
    planClient: "Client will follow through on the identified medication step before the next session",
    planPeer: "Peer will confirm medication management follow-through at the next session",
  },
  {
    id: "benefits",
    keywords: ["snap benefits", "food stamps", "ssi benefits", "ssdi benefits", "medicaid enrollment", "benefit enrollment", "benefits enrollment", "benefits", "ssi", "ssdi", "medicaid", "medicare", "benefit"],
    label: "benefits enrollment or maintenance",
    isBarrier: true,
    objectiveDesc: "discussed benefits eligibility, enrollment, or maintenance needs",
    interventionDesc: "helped client identify the appropriate benefits resource and outlined steps for enrollment or continued maintenance",
    planClient: "Client will take the identified next step toward benefits enrollment or maintenance before the next session",
    planPeer: "Peer will follow up on benefits status at the next session",
  },
  {
    id: "employment",
    keywords: ["job search", "job hunting", "looking for work", "job application", "resume", "interview", "employment", "job hunt"],
    label: "employment-related activity",
    isBarrier: false,
    objectiveDesc: "discussed employment-related activity including job search or application steps",
    interventionDesc: "supported client in identifying the next employment step and addressed any barriers to moving forward",
    planClient: "Client will complete the identified employment-related task before the next session",
    planPeer: "Peer will follow up on employment progress at the next session",
  },
  {
    id: "housing_concern",
    keywords: ["eviction notice", "eviction", "evicted", "housing concern", "housing instability", "facing eviction"],
    label: "housing stability concerns",
    isBarrier: true,
    objectiveDesc: "discussed a housing stability concern and its potential impact on recovery",
    interventionDesc: "helped client identify immediate steps to address the housing concern and explored available housing resources",
    planClient: "Client will take the identified next step to address the housing concern before the next session",
    planPeer: "Peer will follow up on housing status and assist with resource connection as needed",
  },
  {
    id: "legal",
    keywords: ["court date", "probation meeting", "parole meeting", "court obligation", "warrant", "hearing", "probation", "parole", "court"],
    label: "legal obligations",
    isBarrier: true,
    objectiveDesc: "discussed upcoming or current legal obligations",
    interventionDesc: "reviewed upcoming legal obligations with client, identified key dates and requirements, and discussed preparation steps",
    planClient: "Client will follow through on all required legal obligations as discussed",
    planPeer: "Peer will check in prior to any upcoming court or legal date",
  },
  {
    id: "food",
    keywords: ["food access", "food pantry", "groceries", "hungry", "food bank", "food"],
    label: "food or nutritional access",
    isBarrier: true,
    objectiveDesc: "discussed food access or nutritional needs",
    interventionDesc: "identified available food resources in the area and connected client to options",
    planClient: "Client will access the identified food resource before the next session",
    planPeer: "Peer will confirm food access at follow-up",
  },
  {
    id: "mental_health_appt",
    keywords: ["therapy appointment", "counselor appointment", "therapist appointment", "mental health appointment", "counseling appointment"],
    label: "scheduling a mental health appointment",
    isBarrier: true,
    objectiveDesc: "discussed the need to schedule a mental health or counseling appointment",
    interventionDesc: "helped client identify the appropriate mental health provider and outlined steps to schedule the appointment",
    planClient: "Client will contact the mental health provider to schedule or confirm the appointment",
    planPeer: "Peer will verify appointment status at follow-up",
  },
  {
    id: "generic_appointment",
    keywords: ["scheduling an appointment", "schedule an appointment", "appointment"],
    label: "scheduling a service or medical appointment",
    isBarrier: true,
    suppressedBy: ["gi_appointment", "dental", "psych_appointment", "mental_health_appt"],
    objectiveDesc: "discussed the need to schedule a service or medical appointment",
    interventionDesc: "helped client identify the steps needed to schedule the appointment and addressed barriers to follow-through",
    planClient: "Client will take steps to schedule the identified appointment before the next session",
    planPeer: "Peer will confirm scheduling progress at follow-up",
  },
];

function detectIssues(summary: string): IssuePattern[] {
  const lower = summary.toLowerCase();
  const matched: IssuePattern[] = [];
  const usedIds = new Set<string>();

  for (const pattern of ISSUE_PATTERNS) {
    if (usedIds.has(pattern.id)) continue;
    if (pattern.suppressedBy?.some(id => usedIds.has(id))) continue;
    for (const kw of pattern.keywords) {
      if (lower.includes(kw)) {
        matched.push(pattern);
        usedIds.add(pattern.id);
        break;
      }
    }
  }

  return matched;
}

// ─── Note type prefix ──────────────────────────────────────────────────────

function getNoteTypePrefix(noteType: string): string {
  switch (noteType) {
    case "Group": return "Client attended the group session. ";
    case "Morning Check-In": return "Client completed morning check-in. ";
    case "Nightly Check-Out": return "Client completed nightly check-out. ";
    case "Outside Meeting": return "Client attended the external recovery meeting. ";
    case "Shared Meal": return "Client was present for the communal meal. ";
    case "House Activity": return "Client attended the house activity. ";
    case "Transportation": return "Peer transported client. ";
    default: return "Client met with Peer. ";
  }
}

// ─── Quote extractor ───────────────────────────────────────────────────────

function extractQuote(summary: string): string | null {
  const quoted = summary.match(/[""]([^""]+)[""]/);
  if (quoted) return `"${quoted[1]}"`;
  const phrases = summary.match(/(?:said|stated|shared|reported|mentioned)\s+(?:that\s+)?(.+?)(?:\.|$)/i);
  if (phrases) {
    const raw = phrases[1].trim();
    if (raw.length >= 10) return `"${raw}"`;
  }
  return null;
}

// ─── Multi-issue note builder ──────────────────────────────────────────────

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildMultiIssueNote(
  issues: IssuePattern[],
  noteType: string,
  tier: DurationTier,
  quote: string | null
): SOAIPNote {
  const n = issues.length;
  const prefix = getNoteTypePrefix(noteType);
  const labels = issues.map(i => i.label);
  const topicStr = joinList(labels);
  const quoteClause = quote ? ` Client stated: ${quote}.` : "";

  // Subjective
  const subjective = `Client reported needing support with ${topicStr}.${quoteClause}`;

  // Objective
  const objDescs = issues.map(i => i.objectiveDesc);
  const objBase = `${prefix}Client ${joinList(objDescs)}. Client communicated needs clearly and remained engaged throughout the session.`;
  const obj2hr = ` Client responded to Peer's questions by providing additional detail on each area and indicating which items were most urgent.`;
  const obj3hr = ` As the session progressed, client and Peer worked through each issue methodically. By the end of the session, a clear next step had been identified for each area discussed.`;

  let objective = objBase;
  if (tier !== "1hr") objective += obj2hr;
  if (tier === "3hr") objective += obj3hr;

  // Assessment
  const allBarriers = issues.every(i => i.isBarrier);
  let assessment: string;
  if (allBarriers && n > 1) {
    assessment = `Client is managing ${n} concurrent areas of need: ${topicStr}. Despite facing multiple challenges, client's direct communication and willingness to request support reflect active engagement in the recovery process.`;
  } else if (allBarriers) {
    assessment = `Client is managing a challenge related to ${labels[0]} that requires follow-through. Client's willingness to discuss the issue and request support indicates engagement with the recovery process.`;
  } else {
    assessment = `Client demonstrated initiative by identifying and addressing ${n > 1 ? "multiple areas" : "an area"} during the session. Client's engagement and problem-solving reflect active participation in recovery.`;
  }
  if (tier === "3hr") {
    assessment += ` Over the course of the extended session, client demonstrated increased clarity — moving from identifying issues to developing concrete steps for each area.`;
  }

  // Intervention
  const intDescs = issues.map(i => i.interventionDesc);
  let interventionBody: string;
  if (n === 1) {
    interventionBody = `Peer ${intDescs[0]}.`;
  } else {
    const last = intDescs[intDescs.length - 1];
    const rest = intDescs.slice(0, -1);
    interventionBody = `Peer addressed ${n} presenting issues during the session: ${rest.join("; ")}; and ${last}.`;
  }
  if (tier === "2hr") {
    interventionBody += ` Peer confirmed that client had a clear action step for each issue before the session closed.`;
  } else if (tier === "3hr") {
    interventionBody += ` Peer used the extended session time to address each issue in depth, confirmed client's understanding of the plan, and documented action items for follow-up.`;
  }
  const intervention = `${interventionBody} H0038 billing code applied.`;

  // Plan — one line per issue
  const planLines = issues.map(i => `${i.planClient}. ${i.planPeer}.`);
  const plan = planLines.join(" ");

  return { subjective, objective, assessment, intervention, plan };
}

// ─── Single-theme fallback (kept for generic/undetectable input) ───────────

type NoteClassification = "progress" | "barrier";

const BARRIER_SIGNALS = [
  "stress", "struggling", "struggle", "worried", "worry", "anxious", "anxiety",
  "relapse", "craving", "cravings", "conflict", "angry", "anger", "frustrated",
  "frustration", "eviction", "evicted", "homeless",
  "can't", "cannot", "won't", "refused", "overwhelmed", "depressed", "depression",
  "scared", "fear", "afraid", "panic", "crisis", "problem", "trouble", "difficult",
  "hard time", "missed", "fail", "failed", "setback", "argument", "fight",
  "didn't", "did not", "not sleeping", "hopeless", "unsafe", "danger", "withdrawal",
];

const PROGRESS_SIGNALS = [
  "motivation", "motivated", "goal", "goals", "progress", "proud", "excited",
  "happy", "improving", "improve", "learned", "growing", "growth", "working on",
  "committed", "decided", "planning", "plan", "achieved", "completed", "finished",
  "signed up", "enrolled", "applied", "started", "beginning", "looking forward",
  "surprised", "realized", "insight", "positive", "encouraged", "hopeful",
  "workout", "exercise", "fitness", "diet", "healthy", "milestone",
  "opportunity", "grateful", "thankful", "better", "doing well",
];

const THEME_MAP: Record<string, string[]> = {
  fitness: ["workout", "exercise", "fitness", "body fat", "weight", "diet", "gym", "running", "nutrition"],
  employment: ["job", "work", "employment", "hired", "interview", "resume", "career", "wage", "paycheck"],
  housing: ["house", "housing", "apartment", "rent", "lease", "landlord", "eviction", "shelter"],
  family: ["family", "mom", "dad", "child", "children", "kids", "parent", "sibling", "brother", "sister"],
  legal: ["court", "probation", "parole", "attorney", "charge", "case", "warrant", "hearing"],
  mental_health: ["depression", "anxiety", "therapy", "counselor", "psychiatrist", "medication", "mental"],
  substance_use: ["relapse", "craving", "sobriety", "sober", "clean", "substance", "alcohol", "drug", "meeting", "sponsor"],
  education: ["school", "class", "degree", "ged", "college", "training", "certificate", "study"],
  finances: ["money", "finances", "bills", "benefit", "income", "savings", "debt", "snap"],
  social: ["friend", "peer", "community", "group", "isolation", "lonely", "connect", "relationship"],
};

function classify(summary: string): NoteClassification {
  const lower = summary.toLowerCase();
  let b = 0, p = 0;
  for (const w of BARRIER_SIGNALS) if (lower.includes(w)) b++;
  for (const w of PROGRESS_SIGNALS) if (lower.includes(w)) p++;
  return b > p ? "barrier" : "progress";
}

function detectTheme(summary: string): string {
  const lower = summary.toLowerCase();
  for (const [theme, words] of Object.entries(THEME_MAP))
    for (const word of words)
      if (lower.includes(word)) return theme.replace("_", " ");
  return "personal development";
}

function buildObjective(noteType: string, theme: string, classification: NoteClassification, tier: DurationTier): string {
  const isProgress = classification === "progress";
  const base = isProgress
    ? `Client discussed current progress related to ${theme}, described what they have been doing, and demonstrated awareness of the changes they want to make.`
    : `Client described the current difficulty related to ${theme} and discussed the impact on their day-to-day functioning.`;
  const e2 = isProgress
    ? ` Client responded to Peer's questions by elaborating on specific goals and the steps already underway. Client remained engaged and on topic throughout.`
    : ` Client engaged in problem-solving with Peer, considered available options, and responded to clarifying questions.`;
  const e3 = isProgress
    ? ` As the session progressed, client moved from describing the situation to articulating specific goals and discussing obstacles. By the end of the session, client had identified a clear direction.`
    : ` By end of session, client had identified a manageable next step and verbalized readiness to act.`;
  const prefix = getNoteTypePrefix(noteType);
  if (tier === "1hr") return `${prefix}${base}`;
  if (tier === "2hr") return `${prefix}${base}${e2}`;
  return `${prefix}${base}${e2}${e3}`;
}

function buildAssessment(theme: string, classification: NoteClassification, tier: DurationTier): string {
  const isProgress = classification === "progress";
  const base = isProgress
    ? `Client demonstrates self-directed engagement in recovery with clear motivation around ${theme}.`
    : `Client is experiencing a challenge related to ${theme} that is affecting recovery stability.`;
  const d2 = isProgress
    ? ` The ability to articulate goals and reflect on progress indicates readiness to build on current momentum.`
    : ` Client's willingness to engage and discuss the challenge directly indicates capacity for continued participation in support services.`;
  const d3 = isProgress
    ? ` Over the course of the extended session, client demonstrated deepening self-awareness — moving from general motivation to specific goal identification.`
    : ` Over the course of the extended session, client showed increased clarity around contributing factors and demonstrated capacity for structured problem-solving.`;
  if (tier === "1hr") return `${base}${d2}`;
  if (tier === "2hr") return `${base}${d2}`;
  return `${base}${d2}${d3}`;
}

function buildIntervention(theme: string, classification: NoteClassification, tier: DurationTier): string {
  const isProgress = classification === "progress";
  const i1 = isProgress
    ? `Peer reinforced client's self-identified progress and helped client clarify the most important next priority.`
    : `Peer worked with client to clarify the specific nature of the challenge and supported development of a short-term response plan.`;
  const i2 = isProgress
    ? ` Peer guided client in articulating a specific goal and established accountability around follow-through before end of session.`
    : ` Peer helped client weigh available options and identify which step was most realistic given current circumstances.`;
  const i3 = isProgress
    ? ` In the final phase of the session, Peer supported client in anticipating obstacles to the identified goal and reinforced confidence in the plan. H0038 billing code applied.`
    : ` Peer and client built a structured response plan, including what client will do, when, and what Peer will monitor at follow-up. H0038 billing code applied.`;
  const sfx = ` H0038 billing code applied.`;
  if (tier === "1hr") return `${i1}${sfx}`;
  if (tier === "2hr") return `${i1}${i2}${sfx}`;
  return `${i1}${i2}${i3}`;
}

function buildPlan(theme: string, classification: NoteClassification, tier: DurationTier): string {
  const isProgress = classification === "progress";
  const PLANS: Record<string, { short: string; extended: string }> = {
    fitness: {
      short: `Client will maintain workout consistency before the next session. Peer will follow up on progress.`,
      extended: `Client will maintain workout consistency and make at least one dietary improvement before the next session. Peer will review progress on both at follow-up.`,
    },
    employment: {
      short: `Client will complete at least one employment-related task before the next session. Peer will review progress.`,
      extended: `Client will submit at least one job application or complete a resume update. Peer will follow up on the outcome and assist with next steps.`,
    },
    housing: {
      short: `Client will follow through on the identified housing step before the next session. Peer will check in to confirm progress.`,
      extended: `Client will follow through on the housing step discussed and identify one additional resource. Peer will review both at follow-up.`,
    },
    "substance use": {
      short: `Client will attend a community recovery meeting before the next session. Peer will follow up on attendance.`,
      extended: `Client will attend at least one community recovery meeting and check in with their sponsor. Peer will follow up on both at the next session.`,
    },
    education: {
      short: `Client will complete the identified enrollment or coursework step before the next session. Peer will follow up.`,
      extended: `Client will complete the enrollment step and identify the next course or requirement. Peer will review progress and assist with any obstacles.`,
    },
    finances: {
      short: `Client will take the discussed financial action step before the next session. Peer will follow up.`,
      extended: `Client will take the financial action step and explore one additional resource. Peer will review both at follow-up.`,
    },
    legal: {
      short: `Client will follow through on the identified legal obligation before the next session. Peer will confirm completion.`,
      extended: `Client will follow through on the legal obligation and confirm any upcoming dates. Peer will assist with preparation.`,
    },
    "mental health": {
      short: `Client will use the discussed self-management strategy before the next session. Peer will check in on status.`,
      extended: `Client will use the self-management strategy and note any triggers or patterns. Peer will review both at follow-up.`,
    },
    social: {
      short: `Client will make at least one deliberate peer connection before the next session. Peer will follow up.`,
      extended: `Client will make at least one deliberate peer connection and attend a group activity. Peer will review both at follow-up.`,
    },
  };

  const fallback = isProgress
    ? { short: `Client will follow through on the goal discussed today before the next session. Peer will follow up to review progress.`, extended: `Client will follow through on the goal discussed and take one additional step. Peer will review both at follow-up.` }
    : { short: `Client and Peer will revisit the current challenge at the next session with a focused plan.`, extended: `Client and Peer will revisit the challenge at the next session. Peer will monitor for escalation in the interim.` };

  const entry = PLANS[theme] ?? fallback;
  return tier === "1hr" ? entry.short : entry.extended;
}

function buildSingleThemeFallback(
  summary: string,
  noteType: string,
  tier: DurationTier,
  quote: string | null
): SOAIPNote {
  const classification = classify(summary);
  const theme = detectTheme(summary);
  const quoteClause = quote ? ` Client stated: ${quote}.` : "";

  const subjectiveMap: Record<string, Record<NoteClassification, string>> = {
    fitness: { progress: `Client discussed physical health goals and expressed motivation to improve.`, barrier: `Client reported difficulty with fitness or health routines and described the impact.` },
    employment: { progress: `Client reported progress toward employment and discussed active steps.`, barrier: `Client reported a challenge related to employment or job search.` },
    housing: { progress: `Client shared positive developments related to housing stability.`, barrier: `Client reported a housing concern and described its impact on recovery.` },
    "substance use": { progress: `Client reported maintaining sobriety and reflected on supporting factors.`, barrier: `Client disclosed difficulty maintaining sobriety and described circumstances involved.` },
    "mental health": { progress: `Client discussed mental health and progress with current strategies.`, barrier: `Client reported elevated stress or difficulty managing current mental health challenges.` },
    legal: { progress: `Client reported progress on legal obligations and discussed next steps.`, barrier: `Client discussed upcoming or current legal obligations and the stress involved.` },
    education: { progress: `Client discussed progress in educational pursuits and described active steps toward goals.`, barrier: `Client reported a challenge related to education or program attendance.` },
    finances: { progress: `Client reported progress on financial goals and discussed actions toward stability.`, barrier: `Client described a financial concern and discussed its effect on recovery stability.` },
    social: { progress: `Client discussed positive peer connections and community engagement.`, barrier: `Client described difficulties with social connections or interpersonal conflict.` },
    family: { progress: `Client reported positive developments in family relationships.`, barrier: `Client described family-related stress and its effect on recovery.` },
  };

  const subLine = (subjectiveMap[theme]?.[classification]) ??
    (classification === "progress"
      ? `Client reported meaningful progress on a personal goal related to ${theme} and expressed motivation to continue.`
      : `Client reported difficulty with a situation related to ${theme} and discussed the impact.`);

  return {
    subjective: `${subLine}${quoteClause}`,
    objective: buildObjective(noteType, theme, classification, tier),
    assessment: buildAssessment(theme, classification, tier),
    intervention: buildIntervention(theme, classification, tier),
    plan: buildPlan(theme, classification, tier),
  };
}

// ─── Transportation note (special case) ────────────────────────────────────

function buildTransportationNote(summary: string, tier: DurationTier, quote: string | null): SOAIPNote {
  const lower = summary.toLowerCase();
  const quoteClause = quote ? ` Client stated: ${quote}.` : "";

  const dest = lower.includes("gi") || lower.includes("gastro")
    ? "a GI appointment"
    : lower.includes("appointment")
    ? "a medical or service appointment"
    : lower.includes("court")
    ? "a court obligation"
    : lower.includes("iop") || lower.includes("outpatient")
    ? "an outpatient program session"
    : lower.includes("meeting")
    ? "a recovery meeting"
    : "a recovery-related obligation";

  const obj_base = `Peer transported client to ${dest}. Client arrived on time and followed through with the purpose of the trip.`;
  const obj_2hr = ` During transit, client discussed the purpose of the trip and any concerns about the destination interaction.`;
  const obj_3hr = ` On the return trip, client debriefed what occurred, identified any follow-up needed, and discussed the experience with Peer.`;

  const int_base = `Peer provided transportation and used transit time to prepare client for the destination interaction — discussing what to expect, questions to ask, or documents to have ready.`;
  const int_2hr = ` Peer supported client in processing the interaction and identifying any follow-up tasks.`;
  const int_3hr = ` Peer worked with client on a post-appointment action plan, confirmed next steps, and documented any outstanding tasks.`;

  return {
    subjective: `Client required transportation to access ${dest} and did not have independent means to get there.${quoteClause}`,
    objective: tier === "1hr" ? obj_base : tier === "2hr" ? `${obj_base}${obj_2hr}` : `${obj_base}${obj_2hr}${obj_3hr}`,
    assessment: `Lack of independent transportation was a direct barrier to accessing a required service. Peer-provided transportation removed that barrier and enabled client to fulfill the obligation.`,
    intervention: tier === "1hr"
      ? `${int_base} H0038 billing code applied.`
      : tier === "2hr"
      ? `${int_base}${int_2hr} H0038 billing code applied.`
      : `${int_base}${int_2hr}${int_3hr} H0038 billing code applied.`,
    plan: `Client will confirm all upcoming transportation needs in advance. Peer will coordinate transportation logistics for any scheduled appointments or obligations.`,
  };
}

// ─── Generic fallback ───────────────────────────────────────────────────────

function generateGenericNote(tier: DurationTier): SOAIPNote {
  return {
    subjective: `Client engaged in peer support services and discussed current goals and needs.`,
    objective: buildObjective("Individual", "personal development", "progress", tier),
    assessment: buildAssessment("personal development", "progress", tier),
    intervention: buildIntervention("personal development", "progress", tier),
    plan: buildPlan("personal development", "progress", tier),
  };
}

// ─── Main entry point ───────────────────────────────────────────────────────

export function generateSOAIP(
  summary: string,
  noteType: NoteType | string,
  tier: DurationTier = "1hr"
): SOAIPNote {
  const trimmed = summary.trim();
  if (!trimmed) return generateGenericNote(tier);

  const quote = extractQuote(trimmed);

  if (noteType === "Transportation") {
    return buildTransportationNote(trimmed, tier, quote);
  }

  const issues = detectIssues(trimmed);

  if (issues.length > 0) {
    return buildMultiIssueNote(issues, noteType, tier, quote);
  }

  return buildSingleThemeFallback(trimmed, noteType, tier, quote);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function formatNoteContent(note: SOAIPNote): string {
  return `Subjective:\n${note.subjective}\n\nObjective:\n${note.objective}\n\nAssessment:\n${note.assessment}\n\nIntervention:\n${note.intervention}\n\nPlan:\n${note.plan}`;
}

export function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;
  if (endTotal < startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

export function durationToTier(minutes: number): DurationTier {
  if (minutes >= 150) return "3hr";
  if (minutes >= 90) return "2hr";
  return "1hr";
}
