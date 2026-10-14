import { getGuestCode } from "./ai-config.server";

export const GUEST_COOKIE = "cm_guest";

async function token() {
  const data = new TextEncoder().encode("cheap-mind-guest:" + getGuestCode());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function guestToken() {
  return token();
}

export async function hasGuestCookie(request: Request) {
  const header = request.headers.get("x-guest-token");
  if (header && header === (await token())) return true;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${GUEST_COOKIE}=([^;]+)`));
  if (!match?.[1]) return false;
  return match[1] === (await token());
}

export async function guestCookieHeader() {
  const value = await token();
  return `${GUEST_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
}
