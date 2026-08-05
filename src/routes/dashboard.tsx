import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, ShieldCheck, Sparkles, Upload, Users, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import { readScriptFile } from "@/lib/vault/file";
import {
  addScriptVersion,
  analyzeAgainstVault,
  isUnlocked,
  listMyScripts,
  subscribe,
  updatePrivacySettings,
  updateProfileInfo,
  type VaultUser,
  type AnalysisResult,
} from "@/lib/vault/store";
import { reviewNarrative } from "@/lib/ai.functions";
import { fingerprintShort } from "@/lib/vault/crypto";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Vault — Script Vault" },
      {
        name: "description",
        content: "Deposit scripts, view originality reports, signatures, timestamps and versions.",
      },
      { property: "og:title", content: "My Vault — Script Vault" },
      { property: "og:description", content: "Encrypted script deposits and originality reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: Dashboard,
});

const GENRES = [
  "Drama",
  "Thriller",
  "Comedy",
  "Sci-Fi",
  "Horror",
  "Documentary",
  "Romance",
  "Action",
];

function Dashboard() {
  const { user, ready } = useVaultSession();
  const navigate = useNavigate();
  const [, force] = useState(0);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  useEffect(() => {
    if (ready && !user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  const scripts = useMemo(() => (user ? listMyScripts() : []), [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Welcome back, {user.name.split(" ")[0]}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {scripts.length} script{scripts.length === 1 ? "" : "s"} sealed ·{" "}
              {scripts.reduce((a, s) => a + s.versions.length, 0)} signed versions
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[11px]">
            {isUnlocked() ? "Vault key loaded" : "Locked — sign in again"}
          </Badge>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <DepositForm />
          <section>
            <h2 className="text-xl">Your vault</h2>
            <div className="mt-4 space-y-3">
              {scripts.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No deposits yet. Seal your first draft to get a fingerprint and signature.
                </p>
              )}
              {scripts.map((s) => {
                const latest = s.versions[s.versions.length - 1];
                return (
                  <Link
                    key={s.id}
                    to="/scripts/$scriptId"
                    params={{ scriptId: s.id }}
                    className="block rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-lg">{s.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.genre} · v{latest.version} ·{" "}
                          {new Date(latest.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-display text-2xl ${latest.analysis.originality >= 70 ? "text-success" : "text-destructive"}`}
                        >
                          {latest.analysis.originality}%
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          original
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">
                      <ShieldCheck className="mr-1 inline size-3 text-primary" />
                      {fingerprintShort(latest.hash)} · TS {latest.timestampToken.slice(0, 12)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
        
        <ProfileSettingsPanel user={user} />
        <PrivacySettingsPanel user={user} />
      </main>
    </div>
  );
}

function ProfileSettingsPanel({ user }: { user: VaultUser }) {
  const [profession, setProfession] = useState(user.profileInfo?.profession ?? "");
  const [location, setLocation] = useState(user.profileInfo?.location ?? "");
  const [bio, setBio] = useState(user.profileInfo?.bio ?? "");
  
  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    updateProfileInfo({ profession, location, bio });
    toast.success("Profile information updated");
  }

  return (
    <section className="mt-12 rounded-xl border border-border/70 bg-card p-7">
      <h2 className="flex items-center gap-2 text-xl mb-6">
        <Users className="size-4 text-primary" /> Public Profile Settings
      </h2>
      <form onSubmit={saveProfile} className="space-y-4 max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profession">Profession / Title</Label>
            <Input id="profession" value={profession} onChange={e => setProfession(e.target.value)} placeholder="e.g. Writer / Director" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Los Angeles, CA" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." rows={4} />
        </div>
        <Button type="submit">Save Profile</Button>
      </form>
    </section>
  );
}

function PrivacySettingsPanel({ user }: { user: VaultUser }) {
  const [anon, setAnon] = useState(user.privacySettings?.anonymousMode ?? false);
  const [noNotif, setNoNotif] = useState(user.privacySettings?.disableNotifications ?? false);
  const [showScripts, setShowScripts] = useState(user.privacySettings?.showScriptsOnProfile ?? false);

  function saveSettings(a: boolean, n: boolean, s: boolean) {
    updatePrivacySettings({ anonymousMode: a, disableNotifications: n, showScriptsOnProfile: s });
    toast.success("Privacy settings updated");
  }

  return (
    <section className="mt-12 rounded-xl border border-border/70 bg-card p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl">
            <EyeOff className="size-4 text-primary" /> Privacy & Notifications
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage how you view others and what notifications you receive.
          </p>
        </div>
        <Link 
          to="/profile/views" 
          className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
        >
          <Users className="size-4" /> Who's Viewed My Profile
        </Link>
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Anonymous Mode</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, your profile visits will appear as "Anonymous Visitor" to other users.
            </p>
          </div>
          <Switch 
            checked={anon} 
            onCheckedChange={(c) => { setAnon(c); saveSettings(c, noNotif, showScripts); }} 
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Disable Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Turn off email notifications when someone views your profile.
            </p>
          </div>
          <Switch 
            checked={noNotif} 
            onCheckedChange={(c) => { setNoNotif(c); saveSettings(anon, c, showScripts); }} 
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Show Scripts on Profile</Label>
            <p className="text-sm text-muted-foreground">
              Display the titles and genres of your deposited scripts on your public profile.
            </p>
          </div>
          <Switch 
            checked={showScripts} 
            onCheckedChange={(c) => { setShowScripts(c); saveSettings(anon, noNotif, c); }} 
          />
        </div>
      </div>
    </section>
  );
}

function DepositForm() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("pasted-draft.txt");
  const [genre, setGenre] = useState("Drama");
  const scripts = listMyScripts();
  const [scriptId, setScriptId] = useState("new");

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readScriptFile(file);
      setContent(text);
      setFilename(file.name);
      toast.success(`${file.name} loaded (${text.split(/\s+/).length} words)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (!title) return toast.error("Give the script a title.");
    if (content.trim().split(/\s+/).length < 40)
      return toast.error("Add at least ~40 words of script text.");

    setBusy(true);
    try {
      setStage("Encrypting and fingerprinting");
      setProgress(20);
      const existing = scriptId !== "new" ? scripts.find((s) => s.id === scriptId) : undefined;

      setStage("Running semantic similarity across the vault");
      setProgress(45);
      const local = analyzeAgainstVault(content, {
        excludeScriptId: existing?.id,
        ownerId: "self",
      });

      setStage("AI narrative review");
      setProgress(70);
      let ai = { summary: "", suggestions: [] as string[], aiPowered: false };
      try {
        ai = await reviewNarrative({
          data: {
            title,
            excerpt: content.slice(0, 11000),
            themes: local.profile.themes,
            characters: local.profile.characters,
            matches: local.matches.slice(0, 5).map((m) => ({
              title: m.title,
              overall: m.breakdown.overall,
              storyline: m.breakdown.storyline,
              dialogue: m.breakdown.dialogue,
              plot: m.breakdown.plotProgression,
            })),
          },
        });
      } catch {
        ai = { summary: "", suggestions: [], aiPowered: false };
      }

      const analysis: AnalysisResult = {
        originality: local.originality,
        matches: local.matches,
        suggestions: [...ai.suggestions, ...local.suggestions].slice(0, 6),
        aiSummary: ai.summary || undefined,
        aiPowered: ai.aiPowered,
        analyzedAt: new Date().toISOString(),
      };

      setStage("Signing with your RSA key");
      setProgress(88);
      const { script } = await addScriptVersion({
        scriptId: existing?.id,
        title: existing?.title ?? title,
        genre,
        logline: String(f.get("logline") ?? ""),
        filename,
        content,
        analysis,
        index: local.profile,
      });

      setProgress(100);
      toast.success("Script sealed and signed");
      navigate({ to: "/scripts/$scriptId", params: { scriptId: script.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      setStage("");
      setProgress(0);
    }
  }

  return (
    <section className="vault-surface h-fit rounded-xl border border-border/70 p-7">
      <h2 className="flex items-center gap-2 text-xl">
        <Upload className="size-4 text-primary" /> Deposit a draft
      </h2>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Deposit as
          </Label>
          <Select value={scriptId} onValueChange={setScriptId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New script</SelectItem>
              {scripts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  New version of “{s.title}”
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scriptId === "new" && (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="title"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Title
              </Label>
              <Input id="title" name="title" placeholder="The Long Silence" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Genre
                </Label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="logline"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Logline
                </Label>
                <Input id="logline" name="logline" placeholder="One line, no spoilers" />
              </div>
            </div>
          </>
        )}
        {scriptId !== "new" && <input type="hidden" name="title" value="version" />}

        <div className="space-y-2">
          <Label htmlFor="file" className="text-xs uppercase tracking-wider text-muted-foreground">
            Script file (TXT, MD, Fountain, PDF, DOCX)
          </Label>
          <Input
            id="file"
            type="file"
            accept=".txt,.md,.fountain,.fdx,.rtf,.pdf,.docx,.doc"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="content"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            …or paste the script
          </Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={9}
            className="font-mono text-xs"
            placeholder={"INT. VAULT - NIGHT\n\nMAYA\nEverything I've written is in there."}
          />
          <p className="text-[11px] text-muted-foreground">
            <FileText className="mr-1 inline size-3" />
            {content.trim() ? content.trim().split(/\s+/).length : 0} words · encrypted before
            storage
          </p>
        </div>

        {busy && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> {stage}…
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          <Sparkles className="size-4" /> Seal, sign & analyse
        </Button>
      </form>
    </section>
  );
}
