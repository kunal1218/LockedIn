"use client";

import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/Button";
import { useAuth } from "@/features/auth";
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
  const { token, isAuthenticated, openAuthModal } = useAuth();
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
        },
      })),
    [friends]
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

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
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

  const updateLocation = useCallback(async () => {
    if (!token) {
      return;
    }

    if (!navigator.geolocation) {
      setError("Location services are not available in this browser.");
      return;
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 15000,
      });
    });

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
  }, [token]);

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
        toggleError instanceof Error
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
    <Card className="relative min-h-[520px] h-[520px] overflow-hidden p-0 !bg-transparent !backdrop-blur-none">
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_55%),radial-gradient(circle_at_bottom,rgba(255,134,88,0.2),transparent_45%)] pointer-events-none" />
      <div className="absolute left-0 top-0 z-10 flex flex-col gap-4 p-6 pointer-events-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Tag tone="accent">Live map</Tag>
            <h2 className="mt-3 font-display text-2xl font-semibold text-white">
              Friend Finder
            </h2>
            <p className="text-sm text-white/70">
              Snap-map vibes for your campus circle.
            </p>
          </div>
          {!isAuthenticated && (
            <Button
              requiresAuth={false}
              className="pointer-events-auto"
              onClick={() => openAuthModal("login")}
            >
              Log in
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:max-w-xs">
          <div className="rounded-2xl border border-white/10 bg-ink/70 px-4 py-3 text-xs text-white/70 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Share my location</span>
              <button
                type="button"
                className={`pointer-events-auto relative h-6 w-11 rounded-full transition ${
                  settings.shareLocation ? "bg-accent" : "bg-white/20"
                }`}
                onClick={handleToggleShare}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                    settings.shareLocation ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-2">
              {settings.shareLocation
                ? "Your friends can see you for the next 30 minutes."
                : "Stay hidden until you turn sharing on."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-ink/70 px-4 py-3 text-xs text-white/70 shadow-[0_14px_30px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-white">Ghost mode</span>
              <button
                type="button"
                className={`pointer-events-auto rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  settings.ghostMode
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-white/20 text-white/80 hover:border-white/40"
                }`}
                onClick={handleToggleGhost}
              >
                {settings.ghostMode ? "Ghosted" : "Go ghost"}
              </button>
            </div>
            <p className="mt-2">
              {settings.ghostMode
                ? "You are invisible on the map right now."
                : "Hide instantly without toggling sharing off."}
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-ink/70 px-4 py-3 text-xs text-white/70">
              Loading friend locations...
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
