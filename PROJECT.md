# BetMates - Betting League Tracker

## Overview

A web app for tracking bets with friends in a competitive league format. Weekly buy-ins, seasonal competitions, winner takes the pot.

**Live URL:** https://betmates.vercel.app

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router) |
| Backend/DB | Supabase (Postgres, Auth, Storage) |
| Screenshot OCR | Claude Vision API |
| Hosting | Vercel |
| Styling | Tailwind CSS 4 |
| Payments | PayPal.me (manual tracking) |

---

## Features

### User Features
- Sign up / sign in with email + password
- Edit profile (display name)
- Create league with custom settings
- Join league with 6-character invite code
- View dashboard with all leagues
- View league (leaderboard, recent bets, pot total)
- Add bet via screenshot upload (AI parsing)
- Add bet manually (stake, returns, selections)
- Weekly buy-in tracking with PayPal integration
- Submit legs to group bets
- Vote on group bet selections
- View bet history with filters (All/Pending/Won/Lost)
- View P&L totals on bet history page
- Receive push notifications for bet activities
- View real-time activity feed on league page

### Admin Features
- Edit league name and weekly buy-in
- View and copy invite code
- Track weekly payments per member
- Mark members as paid (updates pot)
- Promote/demote/kick members
- End season and declare winner
- Start new season
- Create and manage group bets
- Settle bets (mark as won/lost) from settings page

---

## Database Schema

### Tables

**profiles**
- id (uuid, FK to auth.users)
- display_name (text)
- avatar_url (text, nullable)
- created_at (timestamp)

**leagues**
- id (uuid)
- name (text)
- invite_code (text, unique, default random 6 chars)
- weekly_buyin (numeric, default 5)
- season_length_weeks (int, default 6)
- group_bet_buyin (numeric, default 2)
- group_bet_legs_per_user (int, default 4)
- group_bet_winning_legs (int, default 5)
- created_by (uuid, FK to profiles)
- created_at (timestamp)

**league_members**
- id (uuid)
- league_id (uuid, FK)
- user_id (uuid, FK)
- role (text: 'admin' or 'member')
- joined_at (timestamp)

**seasons**
- id (uuid)
- league_id (uuid, FK)
- season_number (int)
- starts_at (timestamp)
- ends_at (timestamp)
- status (text: 'active', 'completed')
- pot_amount (numeric, default 0)
- winner_id (uuid, FK, nullable)

**bets**
- id (uuid)
- user_id (uuid, FK)
- season_id (uuid, FK)
- bet_type (text: 'single', 'double', 'treble', 'acca')
- stake (numeric)
- potential_return (numeric)
- actual_return (numeric, nullable)
- status (text: 'pending', 'won', 'lost', 'settled')
- screenshot_url (text, nullable)
- placed_at (timestamp)

**bet_legs**
- id (uuid)
- bet_id (uuid, FK)
- selection (text)
- odds_decimal (numeric)
- odds_fractional (text)
- result (text: 'pending', 'won', 'lost')

**payments**
- id (uuid)
- season_id (uuid, FK)
- user_id (uuid, FK)
- week_number (int)
- amount (numeric)
- status (text: 'pending', 'paid')
- paid_at (timestamp)
- unique constraint on (season_id, user_id, week_number)

**group_bets**
- id (uuid)
- season_id (uuid, FK)
- title (text)
- buyin_per_person (numeric)
- legs_per_user (int)
- winning_leg_count (int)
- status (text: 'collecting', 'voting', 'finalized', 'settled')
- created_by (uuid, FK)
- created_at (timestamp)

**group_bet_submissions**
- id (uuid)
- group_bet_id (uuid, FK)
- user_id (uuid, FK)
- selection (text)
- odds_fractional (text)
- odds_decimal (numeric)
- votes (int, default 0)
- selected (boolean, default false)
- submitted_at (timestamp)

**group_bet_votes**
- id (uuid)
- submission_id (uuid, FK)
- user_id (uuid, FK)
- unique constraint on (submission_id, user_id)

**push_subscriptions**
- id (uuid)
- user_id (uuid, FK)
- endpoint (text)
- p256dh (text)
- auth (text)
- created_at (timestamp)
- unique constraint on (user_id, endpoint)

**activity_log**
- id (uuid)
- league_id (uuid, FK)
- user_id (uuid, FK)
- event_type (text: 'bet_placed', 'bet_settled', 'member_joined', 'payment_made', 'group_bet_created')
- data (jsonb)
- created_at (timestamp)

### RLS Policies (Simplified)

All tables have RLS enabled with permissive policies:
- SELECT: true (authenticated users can read)
- INSERT: auth.uid() = user_id or created_by
- UPDATE/DELETE: owner or admin check

---

## File Structure

```
betmates/
├── PROJECT.md
├── .env.local
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── league/[id]/
│   │   │   ├── page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── bet/new/page.tsx
│   │   │   ├── bets/page.tsx
│   │   │   ├── members/page.tsx
│   │   │   ├── stats/page.tsx
│   │   │   └── group-bet/
│   │   │       ├── page.tsx
│   │   │       └── [groupBetId]/page.tsx
│   │   ├── join/[code]/page.tsx
│   │   └── api/
│   │       ├── parse-screenshot/route.ts
│   │       ├── send-push/route.ts
│   │       └── cron/deadline-reminder/route.ts
│   ├── components/
│   │   ├── activity-feed.tsx
│   │   ├── copy-button.tsx
│   │   ├── create-league-button.tsx
│   │   ├── join-league-button.tsx
│   │   ├── members-list.tsx
│   │   ├── payments-tracker.tsx
│   │   ├── profile-form.tsx
│   │   ├── push-prompt.tsx
│   │   ├── season-controls.tsx
│   │   ├── settings-form.tsx
│   │   ├── settle-bets.tsx
│   │   ├── share-link-button.tsx
│   │   ├── member-actions.tsx
│   │   └── sign-out-button.tsx
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── server.ts
│   │       └── middleware.ts
│   └── middleware.ts
```

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://wtgjziuwwmpuzjrxqitj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
PUSH_API_KEY=...
CRON_SECRET=...
```

---

## Deployment

### Vercel Setup
1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Auto-deploys on push to main

### Supabase Setup
1. Create project at supabase.com
2. Run schema SQL in SQL Editor
3. Configure auth: Email provider, disable "Confirm email"
4. Create storage bucket "screenshots" (public)

---

## Session Log

### Session 1
- Project setup, data model design
- Supabase schema creation
- Next.js scaffolding with Tailwind

### Session 2
- Auth flow (originally magic link)
- Dashboard and league views
- Screenshot parsing API with Claude Vision
- Bet submission (upload + manual)

### Session 3
- Group bet feature (submissions, voting, finalization)
- Leaderboard with profit tracking
- Season management

### Session 4
- Admin panel (settings, members, seasons)
- Profile page
- Initial Vercel deployment

### Session 5
- TypeScript fixes (profiles array flattening)
- RLS policy debugging and fixes
- Switched from magic link to password auth (SMTP issues)
- PayPal.me integration for payments
- Payment tracking by admin
- UI overhaul: dark hacker theme to clean light theme
- Server/client component fixes (onClick handlers)
- Comprehensive testing and bug fixes

### Session 6
- Fixed group bet button not showing (schema mismatch)
- Updated group_bets table column names to match schema
- Updated group bet status values (submissions_open, voting_open, betting, settled)
- Added Bet Settlement UI in settings page
- Created settle-bets.tsx component
- Added Bet History page (/league/[id]/bets) with filters
- Added running P&L totals on bet history
- Implemented push notifications infrastructure
- Created push_subscriptions table
- Added push-prompt.tsx component for permission
- Updated service worker for push events
- Created /api/send-push endpoint
- Added Activity Feed with realtime updates
- Created activity_log table
- Added activity-feed.tsx component
- Activity logging on bet settlement

### Session 7
- Enhanced Season Management in settings page
  - Added detailed season info display (dates, days remaining, pot)
  - Auto-fetch leaderboard to pre-select winner on end season
  - Display past seasons when no active season
- Added Pot Calculation RPC function (supabase/pot_calculation.sql)
  - update_season_pot function calculates pot from paid payments
- Created Member List page (/league/[id]/members)
  - Shows all members with roles, join dates, payment status
  - Admin actions: promote/demote/remove members
  - member-actions.tsx component with dropdown menu
- Added Share Invite Link functionality
  - Created /join/[code] page for invite link handling
  - Auto-join for logged in users, signup prompt for guests
  - ShareLinkButton component using Web Share API
  - Logs member_joined activity on join
- Built Stats Dashboard page (/league/[id]/stats)
  - Season overview (members, pot, total bets, win rate)
  - Money stats (staked, returns, profit, averages)
  - Bet breakdown (pending/won/lost, acca stats)
  - Highlights (top performer, worst luck, most active, biggest win)
- Added Notification Triggers with Vercel Cron
  - /api/cron/deadline-reminder route
  - Sends push notifications 24h and 1h before bet deadline
  - vercel.json configured for hourly cron execution
  - Requires CRON_SECRET env var for authentication

---

## Known Issues / TODO

### Pending
- Run new SQL migrations in Supabase:
  - supabase/push_subscriptions.sql
  - supabase/activity_log.sql
  - supabase/pot_calculation.sql
  - supabase/activity_reactions.sql
  - supabase/activity_comments.sql
- Group bet SQL functions need to be run in Supabase:
  - increment_votes
  - decrement_votes
  - transition_to_voting
  - finalize_group_bet
- PWA icons returning 404 (need to add icon files)
- Generate and configure VAPID keys for push notifications
- Add CRON_SECRET env var in Vercel for cron job auth

### Future Enhancements
- Custom domain
- Historical season stats
- Export bet history

---

## API Endpoints

### POST /api/parse-screenshot
Accepts multipart form with image file, returns parsed bet data:
```json
{
  "stake": 5.00,
  "potential_return": 25.00,
  "status": "pending",
  "legs": [
    {
      "selection": "Arsenal to win",
      "odds_fractional": "2/1"
    }
  ]
}
```

### POST /api/send-push
Sends push notifications to specified users. Requires Bearer token auth.
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "title": "BetMates",
  "body": "Your bet has been settled!",
  "url": "/league/xxx/bets",
  "tag": "bet-settled"
}
```

### GET /api/cron/deadline-reminder
Cron job endpoint for deadline reminders. Requires Bearer token auth with CRON_SECRET.
- Runs hourly via Vercel Cron
- Sends push notifications 24 hours before deadline
- Sends urgent notifications 1 hour before deadline
- Returns count of notifications sent

---

## Database Functions

### get_season_leaderboard(p_season_id uuid)
Returns leaderboard data for a season:
```sql
SELECT user_id, display_name, profit
ORDER BY profit DESC
```

### Group Bet Functions (to be applied)
- increment_votes(submission_id)
- decrement_votes(submission_id)
- transition_to_voting(group_bet_id)
- finalize_group_bet(group_bet_id)

---

## Design System

### Colors
- Background: #f5f5f5
- Surface: #ffffff
- Border: #e5e5e5
- Text: #1a1a1a
- Text Secondary: #666666
- Accent (green): #1e8e3e
- Danger (red): #d93025
- Warning (yellow): #f9a825

### Components
- .card - White background, 12px radius, subtle shadow
- .btn - 12px padding, 8px radius, 600 weight
- .btn-primary - Green background, white text
- .btn-secondary - White background, border
- .badge - Pill shape, colored backgrounds
- .list-item - Flex row with bottom border

---

## Testing Checklist

- [x] Sign up with email/password
- [x] Sign in with email/password
- [x] Edit display name
- [x] Create a league
- [x] View invite code
- [x] Copy invite code
- [x] Join league with code
- [ ] Add bet via screenshot
- [x] Add bet manually
- [x] View leaderboard
- [x] View recent bets
- [x] Pay via PayPal link
- [x] Admin: mark payment as paid
- [x] Admin: edit league settings
- [x] Admin: view members
- [x] Admin: promote/demote members
- [x] Admin: kick member
- [ ] Admin: end season
- [ ] Admin: start new season
- [ ] Create group bet
- [ ] Submit legs to group bet
- [ ] Vote on legs
- [ ] Finalize group bet
- [x] Sign out
- [ ] Share invite link
- [ ] Join via invite link
- [ ] View stats dashboard
