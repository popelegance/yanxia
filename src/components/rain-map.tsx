import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Polyline, TileLayer } from "leaflet";
import { PLACES, USER, type Place } from "@/data/places";

type Props = {
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

export function RainMap({ selectedId, onSelect, routeTo }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const lineRef = useRef<Polyline | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let cancelled = false;
    let usedFallback = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || mapRef.current) return;

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
      }).setView([USER.lat, USER.lng], 16);

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
      L.marker([USER.lat, USER.lng], { icon: userIcon, interactive: false }).addTo(map);

      for (const place of PLACES) {
        const marker = L.marker([place.lat, place.lng], {
          icon: pinIcon(L, place, false),
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
      lineRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  useEffect(() => {
    void import("leaflet").then((L) => {
      for (const place of PLACES) {
        const marker = markersRef.current[place.id];
        if (!marker) continue;
        marker.setIcon(pinIcon(L, place, place.id === selectedId));
      }
    });
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    lineRef.current?.remove();
    lineRef.current = null;

    void import("leaflet").then((L) => {
      const current = mapRef.current;
      if (!current) return;
      if (!routeTo) {
        current.setView([USER.lat, USER.lng], 16, { animate: true });
        return;
      }
      const line = L.polyline(
        [
          [USER.lat, USER.lng],
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
  }, [routeTo]);

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
