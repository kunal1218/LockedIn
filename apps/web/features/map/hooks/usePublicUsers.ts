"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUserLocation } from "@lockedin/shared";
import { apiGet } from "@/lib/api";

type UsePublicUsersParams = {
  token?: string | null;
  center: { latitude: number; longitude: number } | null;
  radiusMeters?: number;
  refreshMs?: number;
  enabled?: boolean;
};

export const usePublicUsers = ({
  token,
  center,
  radiusMeters = 5000,
  refreshMs = 10000,
  enabled = true,
}: UsePublicUsersParams) => {
  const [publicUsers, setPublicUsers] = useState<PublicUserLocation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicUsers = useCallback(async () => {
    if (!token || !center || !enabled) {
      setPublicUsers([]);
      return;
    }
    try {
      const response = await apiGet<{ publicUsers: PublicUserLocation[] }>(
        `/map/public-nearby?latitude=${center.latitude}&longitude=${center.longitude}&radius=${radiusMeters}`,
        token
      );
      setPublicUsers(response.publicUsers ?? []);
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[map] failed to load public users", err);
      }
      setError("Unable to load public users.");
    }
  }, [center, enabled, radiusMeters, token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchPublicUsers();
    }, 0);
    if (!token || !center || !enabled) {
      return () => window.clearTimeout(timeout);
    }
    const interval = window.setInterval(fetchPublicUsers, refreshMs);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [center, enabled, fetchPublicUsers, refreshMs, token]);

  return { publicUsers, error, refetch: fetchPublicUsers };
};
