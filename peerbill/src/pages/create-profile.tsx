import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useCreateProfile } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const roles = [
  "Peer Support Specialist",
  "House Manager",
  "Housing Director",
  "Clinical Director",
  "Admin"
] as const;

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(roles, { required_error: "Please select a role" }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function CreateProfile() {
  const { login } = useAuth();
  const { toast } = useToast();
  const createProfileMutation = useCreateProfile();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema)
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      const result = await createProfileMutation.mutateAsync({ data });
      login(result);
      toast({
        title: "Welcome to PeerBill",
        description: "Your profile has been created successfully.",
      });
    } catch {
      toast({
        title: "Unable to connect",
        description: "Could not reach the server. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Background Image & Effects */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract background" 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/80 backdrop-blur-xl border border-white/20 shadow-2xl shadow-primary/5 rounded-3xl p-8 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-center text-foreground mb-2">Welcome to PeerBill</h1>
          <p className="text-center text-muted-foreground mb-8 text-sm">Create your profile to start managing peer support notes efficiently.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <input 
                {...register("name")}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="Jane Doe"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email Address</label>
              <input 
                {...register("email")}
                type="email"
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="jane@example.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select 
                {...register("role")}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none"
              >
                <option value="">Select your role...</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full mt-4 flex items-center justify-center py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary to-blue-500 hover:from-primary hover:to-blue-400 text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
