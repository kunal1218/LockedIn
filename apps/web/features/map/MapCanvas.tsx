"use client";

import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FriendLocation } from "@lockedin/shared";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { FriendPopup } from "@/features/map/components/FriendPopup";
import { MapControls } from "@/features/map/components/MapControls";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  connectSocket,
  disconnectSocket,
  onFriendLocationUpdate,
  socket,
} from "@/lib/socket";
import { formatRelativeTime } from "@/lib/time";

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
const RING_RECENT = "#10b981";
const RING_ACTIVE = "#f59e0b";
const RING_IDLE = "#6b7280";

const getMinutesAgo = (timestamp: string) =>
  (Date.now() - new Date(timestamp).getTime()) / 60000;

const getRingColor = (timestamp: string) => {
  const minutes = getMinutesAgo(timestamp);
  if (minutes < 5) return RING_RECENT;
  if (minutes < 15) return RING_ACTIVE;
  return RING_IDLE;
};

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
  const [selectedFriend, setSelectedFriend] = useState<FriendLocation | null>(
    null
  );
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const missingFieldsLoggedRef = useRef<Set<string>>(new Set());

  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const normalizeFriend = useCallback(
    (raw: FriendLocation & {
      profile_picture_url?: string | null;
      previous_latitude?: number | string | null;
      previous_longitude?: number | string | null;
      last_updated?: string;
    }): FriendLocation => {
      const profilePictureUrl =
        raw.profilePictureUrl ?? raw.profile_picture_url ?? null;
      const bio = raw.bio ?? "";
      const previousLatitudeRaw =
        raw.previousLatitude ?? raw.previous_latitude ?? null;
      const previousLongitudeRaw =
        raw.previousLongitude ?? raw.previous_longitude ?? null;
      const lastUpdated =
        raw.lastUpdated ?? raw.last_updated ?? new Date().toISOString();

      const friend: FriendLocation = {
        id: raw.id,
        name: raw.name ?? "Unknown",
        handle: raw.handle ?? "@unknown",
        latitude: Number(raw.latitude),
        longitude: Number(raw.longitude),
        lastUpdated,
        profilePictureUrl,
        bio,
        previousLatitude:
          previousLatitudeRaw != null ? Number(previousLatitudeRaw) : null,
        previousLongitude:
          previousLongitudeRaw != null ? Number(previousLongitudeRaw) : null,
      };

      if (process.env.NODE_ENV !== "production") {
        const missing: string[] = [];
        if (!("profilePictureUrl" in raw) && !("profile_picture_url" in raw)) {
          missing.push("profilePictureUrl");
        }
        if (!("bio" in raw)) {
          missing.push("bio");
        }
        if (!("previousLatitude" in raw) && !("previous_latitude" in raw)) {
          missing.push("previousLatitude");
        }
        if (!("previousLongitude" in raw) && !("previous_longitude" in raw)) {
          missing.push("previousLongitude");
        }
        if (
          missing.length > 0 &&
          !missingFieldsLoggedRef.current.has(friend.id)
        ) {
          console.info("[map] friend missing fields", {
            id: friend.id,
            missing,
          });
          missingFieldsLoggedRef.current.add(friend.id);
        }
      }

      return friend;
    },
    []
  );

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
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, mapInstanceKey]);

  const updateMarkerElement = useCallback(
    (element: HTMLElement, friend: FriendLocation, profilePictureUrl: string | null) => {
      const ring = element.querySelector<HTMLElement>("[data-role='ring']");
      const inner = element.querySelector<HTMLElement>("[data-role='inner']");
      const label = element.querySelector<HTMLElement>("[data-role='label']");
      const pulse = element.querySelector<HTMLElement>("[data-role='pulse']");

      const ringColor = getRingColor(friend.lastUpdated);
      if (ring) {
        ring.style.border = `4px solid ${ringColor}`;
      }
      if (pulse) {
        pulse.style.border = `4px solid ${ringColor}`;
      }
      if (label) {
        label.textContent = formatRelativeTime(friend.lastUpdated);
      }

      if (inner) {
        inner.style.backgroundColor = getMarkerColor(friend.name);
        const fallback = getInitial(friend.name);
        const existingImg = inner.querySelector("img");
        if (profilePictureUrl) {
          if (existingImg) {
            existingImg.setAttribute("src", profilePictureUrl);
            existingImg.setAttribute("alt", friend.name);
          } else {
            inner.textContent = "";
            const img = document.createElement("img");
            img.src = profilePictureUrl;
            img.alt = friend.name;
            img.className = "h-full w-full object-cover";
            img.loading = "lazy";
            img.onerror = () => {
              inner.textContent = fallback;
              img.remove();
            };
            inner.appendChild(img);
          }
        } else {
          if (existingImg) {
            existingImg.remove();
          }
          inner.textContent = fallback;
        }
      }
    },
    []
  );

  const buildMarker = useCallback(
    (friend: FriendLocation) => {
      const map = mapRef.current;
      if (!map) {
        return null;
      }

      if (!Number.isFinite(friend.latitude) || !Number.isFinite(friend.longitude)) {
        return null;
      }

      const profilePictureUrl =
        friend.profilePictureUrl ??
        (friend as FriendLocation & { profile_picture_url?: string | null })
          .profile_picture_url ??
        null;
      const safeBio = friend.bio ?? "";

      const wrapper = document.createElement("div");
      wrapper.className = "relative flex h-14 w-14 items-center justify-center";
      wrapper.style.cursor = "pointer";
      wrapper.style.pointerEvents = "auto";
      wrapper.style.transition = "transform 2.6s ease";
      wrapper.style.willChange = "transform";

      const ringColor = getRingColor(friend.lastUpdated);

      if (friend.id === user?.id) {
        const pulse = document.createElement("span");
        pulse.dataset.role = "pulse";
        pulse.className = "absolute inset-0 rounded-full animate-ping";
        pulse.style.border = `4px solid ${ringColor}`;
        pulse.style.opacity = "0.3";
        pulse.style.pointerEvents = "none";
        wrapper.appendChild(pulse);
      }

      const ring = document.createElement("div");
      ring.dataset.role = "ring";
      ring.className =
        "relative flex h-14 w-14 items-center justify-center rounded-full";
      ring.style.border = `4px solid ${ringColor}`;

      const inner = document.createElement("div");
      inner.dataset.role = "inner";
      inner.className =
        "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)]";
      inner.style.backgroundColor = getMarkerColor(friend.name);

      const fallback = getInitial(friend.name);

      if (profilePictureUrl) {
        const img = document.createElement("img");
        img.src = profilePictureUrl;
        img.alt = friend.name;
        img.className = "h-full w-full object-cover";
        img.loading = "lazy";
        img.onerror = () => {
          inner.textContent = fallback;
          img.remove();
        };
        inner.appendChild(img);
      } else {
        inner.textContent = fallback;
      }

      ring.appendChild(inner);
      wrapper.appendChild(ring);

      const label = document.createElement("div");
      label.dataset.role = "label";
      label.className =
        "absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-semibold text-white/80 shadow-sm backdrop-blur";
      label.textContent = formatRelativeTime(friend.lastUpdated);
      label.style.pointerEvents = "none";
      wrapper.appendChild(label);

      wrapper.addEventListener("click", () => {
        setSelectedFriend({ ...friend, bio: safeBio, profilePictureUrl });
      });

      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([friend.longitude, friend.latitude])
        .addTo(map);

      updateMarkerElement(wrapper, friend, profilePictureUrl);

      return marker;
    },
    [updateMarkerElement, user?.id]
  );

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }

    const markerMap = markersRef.current;
    const nextIds = new Set(friends.map((friend) => friend.id));

    friends.forEach((friend) => {
      const existing = markerMap.get(friend.id);
      if (existing) {
        const element = existing.getElement();
        const profilePictureUrl =
          friend.profilePictureUrl ??
          (friend as FriendLocation & { profile_picture_url?: string | null })
            .profile_picture_url ??
          null;
        updateMarkerElement(element, friend, profilePictureUrl);
        existing.setLngLat([friend.longitude, friend.latitude]);
      } else {
        const marker = buildMarker(friend);
        if (marker) {
          markerMap.set(friend.id, marker);
        }
      }
    });

    markerMap.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markerMap.delete(id);
      }
    });
  }, [buildMarker, friends, isMapReady, updateMarkerElement]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!selectedFriend) {
      return;
    }
    const updated = friends.find((friend) => friend.id === selectedFriend.id);
    if (!updated) {
      setSelectedFriend(null);
      return;
    }
    if (updated !== selectedFriend) {
      setSelectedFriend(updated);
    }
  }, [friends, selectedFriend]);

  const requestPosition = useCallback(
    async (options?: { suppressError?: boolean }) => {
      if (!navigator.geolocation) {
        const message = "Location services are not available in this browser.";
        if (!options?.suppressError) {
          setError(message);
        }
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
        if (!options?.suppressError) {
          setError(message || "Location permission was denied.");
        }
        if (process.env.NODE_ENV !== "production") {
          console.info("[map] geolocation error", err);
        }
        throw err;
      }
    },
    []
  );

  const refreshFriends = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<FriendsResponse | FriendLocation[]>(
        "/map/friends",
        token
      );
      const rawFriends = Array.isArray(response)
        ? response
        : response.friends ?? [];
      const normalized = rawFriends.map(normalizeFriend).filter((friend) =>
        Number.isFinite(friend.latitude) && Number.isFinite(friend.longitude)
      );
      setFriends(normalized);
      if (!Array.isArray(response)) {
        setSettings(
          response.settings ?? { shareLocation: false, ghostMode: false }
        );
      }
    } catch (loadError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[map] failed to load friends", loadError);
      }
      setError("Can't load friend locations right now");

      if (user?.id) {
        try {
          const position = await requestPosition({ suppressError: true });
          const fallbackFriend = normalizeFriend({
            id: user.id,
            name: user.name ?? "You",
            handle: user.handle ?? "@you",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            lastUpdated: new Date().toISOString(),
          } as FriendLocation);
          setFriends([fallbackFriend]);
        } catch {
          // Ignore fallback errors; error message already set.
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [normalizeFriend, requestPosition, token, user?.handle, user?.id, user?.name]);

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

  const handleRetry = useCallback(() => {
    setError(null);
    setSelectedFriend(null);
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setMapReady(false);
    setMapInstanceKey((prev) => prev + 1);
    refreshFriends();
  }, [refreshFriends]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    connectSocket(token);

    const unsubscribe = onFriendLocationUpdate((data) => {
      setFriends((prev) => {
        const index = prev.findIndex((friend) => friend.id === data.userId);
        if (index < 0) {
          return prev;
        }
        const current = prev[index];
        const next = [...prev];
        next[index] = {
          ...current,
          latitude: data.latitude,
          longitude: data.longitude,
          lastUpdated: data.timestamp,
          previousLatitude: current.latitude,
          previousLongitude: current.longitude,
        };
        return next;
      });
    });

    const handleConnect = () => {
      refreshFriends();
    };

    socket.on("connect", handleConnect);

    return () => {
      unsubscribe();
      socket.off("connect", handleConnect);
      disconnectSocket();
    };
  }, [refreshFriends, token]);

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
        onRetry={handleRetry}
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
      {selectedFriend && (
        <FriendPopup
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
        />
      )}
    </div>
  );
};
