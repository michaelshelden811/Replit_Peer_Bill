import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useListHouses,
  useCreateHouse,
  useDeleteHouse,
  type Client,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Trash2, Home, Users as UsersIcon, Loader2, X, Clock, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";

const today = new Date().toISOString().split("T")[0];

const clientSchema = z.object({
  name: z.string().min(2, "Full name required"),
  house: z.string().min(1, "House required"),
  status: z.enum(["active", "inactive"]).default("active"),
  intakeDate: z
    .string()
    .min(1, "Intake date required")
    .refine((d) => d <= today, { message: "Intake date cannot be in the future" }),
});

const houseSchema = z.object({
  name: z.string().min(2, "House name required"),
});

type ClientForm = z.infer<typeof clientSchema>;
type HouseForm = z.infer<typeof houseSchema>;

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: clients = [], isLoading: clientsLoading } = useListClients();
  const { data: houses = [], isLoading: housesLoading } = useListHouses();

  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();
  const createHouseMutation = useCreateHouse();
  const deleteHouseMutation = useDeleteHouse();

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isHouseModalOpen, setIsHouseModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const {
    register: regClient,
    handleSubmit: handleClientSubmit,
    reset: resetClient,
    formState: { errors: clientErrors },
  } = useForm<ClientForm>({ resolver: zodResolver(clientSchema) });

  const {
    register: regHouse,
    handleSubmit: handleHouseSubmit,
    reset: resetHouse,
  } = useForm<HouseForm>({ resolver: zodResolver(houseSchema) });

  useEffect(() => {
    if (editingClient) {
      resetClient({
        name: editingClient.name,
        house: editingClient.house ?? "",
        status: (editingClient.status ?? "active") as "active" | "inactive",
        intakeDate: editingClient.intakeDate ?? "",
      });
    } else {
      resetClient({ name: "", house: "", status: "active", intakeDate: "" });
    }
  }, [editingClient, resetClient]);

  const openAddModal = () => {
    setEditingClient(null);
    setIsClientModalOpen(true);
  };

  const openEditModal = (client: Client, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingClient(client);
    setIsClientModalOpen(true);
  };

  const closeClientModal = () => {
    setIsClientModalOpen(false);
    setEditingClient(null);
    resetClient({ name: "", house: "", status: "active", intakeDate: "" });
  };

  const onClientSubmit = async (data: ClientForm) => {
    if (editingClient) {
      await onEditClient(data);
    } else {
      await onAddClient(data);
    }
  };

  const onAddClient = async (data: ClientForm) => {
    try {
      await createClientMutation.mutateAsync({ data: {
        name: data.name,
        house: data.house,
        status: data.status,
        intakeDate: data.intakeDate,
      }});
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      closeClientModal();
      toast({ title: "Client added successfully" });
    } catch (err: any) {
      const msg = err?.message?.includes("409") || err?.status === 409
        ? "A client with this name already exists"
        : "Failed to add client";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const onEditClient = async (data: ClientForm) => {
    try {
      await updateClientMutation.mutateAsync({
        id: editingClient!.id,
        data: {
          name: data.name,
          house: data.house,
          status: data.status,
          intakeDate: data.intakeDate,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      closeClientModal();
      toast({ title: "Client updated successfully" });
    } catch (err: any) {
      const msg = err?.message?.includes("409") || err?.status === 409
        ? "A client with this name already exists"
        : "Failed to update client";
      toast({ title: msg, variant: "destructive" });
    }
  };

  const onDeleteClient = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteClientMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client removed" });
    } catch {
      toast({ title: "Failed to remove client", variant: "destructive" });
    }
  };

  const onAddHouse = async (data: HouseForm) => {
    try {
      await createHouseMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["/api/houses"] });
      resetHouse();
      toast({ title: "House added successfully" });
    } catch {
      toast({ title: "Failed to add house", variant: "destructive" });
    }
  };

  const onDeleteHouse = async (id: string) => {
    try {
      await deleteHouseMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/houses"] });
      toast({ title: "House removed" });
    } catch {
      toast({ title: "Failed to remove house", variant: "destructive" });
    }
  };

  const isPending = editingClient
    ? updateClientMutation.isPending
    : createClientMutation.isPending;

  return (
    <Layout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage active clients and housing assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHouseModalOpen(true)}
            className="flex items-center px-4 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-all border border-border"
          >
            <Home className="w-4 h-4 mr-2" />
            Manage Houses
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-sm shadow-md hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Client
          </button>
        </div>
      </div>

      {/* Client Cards — full width */}
      {clientsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-2xl">
          <UsersIcon className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-foreground mb-1">No clients yet</p>
          <p className="text-sm text-muted-foreground">
            Click <span className="text-primary font-medium">+ Add Client</span> to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
              <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer group relative hover:border-primary/40">
                {/* Edit */}
                <button
                  onClick={(e) => openEditModal(client, e)}
                  className="absolute top-3 right-10 p-1.5 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit Client"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => onDeleteClient(client.id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete Client"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Name + Status */}
                <div className="flex items-start justify-between mb-3 pr-6">
                  <div>
                    <p className="font-display font-bold text-foreground text-lg leading-tight">
                      {client.name}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Home className="w-3.5 h-3.5" />
                      {client.house}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      client.status === "active"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {client.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>

                {client.intakeDate && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Intake: {format(new Date(client.intakeDate + "T00:00:00"), "MMM d, yyyy")}
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  View session history →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ─── Add / Edit Client Modal ─── */}
      <AnimatePresence>
        {isClientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeClientModal}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border relative z-10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  {editingClient ? (
                    <><Pencil className="w-5 h-5 text-primary" />Edit Client</>
                  ) : (
                    <><Plus className="w-5 h-5 text-primary" />Add New Client</>
                  )}
                </h2>
                <button
                  onClick={closeClientModal}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleClientSubmit(onClientSubmit)} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Full Name</label>
                  <input
                    {...regClient("name")}
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder="Client Name"
                  />
                  {clientErrors.name && (
                    <p className="text-xs text-destructive mt-1">{clientErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Assigned House</label>
                  <select
                    {...regClient("house")}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  >
                    <option value="">Select a house...</option>
                    {houses.map((h) => (
                      <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                  </select>
                  {clientErrors.house && (
                    <p className="text-xs text-destructive mt-1">{clientErrors.house.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Status</label>
                  <select
                    {...regClient("status")}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Intake Date</label>
                  <input
                    {...regClient("intakeDate")}
                    type="date"
                    max={today}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  />
                  {clientErrors.intakeDate && (
                    <p className="text-xs text-destructive mt-1">{clientErrors.intakeDate.message}</p>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeClientModal}
                    className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/70 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-sm shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingClient ? (
                      "Save Changes"
                    ) : (
                      "Add Client"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Houses Modal ─── */}
      <AnimatePresence>
        {isHouseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsHouseModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border relative z-10 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Home className="w-5 h-5 text-primary" />
                  Manage Houses
                </h2>
                <button
                  onClick={() => setIsHouseModalOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 border-b border-border bg-card">
                <form onSubmit={handleHouseSubmit(onAddHouse)} className="flex gap-3">
                  <input
                    {...regHouse("name")}
                    className="flex-1 px-4 py-2 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
                    placeholder="New house name..."
                  />
                  <button
                    type="submit"
                    disabled={createHouseMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-medium shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    Add
                  </button>
                </form>
              </div>

              <div className="overflow-y-auto p-5 space-y-3">
                {housesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : houses.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No houses configured.
                  </p>
                ) : (
                  houses.map((house) => (
                    <div
                      key={house.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                    >
                      <span className="font-medium text-sm">{house.name}</span>
                      <button
                        onClick={() => onDeleteHouse(house.id)}
                        className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
