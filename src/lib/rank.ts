import type { Intent } from "@/lib/intent";
import type { Place } from "@/data/places";
import { WEATHER } from "@/data/weather";

export function scorePlace(place: Place, intent: Intent): number {
  let score = 40 - place.walkMin * 7;
  if (!place.openNow) score -= 80;
  if (place.floodOnRoute) score -= 28;

  if (intent === "shelter") {
    if (place.cover === "indoor") score += 36;
    else score += 6;
    if (place.canSit) score += 10;
    if (place.kind === "shelter" || place.kind === "subway") score += 8;
    if (WEATHER.minutesUntilLighter <= 4 && place.cover === "canopy") score += 18;
  } else {
    if (place.gear === "sell" || place.gear === "lend" || place.gear === "free") {
      score += 48;
    } else if (place.gear === "unknown") {
      score += 6;
    } else {
      score -= 40;
    }
    if (place.cover === "canopy") score -= 16;
  }

  if (place.walkMin > WEATHER.minutesUntilLighter) {
    score -= 8;
  }

  return score;
}

export function rankPlaces(places: Place[], intent: Intent): Place[] {
  return [...places].sort((a, b) => scorePlace(b, intent) - scorePlace(a, intent));
}

export function adviceLine(top: Place | undefined, intent: Intent): string {
  if (!top) return "附近暂无可用点。";
  if (intent === "shelter") {
    return `最近能进的${top.cover === "indoor" ? "室内" : "有顶点"}：${top.name}，步行 ${top.walkMin} 分钟。${WEATHER.summary}`;
  }
  return `若要买雨具离开：优先 ${top.name}，步行 ${top.walkMin} 分钟。${top.gearNote}`;
}
