import { createFileRoute } from "@tanstack/react-router";
import { loadNearby } from "@/lib/osm-places";

export const Route = createFileRoute("/api/nearby")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return Response.json({ error: "bad coords" }, { status: 400 });
        }
        try {
          const data = await loadNearby({ lat, lng });
          return Response.json(data, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch {
          return Response.json({ area: "", source: "fallback", places: [] }, { status: 502 });
        }
      },
    },
  },
});
