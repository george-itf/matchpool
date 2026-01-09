"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

interface League {
  id: string;
  name: string;
  weekly_buyin: number;
  bet_deadline_day?: number;
  bet_deadline_hour?: number;
}

export function SettingsForm({ league }: { league: League }) {
  const [name, setName] = useState(league.name);
  const [buyin, setBuyin] = useState(league.weekly_buyin.toString());
  const [deadlineDay, setDeadlineDay] = useState((league.bet_deadline_day ?? 5).toString()); // Default Friday
  const [deadlineHour, setDeadlineHour] = useState((league.bet_deadline_hour ?? 15).toString()); // Default 3PM
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from("leagues").update({ 
      name, 
      weekly_buyin: parseFloat(buyin),
      bet_deadline_day: parseInt(deadlineDay),
      bet_deadline_hour: parseInt(deadlineHour),
    }).eq("id", league.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
    setLoading(false);
  };

  const days = [
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
    { value: "0", label: "Sunday" },
  ];

  const hours = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: `${i.toString().padStart(2, '0')}:00`
  }));

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">League Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">Weekly Buy-in</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">£</span>
          <input type="number" value={buyin} onChange={(e) => setBuyin(e.target.value)} min="0" step="0.5" className="pl-7" />
        </div>
      </div>
      
      <div>
        <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)] uppercase tracking-wide">Bet Deadline</label>
        <div className="grid grid-cols-2 gap-3">
          <select value={deadlineDay} onChange={(e) => setDeadlineDay(e.target.value)}>
            {days.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <select value={deadlineHour} onChange={(e) => setDeadlineHour(e.target.value)}>
            {hours.map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Members must submit bets before this time each week
        </p>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Saving..." : saved ? (
          <>
            <IconCheck className="w-4 h-4" />
            <span>Saved</span>
          </>
        ) : "Save Changes"}
      </button>
    </form>
  );
}
