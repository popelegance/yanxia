type LatLng = { lat: number; lng: number };

type Place = {
  id: string;
  name: string;
  kind: string;
  cover: string;
  gear: string;
  gearNote: string;
  walkMin: number;
  meters: number;
  openNow: boolean;
  hours: string;
  canSit: boolean;
  entrance: string;
  lat: number;
  lng: number;
  floodOnRoute: boolean;
  simulated: boolean;
  why: string;
  steps: { text: string; meters: number; covered: boolean }[];
};

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const GENERIC = new Set(["商场", "便利店", "地铁出入口", "公交站亭", "公共室内"]);

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 70));
}

function tagName(tags: Record<string, string>): string {
  return tags["name:zh-Hans"] || tags["name:zh"] || tags["name:zh-Hant"] || tags.name || tags["name:en"] || "";
}

function classify(tags: Record<string, string>) {
  const shop = tags.shop;
  const amenity = tags.amenity;
  const railway = tags.railway;
  const highway = tags.highway;
  const station = tags.station;
  if (shop === "convenience" || shop === "kiosk") return { kind: "convenience", cover: "indoor", gear: "sell", canSit: false };
  if (shop === "chemist" || amenity === "pharmacy") return { kind: "convenience", cover: "indoor", gear: "sell", canSit: false };
  if (shop === "supermarket" || shop === "mall" || shop === "department_store") return { kind: "mall", cover: "indoor", gear: "sell", canSit: true };
  if (railway === "subway_entrance" || railway === "station" || railway === "halt" || station === "subway" || tags.public_transport === "station") {
    return { kind: "subway", cover: "indoor", gear: "unknown", canSit: true };
  }
  if (amenity === "community_centre" || amenity === "library" || amenity === "townhall") return { kind: "shelter", cover: "indoor", gear: "lend", canSit: true };
  if (amenity === "cafe" || amenity === "fast_food" || amenity === "restaurant") return { kind: "convenience", cover: "indoor", gear: "none", canSit: true };
  if (highway === "bus_stop" || amenity === "shelter" || amenity === "bus_station") return { kind: "canopy", cover: "canopy", gear: "none", canSit: false };
  return null;
}

function toPlace(el: OsmElement, user: LatLng): Place | null {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const cls = classify(tags);
  if (!cls) return null;
  const name = tagName(tags);
  if (!name || GENERIC.has(name)) return null;
  const meters = Math.round(haversineMeters(user, { lat, lng }));
  if (meters > 900 || meters < 15) return null;
  const walkMin = walkMinutes(meters);
  const outdoor = Math.round(meters * 0.85);
  const gearNote =
    cls.gear === "sell" ? "此类店雨季常卖伞，库存以现场为准" : cls.kind === "subway" ? "车站可进室内。是否发放雨衣未核实" : "可躲雨，雨具情况未知";
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    kind: cls.kind,
    cover: cls.cover,
    gear: cls.gear,
    gearNote,
    walkMin,
    meters,
    openNow: true,
    hours: tags.opening_hours || "以现场为准",
    canSit: cls.canSit,
    entrance: tags["addr:street"] ? `${tags["addr:street"]}一侧入口` : "沿最近入口进入",
    lat,
    lng,
    floodOnRoute: false,
    simulated: false,
    why: cls.cover === "indoor" ? `可进室内，步行 ${walkMin} 分钟` : `有顶可挡雨，步行 ${walkMin} 分钟`,
    steps: [
      { text: `沿人行道前往${name}`, meters: outdoor, covered: false },
      { text: cls.cover === "indoor" ? "推门进入室内" : "站到檐下", meters: meters - outdoor, covered: true },
    ],
  };
}

function pick(candidates: Place[]): Place[] {
  const scored = [...candidates].sort((a, b) => {
    const rank = (p: Place) => {
      let s = 48 - p.walkMin * 7;
      if (p.gear === "sell" || p.gear === "lend") s += 24;
      if (p.cover === "indoor") s += 10;
      if (p.kind === "subway") s += 8;
      if (p.kind === "canopy") s -= 10;
      if (p.gear === "none") s -= 12;
      return s;
    };
    return rank(b) - rank(a);
  });
  const usedKind = new Map<string, number>();
  const seen = new Set<string>();
  const picked: Place[] = [];
  const caps: Record<string, number> = { canopy: 1, subway: 2, mall: 2, shelter: 1, convenience: 3 };
  for (const place of scored) {
    if (seen.has(place.name.replace(/\s+/g, ""))) continue;
    const cap = place.kind === "convenience" && place.gear !== "sell" ? 1 : caps[place.kind] ?? 1;
    if ((usedKind.get(place.kind) ?? 0) >= cap) continue;
    usedKind.set(place.kind, (usedKind.get(place.kind) ?? 0) + 1);
    seen.add(place.name.replace(/\s+/g, ""));
    picked.push(place);
    if (picked.length >= 8) break;
  }
  return picked.sort((a, b) => a.meters - b.meters);
}

async function overpass(user: LatLng): Promise<OsmElement[]> {
  const { lat, lng } = user;
  const query = `[out:json][timeout:20];(
  nwr["shop"="convenience"](around:800,${lat},${lng});
  nwr["shop"="supermarket"](around:800,${lat},${lng});
  nwr["shop"="mall"](around:800,${lat},${lng});
  nwr["shop"="department_store"](around:800,${lat},${lng});
  nwr["amenity"="pharmacy"](around:800,${lat},${lng});
  nwr["shop"="chemist"](around:800,${lat},${lng});
  nwr["railway"="subway_entrance"](around:800,${lat},${lng});
  nwr["station"="subway"](around:800,${lat},${lng});
  nwr["railway"="station"](around:800,${lat},${lng});
  nwr["amenity"="community_centre"](around:800,${lat},${lng});
  nwr["amenity"="library"](around:800,${lat},${lng});
  nwr["amenity"="cafe"](around:600,${lat},${lng});
  node["highway"="bus_stop"]["name"](around:450,${lat},${lng});
);out center tags;`;
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Yanxia/1.0 (rain shelter prototype)",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: OsmElement[] };
      return data.elements ?? [];
    } catch {
      /* try next mirror */
    }
  }
  return [];
}

async function reverseArea(user: LatLng): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(user.lat));
    url.searchParams.set("lon", String(user.lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "16");
    url.searchParams.set("accept-language", "zh");
    const res = await fetch(url, {
      headers: { "User-Agent": "Yanxia/1.0 (rain shelter prototype)" },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { address?: Record<string, string>; name?: string };
    const a = data.address ?? {};
    return [...new Set([a.neighbourhood || a.suburb || a.quarter, a.road || data.name].filter(Boolean))].join(" · ");
  } catch {
    return "";
  }
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "bad coords" }, { status: 400 });
  }
  const user = { lat, lng };
  const [area, elements] = await Promise.all([reverseArea(user), overpass(user)]);
  const places = pick(elements.map((el) => toPlace(el, user)).filter((p): p is Place => Boolean(p)));
  return Response.json({
    area: area || "当前位置",
    source: places.length >= 3 ? "osm" : "fallback",
    places,
  });
};
