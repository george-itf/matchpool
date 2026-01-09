import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SettingsForm } from "@/components/settings-form";
import { MembersList } from "@/components/members-list";
import { SeasonControls } from "@/components/season-controls";
import { PaymentsTracker } from "@/components/payments-tracker";
import { CopyButton } from "@/components/copy-button";

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

  const seasons = (league.seasons || []) as Array<{ id: string; status: string; season_number: number; starts_at: string; pot_amount: number; winner_id: string | null }>;
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

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t safe-b">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${id}`} className="text-[var(--accent)] font-medium">← Back</Link>
        <h1 className="font-bold">Settings</h1>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* League settings */}
        <div className="card">
          <h3 className="font-semibold mb-4">League settings</h3>
          <SettingsForm league={league} />
        </div>

        {/* Invite code */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Invite code</p>
              <p className="text-2xl font-bold mono">{league.invite_code}</p>
            </div>
            <CopyButton text={league.invite_code} />
          </div>
        </div>

        {/* Payments */}
        {currentSeason && (
          <div className="card">
            <h3 className="font-semibold mb-4">Week {currentWeek} payments</h3>
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
          <h3 className="font-semibold mb-4">Members ({members.length})</h3>
          <MembersList members={members} leagueId={id} currentUserId={user.id} />
        </div>

        {/* Season */}
        <div className="card">
          <h3 className="font-semibold mb-4">Season</h3>
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
