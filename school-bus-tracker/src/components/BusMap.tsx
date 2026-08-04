"use client";
import { useEffect, useRef } from "react";

interface BusPosition {
  lat: number;
  lng: number;
  heading?: number;
}

interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface BusMapProps {
  busPosition?: BusPosition;
  stops?: Stop[];
  routeCoords?: [number, number][];
  height?: string;
}

export default function BusMap({
  busPosition = { lat: -6.8, lng: 39.28 },
  stops = [],
  routeCoords = [],
  height = "400px",
}: BusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const busMarkerRef = useRef<unknown>(null);
  const initializingRef = useRef(false); // synchronous guard

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapRef.current || initializingRef.current) return;

    initializingRef.current = true;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled) return; // effect was cleaned up before import resolved

      if (!containerRef.current) {
        initializingRef.current = false;
        return;
      }

      // Defensive: clear any stale Leaflet state left on the DOM node
      // (can happen with Strict Mode / Fast Refresh remounts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (containerRef.current as any)._leaflet_id;
      }

      // Fix default icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current).setView(
        [busPosition.lat, busPosition.lng],
        14,
      );
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
      }).addTo(map);

      const busIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:36px; height:36px; border-radius:50%; 
          background:#F5A623; border:3px solid #0F2B5B;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.25); font-size:18px">🚌</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const busMarker = L.marker([busPosition.lat, busPosition.lng], {
        icon: busIcon,
      })
        .addTo(map)
        .bindPopup("<b>School Bus</b><br>Live position");
      busMarkerRef.current = busMarker;

      if (routeCoords.length > 1) {
        L.polyline(routeCoords, {
          color: "#0F2B5B",
          weight: 3,
          opacity: 0.7,
          dashArray: "6,4",
        }).addTo(map);
      }

      const stopIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#0D9488;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      stops.forEach((s) => {
        L.marker([s.lat, s.lng], { icon: stopIcon })
          .addTo(map)
          .bindPopup(`<b>${s.name}</b>`);
      });

      initializingRef.current = false;
    });

    return () => {
      cancelled = true;
      initializingRef.current = false;
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove();
        mapRef.current = null;
      }
      busMarkerRef.current = null;
      // Extra safety: strip any leftover Leaflet id from the container
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (containerRef.current && (containerRef.current as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (containerRef.current as any)._leaflet_id;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update bus marker on position change
  useEffect(() => {
    if (!busMarkerRef.current || !mapRef.current) return;
    import("leaflet").then((L) => {
      const marker = busMarkerRef.current as any;
      const map = mapRef.current as any;
      const latLng = L.latLng(busPosition.lat, busPosition.lng);
      marker.setLatLng(latLng);
      map.setView(latLng, map.getZoom(), { animate: true });
    });
  }, [busPosition]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: "12px" }}
    />
  );
}