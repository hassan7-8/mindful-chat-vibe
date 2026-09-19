import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20000),
      }),
    )
    .min(1)
    .max(60),
});

async function verifyUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
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
  if (error || !data.user) return null;
  return data.user;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await verifyUser(request);
        if (!user) return new Response("Please log in first.", { status: 401 });

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request.", { status: 400 });
        }

        const { getProviderConfig, SYSTEM_PROMPT } = await import("@/lib/ai-config.server");
        const cfg = getProviderConfig();
        if (!cfg.configured) {
          return new Response(
            "No AI key set yet. Paste your key in src/lib/ai-config.server.ts.",
            { status: 503 },
          );
        }

        const upstream = await fetch(cfg.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            stream: true,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...body.messages],
          }),
          signal: request.signal,
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          const status = upstream.status;
          let msg = "The AI service returned an error.";
          if (status === 401 || status === 403) msg = "The AI key was rejected. Check it in src/lib/ai-config.server.ts.";
          else if (status === 429) msg = "Rate limit hit on the free tier — wait a moment and try again.";
          else if (text) msg = `AI error (${status}): ${text.slice(0, 200)}`;
          return new Response(msg, { status: status >= 400 && status < 600 ? status : 502 });
        }

        // Convert OpenAI-style SSE into a plain text stream of deltas.
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        const transform = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const json = JSON.parse(data) as {
                  choices?: { delta?: { content?: string | null } }[];
                };
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {
                /* ignore partial json */
              }
            }
          },
        });

        return new Response(upstream.body.pipeThrough(transform), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
