import { customFetch } from "@workspace/api-client-react";

export async function getMorningMotivator(
  steps: number,
  durationSec: number,
  label: string,
): Promise<string> {
  const res = await customFetch<{ text: string }>("/api/gemini/motivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps, durationSec, label }),
  });
  return res.text;
}

// Instant offline messages shown the moment the alarm is beaten,
// so the user never sees a loading spinner while Gemini is fetching.
export const INSTANT_MORNING_MESSAGES: readonly string[] = [
  "Morning, mover. You earned this start.",
  "Eyes open, momentum on. Today is yours.",
  "Look at you, already winning before breakfast.",
  "First win of the day: unlocked.",
  "You out-stepped the snooze button. Beautiful work.",
  "Sun's up, you're up, the day doesn't stand a chance.",
  "Yesterday's plans, meet today's energy.",
  "That snooze never had a chance.",
  "Welcome to the part of the day where good things start.",
  "You moved, the day moved with you. Let's go.",
  "Crisp start. Now make it count.",
  "Step one done. Everything else is downhill.",
  "Awake, alive, ahead. Nice combo.",
  "The world rewards early movers. You qualify.",
  "Look at you, beating gravity at sunrise.",
  "Body's awake, mind's next. Be patient and powerful.",
  "Soft start, strong day. That's the deal.",
  "You showed up for yourself today. That matters.",
  "Slow sip, deep breath, let's begin.",
  "Today gets the good version of you. Lucky day.",
];

export function pickInstantMorningMessage(): string {
  const i = Math.floor(Math.random() * INSTANT_MORNING_MESSAGES.length);
  return INSTANT_MORNING_MESSAGES[i] ?? "Good morning. Let's make it count.";
}

export async function getWeeklyInsight(
  successCount: number,
  totalCount: number,
  avgSeconds: number,
  bestSeconds: number,
): Promise<string> {
  const res = await customFetch<{ text: string }>("/api/gemini/insight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ successCount, totalCount, avgSeconds, bestSeconds }),
  });
  return res.text;
}
