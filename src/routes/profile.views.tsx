import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import { getProfileViews, getDb, type ProfileView } from "@/lib/vault/store";

export const Route = createFileRoute("/profile/views")({
  component: ProfileViewsPage,
});

function ProfileViewsPage() {
  const { user, ready } = useVaultSession();
  const navigate = useNavigate();
  const [views, setViews] = useState<{ view: ProfileView; visitorName: string }[]>([]);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (user) {
      const v = getProfileViews();
      const db = getDb();
      const enriched = v.map(view => {
        const visitorName = view.isAnonymous ? "Anonymous Visitor" : (db.users.find(u => u.id === view.visitorId)?.name || "Unknown");
        return { view, visitorName };
      });
      // Sort by timestamp descending
      enriched.sort((a, b) => new Date(b.view.timestamp).getTime() - new Date(a.view.timestamp).getTime());
      setViews(enriched);
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to Dashboard
        </Link>
        <div className="mt-8 flex items-center gap-3">
          <Users className="size-6 text-primary" />
          <h1 className="text-3xl">Who's Viewed My Profile</h1>
        </div>
        
        <div className="mt-8 space-y-4">
          {views.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No one has viewed your profile yet.
            </div>
          ) : (
            views.map(({ view, visitorName }) => (
              <div key={view.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-5">
                <div>
                  <p className="font-medium">{visitorName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(view.timestamp).toLocaleString()}
                  </p>
                </div>
                {!view.isAnonymous && (
                  <Link 
                    to="/profile/$userId" 
                    params={{ userId: view.visitorId }}
                    className="text-xs text-primary hover:underline"
                  >
                    View Profile
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
