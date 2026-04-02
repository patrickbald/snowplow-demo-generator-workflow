"use client";

import { useState, useEffect } from "react";
import { X, Shield, Target, Cookie, BarChart3 } from "lucide-react";
import {
  trackConsentAllowEvent,
  trackConsentDenyEvent,
  trackConsentSelectedEvent,
  trackCmpVisibleEvent,
  enableAnonymousTrackingMode,
  disableAnonymousTrackingMode,
} from "@/lib/snowplow-config";
import {
  ConsentPreferences,
  getConsentPreferences,
  saveConsentPreferences,
  hasConsentBeenGiven,
} from "@/lib/consent";

export default function ConsentManager() {
  const [showConsent, setShowConsent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    const savedPreferences = getConsentPreferences();
    if (savedPreferences) setPreferences(savedPreferences);

    // Auto-show on first visit if no consent recorded yet
    if (!hasConsentBeenGiven()) {
      setShowConsent(true);
      trackCmpVisibleEvent();
    }

    const handleShow = () => {
      setShowConsent(true);
      trackCmpVisibleEvent();
    };
    window.addEventListener("showConsentManager", handleShow);
    return () => window.removeEventListener("showConsentManager", handleShow);
  }, []);

  const handleAcceptAll = () => {
    const all: ConsentPreferences = { necessary: true, analytics: true, marketing: true, preferences: true };
    setPreferences(all);
    saveConsentPreferences(all);
    setShowConsent(false);
    setShowSettings(false);
    disableAnonymousTrackingMode();
    trackConsentAllowEvent(["necessary", "analytics", "marketing", "preferences"]);
  };

  const handleRejectAll = () => {
    const min: ConsentPreferences = { necessary: true, analytics: false, marketing: false, preferences: false };
    setPreferences(min);
    saveConsentPreferences(min);
    setShowConsent(false);
    setShowSettings(false);
    enableAnonymousTrackingMode();
    trackConsentDenyEvent(["necessary"]);
  };

  const handleSavePreferences = () => {
    saveConsentPreferences(preferences);
    setShowConsent(false);
    setShowSettings(false);
    if (preferences.analytics) disableAnonymousTrackingMode();
    else enableAnonymousTrackingMode();
    const scopes = Object.entries(preferences).filter(([, v]) => v).map(([k]) => k);
    trackConsentSelectedEvent(scopes);
  };

  const handlePreferenceChange = (key: keyof ConsentPreferences, value: boolean) => {
    if (key === "necessary") return;
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (!showConsent && !showSettings) return null;

  const categories = [
    { key: "necessary" as keyof ConsentPreferences, icon: Shield, title: "Necessary", description: "Essential cookies required for the site to function. Always active.", alwaysOn: true },
    { key: "analytics" as keyof ConsentPreferences, icon: BarChart3, title: "Analytics", description: "Helps us understand how you use the site using Snowplow behavioral data.", alwaysOn: false },
    { key: "marketing" as keyof ConsentPreferences, icon: Target, title: "Marketing", description: "Enables personalised content and targeted campaigns.", alwaysOn: false },
    { key: "preferences" as keyof ConsentPreferences, icon: Cookie, title: "Preferences", description: "Remembers your settings and preferences across sessions.", alwaysOn: false },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {!showSettings ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cookie className="h-5 w-5 text-[var(--color-brand-primary)]" />
                <h2 className="text-lg font-bold text-gray-900">Your privacy choices</h2>
              </div>
              <button onClick={() => setShowConsent(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              We use cookies to make {{BRAND_NAME}} work, improve your experience, and show you relevant content.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleAcceptAll} className="w-full py-3 px-4 bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold rounded-xl transition-colors">Accept All</button>
              <button onClick={handleRejectAll} className="w-full py-3 px-4 border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl transition-colors">Reject All</button>
              <button onClick={() => setShowSettings(true)} className="w-full py-3 px-4 text-[var(--color-brand-primary)] font-semibold rounded-xl transition-colors hover:bg-gray-50">Customize</button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Cookie preferences</h2>
              <button onClick={() => { setShowSettings(false); setShowConsent(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              {categories.map(({ key, icon: Icon, title, description, alwaysOn }) => (
                <div key={key} className="flex items-start justify-between gap-4 p-4 rounded-xl bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
                      <Icon className="h-4 w-4 text-[var(--color-brand-primary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-0.5">
                    {alwaysOn ? (
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Always on</span>
                    ) : (
                      <button
                        onClick={() => handlePreferenceChange(key, !preferences[key])}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences[key] ? "bg-[var(--color-brand-primary)]" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences[key] ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleRejectAll} className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl text-sm">Reject All</button>
              <button onClick={handleSavePreferences} className="flex-1 py-3 px-4 bg-[var(--color-brand-primary)] text-white font-semibold rounded-xl text-sm">Save Preferences</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
