"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { initializeYouTubeTracking, stopYouTubeTracking } from "@/lib/snowplow-config";

const YOUTUBE_VIDEO_ID = "4ClPw87tiV0";
const PLAYER_ELEMENT_ID = "yt-player";

export default function VideoPage() {
  const router = useRouter();
  const trackingSessionId = useRef<string | null>(null);

  useEffect(() => {
    // Load the YouTube IFrame API script, then start tracking once it's ready
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    (window as any).onYouTubeIframeAPIReady = () => {
      trackingSessionId.current = initializeYouTubeTracking(PLAYER_ELEMENT_ID);
    };

    return () => {
      if (trackingSessionId.current) stopYouTubeTracking(trackingSessionId.current);
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </button>
            <h1 className="text-base font-semibold text-gray-900">Snowplow: Know Your Customer</h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              id={PLAYER_ELEMENT_ID}
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?enablejsapi=1&mute=1`}
              className="absolute top-0 left-0 w-full h-full"
              title="Snowplow: Know Your Customer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">About This Video</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Learn how Snowplow empowers companies to truly know their users through first-party behavioral data —
            enabling real-time personalization, rich audience segmentation, and actionable insights.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            {["25%", "50%", "100%"].map((pct) => (
              <div key={pct} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-[var(--color-brand-primary)]">{pct}</p>
                <p className="text-xs text-gray-500 mt-0.5">Progress milestone</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
