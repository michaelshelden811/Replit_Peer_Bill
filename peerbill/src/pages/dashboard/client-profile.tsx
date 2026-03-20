import { useParams, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useListClients, useListMonthlyReports, useCreateMonthlyReport } from "@workspace/api-client-react";
import {
  ArrowLeft, Clock, Home, User, Loader2, FileText, Calendar,
  Sparkles, CheckCircle, XCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ClientStats {
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  recentEntries: {
    id: string;
    clientId: string;
    clientName: string | null;
    profileId: string;
    profileName: string | null;
    house: string;
    noteType: string;
    startTime: string;
    endTime: string;
    duration: number;
    noteContent: string;
    createdAt: string;
  }[];
}

interface LedgerEntry {
  id: string;
  clientId: string;
  clientName: string;
  profileId: string;
  profileName: string;
  house: string;
  noteType: string;
  startTime: string;
  endTime: string;
  duration: number;
  noteContent: string;
  createdAt: string;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-100 to-indigo-100 border border-border rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

function buildMonthOptions() {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }
  return options;
}

function monthToDateRange(monthStr: string): { dateFrom: string; dateTo: string } {
  const d = new Date(monthStr + " 1");
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return {
    dateFrom: first.toISOString(),
    dateTo: new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59).toISOString(),
  };
}

const MONTH_OPTIONS = buildMonthOptions();

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useListClients();
  const client = clients.find((c) => c.id === id);

  const { data: stats, isLoading: loadingStats } = useQuery<ClientStats>({
    queryKey: ["/api/clients", id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: savedReports = [], isLoading: loadingReports } = useListMonthlyReports(
    { clientId: id },
    { enabled: !!id }
  );

  const createReportMutation = useCreateMonthlyReport();

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0]);
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "generating" | "preview">("idle");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!selectedMonth) return;
    setReportStatus("generating");
    setReportText("");

    try {
      const { dateFrom, dateTo } = monthToDateRange(selectedMonth);
      const params = new URLSearchParams({ clientId: id, dateFrom, dateTo });
      const ledgerRes = await fetch(`/api/ledger?${params}`);
      if (!ledgerRes.ok) throw new Error("Failed to fetch notes");
      const entries: LedgerEntry[] = await ledgerRes.json();

      if (entries.length === 0) {
        toast({
          title: "No notes found",
          description: `No session notes exist for ${selectedMonth}. Add notes first.`,
          variant: "destructive",
        });
        setReportStatus("idle");
        return;
      }

      const genRes = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          notes: entries.map((e) => ({
            noteContent: e.noteContent,
            noteType: e.noteType,
            startTime: e.startTime,
            endTime: e.endTime,
            createdAt: e.createdAt,
          })),
        }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error ?? "Generation failed");
      }

      const { reportText: generated } = await genRes.json();
      setReportText(generated);
      setReportStatus("preview");
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Could not generate report.",
        variant: "destructive",
      });
      setReportStatus("idle");
    }
  };

  const handleSaveReport = async () => {
    if (!reportText.trim() || !user) return;
    try {
      await createReportMutation.mutateAsync({
        data: {
          clientId: id,
          month: selectedMonth,
          reportText: reportText.trim(),
          createdBy: user.id,
        },
      });

      toast({ title: "Report saved", description: `${selectedMonth} progress report saved.` });
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-reports"] });
      setReportText("");
      setReportStatus("idle");
    } catch {
      toast({ title: "Save failed", description: "Could not save the report.", variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setReportText("");
    setReportStatus("idle");
  };

  const sortedReports = [...savedReports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (!client && clients.length > 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">Client not found</h3>
          <Link href="/dashboard/clients" className="text-sm text-primary hover:underline mt-2">
            Back to Clients
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-4">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          All Clients
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-border rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {client?.name ?? "Loading…"}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                {client?.house && (
                  <span className="flex items-center gap-1.5">
                    <Home className="w-4 h-4" />
                    {client.house}
                  </span>
                )}
                {client?.intakeDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Intake: {format(new Date(client.intakeDate + "T00:00:00"), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
            {client && (
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  client.status === "active"
                    ? "bg-green-500/10 text-green-600"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {client.status === "active" ? "Active" : "Inactive"}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        {loadingStats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard label="Today" value={`${stats.dailyHours}h`} />
              <StatCard label="This Week" value={`${stats.weeklyHours}h`} />
              <StatCard label="This Month" value={`${stats.monthlyHours}h`} />
            </div>

            {/* Session Feed */}
            <div className="mb-8">
              <h2 className="font-display font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Session History
              </h2>

              {stats.recentEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-2xl">
                  <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="font-medium text-foreground mb-1">No records found</p>
                  <p className="text-sm text-muted-foreground">
                    Sessions will appear here once notes are created for this client.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentEntries.map((entry) => {
                    const durationHours = Math.round((entry.duration / 60) * 10) / 10;
                    return (
                      <div key={entry.id} className="bg-card border border-border rounded-2xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              {format(new Date(entry.createdAt), "MMM d, yyyy")}
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-10 shrink-0">Peer</span>
                                <span className="font-semibold text-foreground">
                                  {entry.profileName ?? "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-10 shrink-0">House</span>
                                <span className="text-foreground">{entry.house}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              {durationHours}h
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.startTime} – {entry.endTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* ─── Monthly Progress Report ─── */}
        <div className="border-t border-border pt-8">
          <h2 className="font-display font-semibold text-lg text-foreground mb-5 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Monthly Progress Report
          </h2>

          {/* Generator */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-foreground">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setReportText("");
                    setReportStatus("idle");
                  }}
                  disabled={reportStatus === "generating"}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={reportStatus === "generating" || reportStatus === "preview"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-sm shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {reportStatus === "generating" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>

            {reportStatus === "preview" && (
              <div className="space-y-3">
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  rows={18}
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm leading-relaxed font-mono resize-y"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveReport}
                    disabled={createReportMutation.isPending || !reportText.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {createReportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Accept &amp; Save
                  </button>
                  <button
                    onClick={handleSaveReport}
                    disabled={createReportMutation.isPending || !reportText.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-sm shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {createReportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Edit &amp; Save
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={createReportMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-muted-foreground font-semibold text-sm hover:bg-secondary/70 disabled:opacity-50 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Reports List */}
          {loadingReports ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sortedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-card border border-border rounded-2xl">
              <FileText className="w-9 h-9 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground mb-1">No reports yet</p>
              <p className="text-sm text-muted-foreground">
                Generate and save a report above to see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedReports.map((report) => {
                const isOpen = expandedReportId === report.id;
                return (
                  <div key={report.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedReportId(isOpen ? null : report.id)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{report.month}</p>
                          <p className="text-xs text-muted-foreground">
                            Saved {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="border-t border-border px-5 py-4">
                        <div className="bg-muted/40 rounded-xl p-4">
                          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                            Read-only
                          </p>
                          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                            {report.reportText}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
