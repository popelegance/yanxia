import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Polyline, TileLayer } from "leaflet";
import type { Place } from "@/data/places";
import type { LatLng } from "@/lib/geo";

type Props = {
  user: LatLng;
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  routeTo: Place | null;
};

/** 1×1 透明图：失败瓦片不再画出「API KEY REQUIRED」大字 */
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const ESRI_DARK =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function RainMap({ user, places, selectedId, onSelect, routeTo }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const userMarkerRef = useRef<Marker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  const userRef = useRef(user);
  const placesRef = useRef(places);
  const selectedRef = useRef(selectedId);
  onSelectRef.current = onSelect;
  userRef.current = user;
  placesRef.current = places;
  selectedRef.current = selectedId;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let cancelled = false;
    let usedFallback = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || mapRef.current) return;

      const start = userRef.current;
      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
      }).setView([start.lat, start.lng], 16);

      const esri = L.tileLayer(ESRI_DARK, {
        maxZoom: 16,
        errorTileUrl: BLANK,
        className: "yanxia-tiles",
      });

      esri.on("tileerror", () => {
        if (usedFallback || cancelled) return;
        usedFallback = true;
        map.removeLayer(esri);
        const osm = L.tileLayer(OSM, {
          maxZoom: 19,
          errorTileUrl: BLANK,
          className: "yanxia-tiles yanxia-osm",
        });
        osm.addTo(map);
        tilesRef.current = osm;
      });

      esri.addTo(map);
      tilesRef.current = esri;

      const userIcon = L.divIcon({
        className: "",
        html: `<div class="yanxia-user"><span></span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      userMarkerRef.current = L.marker([start.lat, start.lng], {
        icon: userIcon,
        interactive: false,
        zIndexOffset: 400,
      }).addTo(map);

      for (const place of placesRef.current) {
        const marker = L.marker([place.lat, place.lng], {
          icon: pinIcon(L, place, place.id === selectedRef.current),
          zIndexOffset: 200,
        }).addTo(map);
        marker.on("click", () => onSelectRef.current(place.id));
        markersRef.current[place.id] = marker;
      }

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
      userMarkerRef.current = null;
      lineRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = userMarkerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([user.lat, user.lng]);
    if (!routeTo) {
      map.setView([user.lat, user.lng], 16, { animate: true });
    }
  }, [user.lat, user.lng, routeTo]);

  useEffect(() => {
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      const nextIds = new Set(places.map((p) => p.id));
      for (const id of Object.keys(markersRef.current)) {
        if (nextIds.has(id)) continue;
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
      for (const place of places) {
        const existing = markersRef.current[place.id];
        if (existing) {
          existing.setLatLng([place.lat, place.lng]);
          existing.setIcon(pinIcon(L, place, place.id === selectedId));
          continue;
        }
        const marker = L.marker([place.lat, place.lng], {
          icon: pinIcon(L, place, place.id === selectedId),
          zIndexOffset: 200,
        }).addTo(map);
        marker.on("click", () => onSelectRef.current(place.id));
        markersRef.current[place.id] = marker;
      }
    });
  }, [places, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    lineRef.current?.remove();
    lineRef.current = null;

    void import("leaflet").then((L) => {
      const current = mapRef.current;
      if (!current) return;
      if (!routeTo) {
        current.setView([userRef.current.lat, userRef.current.lng], 16, { animate: true });
        return;
      }
      const line = L.polyline(
        [
          [userRef.current.lat, userRef.current.lng],
          [routeTo.lat, routeTo.lng],
        ],
        {
          color: "#c5cdd6",
          weight: 3,
          opacity: 0.85,
          dashArray: "6 8",
        },
      ).addTo(current);
      lineRef.current = line;
      current.fitBounds(line.getBounds().pad(0.35), { animate: true });
    });
  }, [routeTo, user.lat, user.lng]);

  return <div ref={elRef} className="absolute inset-0 z-0 bg-bg" />;
}

function pinIcon(
  L: typeof import("leaflet"),
  place: Place,
  active: boolean,
): import("leaflet").DivIcon {
  const tone =
    place.cover === "indoor" ? "indoor" : place.gear !== "none" ? "gear" : "canopy";
  return L.divIcon({
    className: "",
    html: `<div class="yanxia-pin ${tone} ${active ? "active" : ""}" aria-hidden="true"><i></i></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
