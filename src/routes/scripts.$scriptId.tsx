import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BadgeX,
  Clock,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import {
  getScript,
  revealVersion,
  verifyVersion,
  checkAccessStatus,
  type ScriptVersion,
  type VaultScript,
  type AccessGrant,
} from "@/lib/vault/store";

export const Route = createFileRoute("/scripts/$scriptId")({
  head: () => ({
    meta: [
      { title: "Script record — Script Vault" },
      {
        name: "description",
        content:
          "Signature status, SHA-256 fingerprint, copyright timestamp, version history and originality report.",
      },
      { property: "og:title", content: "Script record — Script Vault" },
      { property: "og:description", content: "Proof of ownership and originality analysis." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: ScriptDetail,
});

function ScriptDetail() {
  const { scriptId } = Route.useParams();
  const { user, ready } = useVaultSession();
  const navigate = useNavigate();
  const [script, setScript] = useState<VaultScript | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  useEffect(() => {
    const s = getScript(scriptId);
    setScript(s);
    setVersionId(s?.versions[s.versions.length - 1]?.id ?? null);
  }, [scriptId]);

  if (!script || !user) return null;

  const isOwner = user.id === script.ownerId;
  const activeGrant = script.accessGrants?.find((g) => {
    if (g.email.toLowerCase() !== user.email.toLowerCase()) return false;
    const now = new Date();
    const start = new Date(g.startTime);
    const end = new Date(g.expiryTime);
    return now >= start && now <= end;
  });
  
  const hasProfileAccess = checkAccessStatus(script.ownerId) === "approved";

  if (!isOwner && !activeGrant && !hasProfileAccess) {
    return (
      <div className="min-h-screen grain">
        <VaultHeader />
        <main className="mx-auto max-w-5xl px-5 py-12 text-center">
          <h1 className="text-3xl text-destructive mt-10">Access Denied</h1>
          <p className="mt-4 text-muted-foreground">You do not have permission to view this script or your access has expired.</p>
          <Link to="/dashboard" className="mt-8 inline-block"><Button>Back to Vault</Button></Link>
        </main>
      </div>
    );
  }

  const version = script.versions.find((v) => v.id === versionId) ?? script.versions[0];

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to vault
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">{script.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {script.genre} {script.logline && `· ${script.logline}`}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`font-display text-5xl ${version.analysis.originality >= 70 ? "text-success" : "text-destructive"}`}
            >
              {version.analysis.originality}%
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              originality · v{version.version}
            </p>
          </div>
        </div>

        <Tabs defaultValue="proof" className="mt-10">
          <TabsList>
            <TabsTrigger value="proof">Proof</TabsTrigger>
            <TabsTrigger value="report">Similarity report</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="content">Decrypt</TabsTrigger>
          </TabsList>

          <TabsContent value="proof" className="mt-6">
            <ProofPanel script={script} version={version} />
          </TabsContent>
          <TabsContent value="report" className="mt-6">
            <ReportPanel script={script} version={version} />
          </TabsContent>
          <TabsContent value="versions" className="mt-6 space-y-3">
            {script.versions
              .slice()
              .reverse()
              .map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVersionId(v.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                    v.id === version.id
                      ? "border-primary/60 bg-accent/40"
                      : "border-border/70 bg-card"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      Version {v.version} · {v.filename}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()} · TS {v.timestampToken.slice(0, 16)}
                    </p>
                  </div>
                  <Badge variant="outline">{v.analysis.originality}% original</Badge>
                </button>
              ))}
          </TabsContent>
          <TabsContent value="content" className="mt-6">
            <DecryptPanel version={version} sharedContent={activeGrant?.sharedContent} hasProfileAccess={hasProfileAccess} isOwner={isOwner} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ProofPanel({ script, version }: { script: VaultScript; version: ScriptVersion }) {
  const [state, setState] = useState<{ signatureValid: boolean; hashValid: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    setState(await verifyVersion(script, version));
    setChecking(false);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card icon={Fingerprint} title="SHA-256 fingerprint">
        <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
          {version.hash}
        </p>
      </Card>
      <Card icon={Clock} title="Copyright timestamp">
        <p className="font-mono text-xs">{version.timestampToken}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sealed {new Date(version.createdAt).toLocaleString()}
        </p>
      </Card>
      <Card icon={PenTool} title="RSA-PSS 2048 signature" className="sm:col-span-2">
        <p className="max-h-24 overflow-y-auto break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
          {version.signature}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={check} disabled={checking}>
            Verify integrity
          </Button>
          {state && (
            <>
              <StatusPill ok={state.signatureValid} label="Signature" />
              <StatusPill ok={state.hashValid} label="Content hash" />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
        ok ? "border-success/50 text-success" : "border-destructive/50 text-destructive"
      }`}
    >
      {ok ? <BadgeCheck className="size-3.5" /> : <BadgeX className="size-3.5" />}
      {label} {ok ? "valid" : "failed"}
    </span>
  );
}

function ReportPanel({ script, version }: { script: VaultScript; version: ScriptVersion }) {
  const a = version.analysis;

  function downloadReport() {
    const html = `<!doctype html><meta charset="utf-8"><title>${script.title} — Originality Report</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;line-height:1.6;color:#111}
h1{margin-bottom:0}code{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}
table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:left}</style>
<h1>${script.title}</h1><p>Originality report · version ${version.version} · ${new Date(version.createdAt).toLocaleString()}</p>
<h2>Originality score: ${a.originality}%</h2>
<p><strong>SHA-256:</strong> <code>${version.hash}</code></p>
<p><strong>RSA signature:</strong> <code>${version.signature.slice(0, 180)}…</code></p>
<p><strong>Timestamp token:</strong> <code>${version.timestampToken}</code></p>
${a.aiSummary ? `<h3>AI narrative assessment</h3><p>${a.aiSummary}</p>` : ""}
<h3>Matches</h3>${
      a.matches.length
        ? `<table><tr><th>Script</th><th>Overall</th><th>Storyline</th><th>Plot</th><th>Dialogue</th><th>Characters</th><th>Themes</th></tr>${a.matches
            .map(
              (m) =>
                `<tr><td>${m.title}</td><td>${pc(m.breakdown.overall)}</td><td>${pc(m.breakdown.storyline)}</td><td>${pc(m.breakdown.plotProgression)}</td><td>${pc(m.breakdown.dialogue)}</td><td>${pc(m.breakdown.characters)}</td><td>${pc(m.breakdown.themes)}</td></tr>`,
            )
            .join("")}</table>`
        : "<p>No comparable material found in the vault.</p>"
    }
<h3>Recommendations</h3><ul>${a.suggestions.map((s) => `<li>${s}</li>`).join("")}</ul>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${script.title.replace(/\W+/g, "-").toLowerCase()}-originality-report.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded — open and print to PDF");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={a.aiPowered ? "default" : "outline"}>
          {a.aiPowered ? "AI + semantic analysis" : "Semantic analysis (local)"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Analysed {new Date(a.analyzedAt).toLocaleString()}
        </span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={downloadReport}>
          <Download className="size-3.5" /> Export report
        </Button>
      </div>

      {a.aiSummary && (
        <div className="rounded-lg border border-primary/30 bg-accent/30 p-5 text-sm leading-relaxed">
          {a.aiSummary}
        </div>
      )}

      {a.matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No comparable material found in the vault — this draft stands alone.
        </p>
      ) : (
        a.matches.map((m) => (
          <div key={m.scriptId} className="rounded-lg border border-border/70 bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg">{m.title}</p>
              <Badge variant={m.breakdown.overall > 0.45 ? "destructive" : "outline"}>
                {pc(m.breakdown.overall)} overlap · {m.owner}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Storyline", m.breakdown.storyline],
                  ["Plot progression", m.breakdown.plotProgression],
                  ["Dialogue", m.breakdown.dialogue],
                  ["Characters", m.breakdown.characters],
                  ["Themes", m.breakdown.themes],
                ] as const
              ).map(([label, v]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono">{pc(v)}</span>
                  </div>
                  <Progress value={v * 100} className="mt-1.5 h-1.5" />
                </div>
              ))}
            </div>
            {m.sharedCharacters.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Shared characters: {m.sharedCharacters.join(", ")}
              </p>
            )}
            {m.segments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Matching sections
                </p>
                {m.segments.slice(0, 4).map((s, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary">
                      {s.kind} · {pc(s.score)}
                    </p>
                    <p className="mt-1.5 text-xs">{s.source.slice(0, 200)}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      ↔ {s.candidate.slice(0, 200)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <div className="rounded-lg border border-border/70 bg-card p-5">
        <h3 className="text-lg">Recommendations</h3>
        <ul className="mt-3 space-y-2">
          {a.suggestions.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-primary">—</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DecryptPanel({ version, sharedContent, hasProfileAccess, isOwner }: { version: ScriptVersion; sharedContent?: string; hasProfileAccess?: boolean; isOwner?: boolean }) {
  const [text, setText] = useState<string | null>(null);

  async function toggle() {
    if (text) return setText(null);
    if (sharedContent) {
      setText(sharedContent);
      return;
    }
    if (hasProfileAccess && !isOwner) {
      toast.error("Profile access only grants metadata viewing. The owner must grant you direct script access to decrypt the file.");
      return;
    }
    try {
      setText(await revealVersion(version));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card p-5">
      <Button size="sm" variant="outline" onClick={toggle}>
        {text ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {text ? "Re-lock" : "Decrypt with vault key"}
      </Button>
      {text ? (
        <pre className="mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
          {text}
        </pre>
      ) : (
        <p className="mt-5 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
          {version.cipher.data.slice(0, 900)}…
        </p>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border/70 bg-card p-5 ${className}`}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function pc(n: number) {
  return `${Math.round(n * 100)}%`;
}
