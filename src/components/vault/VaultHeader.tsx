import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVaultSession } from "@/hooks/use-vault-session";
import { UnlockGate } from "./UnlockGate";
import { logout, markNotificationsRead, myNotifications, subscribe } from "@/lib/vault/store";

export function VaultHeader() {
  const { user } = useVaultSession();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<ReturnType<typeof myNotifications>>([]);

  useEffect(() => {
    const sync = () => setNotifs(myNotifications());
    sync();
    return subscribe(sync);
  }, [user?.id]);

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <>
      <UnlockGate />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-primary" />
            <span className="font-display text-lg tracking-tight">
              Script<span className="gold-text font-semibold"> Vault</span>
            </span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Vault
              </Link>
              <Link to="/people" className="ml-4 text-sm text-muted-foreground hover:text-foreground">
                Discover
              </Link>
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className="ml-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Admin
                </Link>
              )}
              <DropdownMenu onOpenChange={(o) => o && markNotificationsRead()}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative ml-2">
                    <Bell className="size-4" />
                    {unread > 0 && (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifs.length === 0 && (
                    <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Nothing yet.
                    </div>
                  )}
                  {notifs.slice(0, 8).map((n) => (
                    <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5">
                      <span className="text-xs">{n.message}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="outline" className="ml-1 hidden sm:inline-flex">
                {user.name}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  logout();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <Link to="/">
              <Button variant="outline" size="sm">
                Enter the vault
              </Button>
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
