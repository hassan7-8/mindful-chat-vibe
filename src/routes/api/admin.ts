import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  code: z.string().min(1).max(200),
  action: z.enum(["list", "block", "unblock", "remove"]),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request.", { status: 400 });
        }
        const { getAdminCode, MAX_GUEST_DEVICES } = await import("@/lib/ai-config.server");
        if (body.code !== getAdminCode()) {
          await new Promise((r) => setTimeout(r, 800));
          return new Response("Wrong admin code.", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const t = supabaseAdmin.from("guest_devices");
        if (body.action !== "list") {
          if (!body.id) return new Response("Missing id.", { status: 400 });
          if (body.action === "remove") await t.delete().eq("id", body.id);
          else await t.update({ revoked: body.action === "block" }).eq("id", body.id);
        }
        const { data } = await supabaseAdmin
          .from("guest_devices")
          .select("*")
          .order("last_seen", { ascending: false });
        return Response.json({ devices: data ?? [], max: MAX_GUEST_DEVICES });
      },
    },
  },
});
