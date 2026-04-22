import type { Alarm, Weekday } from "./types";
import { DAY_FULL } from "./types";

export function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function formatPeriod(hour: number): string {
  return hour < 12 ? "AM" : "PM";
}

export function formatDays(days: Weekday[]): string {
  if (days.length === 0) return "Once";
  if (days.length === 7) return "Every day";
  const sorted = [...days].sort();
  const weekdays: Weekday[] = [1, 2, 3, 4, 5];
  const weekend: Weekday[] = [0, 6];
  if (
    sorted.length === 5 &&
    sorted.every((d) => weekdays.includes(d))
  )
    return "Weekdays";
  if (
    sorted.length === 2 &&
    sorted.every((d) => weekend.includes(d))
  )
    return "Weekends";
  return sorted.map((d) => DAY_FULL[d].slice(0, 3)).join(" · ");
}

export function nextOccurrence(alarm: Alarm, from: Date = new Date()): Date {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setHours(alarm.hour, alarm.minute, 0, 0);
  if (alarm.days.length === 0) {
    if (next.getTime() <= from.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(next);
    candidate.setDate(next.getDate() + i);
    if (
      alarm.days.includes(candidate.getDay() as Weekday) &&
      candidate.getTime() > from.getTime()
    ) {
      return candidate;
    }
  }
  return next;
}

export function formatCountdown(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const days = Math.floor(hours / 24);
  const mins = totalMin % 60;
  if (days > 0) return `in ${days}d ${hours % 24}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  if (totalMin > 0) return `in ${totalMin}m`;
  const secs = Math.floor(ms / 1000);
  return `in ${secs}s`;
}
