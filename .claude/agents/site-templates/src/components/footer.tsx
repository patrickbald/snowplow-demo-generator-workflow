"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Shield, Sparkles, ChevronDown, Play, ExternalLink } from "lucide-react";
import { newSession } from "@snowplow/browser-tracker";
import { siteConfig, getRandomUtmParameters } from "@/lib/config";
import { buildUrlWithUtm } from "@/lib/utils";
import { isSignalsEnabled, setSignalsEnabled } from "@/lib/consent";

export default function Footer() {
  const router = useRouter();
  const [signalsOn, setSignalsOn] = useState(true);
  const [showSignalsMenu, setShowSignalsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSignalsOn(isSignalsEnabled()); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowSignalsMenu(false);
    };
    if (showSignalsMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSignalsMenu]);

  const handleUtmReload = () => {
    newSession();
    const utmParams = getRandomUtmParameters();
    const urlWithUtm = buildUrlWithUtm(window.location.href, utmParams);
    window.location.href = urlWithUtm;
  };

  const handleToggleSignals = () => {
    const newValue = !signalsOn;
    setSignalsOn(newValue);
    setSignalsEnabled(newValue);
    setShowSignalsMenu(false);
  };

  return (
    <footer className="bg-gray-950 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="text-white font-bold text-lg">{siteConfig.brand.name}</p>
            <p className="text-gray-400 text-sm mt-1">{siteConfig.brand.tagline}</p>
          </div>
          <div>
            <h4 className="text-gray-300 font-semibold text-sm mb-3">Legal</h4>
            <div className="space-y-2">
              {siteConfig.navigation.footerLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="block text-gray-400 hover:text-white text-sm transition-colors group"
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  title={link.href.includes("snowplow.io") ? "Cross-domain tracking enabled" : undefined}
                >
                  <span className="flex items-center gap-1">
                    {link.name}
                    {link.href.includes("snowplow.io") && (
                      <ExternalLink className="h-3 w-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-gray-300 font-semibold text-sm mb-3">Demo Controls</h4>
            <p className="text-gray-500 text-xs">Snowplow tracking tools for the demo session.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
          <p className="text-gray-600 text-xs">© {new Date().getFullYear()} {siteConfig.brand.name} Demo. Powered by Snowplow.</p>
          <div className="flex items-center gap-2">
            <button onClick={handleUtmReload} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors">
              <RefreshCw className="h-3 w-3 mr-1.5" />UTM Reload
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("showConsentManager"))} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors">
              <Shield className="h-3 w-3 mr-1.5" />Manage Consent
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowSignalsMenu(!showSignalsMenu)}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${signalsOn ? "text-white bg-[var(--color-brand-primary)] hover:opacity-90" : "text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"}`}
              >
                <Sparkles className="h-3 w-3 mr-1.5" />Signals
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showSignalsMenu ? "rotate-180" : ""}`} />
              </button>
              {showSignalsMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-50">
                  <button onClick={handleToggleSignals} className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-between">
                    <div className="flex items-center"><Sparkles className="h-4 w-4 mr-2" /><span>Signals Personalization</span></div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${signalsOn ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"}`}>{signalsOn ? "On" : "Off"}</span>
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => router.push("/video")} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors">
              <Play className="h-3 w-3 mr-1.5" />Watch Video
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
