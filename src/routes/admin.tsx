import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VaultHeader } from "@/components/vault/VaultHeader";
import { useVaultSession } from "@/hooks/use-vault-session";
import { adminStats, setUserRole, subscribe } from "@/lib/vault/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin analytics — Script Vault" },
      {
        name: "description",
        content: "Platform analytics, deposit volume, originality trends and user management.",
      },
      { property: "og:title", content: "Admin analytics — Script Vault" },
      { property: "og:description", content: "Monitoring and user management for the vault." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: Admin,
});

function Admin() {
  const { user, ready } = useVaultSession();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    if (ready && (!user || user.role !== "admin")) navigate({ to: "/" });
  }, [ready, user, navigate]);

  const stats = useMemo(() => (user?.role === "admin" ? adminStats() : null), [user, tick]);
  if (!stats) return null;

  return (
    <div className="min-h-screen grain">
      <VaultHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl">Platform analytics</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Aggregate monitoring only — script contents stay encrypted under each writer's key.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Users" value={stats.users} sub={`${stats.verified} verified`} />
          <Stat label="Scripts" value={stats.scripts} />
          <Stat label="Signed versions" value={stats.versions} />
          <Stat label="Avg originality" value={`${stats.avgOriginality}%`} />
          <Stat label="Flagged (<70%)" value={stats.flagged} />
          <Stat label="Sign-ins" value={stats.logins} sub="all accounts" />
        </div>

        <section className="mt-10 rounded-lg border border-border/70 bg-card p-5">
          <h2 className="text-lg">Login activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every successful sign-in is logged and pushed to admin notifications.
          </p>
          {stats.logins_list.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No sign-ins recorded yet.</p>
          ) : (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.logins_list.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {new Date(l.at).toLocaleString()}
                    </TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.email}</TableCell>
                    <TableCell className="font-mono text-xs">{l.role}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {l.agent}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="mt-10 rounded-lg border border-border/70 bg-card p-5">
          <h2 className="text-lg">Deposits per day</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-10 rounded-lg border border-border/70 bg-card p-5">
          <h2 className="text-lg">User management</h2>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.users_list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.verified ? "outline" : "destructive"}>
                      {u.verified ? "verified" : "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.role}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={u.id === user?.id}
                      onClick={() => setUserRole(u.id, u.role === "admin" ? "user" : "admin")}
                    >
                      {u.role === "admin" ? "Revoke admin" : "Make admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="vault-surface rounded-lg border border-border/70 p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
