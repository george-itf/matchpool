"use client";

import { useState, useEffect } from "react";
import { IconClock } from "@/components/icons";

export function DeadlineCountdown({ deadlineDay = 5, deadlineHour = 15 }: { deadlineDay?: number; deadlineHour?: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);

  useEffect(() => {
    const getNextDeadline = () => {
      const now = new Date();
      const day = now.getDay();
      let daysUntil = (deadlineDay - day + 7) % 7;
      
      // If it's the deadline day but past the hour, go to next week
      if (daysUntil === 0 && now.getHours() >= deadlineHour) {
        daysUntil = 7;
      }
      
      const deadline = new Date(now);
      deadline.setDate(now.getDate() + daysUntil);
      deadline.setHours(deadlineHour, 0, 0, 0);
      return deadline;
    };

    const calculateTimeLeft = () => {
      const deadline = getNextDeadline();
      setDeadlineDate(deadline);
      
      const now = new Date().getTime();
      const diff = deadline.getTime() - now;

      if (diff <= 0) {
        setTimeLeft("Deadline passed");
        setIsUrgent(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
        setIsUrgent(false);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setIsUrgent(hours < 6);
      } else {
        setTimeLeft(`${minutes}m`);
        setIsUrgent(true);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [deadlineDay, deadlineHour]);

  if (!deadlineDate) return null;

  const dayName = deadlineDate.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = deadlineDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex items-center justify-between p-3 rounded ${isUrgent ? 'bg-red-50' : 'bg-yellow-50'}`}>
      <div className="flex items-center gap-2">
        <IconClock className={`w-4 h-4 ${isUrgent ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`} />
        <div>
          <p className={`font-medium text-sm ${isUrgent ? 'text-[var(--danger)]' : 'text-[#b36200]'}`}>
            Bet deadline
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{dayName} {time}</p>
        </div>
      </div>
      <div className={`font-bold ${isUrgent ? 'text-[var(--danger)]' : 'text-[#b36200]'}`}>
        {timeLeft}
      </div>
    </div>
  );
}
