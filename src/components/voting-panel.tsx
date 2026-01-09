"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

interface Submission {
  id: string;
  user_id: string;
  selection: string;
  odds_fractional: string;
  votes: number;
  profiles: { display_name: string };
}

export function VotingPanel({ 
  submissions, 
  votedIds, 
  userId,
  winningCount
}: { 
  submissions: Submission[]; 
  votedIds: Set<string>;
  userId: string;
  winningCount: number;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [localVoted, setLocalVoted] = useState(votedIds);
  const router = useRouter();
  const supabase = createClient();

  const toggleVote = async (submissionId: string) => {
    setLoading(submissionId);
    const hasVoted = localVoted.has(submissionId);

    if (hasVoted) {
      await supabase
        .from("group_bet_votes")
        .delete()
        .eq("submission_id", submissionId)
        .eq("user_id", userId);
      
      await supabase
        .from("group_bet_submissions")
        .update({ votes: submissions.find(s => s.id === submissionId)!.votes - 1 })
        .eq("id", submissionId);

      setLocalVoted(prev => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    } else {
      await supabase
        .from("group_bet_votes")
        .insert({ submission_id: submissionId, user_id: userId });
      
      await supabase
        .from("group_bet_submissions")
        .update({ votes: submissions.find(s => s.id === submissionId)!.votes + 1 })
        .eq("id", submissionId);

      setLocalVoted(prev => new Set([...prev, submissionId]));
    }

    router.refresh();
    setLoading(null);
  };

  // Sort by votes
  const sorted = [...submissions].sort((a, b) => b.votes - a.votes);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-secondary)] mb-3">
        Vote for your favourite picks. Top {winningCount} will form the final acca.
      </p>
      {sorted.map((s, i) => {
        const isVoted = localVoted.has(s.id);
        const isTop = i < winningCount;
        const isOwn = s.user_id === userId;

        return (
          <div 
            key={s.id} 
            className={`flex items-center justify-between p-3 rounded border ${
              isTop ? 'bg-green-50 border-green-200' : 'bg-[var(--bg)] border-[var(--border)]'
            }`}
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{s.selection}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {s.profiles?.display_name} · {s.odds_fractional}
                {isOwn && <span className="ml-1">(you)</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{s.votes}</span>
              <button
                onClick={() => toggleVote(s.id)}
                disabled={loading === s.id}
                className={`btn text-xs py-1 px-3 ${isVoted ? 'btn-primary' : 'btn-secondary'}`}
              >
                {loading === s.id ? "..." : isVoted ? (
                  <>
                    <IconCheck className="w-3 h-3" />
                    <span>Voted</span>
                  </>
                ) : "Vote"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
