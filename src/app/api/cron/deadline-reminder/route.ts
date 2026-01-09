import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";

// Configure web-push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:noreply@betmates.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 5 = Friday
  const hour = now.getUTCHours();

  // Get all active leagues with their deadline settings
  const { data: leagues } = await supabase
    .from("leagues")
    .select(`
      id,
      name,
      bet_deadline_day,
      bet_deadline_hour,
      league_members(user_id)
    `);

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ message: "No leagues found" });
  }

  const notificationsSent: string[] = [];

  for (const league of leagues) {
    const deadlineDay = league.bet_deadline_day ?? 5; // Default Friday
    const deadlineHour = league.bet_deadline_hour ?? 15; // Default 3 PM

    // Check if deadline is in 24 hours
    // This runs at the same hour as deadline but one day before
    const isReminderTime =
      dayOfWeek === ((deadlineDay + 6) % 7) && // Day before deadline
      hour === deadlineHour;

    // Check if deadline is in 1 hour
    const isUrgentReminder =
      dayOfWeek === deadlineDay &&
      hour === deadlineHour - 1;

    if (!isReminderTime && !isUrgentReminder) {
      continue;
    }

    const members = (league.league_members || []) as Array<{ user_id: string }>;
    const userIds = members.map((m) => m.user_id);

    if (userIds.length === 0) continue;

    // Get push subscriptions for these users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (!subscriptions || subscriptions.length === 0) continue;

    const title = isUrgentReminder ? "Deadline in 1 hour!" : "Bet deadline tomorrow";
    const body = isUrgentReminder
      ? `${league.name}: Last chance to place your bets!`
      : `${league.name}: Don't forget to place your bets before the deadline.`;

    const payload = JSON.stringify({
      title,
      body,
      url: `/league/${league.id}`,
      tag: "deadline-reminder",
    });

    // Send to all subscriptions
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        notificationsSent.push(sub.user_id);
      } catch (error) {
        // Remove invalid subscriptions
        if ((error as { statusCode?: number }).statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        console.error("Push notification error:", error);
      }
    }
  }

  return NextResponse.json({
    message: "Deadline reminders sent",
    count: notificationsSent.length,
    timestamp: now.toISOString(),
  });
}
