import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { LeagueHeader } from "@/components/league-header";
import { Leaderboard } from "@/components/leaderboard";
import { RecentBets } from "@/components/recent-bets";
import { AddBetButton } from "@/components/add-bet-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaguePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get league with current season
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select(`
      *,
      seasons (
        id,
        season_number,
        status,
        starts_at,
        ends_at,
        pot_amount
      )
    `)
    .eq("id", id)
    .single();

  if (leagueError || !league) {
    notFound();
  }

  // Check membership
  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/dashboard");
  }

  const seasons = (league.seasons || []) as Array<{ id: string; status: string; season_number: number; starts_at: string; ends_at: string; pot_amount: number }>;
  const currentSeason = seasons.find((s) => s.status === "active") ||
    seasons.find((s) => s.status === "upcoming") ||
    seasons[0];

  // Get leaderboard data
  let leaderboard: Array<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    total_bets: number;
    wins: number;
    profit: number;
    roi: number;
  }> = [];
  
  if (currentSeason) {
    const { data } = await supabase.rpc("get_season_leaderboard", {
      p_season_id: currentSeason.id,
    });
    leaderboard = data || [];
  }

  // Get recent bets for this season
  interface RecentBet {
    id: string;
    user_id: string;
    bet_type: string;
    stake: number;
    potential_return: number;
    actual_return: number;
    status: string;
    placed_at: string;
    profiles: { display_name: string; avatar_url: string | null };
    bet_legs: Array<{ selection: string; odds_fractional: string; result: string }>;
  }
  
  let recentBets: RecentBet[] = [];
  
  if (currentSeason) {
    const { data } = await supabase
      .from("bets")
      .select(`
        id,
        user_id,
        bet_type,
        stake,
        potential_return,
        actual_return,
        status,
        placed_at,
        profiles!bets_user_id_fkey (
          display_name,
          avatar_url
        ),
        bet_legs (
          selection,
          odds_fractional,
          result
        )
      `)
      .eq("season_id", currentSeason.id)
      .order("placed_at", { ascending: false })
      .limit(10);
    
    // Transform the data to match expected type
    recentBets = ((data || []) as unknown as Array<{
      id: string;
      user_id: string;
      bet_type: string;
      stake: number;
      potential_return: number;
      actual_return: number;
      status: string;
      placed_at: string;
      profiles: { display_name: string; avatar_url: string | null } | Array<{ display_name: string; avatar_url: string | null }>;
      bet_legs: Array<{ selection: string; odds_fractional: string; result: string }>;
    }>).map(bet => ({
      ...bet,
      profiles: Array.isArray(bet.profiles) ? bet.profiles[0] : bet.profiles
    }));
  }

  // Get active group bets
  let activeGroupBet: {
    id: string;
    title: string;
    status: string;
    submission_deadline: string;
    voting_deadline: string;
  } | null = null;

  if (currentSeason) {
    const { data } = await supabase
      .from("group_bets")
      .select("id, title, status, submission_deadline, voting_deadline")
      .eq("season_id", currentSeason.id)
      .in("status", ["submissions_open", "voting_open", "betting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    activeGroupBet = data;
  }

  // Get all members for display
  const { data: members } = await supabase
    .from("league_members")
    .select(`
      user_id,
      role,
      profiles!league_members_user_id_fkey (
        display_name,
        avatar_url
      )
    `)
    .eq("league_id", id);

  const getGroupBetStatus = () => {
    if (!activeGroupBet) return null;
    if (activeGroupBet.status === "submissions_open") return { text: "submit legs", color: "var(--accent)" };
    if (activeGroupBet.status === "voting_open") return { text: "vote now", color: "var(--warning)" };
    return { text: "bet placed", color: "var(--muted)" };
  };

  const groupBetStatus = getGroupBetStatus();

  return (
    <main className="min-h-screen pb-24 safe-top safe-bottom">
      <LeagueHeader
        league={league}
        season={currentSeason}
        isAdmin={membership.role === "admin"}
        memberCount={members?.length || 0}
      />

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Active Group Bet Banner */}
        {activeGroupBet && groupBetStatus && (
          <Link
            href={`/league/${id}/group-bet/${activeGroupBet.id}`}
            className="card block border-[var(--accent)] bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <h3 className="font-medium">{activeGroupBet.title}</h3>
                  <p className="text-sm" style={{ color: groupBetStatus.color }}>
                    {groupBetStatus.text}
                  </p>
                </div>
              </div>
              <span className="text-[var(--accent)]">→</span>
            </div>
          </Link>
        )}

        {/* Group Bets Link (if no active one) */}
        {!activeGroupBet && (
          <Link
            href={`/league/${id}/group-bet`}
            className="card block hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <h3 className="font-medium">group bets</h3>
                  <p className="text-sm text-[var(--muted)]">
                    vote on legs, share the winnings
                  </p>
                </div>
              </div>
              <span className="text-[var(--muted)]">→</span>
            </div>
          </Link>
        )}

        {/* Leaderboard */}
        <section>
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3">leaderboard</h2>
          <Leaderboard entries={leaderboard} currentUserId={user.id} />
        </section>

        {/* Recent Bets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[var(--muted)]">recent bets</h2>
            <Link href={`/league/${id}/bets`} className="text-sm text-[var(--accent)]">
              see all
            </Link>
          </div>
          <RecentBets bets={recentBets} currentUserId={user.id} />
        </section>
      </div>

      {/* Fixed Add Bet Button */}
      {currentSeason && (
        <AddBetButton leagueId={id} seasonId={currentSeason.id} />
      )}
    </main>
  );
}
