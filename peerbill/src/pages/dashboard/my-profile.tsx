import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Clock, FileText, Loader2, UserCircle, Phone, Mail, Home, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface ProfileStats {
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  recentEntries: {
    id: string;
    clientName: string;
    house: string;
    duration: number;
    startTime: string;
    endTime: string;
    noteType: string;
    createdAt: string;
  }[];
}

interface FullProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  houseName: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  peer: "Peer Support",
  house_manager: "House Manager",
  director: "Director",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-100 to-indigo-100 border border-border rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function MyProfilePage() {
  const { user } = useAuth();

  const { data: profile } = useQuery<FullProfile>({
    queryKey: ["/api/profiles", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${user!.id}`);
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: stats, isLoading } = useQuery<ProfileStats>({
    queryKey: ["/api/profiles", user?.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${user!.id}/stats`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const displayProfile = profile ?? user;
  const roleLabel = ROLE_LABELS[(displayProfile as { role?: string })?.role ?? ""] ?? displayProfile?.role ?? "";

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground mb-1">My Profile</h1>
        <p className="text-muted-foreground">Your activity summary and session history.</p>
      </div>

      {/* Profile Header */}
      <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserCircle className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-display font-bold text-foreground">{displayProfile?.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {roleLabel && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {roleLabel}
                </span>
              )}
              {profile?.houseName && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Home className="w-3.5 h-3.5" />
                  {profile.houseName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayProfile?.email && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{displayProfile.email}</span>
            </div>
          )}
          {profile?.phone && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{profile.phone}</span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
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

          {/* Session Feed */}
          <div>
            <h2 className="font-display font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              My Sessions
            </h2>

            {stats.recentEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center bg-card border border-border rounded-2xl">
                <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-foreground mb-1">No sessions yet</p>
                <p className="text-sm text-muted-foreground">Your sessions will appear here once notes are saved.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentEntries.map(entry => {
                  const entryDate = new Date(entry.createdAt);
                  const durationHours = Math.round((entry.duration / 60) * 10) / 10;
                  return (
                    <div key={entry.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {format(entryDate, "MMM d, yyyy")}
                          </p>
                          <p className="font-semibold text-foreground truncate">{entry.clientName}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                            <Home className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{entry.house}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
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
    </Layout>
  );
}
