import { getGuestCode } from "./ai-config.server";

export const GUEST_COOKIE = "cm_guest";

async function sha(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token bound to one device: useless if copied to another device id. */
export function deviceToken(deviceId: string) {
  return sha(`cheap-mind-guest:${getGuestCode()}:${deviceId}`);
}

export function isValidDeviceId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(id);
}

/** Verifies the guest token + device id and that the device is still allowed. */
export async function hasGuestCookie(request: Request) {
  const token = request.headers.get("x-guest-token");
  const deviceId = request.headers.get("x-device-id");
  if (!token || !isValidDeviceId(deviceId)) return false;
  if (token !== (await deviceToken(deviceId))) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("guest_devices")
    .select("id, revoked, uses")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!data || data.revoked) return false;
  await supabaseAdmin
    .from("guest_devices")
    .update({ last_seen: new Date().toISOString(), uses: data.uses + 1 })
    .eq("id", data.id);
  return true;
}

export function clientIp(request: Request) {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-nf-client-connection-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export async function lookupGeo(request: Request) {
  const ip = clientIp(request);
  const h = request.headers;
  const geo = {
    ip,
    country: h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "",
    region: h.get("x-vercel-ip-country-region") || "",
    city: decodeURIComponent(h.get("x-vercel-ip-city") || ""),
    isp: "",
  };
  if (ip) {
    try {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(3000),
      });
      const j = (await r.json()) as {
        success?: boolean;
        country?: string;
        region?: string;
        city?: string;
        connection?: { isp?: string };
      };
      if (j.success) {
        geo.country = j.country || geo.country;
        geo.region = j.region || geo.region;
        geo.city = j.city || geo.city;
        geo.isp = j.connection?.isp || "";
      }
    } catch {
      /* geo is best-effort */
    }
  }
  return geo;
}
