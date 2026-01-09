import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { ShareLinkButton } from "@/components/share-link-button";
import { ActivityFeed } from "@/components/activity-feed";
import { IconArrowLeft, IconSettings, IconArrowRight, IconPlus } from "@/components/icons";
import { DeadlineCountdown } from "@/components/deadline-countdown";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaguePage({ params }: PageProps) {
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

  const currentWeek = season ? Math.max(1, Math.ceil((Date.now() - new Date(season.starts_at).getTime()) / (7 * 24 * 60 * 60 * 1000))) : 1;

  // Check payment
  let hasPaidThisWeek = false;
  if (season) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id")
      .eq("season_id", season.id)
      .eq("user_id", user.id)
      .eq("week_number", currentWeek)
      .eq("status", "paid")
      .single();
    hasPaidThisWeek = !!payment;
  }

  // Leaderboard
  let leaderboard: Array<{ user_id: string; display_name: string; profit: number }> = [];
  if (season) {
    const { data } = await supabase.rpc("get_season_leaderboard", { p_season_id: season.id });
    leaderboard = data || [];
  }

  // Recent bets
  let bets: Array<{
    id: string; user_id: string; stake: number; status: string; actual_return: number;
    profiles: { display_name: string } | Array<{ display_name: string }>;
    bet_legs: Array<{ selection: string }>;
  }> = [];
  if (season) {
    const { data } = await supabase
      .from("bets")
      .select(`id, user_id, stake, status, actual_return, profiles!bets_user_id_fkey(display_name), bet_legs(selection)`)
      .eq("season_id", season.id)
      .order("placed_at", { ascending: false })
      .limit(10);
    bets = (data || []) as typeof bets;
  }

  const daysLeft = season ? Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const buyin = league.weekly_buyin || 5;

  // Get recent activity
  const { data: activityData } = await supabase
    .from("activity_log")
    .select("*")
    .eq("league_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const activities = (activityData || []) as Array<{
    id: string;
    event_type: string;
    data: Record<string, unknown>;
    created_at: string;
  }>;

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t" style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
          <IconArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        {membership.role === "admin" && (
          <Link href={`/league/${id}/settings`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
            <IconSettings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        )}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* League header */}
        <div className="card mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">{league.name}</h1>
              <p className="text-sm text-[var(--text-secondary)]">Season {season?.season_number || 1} · {daysLeft}d left</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--accent)]">£{season?.pot_amount || 0}</p>
              <p className="text-xs text-[var(--text-secondary)] uppercase">Pot</p>
            </div>
          </div>

          {/* Deadline countdown */}
          <DeadlineCountdown 
            deadlineDay={league.bet_deadline_day ?? 5} 
            deadlineHour={league.bet_deadline_hour ?? 15} 
          />

          {/* Payment status */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded mt-3">
            <div>
              <p className="font-medium text-sm">Week {currentWeek} buy-in</p>
              <p className="text-xs text-[var(--text-secondary)]">£{buyin} per week</p>
            </div>
            {hasPaidThisWeek ? (
              <span className="badge badge-green">Paid</span>
            ) : (
              <a
                href={`https://paypal.me/harbourgate/${buyin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-xs py-2 px-3"
              >
                Pay £{buyin}
              </a>
            )}
          </div>
        </div>

        {/* Invite code */}
        <div className="card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-header">Invite Code</p>
              <p className="text-xl font-bold mono tracking-wider">{league.invite_code}</p>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton text={league.invite_code} />
              <ShareLinkButton inviteCode={league.invite_code} />
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card mb-4">
          <p className="section-header">Leaderboard</p>
          {leaderboard.length > 0 ? (
            <div>
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className="list-item">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      i === 1 ? 'bg-gray-100 text-gray-600' : 
                      i === 2 ? 'bg-orange-100 text-orange-700' : 
                      'bg-[var(--bg)] text-[var(--text-secondary)]'
                    }`}>
                      {i + 1}
                    </span>
                    <span className={entry.user_id === user.id ? "font-semibold" : ""}>
                      {entry.display_name}
                      {entry.user_id === user.id && <span className="text-[var(--text-secondary)] text-sm"> (you)</span>}
                    </span>
                  </div>
                  <span className={`font-semibold ${entry.profit >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                    {entry.profit >= 0 ? "+" : ""}£{entry.profit.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-center py-6 text-sm">No bets yet</p>
          )}
        </div>

        {/* Recent bets */}
        <div className="card mb-4">
          <p className="section-header">Recent Bets</p>
          {bets.length > 0 ? (
            <div>
              {bets.map((bet) => {
                const profile = Array.isArray(bet.profiles) ? bet.profiles[0] : bet.profiles;
                const profit = bet.status === "settled" ? (bet.actual_return || 0) - bet.stake : 0;
                return (
                  <div key={bet.id} className="list-item">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{profile?.display_name}</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {bet.bet_legs.map((l) => l.selection).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      {bet.status === "settled" ? (
                        <span className={`font-semibold text-sm ${profit >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                          {profit >= 0 ? "+" : ""}£{profit.toFixed(2)}
                        </span>
                      ) : (
                        <span className="badge badge-yellow">£{bet.stake}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-center py-6 text-sm">No bets yet</p>
          )}
        </div>

        {/* My Bets link */}
        <Link href={`/league/${id}/bets`} className="card flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-sm">My Bets</p>
            <p className="text-xs text-[var(--text-secondary)]">View your bet history and P&L</p>
          </div>
          <IconArrowRight className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>

        {/* Group bets link */}
        <Link href={`/league/${id}/group-bet`} className="card flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-sm">Group Bets</p>
            <p className="text-xs text-[var(--text-secondary)]">Vote on legs, share the pot</p>
          </div>
          <IconArrowRight className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>

        {/* Members link */}
        <Link href={`/league/${id}/members`} className="card flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-sm">Members</p>
            <p className="text-xs text-[var(--text-secondary)]">View league members and payment status</p>
          </div>
          <IconArrowRight className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>

        {/* Stats link */}
        <Link href={`/league/${id}/stats`} className="card flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-sm">Stats</p>
            <p className="text-xs text-[var(--text-secondary)]">Season statistics and highlights</p>
          </div>
          <IconArrowRight className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>

        {/* Activity Feed */}
        <div className="card mb-4">
          <p className="section-header">Activity</p>
          <ActivityFeed leagueId={id} initialActivities={activities} userId={user.id} />
        </div>
      </div>

      {/* Fixed bottom button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        zIndex: 50
      }}>
        <Link
          href={`/league/${id}/bet/new?season=${season?.id || ''}`}
          className="btn btn-primary w-full"
        >
          <IconPlus className="w-4 h-4" />
          <span>Add Bet</span>
        </Link>
      </div>
    </main>
  );
}
