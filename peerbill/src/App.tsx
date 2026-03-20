import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

// Pages
import CreateProfile from "@/pages/create-profile";
import DashboardIndex from "@/pages/dashboard/index";
import BillingPage from "@/pages/dashboard/billing";
import ClientsPage from "@/pages/dashboard/clients";
import ProfilesPage from "@/pages/dashboard/profiles";
import LedgerPage from "@/pages/dashboard/ledger";
import HousesPage from "@/pages/dashboard/houses";
import HouseProfilePage from "@/pages/dashboard/house-profile";
import ClientProfilePage from "@/pages/dashboard/client-profile";
import MyProfilePage from "@/pages/dashboard/my-profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootRedirect() {
  const { user, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded) {
      if (user) {
        setLocation("/dashboard");
      } else {
        setLocation("/create-profile");
      }
    }
  }, [user, isLoaded, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/create-profile" component={CreateProfile} />
      <Route path="/dashboard" component={DashboardIndex} />
      <Route path="/dashboard/billing" component={BillingPage} />
      <Route path="/dashboard/clients" component={ClientsPage} />
      <Route path="/dashboard/profiles" component={ProfilesPage} />
      <Route path="/dashboard/ledger" component={LedgerPage} />
      <Route path="/dashboard/houses" component={HousesPage} />
      <Route path="/dashboard/houses/:id" component={HouseProfilePage} />
      <Route path="/dashboard/clients/:id" component={ClientProfilePage} />
      <Route path="/dashboard/my-profile" component={MyProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
