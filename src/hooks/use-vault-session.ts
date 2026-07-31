import { useEffect, useState } from "react";
import { currentUser, subscribe, type VaultUser } from "@/lib/vault/store";

export function useVaultSession() {
  const [user, setUser] = useState<VaultUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setUser(currentUser());
    sync();
    setReady(true);
    return subscribe(sync);
  }, []);

  return { user, ready };
}
