import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";
import { SubmitLegsForm } from "@/components/submit-legs-form";
import { VotingPanel } from "@/components/voting-panel";
import { GroupBetAdminControls } from "@/components/group-bet-admin-controls";

interface PageProps {
  params: Promise<{ id: string; groupBetId: string }>;
}

export default async function GroupBetDetailPage({ params }: PageProps) {
  const { id, groupBetId } = await params;
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

  const { data: groupBet } = await supabase
    .from("group_bets")
    .select("*")
    .eq("id", groupBetId)
    .single();

  if (!groupBet) notFound();

  // Get all submissions with profiles
  const { data: rawSubmissions } = await supabase
    .from("group_bet_submissions")
    .select(`*, profiles!group_bet_submissions_user_id_fkey(display_name)`)
    .eq("group_bet_id", groupBetId)
    .order("votes", { ascending: false });

  const submissions = ((rawSubmissions || []) as Array<{
    id: string;
    user_id: string;
    selection: string;
    odds_fractional: string;
    odds_decimal: number;
    votes: number;
    selected: boolean;
    profiles: { display_name: string } | Array<{ display_name: string }>;
  }>).map(s => ({
    ...s,
    profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
  }));

  // Get user's votes
  const { data: userVotes } = await supabase
    .from("group_bet_votes")
    .select("submission_id")
    .eq("user_id", user.id);

  const votedIds = new Set((userVotes || []).map(v => v.submission_id));

  // Get user's submissions
  const mySubmissions = submissions.filter(s => s.user_id === user.id);
  const hasSubmitted = mySubmissions.length >= groupBet.legs_per_user;

  // Get members for admin
  const { data: rawMembers } = await supabase
    .from("league_members")
    .select(`user_id, profiles!league_members_user_id_fkey(display_name)`)
    .eq("league_id", id);

  const members = ((rawMembers || []) as Array<{
    user_id: string;
    profiles: { display_name: string } | Array<{ display_name: string }>;
  }>).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
  }));

  const isAdmin = membership.role === "admin";

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t safe-b">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${id}/group-bet`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
          <IconArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <h1 className="font-bold text-sm uppercase tracking-wide">{groupBet.title}</h1>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Status card */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`badge ${
              groupBet.status === 'collecting' ? 'badge-yellow' :
              groupBet.status === 'voting' ? 'badge-green' :
              groupBet.status === 'finalized' ? 'badge-gray' :
              'badge-gray'
            }`}>
              {groupBet.status === 'collecting' ? 'Collecting Legs' :
               groupBet.status === 'voting' ? 'Voting Open' :
               groupBet.status === 'finalized' ? 'Finalized' :
               groupBet.status}
            </span>
            <span className="font-bold text-[var(--accent)]">£{groupBet.buyin_per_person} buy-in</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {groupBet.status === 'collecting' && `Submit your ${groupBet.legs_per_user} best selections.`}
            {groupBet.status === 'voting' && `Vote for the top ${groupBet.winning_leg_count} legs.`}
            {groupBet.status === 'finalized' && `Final acca has ${groupBet.winning_leg_count} legs.`}
          </p>
        </div>

        {/* Collecting phase: submit form */}
        {groupBet.status === 'collecting' && (
          <div className="card mb-4">
            <p className="section-header">Your Submissions ({mySubmissions.length}/{groupBet.legs_per_user})</p>
            
            {mySubmissions.length > 0 && (
              <div className="mb-4">
                {mySubmissions.map((s) => (
                  <div key={s.id} className="list-item">
                    <span className="text-sm">{s.selection}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{s.odds_fractional}</span>
                  </div>
                ))}
              </div>
            )}

            {!hasSubmitted && (
              <SubmitLegsForm 
                groupBetId={groupBetId}
                legsRemaining={groupBet.legs_per_user - mySubmissions.length}
              />
            )}

            {hasSubmitted && (
              <p className="text-sm text-[var(--accent)] text-center py-2">
                All legs submitted!
              </p>
            )}
          </div>
        )}

        {/* Voting phase */}
        {groupBet.status === 'voting' && (
          <div className="card mb-4">
            <p className="section-header">Vote for Legs</p>
            <VotingPanel 
              submissions={submissions}
              votedIds={votedIds}
              userId={user.id}
              winningCount={groupBet.winning_leg_count}
            />
          </div>
        )}

        {/* Finalized: show selected legs */}
        {(groupBet.status === 'finalized' || groupBet.status === 'settled') && (
          <div className="card mb-4">
            <p className="section-header">Final Acca</p>
            {submissions.filter(s => s.selected).map((s) => (
              <div key={s.id} className="list-item">
                <div>
                  <p className="font-medium text-sm">{s.selection}</p>
                  <p className="text-xs text-[var(--text-secondary)]">by {s.profiles?.display_name}</p>
                </div>
                <span className="font-semibold">{s.odds_fractional}</span>
              </div>
            ))}
          </div>
        )}

        {/* All submissions */}
        {submissions.length > 0 && groupBet.status !== 'collecting' && (
          <div className="card mb-4">
            <p className="section-header">All Submissions ({submissions.length})</p>
            {submissions.map((s) => (
              <div key={s.id} className={`list-item ${s.selected ? 'bg-green-50 -mx-4 px-4' : ''}`}>
                <div className="flex-1">
                  <p className="font-medium text-sm">{s.selection}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {s.profiles?.display_name} · {s.votes} votes
                  </p>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{s.odds_fractional}</span>
              </div>
            ))}
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="card">
            <p className="section-header">Admin Controls</p>
            <GroupBetAdminControls 
              groupBetId={groupBetId}
              status={groupBet.status}
              leagueId={id}
              members={members}
              submissionCount={submissions.length}
              winningCount={groupBet.winning_leg_count}
            />
          </div>
        )}
      </div>
    </main>
  );
}
