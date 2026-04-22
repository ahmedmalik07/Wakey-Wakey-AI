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
