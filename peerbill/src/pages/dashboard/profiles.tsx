import React from "react";
import { Layout } from "@/components/layout";
import { useListProfiles, useDeleteProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { UserCircle, Trash2, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProfilesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: profiles, isLoading } = useListProfiles();
  const deleteProfileMutation = useDeleteProfile();

  const onDelete = async (id: string) => {
    if (id === user?.id) {
      toast({ title: "Cannot delete your own profile", variant: "destructive" });
      return;
    }
    try {
      await deleteProfileMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({ title: "Profile removed" });
    } catch {
      toast({ title: "Failed to remove profile", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Staff Profiles</h1>
        <p className="text-muted-foreground mt-1">Directory of staff members and administrators.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : profiles?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <UserCircle className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    No profiles found.
                  </td>
                </tr>
              ) : (
                profiles?.map(profile => (
                  <tr key={profile.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center font-medium text-foreground">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3 font-bold text-xs uppercase">
                          {profile.name.substring(0, 2)}
                        </div>
                        {profile.name}
                        {user?.id === profile.id && (
                          <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground border border-border">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{profile.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium text-xs border border-indigo-100">
                        {profile.role.includes("Admin") || profile.role.includes("Director") ? (
                          <Shield className="w-3 h-3 mr-1" />
                        ) : null}
                        {profile.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user?.id !== profile.id && (
                        <button 
                          onClick={() => onDelete(profile.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors inline-flex"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
