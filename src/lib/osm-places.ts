import {
  placesAround,
  type Cover,
  type Gear,
  type Place,
  type PlaceKind,
} from "@/data/places";
import { haversineMeters, walkMinutes, type LatLng } from "@/lib/geo";

export type NearbyResult = {
  area: string;
  source: "osm" | "fallback";
  places: Place[];
};

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const GEAR_BRANDS = [
  "7-eleven",
  "7-11",
  "7eleven",
  "便利蜂",
  "全家",
  "familymart",
  "ok便利",
  "lawson",
  "罗森",
  "羅森",
  "屈臣氏",
  "watsons",
  "万宁",
  "萬寧",
  "mannings",
  "meiyijia",
  "美宜佳",
];

function tagName(tags: Record<string, string>): string {
  return (
    tags["name:zh-Hans"] ||
    tags["name:zh"] ||
    tags["name:zh-Hant"] ||
    tags.name ||
    tags["name:en"] ||
    ""
  );
}

function classify(tags: Record<string, string>): {
  kind: PlaceKind;
  cover: Cover;
  gear: Gear;
  canSit: boolean;
} | null {
  const shop = tags.shop;
  const amenity = tags.amenity;
  const railway = tags.railway;
  const highway = tags.highway;
  const station = tags.station;
  const name = tagName(tags).toLowerCase();

  if (shop === "convenience" || shop === "kiosk") {
    return { kind: "convenience", cover: "indoor", gear: "sell", canSit: false };
  }
  if (shop === "chemist" || amenity === "pharmacy") {
    return { kind: "convenience", cover: "indoor", gear: "sell", canSit: false };
  }
  if (shop === "supermarket" || shop === "mall" || shop === "department_store") {
    return { kind: "mall", cover: "indoor", gear: "sell", canSit: true };
  }
  if (
    railway === "subway_entrance" ||
    railway === "station" ||
    railway === "halt" ||
    station === "subway" ||
    tags.public_transport === "station"
  ) {
    return { kind: "subway", cover: "indoor", gear: "unknown", canSit: true };
  }
  if (amenity === "community_centre" || amenity === "library" || amenity === "townhall") {
    return { kind: "shelter", cover: "indoor", gear: "lend", canSit: true };
  }
  if (amenity === "cafe" || amenity === "fast_food" || amenity === "restaurant") {
    return { kind: "convenience", cover: "indoor", gear: "none", canSit: true };
  }
  if (highway === "bus_stop" || amenity === "shelter" || amenity === "bus_station") {
    return { kind: "canopy", cover: "canopy", gear: "none", canSit: false };
  }
  if (GEAR_BRANDS.some((b) => name.includes(b))) {
    return { kind: "convenience", cover: "indoor", gear: "sell", canSit: false };
  }
  return null;
}

function gearNote(gear: Gear, kind: PlaceKind): string {
  if (gear === "sell") return "此类店雨季常卖伞，库存以现场为准";
  if (gear === "lend") return "公共服务点有时出借雨具，以现场为准";
  if (kind === "subway") return "车站可进室内。是否发放雨衣未核实";
  return "可躲雨，雨具情况未知";
}

function toPlace(el: OsmElement, user: LatLng): Place | null {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const cls = classify(tags);
  if (!cls) return null;
  const name = tagName(tags) || fallbackName(cls.kind);
  const meters = Math.round(haversineMeters(user, { lat, lng }));
  if (meters > 900 || meters < 15) return null;
  const walkMin = walkMinutes(meters);
  const outdoor = Math.round(meters * 0.85);
  const street = tags["addr:street"] || tags["addr:place"] || "";
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    kind: cls.kind,
    cover: cls.cover,
    gear: cls.gear,
    gearNote: gearNote(cls.gear, cls.kind),
    walkMin,
    meters,
    openNow: true,
    hours: tags.opening_hours || "以现场为准",
    canSit: cls.canSit,
    entrance: street ? `${street}一侧入口` : "沿最近入口进入",
    lat,
    lng,
    floodOnRoute: false,
    simulated: false,
    why:
      cls.cover === "indoor"
        ? `可进室内，步行 ${walkMin} 分钟`
        : `有顶可挡雨，步行 ${walkMin} 分钟`,
    steps: [
      { text: `沿人行道前往${name}`, meters: outdoor, covered: false },
      {
        text: cls.cover === "indoor" ? "推门进入室内" : "站到檐下",
        meters: meters - outdoor,
        covered: true,
      },
    ],
  };
}

function fallbackName(kind: PlaceKind): string {
  if (kind === "subway") return "地铁出入口";
  if (kind === "mall") return "商场";
  if (kind === "shelter") return "公共室内";
  if (kind === "canopy") return "公交站亭";
  return "便利店";
}

const GENERIC_NAMES = new Set(["商场", "便利店", "地铁出入口", "公交站亭", "公共室内"]);

function pickDiverse(candidates: Place[]): Place[] {
  const scored = [...candidates].sort((a, b) => rankCandidate(b) - rankCandidate(a));
  const usedKind = new Map<string, number>();
  const usedBucket = new Map<string, number>();
  const seen = new Set<string>();
  const picked: Place[] = [];

  for (const place of scored) {
    if (GENERIC_NAMES.has(place.name)) continue;
    const nameKey = place.name.replace(/\s+/g, "");
    if (seen.has(nameKey)) continue;
    const kindCap = kindCaps(place);
    if ((usedKind.get(place.kind) ?? 0) >= kindCap) continue;
    const bucket = gearBucket(place);
    if ((usedBucket.get(bucket) ?? 0) >= bucketCap(bucket)) continue;
    usedKind.set(place.kind, (usedKind.get(place.kind) ?? 0) + 1);
    usedBucket.set(bucket, (usedBucket.get(bucket) ?? 0) + 1);
    seen.add(nameKey);
    picked.push(place);
    if (picked.length >= 8) break;
  }

  return picked.sort((a, b) => a.meters - b.meters);
}

function rankCandidate(place: Place): number {
  let score = 48 - place.walkMin * 7;
  if (!GENERIC_NAMES.has(place.name)) score += 22;
  if (place.gear === "sell" || place.gear === "lend" || place.gear === "free") score += 24;
  if (place.cover === "indoor") score += 10;
  if (place.kind === "subway") score += 8;
  if (place.kind === "mall") score += 6;
  if (place.kind === "canopy") score -= 10;
  if (place.gear === "none" && place.kind === "convenience") score -= 12;
  return score;
}

function kindCaps(place: Place): number {
  if (place.kind === "canopy") return 1;
  if (place.kind === "subway") return 2;
  if (place.kind === "mall") return 2;
  if (place.kind === "shelter") return 1;
  if (place.kind === "convenience") return place.gear === "sell" ? 3 : 1;
  return 1;
}

function gearBucket(place: Place): string {
  if (place.gear === "sell" || place.gear === "lend" || place.gear === "free") return "gear";
  if (place.cover === "indoor") return "indoor";
  return "canopy";
}

function bucketCap(bucket: string): number {
  if (bucket === "gear") return 4;
  if (bucket === "indoor") return 4;
  return 1;
}

async function overpass(user: LatLng): Promise<OsmElement[]> {
  const { lat, lng } = user;
  const query = `[out:json][timeout:20];
(
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
);
out center tags;`;

  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Yanxia/1.0 (rain shelter prototype)",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(18000),
      });
      if (!res.ok) {
        lastError = new Error(`overpass ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OsmElement[] };
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("overpass failed");
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
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as {
      address?: Record<string, string>;
      name?: string;
    };
    const a = data.address ?? {};
    const parts = [a.neighbourhood || a.suburb || a.quarter, a.road || data.name].filter(
      Boolean,
    );
    return [...new Set(parts)].join(" · ");
  } catch {
    return "";
  }
}

export async function loadNearby(user: LatLng): Promise<NearbyResult> {
  const [area, elements] = await Promise.all([
    reverseArea(user),
    overpass(user).catch(() => [] as OsmElement[]),
  ]);
  const candidates = elements
    .map((el) => toPlace(el, user))
    .filter((p): p is Place => Boolean(p));
  const places = pickDiverse(candidates);
  if (places.length >= 3) {
    return { area: area || "当前位置", source: "osm", places };
  }
  return {
    area: area || "",
    source: "fallback",
    places: placesAround(user),
  };
}
