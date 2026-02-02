"use client";

import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { MapControls } from "@/features/map/components/MapControls";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type FriendLocation = {
  id: string;
  name: string;
  handle: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
};

type MapSettings = {
  shareLocation: boolean;
  ghostMode: boolean;
};

type FriendsResponse = {
  friends: FriendLocation[];
  settings: MapSettings;
};

const mapColors = ["#fde68a", "#a7f3d0", "#fecdd3", "#bae6fd"];

const getMarkerColor = (name: string) =>
  mapColors[name.length % mapColors.length];

const getInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";
const DEFAULT_CENTER: [number, number] = [-73.9857, 40.7484];
const DEFAULT_ZOOM = 12;
const UPDATE_INTERVAL_MS = 60000;

export const MapCanvas = () => {
  const { token, isAuthenticated, openAuthModal, user } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [settings, setSettings] = useState<MapSettings>({
    shareLocation: false,
    ghostMode: false,
  });
  const [isMapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const friendFeatures = useMemo(
    () =>
      friends.map((friend) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [friend.longitude, friend.latitude],
        },
        properties: {
          id: friend.id,
          name: friend.name,
          handle: friend.handle,
          initial: getInitial(friend.name),
          color: getMarkerColor(friend.name),
          lastSeen: formatRelativeTime(friend.lastUpdated),
          isSelf: friend.id === user?.id,
        },
      })),
    [friends, user?.id]
  );

  const updateMapData = useCallback(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }
    const source = mapRef.current.getSource("friends") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: friendFeatures,
    });
  }, [friendFeatures, isMapReady]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !mapboxToken) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      map.addSource("friends", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "friend-clusters",
        type: "circle",
        source: "friends",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#ff8658",
          "circle-opacity": 0.85,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10,
            22,
            30,
            28,
          ],
        },
      });

      map.addLayer({
        id: "friend-cluster-count",
        type: "symbol",
        source: "friends",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#1b1a17",
        },
      });

      map.addLayer({
        id: "friend-points",
        type: "circle",
        source: "friends",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 16,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#1b1a17",
        },
      });

      map.addLayer(
        {
          id: "friend-pulse",
          type: "circle",
          source: "friends",
          filter: [
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "isSelf"], true],
          ],
          paint: {
            "circle-color": "#ffb088",
            "circle-radius": 18,
            "circle-opacity": 0.35,
            "circle-blur": 0.6,
          },
        },
        "friend-points"
      );

      map.addLayer({
        id: "friend-initials",
        type: "symbol",
        source: "friends",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "initial"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-offset": [0, 0],
        },
        paint: {
          "text-color": "#1b1a17",
        },
      });

      map.addLayer({
        id: "friend-last-seen",
        type: "symbol",
        source: "friends",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "lastSeen"],
          "text-size": 10,
          "text-offset": [0, 1.6],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#f7f4ef",
          "text-halo-color": "rgba(27,26,23,0.65)",
          "text-halo-width": 1,
        },
      });

      map.on("click", "friend-clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["friend-clusters"],
        });
        const cluster = features[0];
        if (!cluster || cluster.properties?.cluster_id == null) {
          return;
        }

        const source = map.getSource("friends") as mapboxgl.GeoJSONSource | undefined;
        if (!source) {
          return;
        }

        source.getClusterExpansionZoom(
          Number(cluster.properties.cluster_id),
          (error, zoom) => {
            if (error) {
              return;
            }
            if (zoom == null) {
              return;
            }
            if (cluster.geometry.type !== "Point") {
              return;
            }
            map.easeTo({
              center: cluster.geometry.coordinates as [number, number],
              zoom,
            });
          }
        );
      });

      map.on("mouseenter", "friend-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "friend-clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    updateMapData();
  }, [isMapReady, updateMapData]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    let frameId = 0;
    const animate = () => {
      const map = mapRef.current;
      if (!map || !map.getLayer("friend-pulse")) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      const t = (performance.now() / 1000) % 1;
      const radius = 18 + t * 10;
      const opacity = 0.4 * (1 - t);

      map.setPaintProperty("friend-pulse", "circle-radius", radius);
      map.setPaintProperty("friend-pulse", "circle-opacity", opacity);

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isMapReady]);

  const refreshFriends = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<FriendsResponse>("/map/friends", token);
      setFriends(response.friends ?? []);
      setSettings(response.settings ?? { shareLocation: false, ghostMode: false });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load map data."
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const requestPosition = useCallback(async () => {
    if (!navigator.geolocation) {
      const message = "Location services are not available in this browser.";
      setError(message);
      throw new Error(message);
    }

    try {
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 15000,
        });
      });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Location permission was denied.";
      setError(message || "Location permission was denied.");
      throw err;
    }
  }, []);

  const updateLocation = useCallback(async () => {
    if (!token) {
      return;
    }

    const position = await requestPosition();

    if (process.env.NODE_ENV !== "production") {
      console.info("[map] location captured", {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    }

    await apiPost(
      "/map/location",
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      token
    );

    if (mapRef.current) {
      mapRef.current.easeTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 13),
      });
    }
  }, [requestPosition, token]);

  const centerOnUser = useCallback(async () => {
    const position = await requestPosition();

    if (mapRef.current) {
      mapRef.current.easeTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 14),
      });
    }

    if (token && settings.shareLocation && !settings.ghostMode) {
      await apiPost(
        "/map/location",
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        token
      );
    }
  }, [requestPosition, settings.ghostMode, settings.shareLocation, token]);

  const zoomToCampus = useCallback(() => {
    mapRef.current?.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
  }, []);

  const zoomIn = useCallback(() => {
    if (!mapRef.current) {
      return;
    }
    mapRef.current.zoomTo(mapRef.current.getZoom() + 1, { duration: 200 });
  }, []);

  const zoomOut = useCallback(() => {
    if (!mapRef.current) {
      return;
    }
    mapRef.current.zoomTo(mapRef.current.getZoom() - 1, { duration: 200 });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    refreshFriends();
    const interval = window.setInterval(refreshFriends, UPDATE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshFriends, token]);

  useEffect(() => {
    if (!token || !settings.shareLocation || settings.ghostMode) {
      return;
    }

    updateLocation().catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your location."
      );
    });

    const interval = window.setInterval(() => {
      updateLocation().catch(() => {
        // Ignore silent update failures; we'll retry next cycle.
      });
    }, UPDATE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [settings.ghostMode, settings.shareLocation, token, updateLocation]);

  const handleToggleShare = async () => {
    if (!token) {
      openAuthModal("login");
      return;
    }

    try {
      const next = !settings.shareLocation;
      const response = await apiPatch<{ settings: MapSettings }>(
        "/map/settings",
        { shareLocation: next },
        token
      );
      setSettings(response.settings);
      if (next) {
        await updateLocation();
      }
    } catch (toggleError) {
      setError(
        toggleError instanceof Error && toggleError.message
          ? toggleError.message
          : "Unable to update location settings."
      );
    }
  };

  const handleToggleGhost = async () => {
    if (!token) {
      openAuthModal("login");
      return;
    }

    try {
      const response = await apiPatch<{ settings: MapSettings }>(
        "/map/settings",
        { ghostMode: !settings.ghostMode },
        token
      );
      setSettings(response.settings);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update ghost mode."
      );
    }
  };

  if (!mapboxToken) {
    return (
      <Card className="min-h-[420px]">
        <div className="space-y-3">
          <Tag tone="accent">Map setup needed</Tag>
          <p className="text-sm text-muted">
            Add `NEXT_PUBLIC_MAPBOX_TOKEN` to your web env to load the map.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_55%),radial-gradient(circle_at_bottom,rgba(255,134,88,0.2),transparent_45%)] pointer-events-none" />
      <MapControls
        isAuthenticated={isAuthenticated}
        shareLocation={settings.shareLocation}
        ghostMode={settings.ghostMode}
        onToggleShare={handleToggleShare}
        onToggleGhost={handleToggleGhost}
        onLogin={() => openAuthModal("login")}
        error={error}
        isLoading={isLoading}
      />
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <button
            type="button"
            aria-label="Zoom to my location"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-card-border/60 bg-white/85 text-ink shadow-[0_12px_30px_rgba(27,26,23,0.18)] backdrop-blur transition hover:-translate-y-0.5"
            onClick={() => {
              centerOnUser().catch(() => {
                // Error surfaced via setError.
              });
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Zoom to campus"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-card-border/60 bg-white/85 text-ink shadow-[0_12px_30px_rgba(27,26,23,0.18)] backdrop-blur transition hover:-translate-y-0.5"
            onClick={zoomToCampus}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18" />
              <path d="M4 21V9l8-4 8 4v12" />
              <path d="M9 21V12h6v9" />
            </svg>
          </button>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              aria-label="Zoom in"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-card-border/60 bg-white/85 text-ink shadow-[0_12px_30px_rgba(27,26,23,0.18)] backdrop-blur transition hover:-translate-y-0.5"
              onClick={zoomIn}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-card-border/60 bg-white/85 text-ink shadow-[0_12px_30px_rgba(27,26,23,0.18)] backdrop-blur transition hover:-translate-y-0.5"
              onClick={zoomOut}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
