import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  code: z.string().min(1).max(200),
  deviceId: z.string().regex(/^[a-zA-Z0-9-]{16,64}$/),
});

export const Route = createFileRoute("/api/guest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request.", { status: 400 });
        }

        const { getGuestCode, MAX_GUEST_DEVICES } = await import("@/lib/ai-config.server");
        const { deviceToken, lookupGeo } = await import("@/lib/guest.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.code.trim() !== getGuestCode()) {
          await new Promise((r) => setTimeout(r, 600));
          return new Response("That code isn't right.", { status: 401 });
        }

        const { data: existing } = await supabaseAdmin
          .from("guest_devices")
          .select("id, revoked")
          .eq("device_id", body.deviceId)
          .maybeSingle();

        if (existing?.revoked) {
          return new Response("This device was blocked by the owner.", { status: 403 });
        }

        const geo = await lookupGeo(request);
        const ua = request.headers.get("user-agent")?.slice(0, 400) ?? "";

        if (existing) {
          await supabaseAdmin
            .from("guest_devices")
            .update({ ...geo, user_agent: ua, last_seen: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          const { count } = await supabaseAdmin
            .from("guest_devices")
            .select("id", { count: "exact", head: true })
            .eq("revoked", false);
          if ((count ?? 0) >= MAX_GUEST_DEVICES) {
            return new Response(
              `This code is already in use on ${MAX_GUEST_DEVICES} devices. Ask the owner to free a slot.`,
              { status: 403 },
            );
          }
          const { error } = await supabaseAdmin
            .from("guest_devices")
            .insert({ device_id: body.deviceId, user_agent: ua, ...geo });
          if (error) return new Response("Could not register device.", { status: 500 });
        }

        return Response.json({ ok: true, token: await deviceToken(body.deviceId) });
      },
    },
  },
});
