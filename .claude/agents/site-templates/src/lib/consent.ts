export interface ConsentPreferences {
  necessary: boolean; // Always true, cannot be disabled
  analytics: boolean; // Controls Snowplow full vs anonymous tracking
  marketing: boolean; // Controls ad personalization
  preferences: boolean; // Controls preference persistence
}

// localStorage keys:
// - "consent-given"       → "true" if any consent recorded
// - "consent-preferences" → JSON stringified ConsentPreferences
// - "consent-date"        → ISO timestamp of last consent action
// - "signals-enabled"     → "true" or "false" for Signals toggle

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  const consentGiven = localStorage.getItem("consent-given");
  if (!consentGiven) return false;
  const savedPreferences = localStorage.getItem("consent-preferences");
  if (!savedPreferences) return false;
  try {
    const preferences = JSON.parse(savedPreferences);
    return preferences.analytics === true;
  } catch {
    return false;
  }
}

export function hasMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;
  const consentGiven = localStorage.getItem("consent-given");
  if (!consentGiven) return false;
  const savedPreferences = localStorage.getItem("consent-preferences");
  if (!savedPreferences) return false;
  try {
    const preferences = JSON.parse(savedPreferences);
    return preferences.marketing === true;
  } catch {
    return false;
  }
}

export function getConsentPreferences(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  const savedPreferences = localStorage.getItem("consent-preferences");
  if (!savedPreferences) return null;
  try {
    return JSON.parse(savedPreferences);
  } catch {
    return null;
  }
}

export function saveConsentPreferences(preferences: ConsentPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("consent-given", "true");
  localStorage.setItem("consent-preferences", JSON.stringify(preferences));
  localStorage.setItem("consent-date", new Date().toISOString());
}

export function hasConsentBeenGiven(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("consent-given") === "true";
}

export function clearConsentData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("consent-given");
  localStorage.removeItem("consent-preferences");
  localStorage.removeItem("consent-date");
}

// Signals toggle
export function isSignalsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const signalsPreference = localStorage.getItem("signals-enabled");
  return signalsPreference === null || signalsPreference === "true";
}

export function setSignalsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("signals-enabled", enabled.toString());
  window.dispatchEvent(
    new CustomEvent("signalsPreferenceChanged", { detail: { enabled } })
  );
}
