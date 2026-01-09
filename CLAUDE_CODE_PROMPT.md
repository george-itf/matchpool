# Claude Code Prompt - BetMates Feature Build

## Project Context

BetMates is a betting league tracker PWA built with:
- Next.js 15 (App Router)
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS 4
- Vercel hosting

**Live:** https://betmates.vercel.app
**Repo:** /Users/georgeitf/Desktop/CLAUDE/betmates
**Docs:** See PROJECT.md for full schema, file structure, and feature list

## Current Issue

The "Create Group Bet" button is not showing on `/league/[id]/group-bet` page even though user is admin. Debug and fix this first.

Check:
1. Is `isAdmin` true? Add console.log
2. Is `season` defined? 
3. Is the `CreateGroupBetButton` component being rendered?
4. Check RLS on `group_bets` table - may need policies

## Features to Build (in order)

### 1. Bet Settlement UI (Admin)

Add to `/league/[id]/settings` page:

**Requirements:**
- New "Settle Bets" section showing all pending bets for current season
- Each bet shows: user, selections, stake, potential return
- Two buttons per bet: "Won" (green) and "Lost" (red)
- Won: set status='settled', actual_return=potential_return
- Lost: set status='settled', actual_return=0
- After settling, leaderboard should auto-update (it uses `get_season_leaderboard` RPC)
- Add bulk actions: "Settle All as Lost" for expired bets

**Files to modify:**
- `/src/app/league/[id]/settings/page.tsx` - add section
- Create `/src/components/settle-bets.tsx`

---

### 2. Bet History Page

Create `/league/[id]/bets` page:

**Requirements:**
- List all bets for current user in this league
- Filter tabs: All | Pending | Won | Lost
- Each bet shows: date, selections, stake, return, profit/loss
- Running total at top: "Total Staked: £X | Total Return: £Y | P&L: £Z"
- Click bet to expand and see all legs
- Link from league page: add "My Bets" card above Group Bets

**Files to create:**
- `/src/app/league/[id]/bets/page.tsx`

**Files to modify:**
- `/src/app/league/[id]/page.tsx` - add link

---

### 3. Push Notifications (Web Push)

**Requirements:**
- Service worker already exists at `/public/sw.js`
- Add notification permission prompt on first login
- Store subscription in new `push_subscriptions` table
- Send notifications for:
  - 2 hours before bet deadline (cron job or Supabase Edge Function)
  - When another member places a bet
  - When admin settles your bet
  - Weekly payment reminder

**Database:**
```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Files to create:**
- `/src/lib/notifications.ts` - helper functions
- `/src/components/notification-prompt.tsx`
- `/src/app/api/notifications/subscribe/route.ts`
- `/src/app/api/notifications/send/route.ts`

**Files to modify:**
- `/public/sw.js` - handle push events
- `/src/app/dashboard/page.tsx` - show prompt

---

### 4. Activity Feed

Add to league page:

**Requirements:**
- New `activity_log` table tracking events
- Show last 20 activities on league page
- Event types: bet_placed, bet_settled, member_joined, payment_made, group_bet_created
- Real-time updates using Supabase realtime subscription
- Format: "[User] [action] [details] · [time ago]"

**Database:**
```sql
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_league ON activity_log(league_id, created_at DESC);
```

**Files to create:**
- `/src/components/activity-feed.tsx`

**Files to modify:**
- `/src/app/league/[id]/page.tsx` - add feed section
- All places where events happen - insert activity log entry

---

## Code Standards

1. **TypeScript:** Strict types, no `any`
2. **Components:** Client components only when needed (interactivity)
3. **Styling:** Use existing CSS variables from globals.css
4. **Icons:** Use `/src/components/icons.tsx` - add new icons there if needed
5. **No emojis:** Use SVG icons only
6. **Square design:** 4px border radius, uppercase labels

## After Each Feature

1. Test locally: `npm run dev`
2. Update PROJECT.md with:
   - New files created
   - Database changes
   - Feature description
3. Commit with clear message
4. Push to deploy

## Commands

```bash
cd /Users/georgeitf/Desktop/CLAUDE/betmates
npm run dev
# In another terminal:
git add . && git commit -m "message" && git push
```

## Supabase Access

- Dashboard: https://supabase.com/dashboard/project/wtgjziuwwmpuzjrxqitj
- Run SQL in: SQL Editor
- Check logs in: Logs > Postgres

---

Start by fixing the Create Group Bet button, then proceed with features 1-4 in order. Update PROJECT.md after completing each feature.
