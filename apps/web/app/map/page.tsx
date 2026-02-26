"use client";

import { useSearchParams } from "next/navigation";
import { MapCanvas } from "@/features/map";

export default function MapPage() {
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embedded") === "1";

  return (
    <div
      className={
        isEmbedded
          ? "relative h-[100svh] min-h-[100vh] w-full overflow-hidden"
          : "relative h-[calc(100svh-96px)] min-h-[calc(100vh-96px)] w-full overflow-hidden"
      }
    >
      <MapCanvas embedded={isEmbedded} />
    </div>
  );
}
