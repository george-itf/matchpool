"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IconPlus, IconX } from "@/components/icons";

interface Leg {
  selection: string;
  odds: string;
}

export function SubmitLegsForm({ groupBetId, legsRemaining }: { groupBetId: string; legsRemaining: number }) {
  const [legs, setLegs] = useState<Leg[]>([{ selection: "", odds: "" }]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const addLeg = () => {
    if (legs.length < legsRemaining) {
      setLegs([...legs, { selection: "", odds: "" }]);
    }
  };

  const removeLeg = (i: number) => setLegs(legs.filter((_, idx) => idx !== i));

  const updateLeg = (i: number, field: keyof Leg, value: string) => {
    const updated = [...legs];
    updated[i][field] = value;
    setLegs(updated);
  };

  const parseFrac = (f: string) => {
    const [a, b] = f.split("/");
    return b ? parseFloat(a) / parseFloat(b) + 1 : parseFloat(f) || 2;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const validLegs = legs.filter(l => l.selection && l.odds);

    await supabase.from("group_bet_submissions").insert(
      validLegs.map(l => ({
        group_bet_id: groupBetId,
        user_id: user.id,
        selection: l.selection,
        odds_fractional: l.odds,
        odds_decimal: parseFrac(l.odds),
      }))
    );

    router.refresh();
    setLegs([{ selection: "", odds: "" }]);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {legs.map((leg, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={leg.selection}
            onChange={(e) => updateLeg(i, "selection", e.target.value)}
            placeholder="e.g. Arsenal to win"
            className="flex-1"
          />
          <input
            value={leg.odds}
            onChange={(e) => updateLeg(i, "odds", e.target.value)}
            placeholder="2/1"
            className="w-20 text-center"
          />
          {legs.length > 1 && (
            <button type="button" onClick={() => removeLeg(i)} className="p-2 text-[var(--danger)]">
              <IconX className="w-5 h-5" />
            </button>
          )}
        </div>
      ))}

      {legs.length < legsRemaining && (
        <button 
          type="button"
          onClick={addLeg} 
          className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm"
        >
          <IconPlus className="w-4 h-4" />
          <span>Add another</span>
        </button>
      )}

      <button
        type="submit"
        disabled={loading || !legs.some(l => l.selection && l.odds)}
        className="btn btn-primary w-full"
      >
        {loading ? "Submitting..." : "Submit Legs"}
      </button>
    </form>
  );
}
