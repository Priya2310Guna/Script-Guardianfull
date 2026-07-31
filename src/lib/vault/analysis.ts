/**
 * Local semantic analysis engine: narrative fingerprinting, similarity scoring
 * across storyline, characters, dialogue and themes. Used on its own and as the
 * deterministic base that the AI layer enriches.
 */

const STOP = new Set(
  `the a an and or but if then than that this these those of to in on at for with by from as is are was were be been being it its he she they them his her their you your i we our not no so into out up down over under again once here there when where why how all any both each few more most other some such only own same too very can will just don should now int ext cut scene fade continued`.split(
    /\s+/,
  ),
);

export type NarrativeProfile = {
  tokens: string[];
  shingles: Set<string>;
  characters: string[];
  dialogue: string[];
  themes: string[];
  beats: string[];
  wordCount: number;
};

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function shingles(tokens: string[], n = 3) {
  const s = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}

/** Screenplay character cues: ALL-CAPS lines, "NAME:" prefixes. */
function extractCharacters(text: string) {
  const counts = new Map<string, number>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m =
      line.match(/^([A-Z][A-Z .'-]{2,30})(?:\s*\(.*\))?:/) ||
      (line.length <= 32 && /^[A-Z][A-Z .'-]{2,}$/.test(line) ? [line, line] : null);
    if (m) {
      const name = m[1].trim().replace(/\s+/g, " ");
      if (/^(INT|EXT|FADE|CUT|THE END|TITLE)/.test(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([n]) => n);
}

function extractDialogue(text: string) {
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const colon = line.match(/^[A-Z][A-Z .'-]{2,30}(?:\s*\(.*\))?:\s*(.+)$/);
    if (colon) out.push(colon[1]);
    else if (/^[A-Z][A-Z .'-]{2,30}$/.test(line) && lines[i + 1]?.trim())
      out.push(lines[i + 1].trim());
    else if (/^["“].+["”]$/.test(line)) out.push(line.replace(/^["“]|["”]$/g, ""));
  }
  return out.filter((d) => d.length > 12).slice(0, 400);
}

const THEME_LEXICON: Record<string, string[]> = {
  revenge: ["revenge", "vengeance", "avenge", "payback"],
  betrayal: ["betray", "traitor", "deceive", "lied"],
  love: ["love", "heart", "romance", "kiss", "beloved"],
  loss: ["death", "died", "grief", "funeral", "mourning"],
  power: ["power", "throne", "control", "empire", "rule"],
  survival: ["survive", "escape", "hunt", "trapped", "alive"],
  justice: ["justice", "court", "trial", "law", "guilty"],
  technology: ["machine", "code", "system", "network", "robot", "algorithm"],
  family: ["father", "mother", "brother", "sister", "family", "son", "daughter"],
  identity: ["identity", "memory", "mirror", "truth", "who"],
  redemption: ["forgive", "redeem", "atone", "second chance"],
  ambition: ["ambition", "dream", "career", "win", "fame"],
};

function extractThemes(tokens: string[]) {
  const set = new Set(tokens);
  return Object.entries(THEME_LEXICON)
    .map(([theme, keys]) => [theme, keys.filter((k) => set.has(k.split(" ")[0])).length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 6);
}

/** Split into ordered plot beats so progression can be compared, not just words. */
function extractBeats(text: string, n = 8) {
  const clean = text.replace(/\s+/g, " ").trim();
  const size = Math.max(1, Math.floor(clean.length / n));
  const beats: string[] = [];
  for (let i = 0; i < n && i * size < clean.length; i++)
    beats.push(clean.slice(i * size, (i + 1) * size));
  return beats;
}

export function buildProfile(text: string): NarrativeProfile {
  const tokens = words(text);
  return {
    tokens,
    shingles: shingles(tokens),
    characters: extractCharacters(text),
    dialogue: extractDialogue(text),
    themes: extractThemes(tokens),
    beats: extractBeats(text),
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  };
}

function jaccard<T>(a: Set<T>, b: Set<T>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function cosineBag(a: string[], b: string[]) {
  const fa = new Map<string, number>();
  const fb = new Map<string, number>();
  a.forEach((t) => fa.set(t, (fa.get(t) ?? 0) + 1));
  b.forEach((t) => fb.set(t, (fb.get(t) ?? 0) + 1));
  let dot = 0;
  for (const [k, v] of fa) dot += v * (fb.get(k) ?? 0);
  const na = Math.sqrt([...fa.values()].reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt([...fb.values()].reduce((s, v) => s + v * v, 0));
  return na && nb ? dot / (na * nb) : 0;
}

function nameSimilarity(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const bs = new Set(b.map((x) => x.toLowerCase()));
  let hits = 0;
  for (const n of a) if (bs.has(n.toLowerCase())) hits++;
  return hits / Math.max(a.length, b.length);
}

export type MatchedSegment = { source: string; candidate: string; score: number; kind: string };

export type SimilarityBreakdown = {
  storyline: number;
  dialogue: number;
  characters: number;
  themes: number;
  plotProgression: number;
  overall: number;
};

export type SimilarityMatch = {
  scriptId: string;
  title: string;
  owner: string;
  breakdown: SimilarityBreakdown;
  segments: MatchedSegment[];
  sharedCharacters: string[];
  sharedThemes: string[];
};

export function compareProfiles(
  a: NarrativeProfile,
  b: NarrativeProfile,
): { breakdown: SimilarityBreakdown; segments: MatchedSegment[] } {
  const storyline = jaccard(a.shingles, b.shingles) * 0.6 + cosineBag(a.tokens, b.tokens) * 0.4;

  const segments: MatchedSegment[] = [];
  let dialogueScore = 0;
  const bDialogueTokens = b.dialogue.map((d) => words(d));
  a.dialogue.forEach((line, i) => {
    const at = words(line);
    let best = 0;
    let bestIdx = -1;
    bDialogueTokens.forEach((bt, j) => {
      const s = cosineBag(at, bt);
      if (s > best) {
        best = s;
        bestIdx = j;
      }
    });
    if (best > dialogueScore) dialogueScore = best;
    if (best >= 0.62 && bestIdx >= 0 && segments.length < 12)
      segments.push({
        source: line,
        candidate: b.dialogue[bestIdx],
        score: best,
        kind: "Dialogue",
      });
    void i;
  });

  const plotPairs = Math.min(a.beats.length, b.beats.length);
  let plot = 0;
  for (let i = 0; i < plotPairs; i++) {
    const s = cosineBag(words(a.beats[i]), words(b.beats[i]));
    plot += s;
    if (s >= 0.5 && segments.length < 20)
      segments.push({
        source: a.beats[i].slice(0, 220),
        candidate: b.beats[i].slice(0, 220),
        score: s,
        kind: `Plot beat ${i + 1}`,
      });
  }
  plot = plotPairs ? plot / plotPairs : 0;

  const characters = nameSimilarity(a.characters, b.characters);
  const themes = jaccard(new Set(a.themes), new Set(b.themes));

  const overall =
    storyline * 0.38 + plot * 0.22 + dialogueScore * 0.2 + characters * 0.1 + themes * 0.1;

  return {
    breakdown: {
      storyline: round(storyline),
      dialogue: round(dialogueScore),
      characters: round(characters),
      themes: round(themes),
      plotProgression: round(plot),
      overall: round(overall),
    },
    segments: segments.sort((x, y) => y.score - x.score).slice(0, 12),
  };
}

function round(n: number) {
  return Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
}

export function localSuggestions(matches: SimilarityMatch[], profile: NarrativeProfile) {
  const s: string[] = [];
  const top = matches[0];
  if (!top || top.breakdown.overall < 0.15) {
    s.push("No meaningful overlap found in the vault — the narrative reads as original.");
    s.push("Deepen at least one secondary character arc to widen your distinctiveness margin.");
    return s;
  }
  if (top.breakdown.dialogue > 0.5)
    s.push(
      `Rewrite the flagged exchanges against "${top.title}" — keep intent, change voice and rhythm.`,
    );
  if (top.breakdown.plotProgression > 0.45)
    s.push(
      "Reorder or invert two mid-act beats so the progression stops mirroring the matched script.",
    );
  if (top.breakdown.characters > 0.3)
    s.push(
      `Rename overlapping characters (${top.sharedCharacters.slice(0, 3).join(", ")}) and shift their motivations.`,
    );
  if (top.breakdown.themes > 0.5)
    s.push(
      `Themes ${profile.themes.slice(0, 2).join(" / ")} are heavily shared — add a counter-theme unique to your world.`,
    );
  if (s.length === 0)
    s.push("Overlap is mild; tighten distinctive imagery in the opening ten pages.");
  return s;
}

export function originalityScore(matches: SimilarityMatch[]) {
  const worst = matches.reduce((m, x) => Math.max(m, x.breakdown.overall), 0);
  return Math.round((1 - worst) * 100);
}
