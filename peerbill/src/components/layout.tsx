import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  BookOpen, 
  LogOut,
  Sparkles,
  Menu,
  X,
  Home,
  User,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Billing", href: "/dashboard/billing", icon: Receipt },
  { name: "My Profile", href: "/dashboard/my-profile", icon: User },
  { name: "Houses", href: "/dashboard/houses", icon: Home },
  { name: "Clients", href: "/dashboard/clients", icon: Users },
  { name: "Profiles", href: "/dashboard/profiles", icon: UserCircle },
  { name: "Ledger", href: "/dashboard/ledger", icon: BookOpen },
];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (isLoaded && !user) {
      setLocation("/create-profile");
    }
  }, [user, isLoaded, setLocation]);

  if (!isLoaded || !user) return null;

  return <>{children}</>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex w-full font-sans">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border shadow-sm shadow-black/5 z-10">
          <div className="h-16 flex items-center px-6 border-b border-border/50">
            <Sparkles className="w-5 h-5 text-primary mr-2" />
            <span className="font-display font-bold text-xl tracking-tight text-foreground">PeerBill</span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href} className={cn(
                  "flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-gradient-to-r from-blue-100 to-indigo-100 text-primary" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}>
                  <Icon className={cn("w-5 h-5 mr-3 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border/50">
            <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
              </div>
              <button 
                onClick={logout}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Header & Menu */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
          <div className="flex items-center">
            <Sparkles className="w-5 h-5 text-primary mr-2" />
            <span className="font-display font-bold text-lg">PeerBill</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-foreground">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden fixed inset-0 z-40 bg-card/95 backdrop-blur-md pt-16 flex flex-col"
            >
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={cn(
                      "flex items-center px-4 py-4 rounded-xl text-base font-medium",
                      isActive ? "bg-gradient-to-r from-blue-100 to-indigo-100 text-primary" : "text-muted-foreground"
                    )}>
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border">
                <button 
                  onClick={() => { setIsMobileMenuOpen(false); logout(); }}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-destructive/10 text-destructive font-medium"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col w-full h-screen overflow-hidden pt-16 md:pt-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
