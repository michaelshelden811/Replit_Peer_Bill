import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  houseName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem("userProfile");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem("userProfile");
      }
    }
    setIsLoaded(true);
  }, []);

  const login = useCallback((profile: UserProfile) => {
    localStorage.setItem("userProfile", JSON.stringify(profile));
    setUser(profile);
    setLocation("/dashboard");
  }, [setLocation]);

  const logout = useCallback(() => {
    localStorage.removeItem("userProfile");
    setUser(null);
    setLocation("/create-profile");
  }, [setLocation]);

  return { user, isLoaded, login, logout };
}
