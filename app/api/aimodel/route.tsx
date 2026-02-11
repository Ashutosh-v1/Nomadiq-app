import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPEN_ROUTER_API_KEY,
});

const PROMPT = `
You are an AI Trip Planner Agent. Your goal is to help the user plan a trip by asking ONE relevant trip-related question at a time.

Collect information in this order:
1. Starting location
2. Destination
3. Group Size (Solo, Couple, Family, Friends)
4. Budget (Low, Medium, High)
5. Trip Duration (Days)
6. Travel Interests
7. Special Preferences

Rules:
- Ask ONLY one question at a time
- Stay conversational
- If something is unclear → ask clarification

IMPORTANT:
Return ONLY strict JSON (no markdown, no explanation)

Schema:
{
  "resp": "Text response",
  "ui": "budget/groupSize/TripDuration/Final"
}
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body?.messages || [];

    if (!process.env.OPEN_ROUTER_API_KEY) {
      throw new Error("Missing OPEN_ROUTER_API_KEY");
    }

    const completion = await openai.chat.completions.create({
      model: "google/gemma-3n-e2b-it:free",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: PROMPT,
        },
        ...messages,
      ],
    });

    const raw =
      completion?.choices?.[0]?.message?.content || "";

    console.log("RAW MODEL OUTPUT:", raw);

    if (!raw) {
      return NextResponse.json({
        resp: "Sorry, I couldn't generate a response.",
        ui: "Final",
      });
    }

    // Clean markdown JSON if model adds ```
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If model breaks JSON → fallback safely
      parsed = {
        resp: cleaned,
        ui: "Final",
      };
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
  console.error("🔥 FULL ERROR OBJECT:");
  console.error(error);

  console.error("🔥 RESPONSE:");
  console.error(error?.response?.data);

  return NextResponse.json(
    {
      resp: "Server error",
      ui: "Final",
      error: error?.message,
      providerError: error?.response?.data
    },
    { status: 500 }
  );
}

}
