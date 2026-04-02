"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { setUserForTracking, clearUserForTracking } from "@/lib/snowplow-config";

interface User {
  email: string;
  isLoggedIn: boolean;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const savedUser = localStorage.getItem("demo-user");
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          if (
            userData &&
            typeof userData.email === "string" &&
            typeof userData.isLoggedIn === "boolean"
          ) {
            setUser(userData);
          } else {
            localStorage.removeItem("demo-user");
          }
        }
      } catch (error) {
        console.error("Error parsing saved user:", error);
        localStorage.removeItem("demo-user");
      } finally {
        setIsLoading(false);
      }
    };
    requestAnimationFrame(loadUser);
  }, []);

  const login = (email: string) => {
    const userData = { email, isLoggedIn: true };
    setUser(userData);
    localStorage.setItem("demo-user", JSON.stringify(userData));
    setUserForTracking(email);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("demo-user");
    clearUserForTracking();
  };

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
