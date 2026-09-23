import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const BodySchema = z.object({ prompt: z.string().min(1).max(2000) });

async function isSignedIn(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user);
}

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hasGuestCookie } = await import("@/lib/guest.server");
        const allowed = (await isSignedIn(request)) || (await hasGuestCookie(request));
        if (!allowed) return new Response("Please log in or enter the access code.", { status: 401 });

        let prompt: string;
        try {
          prompt = BodySchema.parse(await request.json()).prompt;
        } catch {
          return new Response("Invalid request.", { status: 400 });
        }

        const { getGeminiKey, IMAGE_MODEL } = await import("@/lib/ai-config.server");
        const key = getGeminiKey();
        if (!key) return new Response("No image key set yet.", { status: 503 });

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            }),
            signal: request.signal,
          },
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return new Response(
            res.status === 429
              ? "Image generation isn't included in your key's free plan yet — chat and voice still work."
              : `Image error (${res.status}): ${text.slice(0, 200)}`,
            { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
          );
        }

        const json = (await res.json()) as {
          candidates?: {
            content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
          }[];
        };
        const parts = json.candidates?.[0]?.content?.parts ?? [];
        const img = parts.find((p) => p.inlineData?.data)?.inlineData;
        if (!img?.data) return new Response("The model returned no image.", { status: 502 });

        return Response.json({
          dataUrl: `data:${img.mimeType ?? "image/png"};base64,${img.data}`,
        });
      },
    },
  },
});
