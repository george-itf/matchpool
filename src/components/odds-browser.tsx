"use client";

import { useEffect, useState } from "react";
import { IconX, IconArrowLeft } from "@/components/icons";

interface Fixture {
  id: number;
  date: string;
  status: string;
  league: { id: number; name: string; country: string; logo: string };
  home: { id: number; name: string; logo: string };
  away: { id: number; name: string; logo: string };
}

interface MarketOption {
  label: string;
  odds: number;
  oddsFractional: string;
}

interface Market {
  id: number;
  name: string;
  options: MarketOption[];
}

interface Selection {
  fixture: Fixture;
  market: string;
  selection: string;
  odds: number;
  oddsFractional: string;
}

export function OddsBrowser({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: Selection) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fixtures, setFixtures] = useState<Record<string, Fixture[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(false);

  // Fetch fixtures when date changes
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchFixtures = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/football/fixtures?date=${date}`);
        const data = await res.json();
        
        if (data.error) {
          setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
          setFixtures({});
        } else {
          setFixtures(data.byLeague || {});
          if (Object.keys(data.byLeague || {}).length === 0) {
            setError(`No fixtures found (${data.totalFound || 0} total matches, ${data.filteredCount || 0} in popular leagues)`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch fixtures:", err);
        setError("Failed to connect to API");
      }
      setLoading(false);
    };

    fetchFixtures();
  }, [date, isOpen]);

  // Fetch odds when fixture selected
  useEffect(() => {
    if (!selectedFixture) return;

    const fetchOdds = async () => {
      setLoadingOdds(true);
      try {
        const res = await fetch(`/api/football/odds?fixture=${selectedFixture.id}`);
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        console.error("Failed to fetch odds:", err);
      }
      setLoadingOdds(false);
    };

    fetchOdds();
  }, [selectedFixture]);

  const handleSelectOdds = (market: Market, option: MarketOption) => {
    if (!selectedFixture) return;
    
    const selectionText = `${selectedFixture.home.name} vs ${selectedFixture.away.name} - ${option.label}`;
    
    onSelect({
      fixture: selectedFixture,
      market: market.name,
      selection: selectionText,
      odds: option.odds,
      oddsFractional: option.oddsFractional,
    });
    
    setSelectedFixture(null);
    setMarkets([]);
    onClose();
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        value: d.toISOString().split("T")[0],
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
      });
    }
    return dates;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface)] w-full sm:max-w-lg sm:rounded-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          {selectedFixture ? (
            <button
              onClick={() => {
                setSelectedFixture(null);
                setMarkets([]);
              }}
              className="flex items-center gap-1 text-[var(--accent)] font-medium text-sm"
            >
              <IconArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <h2 className="font-bold">Browse Odds</h2>
          )}
          <button onClick={onClose} className="p-1 text-[var(--text-secondary)]">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Date selector */}
        {!selectedFixture && (
          <div className="flex gap-2 p-4 overflow-x-auto border-b border-[var(--border)]">
            {getDateOptions().map((d) => (
              <button
                key={d.value}
                onClick={() => setDate(d.value)}
                className={`px-3 py-1.5 text-sm rounded whitespace-nowrap ${
                  date === d.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg)] text-[var(--text)]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedFixture ? (
            // Markets view
            <div>
              <div className="text-center mb-4">
                <p className="font-semibold">
                  {selectedFixture.home.name} vs {selectedFixture.away.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedFixture.league.name} · {formatTime(selectedFixture.date)}
                </p>
              </div>

              {loadingOdds ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">Loading odds...</div>
              ) : markets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[var(--text-secondary)]">No odds available yet</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Odds usually appear 2-3 days before kickoff</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {markets.map((market) => (
                    <div key={market.id} className="card">
                      <p className="section-header">{market.name}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {market.options.map((option, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectOdds(market, option)}
                            className="p-3 bg-[var(--bg)] rounded text-center hover:bg-[var(--accent)] hover:text-white transition"
                          >
                            <p className="text-xs text-[var(--text-secondary)] mb-1">{option.label}</p>
                            <p className="font-bold">{option.oddsFractional}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Fixtures view
            <div>
              {loading ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">Loading fixtures...</div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-[var(--text-secondary)]">{error}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">Try selecting a different date</p>
                </div>
              ) : Object.keys(fixtures).length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">No fixtures found</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(fixtures).map(([league, leagueFixtures]) => (
                    <div key={league}>
                      <p className="section-header mb-2">{league}</p>
                      <div className="space-y-2">
                        {leagueFixtures.map((fixture) => (
                          <button
                            key={fixture.id}
                            onClick={() => setSelectedFixture(fixture)}
                            className="w-full p-3 bg-[var(--bg)] rounded flex items-center justify-between hover:bg-gray-100 transition"
                          >
                            <div className="flex-1 text-left">
                              <p className="font-medium text-sm">{fixture.home.name}</p>
                              <p className="font-medium text-sm">{fixture.away.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-[var(--text-secondary)]">
                                {formatTime(fixture.date)}
                              </p>
                              {fixture.status !== "NS" && (
                                <span className="badge badge-yellow text-xs">{fixture.status}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
