const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-lite";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function generate(prompt: string): Promise<string> {
  if (!API_KEY) throw new Error("Missing Gemini key");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Empty response");
  return text;
}

export async function getMorningMotivator(
  steps: number,
  durationSec: number,
  label: string,
): Promise<string> {
  const prompt = `User just walked ${steps} steps in ${durationSec} seconds to dismiss their "${label}" alarm. Write ONE short, punchy, energetic morning sentence (max 18 words). Optional: include a tiny fun fact or a playful nudge. No emojis. No quotes. Just the sentence.`;
  return generate(prompt);
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
  const prompt = `Weekly wake-up summary for a step-based alarm app:
- Alarms beaten: ${successCount} of ${totalCount}
- Average time-to-wake: ${avgSeconds.toFixed(0)}s
- Fastest wake: ${bestSeconds.toFixed(0)}s

Write a 2-3 sentence warm, encouraging summary. Mention one specific stat. End with a forward-looking nudge. No emojis. No headings.`;
  return generate(prompt);
}
