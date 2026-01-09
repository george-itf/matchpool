"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconCheck, IconPlus, IconUsers, IconDollar } from "@/components/icons";

function IconUsersGroup({ className = "icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

interface Reaction {
  id: string;
  activity_id: string;
  user_id: string;
  reaction: string;
}

interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string };
}

interface Activity {
  id: string;
  event_type: string;
  data: {
    user_name?: string;
    stake?: number;
    return?: number;
    won?: boolean;
    title?: string;
    amount?: number;
  };
  created_at: string;
}

const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "thumbs_up", emoji: "👍" },
  { key: "interrobang", emoji: "⁉️" },
];

export function ActivityFeed({
  leagueId,
  initialActivities,
  userId,
}: {
  leagueId: string;
  initialActivities: Activity[];
  userId: string;
}) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const supabase = createClient();

  // Load reactions and comments
  useEffect(() => {
    const loadReactionsAndComments = async () => {
      const activityIds = activities.map(a => a.id);
      if (activityIds.length === 0) return;

      const [reactionsRes, commentsRes] = await Promise.all([
        supabase
          .from("activity_reactions")
          .select("*")
          .in("activity_id", activityIds),
        supabase
          .from("activity_comments")
          .select("*, profiles!activity_comments_user_id_fkey(display_name)")
          .in("activity_id", activityIds)
          .order("created_at", { ascending: true }),
      ]);

      // Group reactions by activity
      const groupedReactions: Record<string, Reaction[]> = {};
      (reactionsRes.data || []).forEach((r: Reaction) => {
        if (!groupedReactions[r.activity_id]) groupedReactions[r.activity_id] = [];
        groupedReactions[r.activity_id].push(r);
      });
      setReactions(groupedReactions);

      // Group comments by activity
      const groupedComments: Record<string, Comment[]> = {};
      (commentsRes.data || []).forEach((c: Comment) => {
        if (!groupedComments[c.activity_id]) groupedComments[c.activity_id] = [];
        groupedComments[c.activity_id].push(c);
      });
      setComments(groupedComments);
    };

    loadReactionsAndComments();
  }, [activities, supabase]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `league_id=eq.${leagueId}` },
        (payload) => {
          const newActivity = payload.new as Activity;
          setActivities((prev) => [newActivity, ...prev.slice(0, 19)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_reactions" },
        () => {
          // Reload reactions on any change
          const activityIds = activities.map(a => a.id);
          supabase
            .from("activity_reactions")
            .select("*")
            .in("activity_id", activityIds)
            .then(({ data }) => {
              const grouped: Record<string, Reaction[]> = {};
              (data || []).forEach((r: Reaction) => {
                if (!grouped[r.activity_id]) grouped[r.activity_id] = [];
                grouped[r.activity_id].push(r);
              });
              setReactions(grouped);
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_comments" },
        (payload) => {
          const newComment = payload.new as Comment;
          setComments((prev) => ({
            ...prev,
            [newComment.activity_id]: [...(prev[newComment.activity_id] || []), newComment],
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, activities, supabase]);

  const toggleReaction = async (activityId: string, reactionKey: string) => {
    const activityReactions = reactions[activityId] || [];
    const existing = activityReactions.find(r => r.user_id === userId && r.reaction === reactionKey);

    if (existing) {
      await supabase.from("activity_reactions").delete().eq("id", existing.id);
      setReactions((prev) => ({
        ...prev,
        [activityId]: (prev[activityId] || []).filter(r => r.id !== existing.id),
      }));
    } else {
      const { data } = await supabase
        .from("activity_reactions")
        .insert({ activity_id: activityId, user_id: userId, reaction: reactionKey })
        .select()
        .single();
      if (data) {
        setReactions((prev) => ({
          ...prev,
          [activityId]: [...(prev[activityId] || []), data],
        }));
      }
    }
  };

  const submitComment = async (activityId: string) => {
    const content = commentInputs[activityId]?.trim();
    if (!content) return;

    setSubmitting(activityId);
    const { data } = await supabase
      .from("activity_comments")
      .insert({ activity_id: activityId, user_id: userId, content })
      .select("*, profiles!activity_comments_user_id_fkey(display_name)")
      .single();

    if (data) {
      setComments((prev) => ({
        ...prev,
        [activityId]: [...(prev[activityId] || []), data],
      }));
      setCommentInputs((prev) => ({ ...prev, [activityId]: "" }));
    }
    setSubmitting(null);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "bet_placed": return <IconPlus className="w-4 h-4" />;
      case "bet_settled": return <IconCheck className="w-4 h-4" />;
      case "member_joined": return <IconUsers className="w-4 h-4" />;
      case "payment_made": return <IconDollar className="w-4 h-4" />;
      case "group_bet_created": return <IconUsersGroup className="w-4 h-4" />;
      default: return <IconPlus className="w-4 h-4" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "bet_placed": return "bg-blue-100 text-blue-600";
      case "bet_settled": return "bg-green-100 text-green-600";
      case "member_joined": return "bg-purple-100 text-purple-600";
      case "payment_made": return "bg-yellow-100 text-yellow-700";
      case "group_bet_created": return "bg-pink-100 text-pink-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getMessage = (activity: Activity) => {
    const { event_type, data } = activity;
    switch (event_type) {
      case "bet_placed":
        return (<span><strong>{data.user_name}</strong> placed a <strong>£{data.stake?.toFixed(2)}</strong> bet</span>);
      case "bet_settled":
        return (<span><strong>{data.user_name}</strong> {data.won ? <span className="text-[var(--accent)]">won £{data.return?.toFixed(2)}</span> : <span className="text-[var(--danger)]">lost their bet</span>}</span>);
      case "member_joined":
        return (<span><strong>{data.user_name}</strong> joined the league</span>);
      case "payment_made":
        return (<span><strong>{data.user_name}</strong> paid £{data.amount?.toFixed(2)}</span>);
      case "group_bet_created":
        return (<span><strong>{data.user_name}</strong> created group bet: <strong>{data.title}</strong></span>);
      default:
        return <span>Activity</span>;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  if (activities.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] text-center py-4">No activity yet</p>;
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const activityReactions = reactions[activity.id] || [];
        const activityComments = comments[activity.id] || [];
        const isExpanded = expandedComments.has(activity.id);

        return (
          <div key={activity.id} className="border-b border-[var(--border)] pb-4 last:border-0">
            {/* Main activity */}
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${getIconBg(activity.event_type)}`}>
                {getIcon(activity.event_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{getMessage(activity)}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formatTime(activity.created_at)}</p>
              </div>
            </div>

            {/* Reactions */}
            <div className="flex items-center gap-1 mt-2 ml-11">
              {REACTIONS.map(({ key, emoji }) => {
                const count = activityReactions.filter(r => r.reaction === key).length;
                const hasReacted = activityReactions.some(r => r.reaction === key && r.user_id === userId);
                return (
                  <button
                    key={key}
                    onClick={() => toggleReaction(activity.id, key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition ${
                      hasReacted 
                        ? "bg-[var(--accent)] text-white" 
                        : "bg-[var(--bg)] hover:bg-gray-200"
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span className="text-xs">{count}</span>}
                  </button>
                );
              })}
              
              {/* Comment toggle */}
              <button
                onClick={() => setExpandedComments(prev => {
                  const next = new Set(prev);
                  if (next.has(activity.id)) next.delete(activity.id);
                  else next.add(activity.id);
                  return next;
                })}
                className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-[var(--bg)] hover:bg-gray-200 ml-1"
              >
                <span>💬</span>
                {activityComments.length > 0 && <span className="text-xs">{activityComments.length}</span>}
              </button>
            </div>

            {/* Comments section */}
            {isExpanded && (
              <div className="mt-3 ml-11 space-y-2">
                {/* Existing comments */}
                {activityComments.map((comment) => {
                  const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
                  return (
                    <div key={comment.id} className="bg-[var(--bg)] rounded p-2">
                      <p className="text-sm">
                        <strong className="text-xs">{profile?.display_name || "User"}</strong>
                        <span className="text-xs text-[var(--text-secondary)] ml-2">{formatTime(comment.created_at)}</span>
                      </p>
                      <p className="text-sm mt-1">{comment.content}</p>
                    </div>
                  );
                })}

                {/* New comment input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={commentInputs[activity.id] || ""}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [activity.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && submitComment(activity.id)}
                    maxLength={280}
                    className="flex-1 text-sm py-1 px-2"
                  />
                  <button
                    onClick={() => submitComment(activity.id)}
                    disabled={submitting === activity.id || !commentInputs[activity.id]?.trim()}
                    className="btn btn-primary text-xs py-1 px-3"
                  >
                    {submitting === activity.id ? "..." : "Post"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
