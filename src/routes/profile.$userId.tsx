import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, User as UserIcon, MapPin, Briefcase, Mail, UserPlus, ShieldCheck, FileText } from "lucide-react";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import { getDb, recordProfileView, toggleFollow, toggleConnect, requestProfileAccess, checkAccessStatus, type VaultUser, type VaultScript } from "@/lib/vault/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/profile/$userId")({
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { user, ready } = useVaultSession();
  const [profile, setProfile] = useState<VaultUser | null>(null);
  const [publicScripts, setPublicScripts] = useState<VaultScript[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const [_, forceUpdate] = useState(0);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  useEffect(() => {
    const db = getDb();
    const found = db.users.find((u) => u.id === userId);
    setProfile(found ?? null);
    
    const status = checkAccessStatus(userId);
    setAccessStatus(status);
    
    if (found?.privacySettings?.showScriptsOnProfile || status === "approved") {
      setPublicScripts(db.scripts.filter(s => s.ownerId === userId));
    } else {
      setPublicScripts([]);
    }
  }, [userId, _]);

  useEffect(() => {
    if (user && profile) {
      setIsFollowing(user.social?.following.includes(profile.id) ?? false);
      setIsConnected(user.social?.connections.includes(profile.id) ?? false);
      if (user.id !== profile.id) {
        recordProfileView(user.id, profile.id);
      }
    }
  }, [user, profile, _]);

  if (!user) return null;

  function handleFollow() {
    if (!profile) return;
    const following = toggleFollow(profile.id);
    setIsFollowing(following ?? false);
    forceUpdate(n => n + 1);
  }

  function handleConnect() {
    if (!profile) return;
    const connected = toggleConnect(profile.id);
    setIsConnected(connected ?? false);
    forceUpdate(n => n + 1);
  }

  function handleRequestAccess() {
    if (!profile) return;
    try {
      requestProfileAccess(profile.id);
      setAccessStatus("pending");
      forceUpdate(n => n + 1);
    } catch (e: any) {
      console.error(e.message);
    }
  }

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Link
          to="/people"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-3" /> Back to Discover
        </Link>
        
        {profile ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
              <div className="h-32 bg-primary/5 w-full border-b border-border/50"></div>
              <div className="px-8 pb-8 relative">
                <div className="flex justify-between items-end -mt-12 mb-4">
                  <Avatar className="size-24 border-4 border-card bg-card">
                    <AvatarImage src={profile.profileInfo?.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {profile.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.id !== profile.id && (
                    <div className="flex gap-2">
                      <Button onClick={handleFollow} variant={isFollowing ? "outline" : "default"}>
                        {isFollowing ? "Following" : "Follow"}
                      </Button>
                      <Button onClick={handleConnect} variant={isConnected ? "secondary" : "outline"} className="gap-2">
                        <UserPlus className="size-4" /> {isConnected ? "Connected" : "Connect"}
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a href={`mailto:${profile.email}`}><Mail className="size-4" /></a>
                      </Button>
                    </div>
                  )}
                  {user.id === profile.id && (
                    <Button variant="outline" asChild>
                      <Link to="/dashboard">Edit Profile</Link>
                    </Button>
                  )}
                </div>
                
                <h1 className="text-3xl font-semibold">{profile.name}</h1>
                <p className="text-lg text-muted-foreground mt-1">{profile.profileInfo?.profession || "Script Vault Member"}</p>
                
                <p className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                  <Mail className="size-4 shrink-0" /> {profile.email}
                </p>

                {profile.profileInfo?.location && (
                  <p className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" /> {profile.profileInfo.location}
                  </p>
                )}

                <div className="flex gap-4 mt-4 text-sm">
                  <span className="text-muted-foreground"><strong className="text-foreground">{profile.social?.followers?.length || 0}</strong> Followers</span>
                  <span className="text-muted-foreground"><strong className="text-foreground">{profile.social?.following?.length || 0}</strong> Following</span>
                  <span className="text-muted-foreground"><strong className="text-foreground">{profile.social?.connections?.length || 0}</strong> Connections</span>
                </div>
              </div>
            </div>

            {profile.profileInfo?.bio && (
              <div className="rounded-xl border border-border/70 bg-card p-8">
                <h2 className="text-xl font-semibold mb-4">About</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{profile.profileInfo.bio}</p>
              </div>
            )}

            {profile.privacySettings?.showScriptsOnProfile || accessStatus === "approved" ? (
              <div className="rounded-xl border border-border/70 bg-card p-8">
                <h2 className="flex items-center gap-2 text-xl font-semibold mb-6">
                  <ShieldCheck className="size-5 text-primary" /> {accessStatus === "approved" ? "Private Vault Scripts (Access Granted)" : "Public Vault Scripts"}
                </h2>
                {publicScripts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No scripts are listed yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {publicScripts.map(script => (
                      <Link to="/scripts/$scriptId" params={{ scriptId: script.id }} key={script.id} className="block rounded-lg border border-border/70 p-4 transition-colors hover:border-primary/50">
                        <h3 className="font-medium text-lg truncate">{script.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{script.genre}</p>
                        <p className="mt-2 text-sm line-clamp-2 text-muted-foreground">{script.logline}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{script.versions.length} versions</Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><FileText className="size-3" /> Sealed</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-card p-8 text-center">
                <ShieldCheck className="size-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">This user's scripts are kept private in their vault.</p>
                {user.id !== profile.id && (
                  accessStatus === "pending" ? (
                    <Button variant="secondary" disabled>Request Pending</Button>
                  ) : (
                    <Button onClick={handleRequestAccess}>Request Access</Button>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 p-8 text-center text-muted-foreground rounded-xl border border-border/70 bg-card">Profile not found.</div>
        )}
      </main>
    </div>
  );
}
