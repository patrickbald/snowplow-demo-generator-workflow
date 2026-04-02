import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildUrlWithUtm(
  url: string,
  utmParams: {
    source: string;
    medium: string;
    campaign: string;
    term?: string;
    content?: string;
    gclid?: string;
    msclkid?: string;
    dclid?: string;
  }
): string {
  const urlObj = new URL(url, window.location.origin);

  urlObj.searchParams.set("utm_source", utmParams.source);
  urlObj.searchParams.set("utm_medium", utmParams.medium);
  urlObj.searchParams.set("utm_campaign", utmParams.campaign);

  if (utmParams.term) urlObj.searchParams.set("utm_term", utmParams.term);
  if (utmParams.content)
    urlObj.searchParams.set("utm_content", utmParams.content);
  if (utmParams.gclid) urlObj.searchParams.set("gclid", utmParams.gclid);
  if (utmParams.msclkid)
    urlObj.searchParams.set("msclkid", utmParams.msclkid);
  if (utmParams.dclid) urlObj.searchParams.set("dclid", utmParams.dclid);

  return urlObj.toString();
}
