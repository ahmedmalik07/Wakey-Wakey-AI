import { Router, type Request, type Response } from "express";
import {
  MotivateRequest,
  InsightRequest,
} from "@workspace/api-zod";

const router = Router();

const MODEL = "gemini-2.5-flash-lite";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function generate(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("Missing Gemini API key");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("Empty response from Gemini");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

router.post("/motivate", async (req: Request, res: Response) => {
  const parseResult = MotivateRequest.safeParse(req.body);
  if (!parseResult.success) {
    req.log.warn({ issues: parseResult.error.issues }, "Invalid motivate request");
    return res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  const { steps, durationSec, label } = parseResult.data;
  try {
    const prompt = `User just walked ${steps} steps in ${durationSec} seconds to dismiss their "${label}" alarm. Write ONE short, punchy, energetic morning sentence (max 18 words). Optional: include a tiny fun fact or a playful nudge. No emojis. No quotes. Just the sentence.`;
    const text = await generate(prompt);
    res.json({ text });
  } catch (error: any) {
    req.log.error({ err: error }, "Failed to generate motivator");
    const status = error.name === "AbortError" ? 504 : 500;
    res.status(status).json({ error: "Failed to generate motivator", code: "GEMINI_ERROR" });
  }
});

router.post("/insight", async (req: Request, res: Response) => {
  const parseResult = InsightRequest.safeParse(req.body);
  if (!parseResult.success) {
    req.log.warn({ issues: parseResult.error.issues }, "Invalid insight request");
    return res.status(400).json({
      error: "Invalid request",
      details: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  const { successCount, totalCount, avgSeconds, bestSeconds } = parseResult.data;
  try {
    const prompt = `Weekly wake-up summary for a step-based alarm app:
- Alarms beaten: ${successCount} of ${totalCount}
- Average time-to-wake: ${avgSeconds.toFixed(0)}s
- Fastest wake: ${bestSeconds.toFixed(0)}s

Write a 2-3 sentence warm, encouraging summary. Mention one specific stat. End with a forward-looking nudge. No emojis. No headings.`;
    const text = await generate(prompt);
    res.json({ text });
  } catch (error: any) {
    req.log.error({ err: error }, "Failed to generate insight");
    const status = error.name === "AbortError" ? 504 : 500;
    res.status(status).json({ error: "Failed to generate insight", code: "GEMINI_ERROR" });
  }
});

export default router;
