import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useListHouses } from "@workspace/api-client-react";
import { ArrowLeft, BedDouble, Users, Clock, Loader2, Home, FileText } from "lucide-react";
import { format } from "date-fns";

interface ClientStat {
  clientId: string;
  clientName: string;
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
}

interface LedgerEntry {
  id: string;
  clientId: string;
  clientName: string;
  duration: number;
  startTime: string;
  endTime: string;
  noteType: string;
  createdAt: string;
}

interface HouseStats {
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  activeClients: number;
  openBeds: number;
  clientBreakdown: ClientStat[];
  recentEntries: LedgerEntry[];
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function HouseProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: houses = [] } = useListHouses();
  const house = houses.find(h => h.id === id);

  const { data: stats, isLoading: loadingStats } = useQuery<HouseStats>({
    queryKey: ["/api/houses", id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/houses/${id}/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!id,
    staleTime: 30_000,
  });

  if (!house && houses.length > 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Home className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">House not found</h3>
          <Link href="/dashboard/houses" className="text-sm text-primary hover:underline mt-2">
            Back to Houses
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/dashboard/houses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          All Houses
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {house?.name ?? "Loading…"}
              </h1>
              {house?.managerName && (
                <p className="text-muted-foreground mt-1">Manager: {house.managerName}</p>
              )}
            </div>
            {stats && house && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm">
                  <BedDouble className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{stats.activeClients} / {house.bedCount} beds</span>
                </div>
                <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium ${stats.openBeds > 0 ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                  <Users className="w-4 h-4" />
                  {stats.openBeds} open {stats.openBeds === 1 ? "bed" : "beds"}
                </div>
              </div>
            )}
          </div>
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            {/* Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard label="Today" value={`${stats.dailyHours}h`} />
              <StatCard label="This Week" value={`${stats.weeklyHours}h`} />
              <StatCard label="This Month" value={`${stats.monthlyHours}h`} />
            </div>

            {/* Client Breakdown */}
            {stats.clientBreakdown.length > 0 && (
              <div className="mb-6">
                <h2 className="font-display font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Client Breakdown
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {stats.clientBreakdown.map(client => (
                    <div key={client.clientId} className="bg-card border border-border rounded-2xl p-4">
                      <p className="font-semibold text-foreground mb-3">{client.clientName}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Today", value: client.dailyHours },
                          { label: "Week", value: client.weeklyHours },
                          { label: "Month", value: client.monthlyHours },
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center bg-secondary/50 rounded-xl py-2">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="font-bold text-foreground text-sm">{value}h</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ledger Feed */}
            <div>
              <h2 className="font-display font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Recent Sessions
              </h2>
              {stats.recentEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-2xl">
                  <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No sessions recorded yet for this house.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentEntries.map(entry => {
                    const entryDate = new Date(entry.createdAt);
                    const durationHours = Math.round((entry.duration / 60) * 10) / 10;
                    return (
                      <div key={entry.id} className="bg-card border border-border rounded-2xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {format(entryDate, "MMM d, yyyy")}
                            </p>
                            <p className="font-semibold text-foreground">{entry.clientName}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{entry.noteType}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              {durationHours}h
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {entry.startTime} – {entry.endTime}
                            </p>
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
      </div>
    </Layout>
  );
}
