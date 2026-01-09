"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconCamera, IconEdit, IconX, IconPlus } from "@/components/icons";
import { OddsBrowser } from "@/components/odds-browser";
import { logActivity } from "@/lib/activity";

interface Leg {
  selection: string;
  odds: string;
  oddsDecimal?: number;
}

export default function NewBetPage({ params }: { params: Promise<{ id: string }> }) {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  
  useEffect(() => {
    params.then((p) => setLeagueId(p.id));
  }, [params]);

  const searchParams = useSearchParams();
  const seasonId = searchParams.get("season");

  const [mode, setMode] = useState<"choose" | "upload" | "manual">("choose");
  const [loadingText, setLoadingText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [error, setError] = useState("");

  const [stake, setStake] = useState("");
  const [potentialReturn, setPotentialReturn] = useState("");
  const [status, setStatus] = useState("pending");
  const [legs, setLegs] = useState<Leg[]>([]);

  const router = useRouter();
  const supabase = createClient();

  // Calculate potential return when legs/stake change
  useEffect(() => {
    if (stake && legs.length > 0) {
      const totalOdds = legs.reduce((acc, leg) => {
        const decimal = leg.oddsDecimal || parseFrac(leg.odds);
        return acc * decimal;
      }, 1);
      setPotentialReturn((parseFloat(stake) * totalOdds).toFixed(2));
    }
  }, [stake, legs]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setMode("upload");
    setLoadingText("Uploading image...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not logged in");
        setMode("choose");
        return;
      }

      // Upload to storage (optional - for record keeping)
      const path = `${user.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from("screenshots").upload(path, file);

      setLoadingText("Reading bet slip with AI...");

      // Parse with Claude
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/parse-screenshot", { method: "POST", body: formData });
      const data = await res.json();

      console.log("Parse result:", data);

      if (data.error) {
        setError(data.error);
        setMode("manual");
        setLegs([{ selection: "", odds: "" }]);
        return;
      }

      // Populate form with parsed data
      if (data.stake) setStake(data.stake.toString());
      if (data.potential_return) setPotentialReturn(data.potential_return.toString());
      if (data.status) setStatus(data.status);
      if (data.legs?.length) {
        setLegs(data.legs.map((l: { selection: string; odds_fractional: string; odds_decimal: number }) => ({
          selection: l.selection || "",
          odds: l.odds_fractional || "",
          oddsDecimal: l.odds_decimal,
        })));
      } else {
        setLegs([{ selection: "", odds: "" }]);
      }

      setMode("manual");
    } catch (err) {
      console.error("Screenshot error:", err);
      setError("Failed to process screenshot");
      setMode("manual");
      setLegs([{ selection: "", odds: "" }]);
    }
  };

  const handleBrowseSelect = (selection: {
    selection: string;
    odds: number;
    oddsFractional: string;
  }) => {
    setLegs([...legs, {
      selection: selection.selection,
      odds: selection.oddsFractional,
      oddsDecimal: selection.odds,
    }]);
    setMode("manual");
  };

  const addManualLeg = () => setLegs([...legs, { selection: "", odds: "" }]);
  const removeLeg = (i: number) => setLegs(legs.filter((_, idx) => idx !== i));
  const updateLeg = (i: number, field: keyof Leg, value: string) => {
    const updated = [...legs];
    updated[i] = { ...updated[i], [field]: value };
    if (field === "odds") {
      updated[i].oddsDecimal = parseFrac(value);
    }
    setLegs(updated);
  };

  const parseFrac = (f: string) => {
    if (!f) return 2;
    const [a, b] = f.split("/");
    return b ? parseFloat(a) / parseFloat(b) + 1 : parseFloat(f) || 2;
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !seasonId) return;

    const validLegs = legs.filter((l) => l.selection && l.odds);
    const betTypes = ["single", "double", "treble", "acca"];
    const betType = betTypes[Math.min(validLegs.length - 1, 3)] || "other";

    const { data: bet } = await supabase
      .from("bets")
      .insert({
        user_id: user.id,
        season_id: seasonId,
        bet_type: betType,
        stake: parseFloat(stake),
        potential_return: parseFloat(potentialReturn),
        status,
        actual_return: status === "won" ? parseFloat(potentialReturn) : status === "lost" ? 0 : null,
        placed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (bet) {
      await supabase.from("bet_legs").insert(
        validLegs.map((l) => ({
          bet_id: bet.id,
          selection: l.selection,
          odds_fractional: l.odds,
          odds_decimal: l.oddsDecimal || parseFrac(l.odds),
          result: status === "won" ? "won" : status === "lost" ? "lost" : "pending",
        }))
      );

      // Get league_id from season
      const { data: season } = await supabase
        .from("seasons")
        .select("league_id")
        .eq("id", seasonId)
        .single();

      // Get user's display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      // Log activity
      if (season) {
        await logActivity(supabase, {
          leagueId: season.league_id,
          userId: user.id,
          eventType: "bet_placed",
          data: {
            user_name: profile?.display_name || "Someone",
            stake: parseFloat(stake),
            legs: validLegs.length,
          },
        });
      }
    }

    router.push(`/league/${leagueId}`);
    router.refresh();
  };

  if (!leagueId) return null;

  return (
    <main className="min-h-screen bg-[var(--bg)] safe-t safe-b">
      {/* Header */}
      <div className="header flex items-center justify-between">
        <Link href={`/league/${leagueId}`} className="text-[var(--accent)] font-medium text-sm">Cancel</Link>
        <h1 className="font-bold text-sm uppercase tracking-wide">Add Bet</h1>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-[var(--danger)] rounded text-sm">
            {error}
          </div>
        )}

        {mode === "choose" && (
          <div className="space-y-4">
            <p className="text-[var(--text-secondary)] text-center text-sm mb-6">How do you want to add your bet?</p>
            
            {/* Browse Live Odds */}
            <button 
              onClick={() => setShowBrowser(true)} 
              className="card block w-full text-center py-8 hover:border-[var(--accent)] transition-colors bg-green-50 border-[var(--accent)]"
            >
              <IconPlus className="w-10 h-10 mx-auto mb-3 text-[var(--accent)]" />
              <p className="font-semibold text-[var(--accent)]">Browse Live Odds</p>
              <p className="text-sm text-[var(--text-secondary)]">Pick from today's fixtures</p>
            </button>

            <label className="card block cursor-pointer text-center py-8 hover:border-[var(--accent)] transition-colors">
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <IconCamera className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="font-semibold">Upload Screenshot</p>
              <p className="text-sm text-[var(--text-secondary)]">We'll read your bet slip automatically</p>
            </label>

            <button onClick={() => { setLegs([{ selection: "", odds: "" }]); setMode("manual"); }} className="card block w-full text-center py-8 hover:border-[var(--accent)] transition-colors">
              <IconEdit className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="font-semibold">Enter Manually</p>
              <p className="text-sm text-[var(--text-secondary)]">Type in your bet details</p>
            </button>
          </div>
        )}

        {mode === "upload" && (
          <div className="card text-center py-12">
            <div className="animate-pulse">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--accent)] opacity-20"></div>
              <p className="font-medium">{loadingText}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">This may take a few seconds</p>
            </div>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-4">
            {/* Selections */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-header">Selections</p>
                <button
                  onClick={() => setShowBrowser(true)}
                  className="text-xs text-[var(--accent)] font-medium"
                >
                  + Browse Odds
                </button>
              </div>
              
              {legs.length === 0 ? (
                <button
                  onClick={() => setShowBrowser(true)}
                  className="w-full p-4 border-2 border-dashed border-[var(--border)] rounded text-center hover:border-[var(--accent)] transition"
                >
                  <IconPlus className="w-5 h-5 mx-auto mb-1 text-[var(--accent)]" />
                  <p className="text-sm text-[var(--accent)]">Add selection</p>
                </button>
              ) : (
                <div className="space-y-3">
                  {legs.map((leg, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          value={leg.selection}
                          onChange={(e) => updateLeg(i, "selection", e.target.value)}
                          placeholder="e.g. Arsenal to win"
                          className="w-full"
                        />
                      </div>
                      <input
                        value={leg.odds}
                        onChange={(e) => updateLeg(i, "odds", e.target.value)}
                        placeholder="2/1"
                        className="w-20 text-center"
                      />
                      <button 
                        onClick={() => removeLeg(i)} 
                        className="p-2 text-[var(--danger)]"
                      >
                        <IconX className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowBrowser(true)} 
                      className="flex-1 py-2 text-sm text-[var(--accent)] font-medium bg-green-50 rounded"
                    >
                      + Browse Odds
                    </button>
                    <button 
                      onClick={addManualLeg} 
                      className="flex-1 py-2 text-sm text-[var(--text-secondary)] font-medium bg-[var(--bg)] rounded"
                    >
                      + Manual Entry
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stake and returns */}
            <div className="card">
              <p className="section-header">Bet Details</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)]">Stake</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">£</span>
                    <input 
                      type="number" 
                      value={stake} 
                      onChange={(e) => setStake(e.target.value)} 
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)]">Returns</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">£</span>
                    <input 
                      type="number" 
                      value={potentialReturn} 
                      onChange={(e) => setPotentialReturn(e.target.value)} 
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 text-[var(--text-secondary)]">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {["pending", "won", "lost"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`py-2 px-3 rounded text-xs font-semibold uppercase tracking-wide border transition ${
                        status === s
                          ? s === "won" ? "bg-green-50 border-[var(--accent)] text-[var(--accent)]"
                            : s === "lost" ? "bg-red-50 border-[var(--danger)] text-[var(--danger)]"
                            : "bg-yellow-50 border-[var(--warning)] text-[var(--warning)]"
                          : "border-[var(--border)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !stake || !potentialReturn || legs.length === 0 || !legs.some((l) => l.selection)}
              className="btn btn-primary w-full"
            >
              {saving ? "Saving..." : "Save Bet"}
            </button>
          </div>
        )}
      </div>

      {/* Odds browser modal */}
      <OddsBrowser
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={handleBrowseSelect}
      />
    </main>
  );
}
