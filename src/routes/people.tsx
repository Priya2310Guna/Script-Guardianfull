import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Search, MapPin, Briefcase } from "lucide-react";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import { getDb, type VaultUser } from "@/lib/vault/store";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/people")({
  component: PeoplePage,
});

function PeoplePage() {
  const { user, ready } = useVaultSession();
  const navigate = useNavigate();
  const [users, setUsers] = useState<VaultUser[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (ready && !user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (user) {
      const db = getDb();
      setUsers(db.users.filter(u => u.id !== user.id)); // exclude self
    }
  }, [user]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const lower = search.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(lower) ||
      u.profileInfo?.profession?.toLowerCase().includes(lower) ||
      u.profileInfo?.location?.toLowerCase().includes(lower)
    );
  }, [search, users]);

  if (!user) return null;

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl">Discover People</h1>
        <p className="mt-2 text-sm text-muted-foreground">Find and connect with other writers, producers, and directors in the Vault.</p>
        
        <div className="mt-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            className="pl-9 bg-card w-full max-w-md" 
            placeholder="Search by name, profession, or location..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No users found matching your search.
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="flex flex-col rounded-xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/50">
                <div className="flex items-start gap-4">
                  <Avatar className="size-14 border border-border/50">
                    <AvatarImage src={u.profileInfo?.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {u.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link to="/profile/$userId" params={{ userId: u.id }} className="font-medium text-lg truncate hover:underline">
                      {u.name}
                    </Link>
                    {u.profileInfo?.profession && (
                      <p className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground truncate">
                        <Briefcase className="size-3 shrink-0" /> {u.profileInfo.profession}
                      </p>
                    )}
                    {u.profileInfo?.location && (
                      <p className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground truncate">
                        <MapPin className="size-3 shrink-0" /> {u.profileInfo.location}
                      </p>
                    )}
                  </div>
                </div>
                {u.profileInfo?.bio && (
                  <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                    {u.profileInfo.bio}
                  </p>
                )}
                <div className="mt-auto pt-6">
                  <Link to="/profile/$userId" params={{ userId: u.id }} className="flex w-full items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
                    View Profile
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
