"use client";

import { useState, useCallback } from "react";

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

interface UseShareReturn {
  share: (data: ShareData) => Promise<void>;
  isCopied: boolean;
  error: string | null;
}

export function useShare(): UseShareReturn {
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = useCallback(async (data: ShareData) => {
    setError(null);
    setIsCopied(false);

    // Native share sheet (iOS, Android, some desktop browsers)
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
      if (navigator.canShare(data)) {
        try {
          await navigator.share(data);
          return;
        } catch (err: unknown) {
          // User dismissed the share sheet — not an error
          if (err instanceof Error && err.name === "AbortError") return;
          // Any other share failure falls through to clipboard
          console.warn("Share API failed, falling back to clipboard:", err);
        }
      }
    }

    // Clipboard fallback (desktop)
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(data.url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err: unknown) {
        setError("Failed to copy link");
        console.error("Clipboard error:", err);
      }
    } else {
      setError("Sharing not supported on this device");
    }
  }, []);

  return { share, isCopied, error };
}
