import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { FileLock2, Fingerprint, PenTool, ScanSearch, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/vault-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import { sendVerificationEmail } from "@/lib/email.functions";
import { login, register, resendOtp, verifyEmail, resetPassword } from "@/lib/vault/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Script Vault — Encrypted Screenplay Registry & Originality Check" },
      {
        name: "description",
        content:
          "Encrypt, digitally sign and timestamp your screenplays, then run AI semantic originality analysis against the vault.",
      },
      { property: "og:title", content: "Script Vault — Protect and Prove Your Screenplays" },
      {
        property: "og:description",
        content:
          "AES-256 encryption, RSA digital signatures, SHA-256 fingerprints and AI plot similarity detection for writers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: FileLock2,
    title: "AES-256 vault",
    body: "Every draft is encrypted under a key derived from your passphrase alone.",
  },
  {
    icon: Fingerprint,
    title: "SHA-256 fingerprint",
    body: "A cryptographic digest binds the exact words of the draft you filed.",
  },
  {
    icon: PenTool,
    title: "RSA signature",
    body: "Each version is signed with your private 2048-bit key to prove authorship.",
  },
  {
    icon: ScanSearch,
    title: "Semantic analysis",
    body: "Storyline, beats, characters, dialogue and themes compared, not just words.",
  },
  {
    icon: Clock,
    title: "Proof of creation",
    body: "Immutable timestamp tokens and full version history for every deposit.",
  },
  {
    icon: ShieldCheck,
    title: "Verified access",
    body: "Email verification and signed session tokens gate the whole vault.",
  },
];

function Landing() {
  const { user } = useVaultSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main>
        <section className="relative overflow-hidden">
          <img
            src={heroImage}
            alt="Brass vault door opening with screenplay pages and hash characters drifting out"
            width={1600}
            height={1008}
            className="absolute inset-0 size-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div className="max-w-xl">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
                Smart Technology Script Vault
              </p>
              <h1 className="mt-5 text-5xl leading-[1.05] lg:text-6xl">
                Your screenplay, <span className="gold-text">sealed, signed</span> and proven yours.
              </h1>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                Deposit a draft and the vault encrypts it, fingerprints it, signs it with your
                private key and timestamps the moment of creation — then reads the story itself to
                tell you how original it really is.
              </p>
              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
                {PILLARS.map((p) => (
                  <div key={p.title}>
                    <p.icon className="size-4 text-primary" />
                    <dt className="mt-2.5 text-sm font-medium">{p.title}</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <AuthPanel />
          </div>
        </section>
      </main>
      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Cryptography runs in your browser · WebCrypto AES-256-GCM · RSA-PSS 2048 · SHA-256
      </footer>
    </div>
  );
}

function AuthPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const sendEmail = useServerFn(sendVerificationEmail);

  async function deliverCode(email: string, code: string, name?: string) {
    setDelivered(null);
    try {
      const res = await sendEmail({ data: { email, code, name } });
      if (res.sent) {
        setDelivered(true);
        toast.success(`Verification code emailed to ${email}`);
        return;
      }
      setDelivered(false);
      toast.error(
        res.reason === "not_configured"
          ? "Email service not configured — using the on-screen code"
          : "Email delivery failed — use the on-screen code",
      );
    } catch {
      setDelivered(false);
      toast.error("Email delivery failed — use the on-screen code");
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const name = String(f.get("name"));
      const u = await register(name, String(f.get("email")), String(f.get("password")));
      setPendingEmail(u.email);
      setPendingCode(u.otp);
      setTab("verify");
      if (u.otp) await deliverCode(u.email, u.otp, name);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await login(String(f.get("email")), String(f.get("password")));
      toast.success("Vault unlocked");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "unverified") {
        setPendingEmail(String(f.get("email")));
        setTab("verify");
        toast.error("Verify your email first");
      } else toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      verifyEmail(pendingEmail, String(f.get("code")));
      toast.success("Email verified — sign in to unlock your vault");
      setPendingCode(null);
      setDelivered(null);
      setTab("signin");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleResetRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const email = String(f.get("email"));
      const code = resendOtp(email);
      setPendingEmail(email);
      setPendingCode(code);
      setTab("reset-confirm");
      await deliverCode(email, code);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await resetPassword(pendingEmail, String(f.get("code")), String(f.get("password")));
      toast.success("Password reset successfully. Sign in with your new password.");
      setTab("signin");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vault-surface h-fit rounded-xl border border-border/70 p-7">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="verify">Verify</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email" name="email" type="email" placeholder="you@studio.com" />
            <Field label="Passphrase" name="password" type="password" placeholder="••••••••" />
            <Button type="submit" className="w-full" disabled={busy}>
              Unlock vault
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Your passphrase derives the decryption key — it is never stored.
            </p>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setTab("reset-request")}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Forgot passphrase?
              </button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Full name" name="name" placeholder="Ava Mendes" />
            <Field label="Email" name="email" type="email" placeholder="you@studio.com" />
            <Field
              label="Passphrase"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              minLength={8}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              Create account
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              An RSA-2048 signing keypair is generated on your device at signup.
            </p>
          </form>
        </TabsContent>

        <TabsContent value="verify" className="mt-6">
          <div className="mb-5 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {delivered ? "Code sent to your inbox" : "Your verification code"}
            </p>
            {delivered ? (
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Check <span className="font-mono text-primary">{pendingEmail}</span> for a 6-digit
                code from Script Vault. Look in spam if it is not there within a minute.
              </p>
            ) : (
              <>
                <p className="mt-2 font-mono text-2xl tracking-[0.4em] text-primary">
                  {pendingCode ?? "— — — — — —"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {delivered === false
                    ? "Email delivery failed, so the code is shown here as a fallback."
                    : "Register or tap “Resend code” to get a fresh code by email."}
                </p>
              </>
            )}
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <Field
              label="Email"
              name="vemail"
              type="email"
              value={pendingEmail}
              onChange={(e) => setPendingEmail(e.target.value)}
            />
            <Field
              label="6-digit code"
              name="code"
              placeholder="000000"
              inputMode="numeric"
              defaultValue={delivered ? "" : (pendingCode ?? "")}
              key={`${pendingCode ?? "empty"}-${String(delivered)}`}
            />
            <Button type="submit" className="w-full">
              Verify email
            </Button>
            <button
              type="button"
              disabled={busy}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={async () => {
                setBusy(true);
                try {
                  const code = resendOtp(pendingEmail);
                  setPendingCode(code);
                  await deliverCode(pendingEmail, code);
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend code
            </button>
          </form>
        </TabsContent>

        <TabsContent value="reset-request" className="mt-6">
          <div className="mb-5 rounded-lg border border-warning/40 bg-warning/5 p-4 text-warning">
            <p className="text-xs font-semibold uppercase tracking-wider">Warning: Data Loss</p>
            <p className="mt-2 text-xs leading-relaxed">
              Script Vault uses zero-knowledge encryption. Resetting your passphrase will generate a new encryption key, which means <strong>you will permanently lose access to all previously encrypted scripts</strong>.
            </p>
          </div>
          <form onSubmit={handleResetRequest} className="space-y-4">
            <Field label="Account Email" name="email" type="email" placeholder="you@studio.com" />
            <Button type="submit" variant="destructive" className="w-full" disabled={busy}>
              Send Reset Code
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:underline"
              onClick={() => setTab("signin")}
            >
              Cancel
            </button>
          </form>
        </TabsContent>

        <TabsContent value="reset-confirm" className="mt-6">
          <div className="mb-5 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {delivered ? "Reset code sent" : "Your reset code"}
            </p>
            {delivered ? (
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Check <span className="font-mono text-primary">{pendingEmail}</span> for a 6-digit code.
              </p>
            ) : (
              <p className="mt-2 font-mono text-2xl tracking-[0.4em] text-primary">
                {pendingCode ?? "— — — — — —"}
              </p>
            )}
          </div>
          <form onSubmit={handleResetConfirm} className="space-y-4">
            <Field
              label="6-digit code"
              name="code"
              placeholder="000000"
              inputMode="numeric"
              defaultValue={delivered ? "" : (pendingCode ?? "")}
            />
            <Field
              label="New Passphrase"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              minLength={8}
            />
            <Button type="submit" variant="destructive" className="w-full" disabled={busy}>
              Confirm Password Reset
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:underline"
              onClick={() => setTab("signin")}
            >
              Cancel
            </button>
          </form>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function Field({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} required {...rest} />
    </div>
  );
}
