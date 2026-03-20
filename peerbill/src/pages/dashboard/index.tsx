import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useListLedgerEntries } from "@workspace/api-client-react";
import { Clock, FileText, TrendingUp, Calendar, Home, User } from "lucide-react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

function toH(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-100 to-indigo-100 border border-border rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: allEntries = [], isLoading } = useListLedgerEntries({});

  const myEntries = allEntries.filter(e => e.profileId === user?.id);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayMin = 0, weekMin = 0, monthMin = 0;
  let todayCount = 0, weekCount = 0, monthCount = 0;

  for (const e of myEntries) {
    const d = new Date(e.createdAt);
    if (d >= todayStart) { todayMin += e.duration; todayCount++; }
    if (d >= weekStart)  { weekMin  += e.duration; weekCount++;  }
    if (d >= monthStart) { monthMin += e.duration; monthCount++; }
  }

  const recentEntries = [...myEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Your personal activity overview.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Today"
              value={`${toH(todayMin)}h`}
              sub={`${todayCount} note${todayCount !== 1 ? "s" : ""}`}
            />
            <StatCard
              label="This Week"
              value={`${toH(weekMin)}h`}
              sub={`${weekCount} note${weekCount !== 1 ? "s" : ""}`}
            />
            <StatCard
              label="This Month"
              value={`${toH(monthMin)}h`}
              sub={`${monthCount} note${monthCount !== 1 ? "s" : ""}`}
            />
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recent Activity
            </h2>

            {recentEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
                <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-foreground mb-1">No notes yet</p>
                <p className="text-sm text-muted-foreground">
                  Head to <span className="text-primary font-medium">Billing</span> to create your first session note.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEntries.map((entry) => {
                  const dos = new Date(entry.createdAt);
                  const hours = toH(entry.duration);
                  return (
                    <div
                      key={entry.id}
                      className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="font-semibold text-foreground">
                            {entry.clientName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {entry.noteType}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {entry.house}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(dos, "MMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {entry.startTime} – {entry.endTime}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-display font-bold text-foreground">{hours}h</p>
                        <p className="text-xs text-muted-foreground">billed</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
