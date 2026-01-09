import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Look up league by invite code
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("invite_code", code.toUpperCase())
    .single();

  if (!league) {
    return (
      <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center">
          <h1 className="text-xl font-bold mb-2">Invalid Code</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            This invite code is invalid or has expired.
          </p>
          <Link href="/dashboard" className="btn btn-primary w-full">
            GO TO DASHBOARD
          </Link>
        </div>
      </main>
    );
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if already a member
    const { data: existingMembership } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .single();

    if (existingMembership) {
      // Already a member, redirect to league
      redirect(`/league/${league.id}`);
    }

    // Join the league
    await supabase.from("league_members").insert({
      league_id: league.id,
      user_id: user.id,
      role: "member",
    });

    // Log activity
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    await supabase.from("activity_log").insert({
      league_id: league.id,
      user_id: user.id,
      event_type: "member_joined",
      data: { user_name: profile?.display_name || "New member" },
    });

    redirect(`/league/${league.id}`);
  }

  // Not logged in - show sign up prompt
  const returnUrl = encodeURIComponent(`/join/${code}`);

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="card max-w-sm w-full text-center">
        <h1 className="text-xl font-bold mb-2">Join {league.name}</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          You&apos;ve been invited to join a betting league. Sign up or log in to continue.
        </p>
        <div className="space-y-3">
          <Link
            href={`/login?returnUrl=${returnUrl}`}
            className="btn btn-primary w-full"
          >
            SIGN UP / LOG IN
          </Link>
          <Link href="/" className="btn btn-secondary w-full">
            LEARN MORE
          </Link>
        </div>
      </div>
    </main>
  );
}
