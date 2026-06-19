"use client";

import { useEffect, useState } from "react";

// 內部小後台 —— 字串直接 zh-TW（不對外、不走 i18n）。

interface Entitlement {
  isPremium: boolean;
  status: string;
  source: string | null;
  accessUntil: string | null;
}
interface UserLookup {
  user: { id: string; email: string; name: string | null };
  entitlement: Entitlement;
}
interface PromoCode {
  id: string;
  code: string;
  grantDays: number;
  maxRedemptions: number | null;
  perUserLimit: number;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function AdminPanel() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-10">
      <h1 className="text-xl font-bold text-foreground">Admin 後台</h1>
      <UserGrantSection />
      <PromoCodesSection />
    </div>
  );
}

function fmtEnt(e: Entitlement): string {
  const until = e.accessUntil ? e.accessUntil.slice(0, 10) : "永久";
  return `${e.status}${e.isPremium ? "（premium）" : ""} · 來源 ${e.source ?? "—"} · 到期 ${until}`;
}

function UserGrantSection() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<UserLookup | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    setMsg(null);
    setResult(null);
    const res = await fetch(`/api/admin/user?email=${encodeURIComponent(email.trim())}`);
    if (!res.ok) {
      setMsg(res.status === 404 ? "查無此 user" : "查詢失敗");
      return;
    }
    setResult(await res.json());
  }

  async function grant(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg("操作失敗");
        return;
      }
      setResult((r) => (r ? { ...r, entitlement: data.entitlement } : r));
      setMsg("已更新");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg("操作失敗");
        return;
      }
      setResult((r) => (r ? { ...r, entitlement: data.entitlement } : r));
      setMsg("已收回");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-text-dim">
        會員權限
      </h2>
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="user email"
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={lookup}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-hover"
        >
          查詢
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-border p-3 text-sm space-y-3">
          <div>
            <div className="font-medium text-foreground">
              {result.user.name || "（未命名）"} · {result.user.email}
            </div>
            <div className="text-xs text-text-dim mt-1">{fmtEnt(result.entitlement)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => grant({ forever: true })}
              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">開永久</button>
            <button disabled={busy} onClick={() => grant({ days: 365 })}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface-hover disabled:opacity-50">+365 天</button>
            <button disabled={busy} onClick={() => grant({ days: 30 })}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface-hover disabled:opacity-50">+30 天</button>
            <button disabled={busy} onClick={revoke}
              className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50">收回</button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-text-dim">{msg}</p>}
    </section>
  );
}

function PromoCodesSection() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [form, setForm] = useState({ code: "", grantDays: "30", maxRedemptions: "", expiresAt: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/promo-codes");
    if (res.ok) setCodes((await res.json()).codes);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setMsg(null);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        grantDays: Number(form.grantDays),
        maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
        expiresAt: form.expiresAt || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "建立失敗");
      return;
    }
    setForm({ code: "", grantDays: "30", maxRedemptions: "", expiresAt: "" });
    setMsg("已建立");
    load();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-text-dim">
        Promo Code
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="CODE" className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary uppercase" />
        <input value={form.grantDays} onChange={(e) => setForm({ ...form, grantDays: e.target.value })}
          placeholder="天數" type="number" className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" />
        <input value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
          placeholder="上限(空=無限)" type="number" className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" />
        <input value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          placeholder="到期(YYYY-MM-DD)" className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary" />
      </div>
      <button onClick={create} disabled={!form.code.trim()}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">建立</button>
      {msg && <p className="text-xs text-text-dim">{msg}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-text-dim">
            <tr className="text-left">
              <th className="py-1 pr-3">Code</th><th className="pr-3">天</th>
              <th className="pr-3">用量</th><th className="pr-3">到期</th><th>狀態</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {codes.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-1 pr-3 font-mono">{c.code}</td>
                <td className="pr-3">{c.grantDays}</td>
                <td className="pr-3">{c.redeemedCount}/{c.maxRedemptions ?? "∞"}</td>
                <td className="pr-3">{c.expiresAt ? c.expiresAt.slice(0, 10) : "—"}</td>
                <td>{c.isActive ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
