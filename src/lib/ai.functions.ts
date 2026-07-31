import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(12000),
  themes: z.array(z.string()).max(10),
  characters: z.array(z.string()).max(20),
  matches: z
    .array(
      z.object({
        title: z.string(),
        overall: z.number(),
        storyline: z.number(),
        dialogue: z.number(),
        plot: z.number(),
      }),
    )
    .max(5),
});

export type AiNarrativeReport = {
  summary: string;
  suggestions: string[];
  aiPowered: boolean;
};

/** Narrative-level review of a script and its detected overlaps, via Lovable AI. */
export const reviewNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<AiNarrativeReport> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { summary: "", suggestions: [], aiPowered: false };

    const prompt = `Script title: ${data.title}
Detected themes: ${data.themes.join(", ") || "none"}
Characters: ${data.characters.join(", ") || "none"}
Similarity matches from the vault:
${data.matches.map((m) => `- "${m.title}": overall ${(m.overall * 100).toFixed(0)}%, storyline ${(m.storyline * 100).toFixed(0)}%, dialogue ${(m.dialogue * 100).toFixed(0)}%, plot ${(m.plot * 100).toFixed(0)}%`).join("\n") || "- none"}

Script excerpt:
"""
${data.excerpt}
"""

Assess storyline, plot progression, characters, dialogue and themes. Return JSON with:
"summary" (2-3 sentences on narrative structure and originality risk) and
"suggestions" (3-5 specific, actionable rewrites to increase originality).`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a script development executive and plagiarism analyst. Reply with strict JSON only.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        return {
          summary:
            res.status === 429
              ? "AI review is rate limited right now — showing the local semantic analysis only."
              : res.status === 402
                ? "AI credits are exhausted — showing the local semantic analysis only."
                : "",
          suggestions: [],
          aiPowered: false,
        };
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as { summary?: string; suggestions?: string[] };
      return {
        summary: parsed.summary ?? "",
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
        aiPowered: true,
      };
    } catch {
      return { summary: "", suggestions: [], aiPowered: false };
    }
  });
