"use client";

import { useState } from "react";
import { X, Mail } from "lucide-react";
import { useUser } from "@/contexts/user-context";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string) => void;
}

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const { login } = useUser();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    login(email.trim());
    onLogin(email.trim());
    setIsLoading(false);
    setEmail("");
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="relative bg-[var(--color-brand-primary)] p-8 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-white">Welcome to {{BRAND_NAME}}</h2>
          <p className="text-white/80 text-sm mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent"
                required
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full flex justify-center items-center py-3 px-4 rounded-full text-sm font-semibold text-white bg-[var(--color-brand-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Signing in...</>
            ) : "Sign In"}
          </button>
          <p className="mt-4 text-xs text-gray-400 text-center">Demo site — any email works for demonstration.</p>
        </form>
      </div>
    </div>
  );
}
