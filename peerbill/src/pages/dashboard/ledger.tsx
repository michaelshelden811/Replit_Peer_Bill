import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import {
  useListLedgerEntries,
  useListClients,
  useListHouses,
  useListProfiles,
} from "@workspace/api-client-react";
import { FileText, Loader2, Clock, Home, Users, User, X, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Filters {
  clientName: string;
  houseName: string;
  peerName: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  clientName: "",
  houseName: "",
  peerName: "",
  dateFrom: "",
  dateTo: "",
};

const FILTER_LABELS: Record<keyof Filters, string> = {
  clientName: "Client",
  houseName: "House",
  peerName: "Peer",
  dateFrom: "From",
  dateTo: "To",
};

export default function LedgerPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: allEntries = [], isLoading } = useListLedgerEntries({});
  const { data: clients = [] } = useListClients();
  const { data: houses = [] } = useListHouses();
  const { data: profiles = [] } = useListProfiles();

  const filtered = useMemo(() => {
    let result = [...allEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters.clientName) {
      result = result.filter(e => e.clientName === filters.clientName);
    }
    if (filters.houseName) {
      result = result.filter(e => e.house === filters.houseName);
    }
    if (filters.peerName) {
      result = result.filter(e => e.profileName === filters.peerName);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter(e => new Date(e.createdAt) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(e => new Date(e.createdAt) <= to);
    }

    return result;
  }, [allEntries, filters]);

  const totalMinutes = useMemo(() => filtered.reduce((sum, e) => sum + e.duration, 0), [filtered]);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== "") as [keyof Filters, string][];
  const hasFilters = activeFilters.length > 0;

  const removeFilter = (key: keyof Filters) => setFilters(p => ({ ...p, [key]: "" }));
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setExpandedId(null); };
  const setFilter = (key: keyof Filters, value: string) => setFilters(p => ({ ...p, [key]: value }));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Global Ledger</h1>
        <p className="text-muted-foreground mt-1">All sessions across the system. Filter to narrow results.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Client */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Client
            </label>
            <select
              value={filters.clientName}
              onChange={e => setFilter("clientName", e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* House */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> House
            </label>
            <select
              value={filters.houseName}
              onChange={e => setFilter("houseName", e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">All Houses</option>
              {houses.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
            </select>
          </div>

          {/* Peer */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Peer
            </label>
            <select
              value={filters.peerName}
              onChange={e => setFilter("peerName", e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">All Peers</option>
              {profiles.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilter("dateFrom", e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilter("dateTo", e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Active Tags + Reset */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/60">
            {activeFilters.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {FILTER_LABELS[key]}: {value}
                <button onClick={() => removeFilter(key)} className="hover:text-primary/60 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-medium hover:bg-secondary/80 transition-colors ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-slate-100 to-indigo-100 border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
          <p className="text-3xl font-display font-bold text-foreground">{totalHours}h</p>
        </div>
        <div className="bg-gradient-to-br from-slate-100 to-indigo-100 border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground mb-1">Entries</p>
          <p className="text-3xl font-display font-bold text-foreground">
            {filtered.length}
            <span className="text-base font-normal text-muted-foreground ml-1.5">notes</span>
          </p>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
          <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-foreground mb-1">No records found</p>
          {hasFilters && (
            <button onClick={resetFilters} className="text-sm text-primary hover:underline mt-1">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => {
            const isExpanded = expandedId === entry.id;
            const durationHours = Math.round((entry.duration / 60) * 10) / 10;
            return (
              <div
                key={entry.id}
                className={cn(
                  "bg-card border border-border rounded-2xl overflow-hidden transition-all",
                  isExpanded && "border-primary/30"
                )}
              >
                <button
                  className="w-full text-left p-4 hover:bg-secondary/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-10 shrink-0">Client</span>
                          <span className="font-semibold text-foreground truncate">{entry.clientName ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-10 shrink-0">Peer</span>
                          <span className="text-foreground truncate">{entry.profileName ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-10 shrink-0">House</span>
                          <span className="text-foreground truncate">{entry.house}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        {durationHours}h
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.startTime} – {entry.endTime}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-border/60">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-3">
                          SOAIP Note
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground bg-secondary/30 rounded-xl p-4">
                          {entry.noteContent}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
