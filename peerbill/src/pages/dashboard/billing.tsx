import React, { useState, useRef, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useListClients, 
  useListHouses, 
  useCreateLedgerEntry 
} from "@workspace/api-client-react";
import { NOTE_TYPES, generateSOAIP, formatNoteContent, calculateDuration, durationToTier, type SOAIPNote } from "@/lib/soaip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, FileText, CheckCircle2, Clock, Mic, MicOff, Check, X, Copy, RotateCcw, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const todayISO = new Date().toISOString().split("T")[0];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hasTimeOverlap(
  newStart: number, newEnd: number,
  existingStart: number, existingEnd: number
): boolean {
  return newStart < existingEnd && newEnd > existingStart;
}

const formatDOS = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};

const noteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  houseId: z.string().min(1, "House is required"),
  noteType: z.enum(NOTE_TYPES, { required_error: "Note type is required" }),
  dateOfService: z.string().min(1, "Date of service is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  summary: z.string().min(10, "Please provide a brief summary of the session"),
});

type NoteFormValues = z.infer<typeof noteSchema>;

const DRAFT_KEY = "draft_note";

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: clients, isLoading: loadingClients } = useListClients();
  const { data: houses, isLoading: loadingHouses } = useListHouses();
  const createLedgerMutation = useCreateLedgerEntry();

  const [generatedSOAIP, setGeneratedSOAIP] = useState<SOAIPNote | null>(null);
  const [noteStatus, setNoteStatus] = useState<"idle" | "pending" | "accepted">("idle");
  const [noteDate, setNoteDate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<null | "saving" | "saved">(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      dateOfService: todayISO,
      startTime: "09:00",
      endTime: "10:00"
    }
  });

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft: Partial<NoteFormValues> = JSON.parse(raw);
      (Object.keys(draft) as (keyof NoteFormValues)[]).forEach((key) => {
        if (draft[key]) setValue(key, draft[key] as string);
      });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft on form changes (debounced 2s)
  useEffect(() => {
    const subscription = watch((values) => {
      setDraftStatus("saving");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        } catch {}
        setDraftStatus("saved");
      }, 2000);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watch]);

  const startDictation = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SR) {
      alert("Voice input not supported on this device");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      const current = watch("summary") || "";
      const separator = current.trim().length > 0 ? " " : "";
      setValue("summary", current + separator + transcript, { shouldValidate: true });
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, watch, setValue]);

  const watchClientId = watch("clientId");
  const watchStartTime = watch("startTime");
  const watchEndTime = watch("endTime");

  // Auto-fill house when client is selected
  React.useEffect(() => {
    if (watchClientId && clients && houses) {
      const client = clients.find(c => c.id === watchClientId);
      if (client?.house) {
        const matchedHouse = houses.find(h => h.name === client.house);
        setValue("houseId", matchedHouse ? matchedHouse.id : client.house);
      }
    } else if (!watchClientId) {
      setValue("houseId", "");
    }
  }, [watchClientId, clients, houses, setValue]);

  const duration = calculateDuration(watchStartTime, watchEndTime);
  const tier = durationToTier(duration);

  const TIER_LABELS: Record<string, string> = {
    "1hr": "Standard",
    "2hr": "Extended",
    "3hr": "Long Session",
  };

  const onGenerate = async (data: NoteFormValues) => {
    setOverlapError(null);

    if (user) {
      try {
        const params = new URLSearchParams({ profileId: user.id });
        const res = await fetch(`/api/ledger?${params}`);
        if (res.ok) {
          const allEntries: { startTime: string; endTime: string; createdAt: string }[] = await res.json();
          const sameDayEntries = allEntries.filter(e => {
            const entryDate = new Date(e.createdAt).toISOString().split("T")[0];
            return entryDate === data.dateOfService;
          });
          const newStart = timeToMinutes(data.startTime);
          const newEnd = timeToMinutes(data.endTime);
          for (const entry of sameDayEntries) {
            if (hasTimeOverlap(newStart, newEnd, timeToMinutes(entry.startTime), timeToMinutes(entry.endTime))) {
              const msg = "Time overlap detected — adjust session time";
              setOverlapError(msg);
              toast({ title: msg, variant: "destructive" });
              return;
            }
          }
        }
      } catch {
        // fail open
      }
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: data.summary, noteType: data.noteType, tier }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ai = await res.json() as SOAIPNote;
      if (!ai.subjective || !ai.objective || !ai.assessment || !ai.intervention || !ai.plan) {
        throw new Error("Incomplete note returned");
      }
      setGeneratedSOAIP(ai);
    } catch {
      setGeneratedSOAIP(generateSOAIP(data.summary, data.noteType, tier));
    } finally {
      setNoteDate(data.dateOfService);
      setNoteStatus("pending");
      setIsGenerating(false);
    }
  };

  const onAccept = () => setNoteStatus("accepted");

  const onReject = () => {
    setGeneratedSOAIP(null);
    setNoteDate("");
    setNoteStatus("idle");
    setOverlapError(null);
  };

  const onNewNote = () => {
    setGeneratedSOAIP(null);
    setNoteDate("");
    setNoteStatus("idle");
    setOverlapError(null);
  };

  const onCopyNote = () => {
    if (!generatedSOAIP) return;
    const dosLine = noteDate ? `Date of Service: ${formatDOS(noteDate)}\n\n` : "";
    navigator.clipboard.writeText(dosLine + formatNoteContent(generatedSOAIP)).then(() => {
      toast({ title: "Copied", description: "Note copied to clipboard." });
    });
  };

  const onSaveNote = async () => {
    if (!generatedSOAIP || !user) return;

    const data = watch();
    const finalContent = formatNoteContent(generatedSOAIP);

    const client = clients?.find(c => c.id === data.clientId);
    const house = houses?.find(h => h.id === data.houseId);

    try {
      await createLedgerMutation.mutateAsync({
          clientId: data.clientId,
          profileId: user.id,
          house: house?.name || data.houseId,
          noteType: data.noteType,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: duration,
          noteContent: finalContent
        }
      });
      
      toast({
        title: "Note Saved",
        description: "Billing note has been successfully saved to the ledger.",
      });

      localStorage.removeItem(DRAFT_KEY);
      setDraftStatus(null);
      setGeneratedSOAIP(null);
      setNoteDate("");
      setNoteStatus("idle");
      setOverlapError(null);
      reset({
        clientId: "",
        houseId: "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        noteType: "" as any,
        dateOfService: todayISO,
        startTime: "09:00",
        endTime: "10:00",
        summary: "",
      });
      setTimeout(() => {
        document.querySelector<HTMLSelectElement>('[name="clientId"]')?.focus();
      }, 50);
    } catch {
      toast({
        title: "Error saving note",
        description: "Could not save the note to the ledger. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Create Billing Note</h1>
        <p className="text-muted-foreground mt-1">Generate compliant SOAIP notes efficiently.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form */}
        <div className="bg-card border border-border shadow-md shadow-black/5 rounded-2xl p-6">
          <form onSubmit={handleSubmit(onGenerate)} className="space-y-6">

            {draftStatus && (
              <div className="flex items-center justify-end">
                <span className="text-xs text-muted-foreground">
                  {draftStatus === "saving" ? "Saving…" : "✓ Draft saved"}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <select 
                  {...register("clientId")}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                >
                  <option value="">Select a client...</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  House
                  {watchClientId && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                      <Lock className="w-3 h-3" /> auto-filled
                    </span>
                  )}
                </label>
                <select 
                  {...register("houseId")}
                  disabled={!!watchClientId}
                  className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all outline-none ${
                    watchClientId
                      ? "bg-secondary/50 border-border text-muted-foreground cursor-not-allowed"
                      : "bg-background border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
                  }`}
                >
                  <option value="">Select a house...</option>
                  {houses?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                {errors.houseId && <p className="text-xs text-destructive">{errors.houseId.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Note Type</label>
                <select
                  {...register("noteType")}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                >
                  <option value="">Select type...</option>
                  {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.noteType && <p className="text-xs text-destructive">{errors.noteType.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date of Service</label>
                <input
                  type="date"
                  {...register("dateOfService")}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                />
                {errors.dateOfService && <p className="text-xs text-destructive">{errors.dateOfService.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time</label>
                <input 
                  type="time"
                  {...register("startTime")}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Time</label>
                <input 
                  type="time"
                  {...register("endTime")}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="px-4 py-3 rounded-xl bg-secondary/50 border border-border text-sm flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    {duration > 0 ? `${duration} mins` : '-- mins'}
                  </span>
                  {duration > 0 && (
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      tier === "3hr" ? "bg-violet-100 text-violet-700" :
                      tier === "2hr" ? "bg-blue-100 text-blue-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {TIER_LABELS[tier]}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Session Summary / Topic</label>
                <button
                  type="button"
                  onClick={startDictation}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all min-h-[40px] min-w-[130px] justify-center
                    ${isListening
                      ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/30 animate-pulse"
                      : "bg-background border-border text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4 shrink-0" />
                      <span>Listening…</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 shrink-0" />
                      <span>Dictate</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <textarea
                  {...register("summary")}
                  rows={4}
                  className={`w-full px-4 py-3 rounded-xl bg-background border-2 transition-all outline-none resize-none
                    ${isListening
                      ? "border-red-400 ring-4 ring-red-400/15"
                      : "border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
                    }`}
                  placeholder="Briefly describe what was discussed or done during the session, or tap Dictate to speak…"
                />
                {isListening && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-red-500 text-xs font-medium pointer-events-none">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Recording
                  </div>
                )}
              </div>
              {errors.summary && <p className="text-xs text-destructive">{errors.summary.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin text-primary" />
                  Generating with AI…
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate SOAIP Note
                </>
              )}
            </button>

            {overlapError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
                <X className="w-4 h-4 shrink-0" />
                {overlapError}
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Note Workflow */}
        <div className="flex flex-col h-full min-h-[500px]">
          <AnimatePresence mode="wait">

            {noteStatus === "idle" && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-border rounded-2xl bg-card/50"
              >
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No Note Generated</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">Fill out the session details and click generate to create a compliant SOAIP note.</p>
              </motion.div>
            )}

            {noteStatus === "pending" && generatedSOAIP && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col bg-card border-2 border-amber-300 shadow-lg shadow-amber-500/10 rounded-2xl overflow-hidden"
              >
                <div className="p-4 border-b border-amber-200 bg-amber-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <span className="font-semibold text-sm text-amber-800">Review Generated Note</span>
                  </div>
                  <span className="text-xs font-mono bg-white/80 px-2 py-1 rounded border border-amber-200 text-amber-700">H0038</span>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm leading-relaxed">
                  {noteDate && (
                    <div className="flex items-center gap-2 pb-4 border-b border-amber-200">
                      <span className="font-semibold text-foreground">Date of Service:</span>
                      <span className="font-mono text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-md text-xs font-semibold">{formatDOS(noteDate)}</span>
                    </div>
                  )}
                  {[
                    ["Subjective", generatedSOAIP.subjective],
                    ["Objective", generatedSOAIP.objective],
                    ["Assessment", generatedSOAIP.assessment],
                    ["Intervention", generatedSOAIP.intervention],
                    ["Plan", generatedSOAIP.plan],
                  ].map(([label, text]) => (
                    <div key={label}>
                      <h4 className="font-semibold text-foreground mb-1">{label}:</h4>
                      <p className="text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-amber-200 bg-amber-50/50 flex gap-3">
                  <button
                    onClick={onReject}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-red-200 bg-white text-red-600 font-semibold text-sm hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all min-h-[52px]"
                  >
                    <X className="w-5 h-5" />
                    Reject Note
                  </button>
                  <button
                    onClick={onAccept}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary to-blue-500 hover:from-primary hover:to-blue-400 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all min-h-[52px] disabled:opacity-70"
                  >
                    <Check className="w-5 h-5" />
                    Accept Note
                  </button>
                </div>
              </motion.div>
            )}

            {noteStatus === "accepted" && generatedSOAIP && (
              <motion.div
                key="accepted"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col bg-card border-2 border-green-400 shadow-lg shadow-green-500/10 rounded-2xl overflow-hidden"
              >
                <div className="p-4 border-b border-green-200 bg-green-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-sm text-green-800">Note Accepted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs text-green-700 font-medium">Locked</span>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm leading-relaxed">
                  {noteDate && (
                    <div className="flex items-center gap-2 pb-4 border-b border-green-200">
                      <span className="font-semibold text-foreground">Date of Service:</span>
                      <span className="font-mono text-green-700 bg-green-100 px-2.5 py-0.5 rounded-md text-xs font-semibold">{formatDOS(noteDate)}</span>
                    </div>
                  )}
                  {[
                    ["Subjective", generatedSOAIP.subjective],
                    ["Objective", generatedSOAIP.objective],
                    ["Assessment", generatedSOAIP.assessment],
                    ["Intervention", generatedSOAIP.intervention],
                    ["Plan", generatedSOAIP.plan],
                  ].map(([label, text]) => (
                    <div key={label}>
                      <h4 className="font-semibold text-foreground mb-1">{label}:</h4>
                      <p className="text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-green-200 bg-green-50/50 flex gap-3 flex-wrap">
                  <button
                    onClick={onCopyNote}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-muted-foreground text-sm font-medium hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                  <button
                    onClick={onNewNote}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-muted-foreground text-sm font-medium hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" /> New Note
                  </button>
                  <button
                    onClick={onSaveNote}
                    disabled={createLedgerMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-70"
                  >
                    {createLedgerMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Save to Ledger</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
