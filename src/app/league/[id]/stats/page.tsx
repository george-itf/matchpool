import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconTrendingUp, IconTrendingDown } from "@/components/icons";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface BetWithLegs {
  id: string;
  user_id: string;
  stake: number;
  status: string;
  actual_return: number | null;
  potential_return: number;
  placed_at: string;
  bet_legs: Array<{ selection: string; result: string }>;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  profit: number;
}

export default async function StatsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/dashboard");

  const { data: league } = await supabase
    .from("leagues")
    .select(`*, seasons ( id, season_number, status, starts_at, ends_at, pot_amount )`)
    .eq("id", id)
    .single();

  if (!league) notFound();

  const seasons = (league.seasons || []) as Array<{ id: string; status: string; season_number: number; starts_at: string; ends_at: string; pot_amount: number }>;
  const season = seasons.find((s) => s.status === "active") || seasons[0];

  if (!season) {
    return (
      <main className="min-h-screen bg-[var(--bg)] safe-t">
        <div className="header flex items-center justify-between">
          <Link href={`/league/${id}`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
            <IconArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
        </div>
        <div className="p-4 max-w-lg mx-auto">
          <p className="text-center text-[var(--text-secondary)] py-8">No season data available</p>
        </div>
      </main>
    );
  }

  // Fetch all bets for the season
  const { data: betsData } = await supabase
    .from("bets")
    .select(`id, user_id, stake, status, actual_return, potential_return, placed_at, bet_legs(selection, result)`)
    .eq("season_id", season.id);

  const bets = (betsData || []) as BetWithLegs[];

  // Fetch leaderboard
  const { data: leaderboardData } = await supabase.rpc("get_season_leaderboard", { p_season_id: season.id });
  const leaderboard = (leaderboardData || []) as LeaderboardEntry[];

  // Fetch member count
  const { count: memberCount } = await supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", id);

  // Calculate stats
  const totalBets = bets.length;
  const settledBets = bets.filter(b => b.status === "settled" || b.status === "won" || b.status === "lost");
  const wonBets = bets.filter(b => b.status === "won" || (b.status === "settled" && (b.actual_return || 0) > b.stake));
  const lostBets = bets.filter(b => b.status === "lost" || (b.status === "settled" && (b.actual_return || 0) < b.stake));

  const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length * 100) : 0;

  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalReturns = bets.reduce((sum, b) => sum + (b.actual_return || 0), 0);
  const totalProfit = totalReturns - totalStaked;

  const avgStake = totalBets > 0 ? totalStaked / totalBets : 0;
  const avgReturn = settledBets.length > 0 ? totalReturns / settledBets.length : 0;

  // Best and worst performers
  const bestPerformer = leaderboard[0];
  const worstPerformer = leaderboard[leaderboard.length - 1];

  // Most active bettor
  const betsByUser: Record<string, number> = {};
  bets.forEach(b => {
    betsByUser[b.user_id] = (betsByUser[b.user_id] || 0) + 1;
  });
  const mostActiveUserId = Object.entries(betsByUser).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostActiveBettor = leaderboard.find(l => l.user_id === mostActiveUserId);
  const mostActiveBetCount = mostActiveUserId ? betsByUser[mostActiveUserId] : 0;

  // Biggest win
  const biggestWin = bets
    .filter(b => b.status === "won" || (b.status === "settled" && (b.actual_return || 0) > b.stake))
    .sort((a, b) => ((b.actual_return || 0) - b.stake) - ((a.actual_return || 0) - a.stake))[0];
  const biggestWinUser = biggestWin ? leaderboard.find(l => l.user_id === biggestWin.user_id) : null;

  // Calculate acca stats
  const accaBets = bets.filter(b => b.bet_legs.length >= 4);
  const accaWins = accaBets.filter(b => b.status === "won" || (b.status === "settled" && (b.actual_return || 0) > b.stake));
  const accaWinRate = accaBets.length > 0 ? (accaWins.length / accaBets.length * 100) : 0;

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t pb-8">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${id}`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
          <IconArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <h1 className="font-bold">Stats</h1>
        <div className="w-12"></div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Season overview */}
        <div className="card mb-4">
          <p className="section-header">Season {season.season_number} Overview</p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="bg-[var(--bg)] rounded p-3 text-center">
              <p className="text-2xl font-bold">{memberCount || 0}</p>
              <p className="text-xs text-[var(--text-secondary)] uppercase">Members</p>
            </div>
            <div className="bg-[var(--bg)] rounded p-3 text-center">
              <p className="text-2xl font-bold text-[var(--accent)]">£{season.pot_amount.toFixed(0)}</p>
              <p className="text-xs text-[var(--text-secondary)] uppercase">Pot</p>
            </div>
            <div className="bg-[var(--bg)] rounded p-3 text-center">
              <p className="text-2xl font-bold">{totalBets}</p>
              <p className="text-xs text-[var(--text-secondary)] uppercase">Total Bets</p>
            </div>
            <div className="bg-[var(--bg)] rounded p-3 text-center">
              <p className="text-2xl font-bold">{winRate.toFixed(0)}%</p>
              <p className="text-xs text-[var(--text-secondary)] uppercase">Win Rate</p>
            </div>
          </div>
        </div>

        {/* Money stats */}
        <div className="card mb-4">
          <p className="section-header">Money</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Total Staked</span>
              <span className="font-semibold">£{totalStaked.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Total Returns</span>
              <span className="font-semibold">£{totalReturns.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
              <span className="text-sm text-[var(--text-secondary)]">Net Profit/Loss</span>
              <span className={`font-bold ${totalProfit >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                {totalProfit >= 0 ? "+" : ""}£{totalProfit.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Average Stake</span>
              <span className="font-semibold">£{avgStake.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Average Return</span>
              <span className="font-semibold">£{avgReturn.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Bet breakdown */}
        <div className="card mb-4">
          <p className="section-header">Bet Breakdown</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Pending</span>
              <span className="font-semibold">{bets.filter(b => b.status === "pending").length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Won</span>
              <span className="font-semibold text-[var(--accent)]">{wonBets.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Lost</span>
              <span className="font-semibold text-[var(--danger)]">{lostBets.length}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
              <span className="text-sm text-[var(--text-secondary)]">Accumulators</span>
              <span className="font-semibold">{accaBets.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Acca Win Rate</span>
              <span className="font-semibold">{accaWinRate.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Leaderboard highlights */}
        <div className="card mb-4">
          <p className="section-header">Highlights</p>
          <div className="space-y-4 mt-3">
            {bestPerformer && (
              <div className="flex items-center justify-between bg-green-50 rounded p-3">
                <div className="flex items-center gap-2">
                  <IconTrendingUp className="w-5 h-5 text-[var(--accent)]" />
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] uppercase">Top Performer</p>
                    <p className="font-semibold">{bestPerformer.display_name}</p>
                  </div>
                </div>
                <span className="font-bold text-[var(--accent)]">+£{bestPerformer.profit.toFixed(2)}</span>
              </div>
            )}

            {worstPerformer && worstPerformer.profit < 0 && (
              <div className="flex items-center justify-between bg-red-50 rounded p-3">
                <div className="flex items-center gap-2">
                  <IconTrendingDown className="w-5 h-5 text-[var(--danger)]" />
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] uppercase">Worst Luck</p>
                    <p className="font-semibold">{worstPerformer.display_name}</p>
                  </div>
                </div>
                <span className="font-bold text-[var(--danger)]">£{worstPerformer.profit.toFixed(2)}</span>
              </div>
            )}

            {mostActiveBettor && (
              <div className="flex items-center justify-between bg-[var(--bg)] rounded p-3">
                <div>
                  <p className="text-xs text-[var(--text-secondary)] uppercase">Most Active</p>
                  <p className="font-semibold">{mostActiveBettor.display_name}</p>
                </div>
                <span className="font-bold">{mostActiveBetCount} bets</span>
              </div>
            )}

            {biggestWin && biggestWinUser && (
              <div className="flex items-center justify-between bg-yellow-50 rounded p-3">
                <div>
                  <p className="text-xs text-[var(--text-secondary)] uppercase">Biggest Win</p>
                  <p className="font-semibold">{biggestWinUser.display_name}</p>
                </div>
                <span className="font-bold text-[var(--accent)]">
                  +£{((biggestWin.actual_return || 0) - biggestWin.stake).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
