import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@/components/icons";
import { MemberActions } from "@/components/member-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MembersPage({ params }: PageProps) {
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
    .select(`*, seasons ( id, season_number, status, starts_at )`)
    .eq("id", id)
    .single();

  if (!league) notFound();

  const { data: rawMembers } = await supabase
    .from("league_members")
    .select(`id, user_id, role, joined_at, profiles!league_members_user_id_fkey ( display_name )`)
    .eq("league_id", id)
    .order("joined_at");

  const members = ((rawMembers || []) as unknown as Array<{
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    profiles: { display_name: string } | Array<{ display_name: string }>;
  }>).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
  }));

  const seasons = (league.seasons || []) as Array<{ id: string; status: string; season_number: number; starts_at: string }>;
  const currentSeason = seasons.find((s) => s.status === "active");

  const currentWeek = currentSeason
    ? Math.max(1, Math.ceil((Date.now() - new Date(currentSeason.starts_at).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 1;

  // Get payments for current week
  let payments: Array<{ user_id: string; status: string }> = [];
  if (currentSeason) {
    const { data } = await supabase
      .from("payments")
      .select("user_id, status")
      .eq("season_id", currentSeason.id)
      .eq("week_number", currentWeek);
    payments = data || [];
  }

  const paidUserIds = new Set(payments.filter((p) => p.status === "paid").map((p) => p.user_id));
  const isAdmin = membership.role === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t safe-b">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${id}`} className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm">
          <IconArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <h1 className="font-bold text-sm uppercase tracking-wide">Members</h1>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Summary */}
        <div className="card mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-[var(--text-secondary)] uppercase">Members</p>
            </div>
            {currentSeason && (
              <div className="text-right">
                <p className="text-lg font-semibold text-[var(--accent)]">
                  {paidUserIds.size}/{members.length}
                </p>
                <p className="text-xs text-[var(--text-secondary)] uppercase">Paid Week {currentWeek}</p>
              </div>
            )}
          </div>
        </div>

        {/* Members list */}
        <div className="card">
          <p className="section-header">All Members</p>
          <div className="space-y-1">
            {members.map((m) => {
              const isMe = m.user_id === user.id;
              const isMemberAdmin = m.role === "admin";
              const hasPaid = paidUserIds.has(m.user_id);

              return (
                <div key={m.id} className="list-item">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{m.profiles?.display_name}</span>
                      {isMe && <span className="text-xs text-[var(--text-secondary)]">(you)</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {isMemberAdmin && <span className="badge badge-green">ADMIN</span>}
                      <span className="text-xs text-[var(--text-secondary)]">
                        Joined {formatDate(m.joined_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Payment status */}
                    {currentSeason && (
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          hasPaid ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        }`}
                        title={hasPaid ? "Paid this week" : "Not paid this week"}
                      >
                        <IconCheck className="w-4 h-4" />
                      </div>
                    )}

                    {/* Admin actions */}
                    {isAdmin && !isMe && (
                      <MemberActions
                        memberId={m.id}
                        memberName={m.profiles?.display_name || "Member"}
                        isAdmin={isMemberAdmin}
                        adminCount={adminCount}
                        leagueId={id}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
