import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isUnlocked, logout, subscribe, unlock } from "@/lib/vault/store";
import { useVaultSession } from "@/hooks/use-vault-session";

/** Shown when a session exists but the in-memory AES key was lost (page reload). */
export function UnlockGate() {
  const { user } = useVaultSession();
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setLocked(Boolean(user) && !isUnlocked());
    sync();
    return subscribe(sync);
  }, [user]);

  if (!user || !locked) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const pass = String(new FormData(e.currentTarget).get("pass"));
          setBusy(true);
          try {
            await unlock(pass);
            toast.success("Vault unlocked");
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="vault-surface w-full max-w-sm rounded-xl border border-border/70 p-7"
      >
        <h2 className="flex items-center gap-2 text-xl">
          <KeyRound className="size-4 text-primary" /> Vault locked
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Your decryption key lives only in memory. Re-enter your passphrase to open the vault.
        </p>
        <div className="mt-5 space-y-2">
          <Label htmlFor="pass" className="text-xs uppercase tracking-wider text-muted-foreground">
            Passphrase
          </Label>
          <Input id="pass" name="pass" type="password" autoFocus required />
        </div>
        <Button type="submit" className="mt-5 w-full" disabled={busy}>
          Unlock
        </Button>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Sign out instead
        </button>
      </form>
    </div>
  );
}
