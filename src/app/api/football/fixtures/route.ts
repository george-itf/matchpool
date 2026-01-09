import { NextResponse } from "next/server";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  if (!API_KEY) {
    return NextResponse.json({ error: "API_FOOTBALL_KEY not configured", fixtures: [], byLeague: {} }, { status: 200 });
  }

  try {
    // Fetch all fixtures for the date (no league filter to maximize results)
    const url = `${BASE_URL}/fixtures?date=${date}`;
    
    console.log("Fetching fixtures:", url);

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": API_KEY,
      },
      next: { revalidate: 300 },
    });

    const data = await response.json();

    console.log("API Response:", JSON.stringify(data).slice(0, 500));

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error("API Errors:", data.errors);
      return NextResponse.json({ error: data.errors, fixtures: [], byLeague: {} }, { status: 200 });
    }

    // Filter to popular leagues only
    const popularLeagueIds = [
      39,   // Premier League
      140,  // La Liga
      78,   // Bundesliga
      135,  // Serie A
      61,   // Ligue 1
      2,    // Champions League
      3,    // Europa League
      48,   // FA Cup
      45,   // EFL Cup
      40,   // Championship
      41,   // League One
      42,   // League Two
      94,   // Primeira Liga (Portugal)
      88,   // Eredivisie
      144,  // Belgian Pro League
      203,  // Turkish Super Lig
      179,  // Scottish Premiership
    ];

    // Transform to simpler format
    const allFixtures = (data.response || []).map((fixture: {
      fixture: { id: number; date: string; status: { short: string } };
      league: { id: number; name: string; country: string; logo: string };
      teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
    }) => ({
      id: fixture.fixture.id,
      date: fixture.fixture.date,
      status: fixture.fixture.status.short,
      league: {
        id: fixture.league.id,
        name: fixture.league.name,
        country: fixture.league.country,
        logo: fixture.league.logo,
      },
      home: {
        id: fixture.teams.home.id,
        name: fixture.teams.home.name,
        logo: fixture.teams.home.logo,
      },
      away: {
        id: fixture.teams.away.id,
        name: fixture.teams.away.name,
        logo: fixture.teams.away.logo,
      },
    }));

    // Filter to popular leagues
    const fixtures = allFixtures.filter((f: { league: { id: number } }) => 
      popularLeagueIds.includes(f.league.id)
    );

    // Group by league
    const byLeague: Record<string, typeof fixtures> = {};
    fixtures.forEach((f: { league: { name: string } }) => {
      const leagueName = f.league.name;
      if (!byLeague[leagueName]) byLeague[leagueName] = [];
      byLeague[leagueName].push(f);
    });

    return NextResponse.json({ 
      fixtures, 
      byLeague,
      totalFound: data.response?.length || 0,
      filteredCount: fixtures.length,
    });
  } catch (error) {
    console.error("Football API error:", error);
    return NextResponse.json({ error: "Failed to fetch fixtures", fixtures: [], byLeague: {} }, { status: 200 });
  }
}
