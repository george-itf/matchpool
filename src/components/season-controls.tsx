"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IconTrophy } from "@/components/icons";

interface Season {
  id: string;
  season_number: number;
  status: string;
  starts_at: string;
  ends_at?: string;
  pot_amount: number;
  winner_id: string | null;
}

interface Member {
  user_id: string;
  profiles: { display_name: string };
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  profit: number;
}

export function SeasonControls({
  leagueId,
  currentSeason,
  allSeasons,
  members,
  seasonLengthWeeks,
}: {
  leagueId: string;
  currentSeason: Season | null;
  allSeasons: Season[];
  members: Member[];
  seasonLengthWeeks: number;
}) {
  const [loading, setLoading] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const router = useRouter();
  const supabase = createClient();

  // Fetch leaderboard to determine winner
  useEffect(() => {
    if (!currentSeason) return;

    const fetchLeaderboard = async () => {
      const { data } = await supabase.rpc("get_season_leaderboard", {
        p_season_id: currentSeason.id,
      });
      if (data && data.length > 0) {
        setLeaderboard(data);
        // Auto-select top performer as winner
        setWinner(data[0].user_id);
      }
    };

    fetchLeaderboard();
  }, [currentSeason, supabase]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  const startSeason = async () => {
    setLoading(true);
    const num = allSeasons.length > 0 ? Math.max(...allSeasons.map((s) => s.season_number)) + 1 : 1;
    const starts = new Date();
    const ends = new Date();
    ends.setDate(ends.getDate() + seasonLengthWeeks * 7);

    await supabase.from("seasons").insert({
      league_id: leagueId,
      season_number: num,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: "active",
      pot_amount: 0,
    });

    router.refresh();
    setLoading(false);
  };

  const endSeason = async () => {
    if (!currentSeason || !winner) return;
    setLoading(true);

    await supabase
      .from("seasons")
      .update({ status: "completed", winner_id: winner })
      .eq("id", currentSeason.id);

    setShowEnd(false);
    router.refresh();
    setLoading(false);
  };

  // Get winner name for completed seasons
  const getWinnerName = (winnerId: string | null) => {
    if (!winnerId) return null;
    const member = members.find((m) => m.user_id === winnerId);
    return member?.profiles?.display_name;
  };

  // Get days remaining
  const getDaysRemaining = () => {
    if (!currentSeason?.ends_at) return 0;
    const diff = new Date(currentSeason.ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  return (
    <div>
      {currentSeason ? (
        <div className="space-y-4">
          {/* Season info card */}
          <div className="p-3 bg-[var(--bg)] rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Season {currentSeason.season_number}</span>
              <span className="badge badge-green">ACTIVE</span>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {formatDate(currentSeason.starts_at)}
              {currentSeason.ends_at && ` - ${formatDate(currentSeason.ends_at)}`}
              <span className="ml-2">({getDaysRemaining()} days left)</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
              <span className="text-sm">Pot</span>
              <span className="font-bold text-[var(--accent)]">
                £{(currentSeason.pot_amount || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* End season button/form */}
          {!showEnd ? (
            <button
              onClick={() => setShowEnd(true)}
              className="btn btn-secondary w-full"
            >
              END SEASON
            </button>
          ) : (
            <div className="p-4 bg-[var(--bg)] rounded space-y-3">
              <p className="font-semibold text-sm">End Season {currentSeason.season_number}</p>

              {/* Current leader info */}
              {leaderboard.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <IconTrophy className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-sm">{leaderboard[0].display_name}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Leader with £{leaderboard[0].profit.toFixed(2)} profit
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs text-[var(--text-secondary)] uppercase mb-1 block">
                  Winner
                </label>
                <select
                  value={winner}
                  onChange={(e) => setWinner(e.target.value)}
                  className="w-full"
                >
                  <option value="">Choose winner...</option>
                  {members.map((m) => {
                    const lb = leaderboard.find((l) => l.user_id === m.user_id);
                    return (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.display_name}
                        {lb ? ` (£${lb.profit.toFixed(2)})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowEnd(false)}
                  className="btn btn-secondary flex-1"
                >
                  CANCEL
                </button>
                <button
                  onClick={endSeason}
                  disabled={!winner || loading}
                  className="btn btn-primary flex-1"
                >
                  {loading ? "..." : "CONFIRM"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Past seasons */}
          {allSeasons.filter((s) => s.status === "completed").length > 0 && (
            <div className="space-y-2">
              {allSeasons
                .filter((s) => s.status === "completed")
                .sort((a, b) => b.season_number - a.season_number)
                .slice(0, 3)
                .map((s) => (
                  <div
                    key={s.id}
                    className="p-3 bg-[var(--bg)] rounded flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-sm">Season {s.season_number}</span>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {s.winner_id && (
                          <>
                            Winner: {getWinnerName(s.winner_id)}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="badge badge-gray">£{s.pot_amount || 0}</span>
                  </div>
                ))}
            </div>
          )}

          <button
            onClick={startSeason}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? "STARTING..." : "START NEW SEASON"}
          </button>
        </div>
      )}
    </div>
  );
}
