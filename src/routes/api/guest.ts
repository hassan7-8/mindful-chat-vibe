import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({ code: z.string().min(1).max(200) });

export const Route = createFileRoute("/api/guest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let code: string;
        try {
          code = BodySchema.parse(await request.json()).code;
        } catch {
          return new Response("Invalid request.", { status: 400 });
        }

        const { getGuestCode } = await import("@/lib/ai-config.server");
        const { guestCookieHeader } = await import("@/lib/guest.server");

        if (code.trim() !== getGuestCode()) {
          await new Promise((r) => setTimeout(r, 400));
          return new Response("That code isn't right.", { status: 401 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": await guestCookieHeader(),
          },
        });
      },
    },
  },
});
