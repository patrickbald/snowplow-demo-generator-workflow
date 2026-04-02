"use client";

import { useEffect } from "react";
import {
  initializeSnowplowOnly,
  enableCrossDomainLinking,
} from "@/lib/snowplow-config";
import { useSnowplowTracking } from "@/hooks/use-snowplow-tracking";

interface SnowplowInitProps {
  children: React.ReactNode;
}

export default function SnowplowInit({ children }: SnowplowInitProps) {
  useEffect(() => {
    initializeSnowplowOnly();
    enableCrossDomainLinking();
  }, []);

  // Track page views on route changes — ONLY place page views are tracked
  useSnowplowTracking();

  return <>{children}</>;
}
