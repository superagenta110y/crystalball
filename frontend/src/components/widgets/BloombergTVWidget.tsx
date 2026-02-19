/**
 * BloombergTVWidget — Embedded Bloomberg live stream.
 * Uses the publicly available Bloomberg live stream embed.
 *
 * Note: Bloomberg may block embedding depending on region/policy.
 * The widget falls back to a link if the embed is blocked.
 */
"use client";

import React, { useState } from "react";
import { Tv, ExternalLink } from "lucide-react";

export function BloombergTVWidget() {
  const [embedError, setEmbedError] = useState(false);

  if (embedError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-500 p-4">
        <Tv size={28} />
        <div className="text-sm font-medium">Bloomberg TV</div>
        <p className="text-xs text-center text-neutral-600">
          Embedding was blocked. Open directly:
        </p>
        <a
          href="https://www.bloomberg.com/live"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          bloomberg.com/live <ExternalLink size={11} />
        </a>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <iframe
        src="https://www.bloomberg.com/live"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen"
        title="Bloomberg TV Live"
        onError={() => setEmbedError(true)}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}
