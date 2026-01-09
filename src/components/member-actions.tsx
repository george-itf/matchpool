"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function MemberActions({
  memberId,
  memberName,
  isAdmin,
  adminCount,
  leagueId,
}: {
  memberId: string;
  memberName: string;
  isAdmin: boolean;
  adminCount: number;
  leagueId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const promote = async () => {
    setLoading(true);
    await supabase.from("league_members").update({ role: "admin" }).eq("id", memberId);
    setShowMenu(false);
    router.refresh();
    setLoading(false);
  };

  const demote = async () => {
    setLoading(true);
    await supabase.from("league_members").update({ role: "member" }).eq("id", memberId);
    setShowMenu(false);
    router.refresh();
    setLoading(false);
  };

  const remove = async () => {
    if (!confirm(`Remove ${memberName} from the league? This cannot be undone.`)) return;
    setLoading(true);
    await supabase.from("league_members").delete().eq("id", memberId);
    setShowMenu(false);
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg z-20 min-w-[140px]">
            {isAdmin ? (
              adminCount > 1 && (
                <button
                  onClick={demote}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg)] text-[var(--text)]"
                >
                  {loading ? "..." : "DEMOTE"}
                </button>
              )
            ) : (
              <button
                onClick={promote}
                disabled={loading}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg)] text-[var(--accent)]"
              >
                {loading ? "..." : "PROMOTE"}
              </button>
            )}
            <button
              onClick={remove}
              disabled={loading}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg)] text-[var(--danger)]"
            >
              {loading ? "..." : "REMOVE"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
