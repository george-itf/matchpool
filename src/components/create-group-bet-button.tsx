"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IconPlus, IconX } from "@/components/icons";

export function CreateGroupBetButton({ 
  seasonId, 
  leagueId,
  defaultBuyin,
  defaultLegs,
  defaultWinning
}: { 
  seasonId: string; 
  leagueId: string;
  defaultBuyin: number;
  defaultLegs: number;
  defaultWinning: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(`Week ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
  const [buyin, setBuyin] = useState(defaultBuyin.toString());
  const [legs, setLegs] = useState(defaultLegs.toString());
  const [winning, setWinning] = useState(defaultWinning.toString());

  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: groupBet } = await supabase
      .from("group_bets")
      .insert({
        season_id: seasonId,
        title,
        buyin_per_person: parseFloat(buyin),
        legs_per_user: parseInt(legs),
        winning_leg_count: parseInt(winning),
        status: "collecting",
        created_by: user.id,
      })
      .select()
      .single();

    if (groupBet) {
      router.push(`/league/${leagueId}/group-bet/${groupBet.id}`);
    }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary w-full">
        <IconPlus className="w-4 h-4" />
        <span>Create Group Bet</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-[var(--surface)] rounded p-6 w-full max-w-md border border-[var(--border)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Create Group Bet</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-[var(--text-secondary)]">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">Title</label>
                <input
                  placeholder="e.g. Weekend Acca"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">Buy-in</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">£</span>
                    <input 
                      type="number" 
                      value={buyin} 
                      onChange={(e) => setBuyin(e.target.value)} 
                      min="1" 
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">Legs Each</label>
                  <input 
                    type="number" 
                    value={legs} 
                    onChange={(e) => setLegs(e.target.value)} 
                    min="1" 
                    max="10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">Final Legs</label>
                  <input 
                    type="number" 
                    value={winning} 
                    onChange={(e) => setWinning(e.target.value)} 
                    min="1" 
                    max="20"
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">
                Each member submits {legs} selections. Top {winning} voted legs form the final acca.
              </p>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={loading || !title} className="btn btn-primary flex-1">
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
