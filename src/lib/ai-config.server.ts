/**
 * ─────────────────────────────────────────────────────────────
 *  CHEAP MIND AI — AI PROVIDER CONFIG
 * ─────────────────────────────────────────────────────────────
 *  Paste your API key below. This file only ever runs on the
 *  server (the *.server.ts suffix keeps it out of the browser
 *  bundle), so the key is never shipped to visitors.
 *
 *  Default provider: Google Gemini (free tier, forever).
 *  Get a free key here → https://aistudio.google.com/app/apikey
 *
 *  Prefer Groq (also free, extremely fast)? Switch PROVIDER to
 *  "groq" and paste a key from https://console.groq.com/keys
 *
 *  Environment variables (GEMINI_API_KEY / GROQ_API_KEY) win over
 *  the hard-coded value if they are set — handy on Vercel.
 * ─────────────────────────────────────────────────────────────
 */

export const PROVIDER: "gemini" | "groq" = "gemini";

// ▼▼▼ PASTE YOUR KEY HERE ▼▼▼
export const GEMINI_API_KEY = "PASTE_YOUR_GEMINI_KEY_HERE";
export const GROQ_API_KEY = "PASTE_YOUR_GROQ_KEY_HERE";
// ▲▲▲ PASTE YOUR KEY HERE ▲▲▲

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

export function getProviderConfig() {
  const envKey =
    PROVIDER === "gemini" ? process.env["GEMINI_API_KEY"] : process.env["GROQ_API_KEY"];
  const codeKey = PROVIDER === "gemini" ? GEMINI_API_KEY : GROQ_API_KEY;
  const apiKey = envKey?.trim() || codeKey.trim();
  const configured = Boolean(apiKey) && !apiKey.startsWith("PASTE_YOUR_");
  return { ...PROVIDERS[PROVIDER], apiKey, configured, provider: PROVIDER };
}
