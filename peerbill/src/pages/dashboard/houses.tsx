import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListHouses, useCreateHouse, useDeleteHouse, useListLedgerEntries, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Home, Plus, X, ChevronRight, Loader2, BedDouble, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { House, LedgerEntry, Client } from "@workspace/api-client-react";

const createHouseSchema = z.object({
  name: z.string().min(1, "House name is required"),
  managerName: z.string().min(1, "Manager name is required"),
  bedCount: z.coerce.number().int().min(1).max(8),
});
type CreateHouseForm = z.infer<typeof createHouseSchema>;

function computeStats(entries: LedgerEntry[], houseName: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const houseEntries = entries.filter(e => e.house === houseName);
  let daily = 0, weekly = 0, monthly = 0;
  const clientIds = new Set<string>();

  for (const e of houseEntries) {
    const d = new Date(e.createdAt);
    clientIds.add(e.clientId);
    if (d >= startOfToday) daily += e.duration;
    if (d >= startOfWeek) weekly += e.duration;
    if (d >= startOfMonth) monthly += e.duration;
  }

  const toH = (m: number) => Math.round((m / 60) * 10) / 10;
  return {
    dailyHours: toH(daily),
    weeklyHours: toH(weekly),
    monthlyHours: toH(monthly),
    activeClients: clientIds.size,
  };
}

function HouseCard({ house, allEntries, allClients }: { house: House; allEntries: LedgerEntry[]; allClients: Client[] }) {
  const stats = computeStats(allEntries, house.name);
  const occupiedBeds = allClients.filter(
    (c) => c.house === house.name && c.status === "active"
  ).length;
  const totalBeds = house.bedCount ?? 8;
  const openBeds = Math.max(0, totalBeds - occupiedBeds);

  return (
    <Link href={`/dashboard/houses/${house.id}`}>
      <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">
              {house.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manager: {house.managerName || "—"}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
        </div>

        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-1.5 text-sm">
            <BedDouble className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{occupiedBeds} / {totalBeds}</span>
            <span className="text-muted-foreground">beds</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-full",
            openBeds > 0 ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
          )}>
            <Users className="w-3.5 h-3.5" />
            <span className="font-medium">{openBeds} open</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Today", value: stats.dailyHours },
            { label: "Week", value: stats.weeklyHours },
            { label: "Month", value: stats.monthlyHours },
          ].map(({ label, value }) => (
            <div key={label} className="text-center bg-secondary/50 rounded-xl py-2.5 px-1">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              <p className="font-bold text-foreground text-sm">{value}h</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function HousesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: houses = [], isLoading: loadingHouses } = useListHouses();
  const { data: allEntries = [], isLoading: loadingEntries } = useListLedgerEntries({});
  const { data: allClients = [] } = useListClients();
  const createMutation = useCreateHouse();
  const deleteMutation = useDeleteHouse();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateHouseForm>({
    resolver: zodResolver(createHouseSchema),
    defaultValues: { name: "", managerName: "", bedCount: 8 },
  });

  const onSubmit = async (data: CreateHouseForm) => {
    try {
      await createMutation.mutateAsync({ data: { name: data.name, managerName: data.managerName, bedCount: data.bedCount } });
      queryClient.invalidateQueries({ queryKey: ["/api/houses"] });
      toast({ title: "House created" });
      reset();
      setShowForm(false);
    } catch {
      toast({ title: "Failed to create house", variant: "destructive" });
    }
  };

  const isLoading = loadingHouses || loadingEntries;

  return (
    <Layout>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Houses</h1>
          <p className="text-muted-foreground mt-1">Manage and track activity across all program houses.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add House"}
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="font-display font-semibold text-lg text-foreground mb-5">New House</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">House Name *</label>
              <input
                {...register("name")}
                placeholder="e.g. Oak House"
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Manager Name *</label>
              <input
                {...register("managerName")}
                placeholder="e.g. Sarah Mitchell"
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
              />
              {errors.managerName && <p className="text-xs text-destructive mt-1">{errors.managerName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bed Count (max 8)</label>
              <input
                {...register("bedCount")}
                type="number"
                min={1}
                max={8}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
              />
              {errors.bedCount && <p className="text-xs text-destructive mt-1">{errors.bedCount.message}</p>}
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-70"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create House
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : houses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Home className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">No houses yet</h3>
          <p className="text-sm text-muted-foreground">Add your first house to start tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {houses.map(house => (
            <HouseCard key={house.id} house={house} allEntries={allEntries} allClients={allClients} />
          ))}
        </div>
      )}
    </Layout>
  );
}
