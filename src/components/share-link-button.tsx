"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";

// Share icon
function IconShare({ className = "icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

export function ShareLinkButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${inviteCode}`
    : `/join/${inviteCode}`;

  const share = async () => {
    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my BetMates league",
          text: "Join my betting league on BetMates!",
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or error, fall through to copy
      }
    }

    // Fallback to copy
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={share} className="btn btn-primary text-xs py-2 px-3">
      {copied ? (
        <>
          <IconCheck className="w-4 h-4" />
          <span>COPIED</span>
        </>
      ) : (
        <>
          <IconShare className="w-4 h-4" />
          <span>SHARE</span>
        </>
      )}
    </button>
  );
}
