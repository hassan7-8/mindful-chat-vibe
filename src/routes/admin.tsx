import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — Cheap Mind AI" },
      { name: "description", content: "Private device dashboard for the Cheap Mind AI owner." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Owner dashboard — Cheap Mind AI" },
      { property: "og:description", content: "Private device dashboard." },
    ],
  }),
  component: AdminPage,
});

type Device = {
  id: string;
  device_id: string;
  user_agent: string | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  revoked: boolean;
  uses: number;
  first_seen: string;
  last_seen: string;
};

function describeUA(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone/iPad" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

function AdminPage() {
  const [code, setCode] = useState("");
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [max, setMax] = useState(2);
  const [busy, setBusy] = useState(false);

  async function call(action: "list" | "block" | "unblock" | "remove", id?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action, id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { devices: Device[]; max: number };
      setDevices(j.devices);
      setMax(j.max);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function login(e: FormEvent) {
    e.preventDefault();
    void call("list");
  }

  const active = devices?.filter((d) => !d.revoked).length ?? 0;

  return (
    <div className="min-h-screen bg-cream px-4 py-6 text-ink sm:px-8">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <Logo />
        {devices && (
          <button onClick={() => void call("list")} className="press rounded-xl bg-paper px-3 py-2 text-sm font-medium ring-1 ring-ink/5">
            ↻ Refresh
          </button>
        )}
      </header>
      <div className="mx-auto mt-8 max-w-4xl">
        {!devices ? (
          <form onSubmit={login} className="anim-bouncein mx-auto max-w-sm rounded-3xl bg-paper p-6 shadow-pop ring-1 ring-ink/5">
            <h1 className="font-display text-2xl font-semibold">Owner only</h1>
            <p className="mt-1 text-sm text-ink/60">Enter your admin code to see who uses the access code.</p>
            <input
              type="password"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Admin code"
              className="mt-4 w-full rounded-xl bg-cream px-3 py-2.5 text-sm outline-none ring-1 ring-ink/5 focus:ring-2 focus:ring-plum"
            />
            <button disabled={busy} className="press lift mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-cream disabled:opacity-60">
              {busy ? "Checking…" : "Open dashboard"}
            </button>
          </form>
        ) : (
          <div className="anim-slideup">
            <h1 className="font-display text-3xl font-semibold">Devices</h1>
            <p className="mt-1 text-sm text-ink/60">
              {active} of {max} slots in use. Remove a device to free its slot; block to stop it for good.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {devices.length === 0 && <p className="text-sm text-ink/50">No device has used the code yet.</p>}
              {devices.map((d, i) => (
                <div key={d.id} style={{ animationDelay: `${i * 60}ms` }} className={`anim-slideup rounded-3xl bg-paper p-5 ring-1 ring-ink/5 ${d.revoked ? "opacity-60" : "shadow-pop-sm"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{describeUA(d.user_agent)}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.revoked ? "bg-coral/20 text-coral" : "bg-mint/25"}`}>
                      {d.revoked ? "Blocked" : "Active"}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-ink/70">
                    <div>📍 {[d.city, d.region, d.country].filter(Boolean).join(", ") || "Location unknown"}</div>
                    <div>🌐 IP {d.ip || "—"}{d.isp ? ` · ${d.isp}` : ""}</div>
                    <div>🕒 First {new Date(d.first_seen).toLocaleString()}</div>
                    <div>⚡ Last {new Date(d.last_seen).toLocaleString()} · {d.uses} messages</div>
                    <div className="break-all text-xs text-ink/40">{d.user_agent}</div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <button disabled={busy} onClick={() => void call(d.revoked ? "unblock" : "block", d.id)} className="press rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-semibold">
                      {d.revoked ? "Unblock" : "Block"}
                    </button>
                    <button disabled={busy} onClick={() => void call("remove", d.id)} className="press rounded-lg bg-coral/15 px-3 py-1.5 text-xs font-semibold text-coral">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
