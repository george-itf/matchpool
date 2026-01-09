import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SettingsForm } from "@/components/settings-form";
import { MembersList } from "@/components/members-list";
import { SeasonControls } from "@/components/season-controls";
import { PaymentsTracker } from "@/components/payments-tracker";
import { SettleBets } from "@/components/settle-bets";
import { CopyButton } from "@/components/copy-button";
import { IconArrowLeft } from "@/components/icons";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
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

  if (!membership || membership.role !== "admin") redirect(`/league/${id}`);

  const { data: league } = await supabase
    .from("leagues")
    .select(`*, seasons ( id, season_number, status, starts_at, ends_at, pot_amount, winner_id )`)
    .eq("id", id)
    .single();

  if (!league) notFound();

  const { data: rawMembers } = await supabase
    .from("league_members")
    .select(`id, user_id, role, joined_at, profiles!league_members_user_id_fkey ( display_name )`)
    .eq("league_id", id)
    .order("joined_at");

  const members = ((rawMembers || []) as unknown as Array<{
    id: string; user_id: string; role: string; joined_at: string;
    profiles: { display_name: string } | Array<{ display_name: string }>;
  }>).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
  }));

  const seasons = (league.seasons || []) as Array<{ id: string; status: string; season_number: number; starts_at: string; ends_at: string; pot_amount: number; winner_id: string | null }>;
  const currentSeason = seasons.find((s) => s.status === "active");

  const currentWeek = currentSeason 
    ? Math.max(1, Math.ceil((Date.now() - new Date(currentSeason.starts_at).getTime()) / (7 * 24 * 60 * 60 * 1000))) 
    : 1;

  let payments: Array<{ user_id: string; status: string }> = [];
  if (currentSeason) {
    const { data } = await supabase
      .from("payments")
      .select("user_id, status")
      .eq("season_id", currentSeason.id)
      .eq("week_number", currentWeek);
    payments = data || [];
  }

  // Get pending bets for settlement
  let pendingBets: Array<{
    id: string;
    user_id: string;
    stake: number;
    potential_return: number;
    placed_at: string;
    profiles: { display_name: string } | Array<{ display_name: string }>;
    bet_legs: Array<{ selection: string }>;
  }> = [];
  if (currentSeason) {
    const { data } = await supabase
      .from("bets")
      .select(`id, user_id, stake, potential_return, placed_at, profiles!bets_user_id_fkey(display_name), bet_legs(selection)`)
      .eq("season_id", currentSeason.id)
      .eq("status", "pending")
      .order("placed_at", { ascending: false });
    pendingBets = ((data || []) as typeof pendingBets).map(b => ({
      ...b,
      profiles: Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
    }));
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t safe-b">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${id}`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
          <IconArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <h1 className="font-bold text-sm uppercase tracking-wide">Settings</h1>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* League settings */}
        <div className="card">
          <p className="section-header">League Settings</p>
          <SettingsForm league={league} />
        </div>

        {/* Invite code */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-header">Invite Code</p>
              <p className="text-xl font-bold mono tracking-wider">{league.invite_code}</p>
            </div>
            <CopyButton text={league.invite_code} />
          </div>
        </div>

        {/* Settle Bets */}
        {currentSeason && (
          <div className="card">
            <p className="section-header">Settle Bets ({pendingBets.length} pending)</p>
            <SettleBets
              bets={pendingBets as Array<{
                id: string;
                user_id: string;
                stake: number;
                potential_return: number;
                placed_at: string;
                profiles: { display_name: string };
                bet_legs: Array<{ selection: string }>;
              }>}
              seasonId={currentSeason.id}
              leagueId={id}
            />
          </div>
        )}

        {/* Payments */}
        {currentSeason && (
          <div className="card">
            <p className="section-header">Week {currentWeek} Payments</p>
            <PaymentsTracker
              seasonId={currentSeason.id}
              weekNumber={currentWeek}
              members={members}
              payments={payments}
              buyin={league.weekly_buyin}
            />
          </div>
        )}

        {/* Members */}
        <div className="card">
          <p className="section-header">Members ({members.length})</p>
          <MembersList members={members} leagueId={id} currentUserId={user.id} />
        </div>

        {/* Season */}
        <div className="card">
          <p className="section-header">Season</p>
          <SeasonControls
            leagueId={id}
            currentSeason={currentSeason || null}
            allSeasons={seasons}
            members={members}
            seasonLengthWeeks={league.season_length_weeks}
          />
        </div>
      </div>
    </main>
  );
}
