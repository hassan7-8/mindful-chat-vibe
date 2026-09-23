/**
 * ─────────────────────────────────────────────────────────────
 *  CHEAP MIND AI — AI PROVIDER CONFIG (server only)
 * ─────────────────────────────────────────────────────────────
 *  This file never reaches the browser (*.server.ts), so the key
 *  and the guest access code stay private.
 *
 *  On Vercel you can instead set env vars:
 *    GEMINI_API_KEY, GROQ_API_KEY, GUEST_ACCESS_CODE
 *  Env vars always win over the values written below.
 * ─────────────────────────────────────────────────────────────
 */

export const PROVIDER: "gemini" | "groq" = "gemini";

// ▼▼▼ YOUR KEYS ▼▼▼
export const GEMINI_API_KEY = "AQ.Ab8RN6J3nGod-CJ3AnfanfcUASfAkhRCo5UVR-kL9QnzesWSGA";
export const GROQ_API_KEY = "PASTE_YOUR_GROQ_KEY_HERE";

// Secret code that unlocks the chat without an account.
export const GUEST_ACCESS_CODE = "hassan7534@";
// ▲▲▲ YOUR KEYS ▲▲▲

export const SYSTEM_PROMPT =
  "You are Cheap Mind AI — a fast, friendly, sharp assistant. Answer clearly and concisely. Use Markdown (headings, lists, code blocks) when it helps readability.";

const PROVIDERS = {
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
  },
} as const;

export const IMAGE_MODEL = "gemini-2.5-flash-image";

function clean(value: string | undefined) {
  const v = value?.trim() ?? "";
  return v && !v.startsWith("PASTE_YOUR_") ? v : "";
}

export function getGuestCode() {
  return clean(process.env["GUEST_ACCESS_CODE"]) || GUEST_ACCESS_CODE.trim();
}

export function getGeminiKey() {
  return clean(process.env["GEMINI_API_KEY"]) || clean(GEMINI_API_KEY);
}

export function getProviderConfig() {
  const apiKey =
    PROVIDER === "gemini"
      ? getGeminiKey()
      : clean(process.env["GROQ_API_KEY"]) || clean(GROQ_API_KEY);
  return { ...PROVIDERS[PROVIDER], apiKey, configured: Boolean(apiKey), provider: PROVIDER };
}
