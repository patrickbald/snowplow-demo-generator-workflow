"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageViewEvent } from "@/lib/snowplow-config";

export function useSnowplowTracking() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string>("");
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (
      pathname &&
      (isInitialMount.current || pathname !== lastPathnameRef.current)
    ) {
      trackPageViewEvent();
      lastPathnameRef.current = pathname;
      isInitialMount.current = false;
    }
  }, [pathname]);
}
