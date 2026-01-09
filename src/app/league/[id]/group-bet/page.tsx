import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconPlus } from "@/components/icons";
import { CreateGroupBetButton } from "@/components/create-group-bet-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupBetsPage({ params }: PageProps) {
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
    .select(`*, seasons ( id, season_number, status )`)
    .eq("id", id)
    .single();

  if (!league) notFound();

  const seasons = (league.seasons || []) as Array<{ id: string; status: string; season_number: number }>;
  const season = seasons.find((s) => s.status === "active") || seasons[0];

  // Get group bets
  let groupBets: Array<{
    id: string;
    title: string;
    status: string;
    buyin_per_person: number;
    legs_per_user: number;
    created_at: string;
  }> = [];
  if (season) {
    const { data } = await supabase
      .from("group_bets")
      .select("*")
      .eq("season_id", season.id)
      .order("created_at", { ascending: false });
    groupBets = data || [];
  }

  const isAdmin = membership.role === "admin";

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t safe-b">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${id}`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
          <IconArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <h1 className="font-bold text-sm uppercase tracking-wide">Group Bets</h1>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Intro */}
        <div className="card mb-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Everyone submits their best selections, vote on the top picks, build a combined acca and split any winnings.
          </p>
        </div>

        {/* Admin: Create group bet */}
        {isAdmin && season && (
          <div className="mb-4">
            <CreateGroupBetButton 
              seasonId={season.id} 
              leagueId={id}
              defaultBuyin={league.group_bet_buyin || 2}
              defaultLegs={league.group_bet_legs_per_user || 4}
              defaultWinning={league.group_bet_winning_legs || 5}
            />
          </div>
        )}

        {/* Group bets list */}
        {groupBets.length > 0 ? (
          <div className="space-y-3">
            {groupBets.map((gb) => (
              <Link key={gb.id} href={`/league/${id}/group-bet/${gb.id}`} className="card block">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{gb.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      £{gb.buyin_per_person} buy-in · {gb.legs_per_user} legs each
                    </p>
                  </div>
                  <span className={`badge ${
                    gb.status === 'collecting' ? 'badge-yellow' :
                    gb.status === 'voting' ? 'badge-green' :
                    gb.status === 'finalized' ? 'badge-gray' :
                    'badge-gray'
                  }`}>
                    {gb.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center py-10">
            <p className="text-[var(--text-secondary)]">No group bets yet</p>
            {isAdmin && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">Create one to get started</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
